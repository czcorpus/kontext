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

import asyncio
import logging
import os
from typing import List, Optional, Tuple, Union
import uuid

import aiofiles.os
import bgcalc
import plugins
import settings
from conclib.calc import (
    check_result, del_silent, extract_manatee_error, find_cached_conc_base,
    wait_for_conc)
from conclib.calc.base import GeneralWorker, ConcRegistration
from conclib.common import KConc
from conclib.empty import InitialConc
from conclib.errors import ConcCalculationStatusException
from conclib.pyconc import PyConc
from corplib.corpus import AbstractKCorpus
from plugin_types.conc_cache import ConcCacheStatus

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)
CONC_REGISTER_WAIT_LIMIT = 20  # client may be forced to wait loger due to other tasks
CONC_BG_SYNC_ALIGNED_CORP_THRESHOLD = 50000000
CONC_BG_SYNC_SINGLE_CORP_THRESHOLD = 2000000000


async def _get_async_conc(corp: AbstractKCorpus, user_id, q, cutoff, minsize) -> KConc:
    """
    """
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
    status = await cache_map.get_calc_status(corp.cache_key, q, cutoff)
    if not status or status.error:
        worker = bgcalc.calc_backend_client(settings)
        task = ConcRegistration(task_id=None)  # task ID will be filled by workerurey
        reg_args = await task.run(corp.portable_ident, corp.cache_key, q, cutoff)
        if not reg_args.get('already_running', False):
            worker.send_task_sync(
                'conc_calculate', object.__class__,
                args=(reg_args, user_id, corp.portable_ident, corp.cache_key, q, cutoff),
                soft_time_limit=TASK_TIME_LIMIT)

    conc_avail = await wait_for_conc(
        cache_map=cache_map, corp_cache_key=corp.cache_key, q=q, cutoff=cutoff, minsize=minsize)
    if conc_avail:
        return PyConc(corp, 'l', await cache_map.readable_cache_path(corp.cache_key, q, cutoff))
    else:
        return InitialConc(corp, await cache_map.readable_cache_path(corp.cache_key, q, cutoff))


async def get_bg_conc(
        corp: AbstractKCorpus,
        user_id: int,
        q: Tuple[str, ...],
        corp_cache_key: Optional[str],
        cutoff: int,
        calc_from: int,
        minsize: int,
        force_wait: bool = False,
) -> KConc:
    """
    arguments:
    calc_from - from which operation idx (inclusive) we have to calculate respective results
    """
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)

    status = await cache_map.get_calc_status(corp_cache_key, q, cutoff)
    if status and not status.finished:  # the calc is already running, the client has to wait and check regularly
        return InitialConc(corp, status.cachefile)
    # let's create cache records of the operations we'll have to perform
    if calc_from < len(q):
        for i in range(calc_from, len(q)):
            status = await cache_map.add_to_map(corp_cache_key, q[:i + 1], cutoff, ConcCacheStatus(), overwrite=True)
            # the file cannot be valid as otherwise, calc_from would be higher
            if await aiofiles.os.path.isfile(status.cachefile):
                await del_silent(status.cachefile)
                logging.getLogger(__name__).warning(
                    f'Removed unbound conc. cache file {status.cachefile}')
        worker = bgcalc.calc_backend_client(settings)
        result = await worker.send_task(
            'conc_sync_calculate', object.__class__,
            (user_id, corp.corpname, corp.subcorpus_id, corp_cache_key, q, cutoff),
            time_limit=TASK_TIME_LIMIT)
        if force_wait:
            await result.get(timeout=TASK_TIME_LIMIT)
    # for smaller concordances/corpora there is a chance the data
    # is ready in a few seconds - let's try this:

    _, finished = await check_result(
        cache_map=cache_map, corp_cache_key=corp_cache_key, q=q, cutoff=cutoff, minsize=minsize)
    if finished:
        return PyConc(corp, 'l', await cache_map.readable_cache_path(corp_cache_key, q, cutoff))
    else:
        # return empty yet unfinished concordance to make the client watch the calculation
        return InitialConc(corp, await cache_map.readable_cache_path(corp_cache_key, q, cutoff))


async def _normalize_permissions(path: str):
    if await aiofiles.os.path.isfile(path) and os.getuid() == (await aiofiles.os.stat(path)).st_uid:
        os.chmod(path, 0o664)


async def _get_sync_conc(
        worker, corp: AbstractKCorpus, q: Tuple[str, ...], cutoff: int) -> PyConc:
    """
    Calculate a concordance using worker functionality but on the webserver.
    Return completed concordance (i.e. block until finished).
    """
    status = worker.create_new_calc_status()
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
    try:
        conc = worker.compute_conc(corp, q, cutoff)
        conc.sync()  # wait for the computation to finish
        status.update(
            finished=True,
            readable=True,
            concsize=conc.size(),
            fullsize=conc.fullsize())
        status.recalc_relconcsize(corp)
        status.arf = round(conc.compute_ARF(), 2) if not corp.subcorpus_id else None
        status = await cache_map.add_to_map(corp.cache_key, q[:1], cutoff, status)
        await _normalize_permissions(status.cachefile)  # in case the file already exists
        conc.save(status.cachefile)
        await _normalize_permissions(status.cachefile)
        await cache_map.add_to_map(corp.cache_key, q[:1], cutoff, status, overwrite=True)
        # update size in map file
        return conc
    except Exception as e:
        # Please note that there is no need to clean any mess
        # (unfinished cached concordance etc.)
        # here as this is performed by _get_cached_conc()
        # function in case it detects a problem.
        manatee_err = extract_manatee_error(e)
        status.update(
            finished=True,
            concsize=0,
            error=manatee_err if manatee_err else e)
        status = await cache_map.add_to_map(corp.cache_key, q[:1], cutoff, status, overwrite=True)
        raise status.normalized_error


def _should_be_bg_query(corp: AbstractKCorpus, query: Tuple[str, ...], asnc: int) -> bool:
    if asnc > 1:
        return True
    return (len(query) > 1 and
            asnc == 1 and
            (query[1][0] == 'X' and corp.size > CONC_BG_SYNC_ALIGNED_CORP_THRESHOLD
             or corp.size > CONC_BG_SYNC_SINGLE_CORP_THRESHOLD))


async def get_conc(
        corp: AbstractKCorpus,
        user_id: int,
        q: Optional[Union[List[str], Tuple[str, ...]]] = None,
        fromp: int = 0,
        pagesize: int = 0,
        asnc: int = 0,
        cutoff: int = 0) -> KConc:
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
    asnc -- sets level of asynchronicity
        0 = blocking mode - wait until the whole concordance is ready
        1 = use Manatee's async mode (run on Worker) - i.e. wait for some minimal readable concordance
            and continue in background
        2 = return InitialConc and leave whole calculation on Worker
    cutoff -- max. concordance size (if > 0 then we work only with a respective part of possible full concordance)
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
    # try to locate concordance in cache
    lock = asyncio.Lock()
    async with lock:
        # 1st coroutine goes through (there is no conc cache yet)
        # 2nd goes through, but it already finds an open cache entry so it 'wait_for_conc()' inside the lock
        # >= 3 cannot enter but once it can the concordance is already avail. so there is no unnecessary lag here
        # (it doesn't matter whether a coroutine waits here or in 'wait_for_conc()')
        calc_from, conc = await find_cached_conc_base(corp, q, cutoff, minsize)
    if not conc and q[0][0] == 'R':  # online sample
        q_copy = list(q)
        q_copy[0] = q[0][1:]
        q_copy = tuple(q_copy)
        await find_cached_conc_base(corp, q_copy, cutoff, -1)
        # TODO this branch has no use (unless we want to revive online sample func)

    # move mid-sized aligned corpora or large non-aligned corpora to background
    if _should_be_bg_query(corp, q, asnc):
        conc = await get_bg_conc(
            corp=corp, user_id=user_id, q=q, corp_cache_key=corp.cache_key, cutoff=cutoff,
            calc_from=calc_from, minsize=minsize)
    else:
        worker = GeneralWorker()
        if isinstance(conc, InitialConc):
            calc_from = 1
            # use Manatee asynchronous conc. calculation (= show 1st page once it's avail.)
            if asnc and len(q) == 1:
                conc = await _get_async_conc(corp=corp, user_id=user_id, q=q, cutoff=cutoff, minsize=minsize)
            # do the calc here and return (OK for small to mid-sized corpora without alignments)
            else:
                conc = await _get_sync_conc(
                    worker=worker, corp=corp, q=q, cutoff=cutoff)
        # save additional concordance actions to cache (e.g. sample)
        for act in range(calc_from, len(q)):
            command, args = q[act][0], q[act][1:]
            conc.exec_command(command, args)
            cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
            curr_status = await cache_map.get_calc_status(corp.cache_key, q[:act + 1], cutoff)
            if curr_status and not curr_status.finished:
                ready = await wait_for_conc(
                    cache_map=cache_map, corp_cache_key=corp.cache_key, q=q[:act + 1], cutoff=cutoff, minsize=-1)
                if not ready:
                    raise ConcCalculationStatusException(
                        'Wait for concordance operation failed')
            elif not curr_status:
                calc_status = worker.create_new_calc_status()
                calc_status.concsize = conc.size()
                calc_status = await cache_map.add_to_map(corp.cache_key, q[:act + 1], cutoff, calc_status)
                conc.save(calc_status.cachefile)
                await _normalize_permissions(calc_status.cachefile)
                # TODO can we be sure here that conc is finished even if its not the first query op.?
                await cache_map.update_calc_status(
                    corp.cache_key, q[:act + 1], cutoff, finished=True, readable=True, concsize=conc.size())
    return conc
