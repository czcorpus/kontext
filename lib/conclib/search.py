# Copyright (c) 2003-2014  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import logging
from typing import Tuple, Optional, Union
import os

import settings
import plugins
from plugins.abstract.conc_cache import ConcCacheStatus
from conclib.pyconc import PyConc
from conclib.empty import InitialConc
from conclib.calc.base import GeneralWorker
from conclib.calc import find_cached_conc_base, wait_for_conc, del_silent
from conclib.errors import ConcCalculationStatusException
from corplib.corpus import KCorpus
import bgcalc
import manatee


TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)
CONC_REGISTER_TASK_LIMIT = 5  # task itself should be super-fast
CONC_REGISTER_WAIT_LIMIT = 20  # client may be forced to wait loger due to other tasks
CONC_BG_SYNC_ALIGNED_CORP_THRESHOLD = 50000000
CONC_BG_SYNC_SINGLE_CORP_THRESHOLD = 2000000000


def _get_async_conc(corp, user_id, q, subchash, samplesize, minsize):
    """
    """
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
    status = cache_map.get_calc_status(subchash, q)
    if not status or status.error:
        app = bgcalc.calc_backend_client(settings)
        ans = app.send_task('conc_register', (user_id, corp.corpname, getattr(corp, 'subcname', None),
                                              subchash, q, samplesize, TASK_TIME_LIMIT),
                            time_limit=CONC_REGISTER_TASK_LIMIT)
        ans.get(timeout=CONC_REGISTER_WAIT_LIMIT)
    conc_avail = wait_for_conc(cache_map=cache_map, subchash=subchash, q=q, minsize=minsize)
    if conc_avail:
        return PyConc(corp, 'l', cache_map.readable_cache_path(subchash, q))
    else:
        return InitialConc(corp, cache_map.readable_cache_path(subchash, q))


def _get_bg_conc(corp: KCorpus, user_id: int, q: Tuple[str, ...], subchash: Optional[str], samplesize: int,
                 calc_from: int, minsize: int) -> Union[PyConc, InitialConc]:
    """
    arguments:
    calc_from - from which operation idx (inclusive) we have to calculate respective results
    """
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)

    status = cache_map.get_calc_status(subchash, q)
    if status and not status.finished:  # the calc is already running, the client has to wait and check regularly
        return InitialConc(corp, status.cachefile)
    # let's create cache records of the operations we'll have to perform
    if calc_from < len(q):
        for i in range(calc_from, len(q)):
            status = cache_map.add_to_map(subchash, q[:i + 1], ConcCacheStatus(), overwrite=True)
            if os.path.isfile(status.cachefile):  # the file cannot be valid as otherwise, calc_from would be higher
                del_silent(status.cachefile)
                logging.getLogger(__name__).warning(f'Removed unbound conc. cache file {status.cachefile}')
        app = bgcalc.calc_backend_client(settings)
        app.send_task('conc_sync_calculate',
                      (user_id, corp.corpname, getattr(corp, 'subcname', None), subchash, q, samplesize),
                      time_limit=TASK_TIME_LIMIT)
    # for smaller concordances/corpora there is a chance the data
    # is ready in a few seconds - let's try this:
    conc_avail = wait_for_conc(cache_map=cache_map, subchash=subchash, q=q, minsize=minsize)
    if conc_avail:
        return PyConc(corp, 'l', cache_map.readable_cache_path(subchash, q))
    else:
        # return empty yet unfinished concordance to make the client watch the calculation
        return InitialConc(corp, cache_map.readable_cache_path(subchash, q))


def _get_sync_conc(worker, corp, q, save, subchash, samplesize):
    status = worker.create_new_calc_status()
    conc = worker.compute_conc(corp, q, samplesize)
    conc.sync()  # wait for the computation to finish
    status.finished = True
    status.concsize = conc.size()
    if save:
        cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
        status = cache_map.add_to_map(subchash, q[:1], status)
        conc.save(status.cachefile)
        if os.getuid() == os.stat(status.cachefile).st_uid:
            os.chmod(status.cachefile, 0o664)
        # update size in map file
        cache_map.update_calc_status(subchash, q[:1], concsize=conc.size(), readable=True, finished=True)
    return conc


def _should_be_bg_query(corp: KCorpus, query: Tuple[str, ...], asnc: int) -> bool:
    return (len(query) > 1 and
            asnc == 1 and
            (query[1][0] == 'X' and corp.size > CONC_BG_SYNC_ALIGNED_CORP_THRESHOLD
             or corp.size() > CONC_BG_SYNC_SINGLE_CORP_THRESHOLD))


def get_conc(corp: KCorpus, user_id, q: Tuple[str, ...] = None, fromp=0, pagesize=0, asnc=0, save=0, samplesize=0
             ) -> Union[manatee.Concordance, InitialConc]:
    """
    Get/calculate a concordance. The function always tries to fetch as complete
    result as possible (related to the 'q' tuple) from cache. The rest is calculated
    in different ways depending on contents of 'q' and also on the 'asnc' argument
    (if 0 then the conc is always calculated synchronously and within the same process,
    if 1 then the calculation can involve a) background calculation based on Manatee's
    asynchronous/continuous concordance fetching or b) background calculation with
    no continuous data fetching (i.e. user waits and then the whole result is avail.).

    corp -- a respective KCorpus
    user_id -- database user ID
    q -- a tuple/list containing an extended query representation
         (e.g. ['aword,[] within <doc id="foo" />', 'p0 ...'])
    fromp -- a page offset
    pagesize -- a page size (in lines, related to 'fromp')
    asnc -- if 1 then KonText spawns an asynchronous process to calculate the concordance
            and will provide results as they are ready
    save -- specifies whether to use a caching mechanism
    samplesize -- ?
    """
    if not q:
        return InitialConc(corp=corp, finished=True)
    # complete bg calc. without continuous data fetching => must accept 0
    if _should_be_bg_query(corp, q, asnc):
        minsize = 0
    elif len(q) > 1 or asnc == 0:  # conc with additional ops. needs whole concordance
        minsize = -1
    else:
        minsize = fromp * pagesize  # happy case for a user
    subchash = getattr(corp, 'subchash', None)
    conc = InitialConc(corp=corp, finished=True)
    # try to locate concordance in cache
    if save:
        calc_from, conc = find_cached_conc_base(corp, subchash, q, minsize)
        if calc_from == len(q):
            save = 0
        if not conc and q[0][0] == 'R':  # online sample
            q_copy = list(q)
            q_copy[0] = q[0][1:]
            q_copy = tuple(q_copy)
            t, c = find_cached_conc_base(corp, subchash, q_copy, -1)
            if c:
                fullsize = c.fullsize()  # TODO fullsize ???
    else:
        calc_from = 1
        asnc = 0

    # move mid-sized aligned corpora or large non-aligned corpora to background
    if _should_be_bg_query(corp, q, asnc):
        minsize = fromp * pagesize
        conc = _get_bg_conc(corp=corp, user_id=user_id, q=q, subchash=subchash, samplesize=samplesize,
                            calc_from=calc_from, minsize=minsize)
    else:
        worker = GeneralWorker()
        if isinstance(conc, InitialConc):
            calc_from = 1
            # use Manatee asynchronous conc. calculation (= show 1st page once it's avail.)
            if asnc and len(q) == 1:
                conc = _get_async_conc(corp=corp, user_id=user_id, q=q, subchash=subchash,
                                       samplesize=samplesize, minsize=minsize)

            # do the calc here and return (OK for small to mid sized corpora without alignments)
            else:
                conc = _get_sync_conc(worker=worker, corp=corp, q=q, save=save, subchash=subchash,
                                      samplesize=samplesize)
        # save additional concordance actions to cache (e.g. sample)
        for act in range(calc_from, len(q)):
            command, args = q[act][0], q[act][1:]
            conc.exec_command(command, args)
            if command in 'gae':  # user specific/volatile actions, cannot save
                save = 0
            if save:
                cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
                curr_status = cache_map.get_calc_status(subchash, q[:act + 1])
                if curr_status and not curr_status.finished:
                    ready = wait_for_conc(cache_map=cache_map,
                                          subchash=subchash, q=q[:act + 1], minsize=-1)
                    if not ready:
                        raise ConcCalculationStatusException(
                            'Wait for concordance operation failed')
                elif not curr_status:
                    calc_status = worker.create_new_calc_status()
                    calc_status.concsize = conc.size()
                    calc_status = cache_map.add_to_map(subchash, q[:act + 1], calc_status)
                    conc.save(calc_status.cachefile)
                    if os.getuid() == os.stat(calc_status.cachefile).st_uid:
                        os.chmod(calc_status.cachefile, 0o664)
                    # TODO can we be sure here that conc is finished even if its not the first query op.?
                    cache_map.update_calc_status(
                        subchash, q[:act + 1], finished=True, readable=True, concsize=conc.size())
    return conc
