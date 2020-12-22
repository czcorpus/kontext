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

from typing import Tuple, Optional
import os
import time
import logging
import sys

import settings
import plugins
from plugins.abstract.conc_cache import AbstractConcCache, CalcStatus
from corplib import CorpusManager, is_subcorpus, corp_mtime as corplib_corp_mtime
from conclib.empty import EmptyConc
import manatee
from conclib.pyconc import PyConc
from conclib.calc.base import GeneralWorker
from conclib.calc.errors import ConcCalculationStatusException
import bgcalc

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


def _contains_shuffle_seq(q_ops: Tuple[str, ...]) -> bool:
    """
    Tests whether the provided query sequence contains a subsequence
    of 'shuffle' operation (e.g. on ['foo', 'bar', 'f', 'f', 'something'] returns True)
    """
    prev_shuffle = False
    for item in q_ops:
        if item == 'f':
            if prev_shuffle:
                return True
            else:
                prev_shuffle = True
        else:
            prev_shuffle = False
    return False


def del_silent(path: str):
    """
    Remove a file without complaining in case of a error (OSError, TypeError)
    """
    try:
        os.remove(path)
    except (OSError, TypeError) as ex:
        logging.getLogger(__name__).warning(f'del_silent problem: {ex} (file: {path}')


def cancel_async_task(cache_map: AbstractConcCache, subchash: Optional[str], q: Tuple[str, ...]):
    cachefile = cache_map.cache_file_path(subchash, q)
    status = cache_map.get_calc_status(subchash, q)
    if status:
        try:
            if status.task_id:
                app = bgcalc.calc_backend_client(settings)
                app.control.revoke(status.task_id, terminate=True, signal='SIGKILL')
        except IOError:
            pass
    cache_map.del_entry(subchash, q)
    del_silent(cachefile)


def wait_for_conc(cache_map: AbstractConcCache, q: Tuple[str, ...], subchash: Optional[str], minsize: int) -> bool:
    """
    Find a conc. calculation record in cache (matching provided subchash and query)
    and wait until a result is available. The behavior is modified by 'minsize' (see below).

    arguments:
    minsize -- min. size of concordance we accept:
                1) > 0  => we want at least some lines to be available => short time limit
                2) == -1 => we want the whole concordance to be ready => longer time limit
                3) == 0 => we only care whether the file exists => sort time limit
    """
    time_limit = 5 if minsize >= 0 else 30
    t0 = t1 = time.time()
    i = 1
    has_min_result, finished = _check_result(cache_map, q, subchash, minsize)
    while not (finished or has_min_result) and t1 - t0 < time_limit:
        time.sleep(i * 0.1)
        i += 1
        t1 = time.time()
        has_min_result, finished = _check_result(cache_map, q, subchash, minsize)
    if not has_min_result:
        if finished:  # cache vs. filesystem mismatch
            cache_map.del_entry(subchash, q)
        return False
    return True


def _check_result(cache_map: AbstractConcCache, q: Tuple[str, ...], subchash: Optional[str],
                  minsize: int) -> Tuple[bool, bool]:
    """
    Check for result status while validating calculation
    status. In case of an error an Exception can be thrown.
    It is perfectly fine to not find an entry for some
    subchash+q combination (in such case, False, False is returned).

    return:
    2-tuple ["has min. acceptable result", "is finished"]
    Return True if a specific concordance calculation
    has not reached a minimal viewable size yet.
    Otherwise it returns False (= we can show a partial
    result).

    In case the calculation finished due to an error
    the function throws a ConcCalculationStatusException.
    """
    status = cache_map.get_calc_status(subchash, q)
    if status is None:
        return False, False
    err = status.test_error(TASK_TIME_LIMIT)
    if err is not None:
        cache_map.del_full_entry(subchash, q)
        raise err
    return status.has_some_result(minsize=minsize), status.finished


def find_cached_conc_base(corp: manatee.Corpus, subchash: Optional[str], q: Tuple[str, ...],
                          minsize: int) -> Tuple[Optional[int], manatee.Concordance]:
    """
    Load a concordance from cache starting from a complete operation q[:],
    then trying q[:-1], q[:-2], q:[:-i] etc. A possible found concordance can be
    used to skip calculation of already available operations q[:-i].

    arguments:
    minsize -- a minimum concordance size to return immediately (synchronously); please
                note that unlike wait_for_conc here we accept also 0

    returns:
    a 2-tuple [an index within 'q' where to start with non-cached results], [a concordance instance]
    """
    start_time = time.time()
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
    cache_map.refresh_map()
    calc_status = cache_map.get_calc_status(subchash, q)
    if calc_status:
        if calc_status.error is None:
            corp_mtime = corplib_corp_mtime(corp)
            if calc_status.created - corp_mtime < 0:
                logging.getLogger(__name__).warning(
                    'Removed outdated cache file (older than corpus indices)')
                cache_map.del_full_entry(subchash, q)
        else:
            logging.getLogger(__name__).warning(
                'Removed failed calculation cache record (error: {0}'.format(calc_status.error))
            cache_map.del_full_entry(subchash, q)
            raise ConcCalculationStatusException(calc_status.error)

    if _contains_shuffle_seq(q):
        srch_from = 1
    else:
        srch_from = len(q)

    conc = EmptyConc(corp=corp)
    ans = (0, conc)
    # try to find the most complete cached operation
    # (e.g. query + filter + sample)
    for i in range(srch_from, 0, -1):
        cache_path = cache_map.cache_file_path(subchash, q[:i])
        # now we know that someone already calculated the conc (but it might not be finished yet)
        if cache_path:
            try:
                ready = wait_for_conc(cache_map=cache_map, subchash=subchash,
                                      q=q[:i], minsize=minsize)
                if not ready:
                    if minsize != 0:
                        cancel_async_task(cache_map, subchash, q[:i])
                        logging.getLogger(__name__).warning(
                            'Removed unfinished concordance cache record due to exceeded time limit')
                    continue
                _, finished = _check_result(
                    cache_map=cache_map, subchash=subchash, q=q[:i], minsize=minsize)
                if finished:
                    mcorp = corp
                    for qq in reversed(q[:i]):  # find the right main corp, if aligned
                        if qq.startswith('x-'):
                            mcorp = manatee.Corpus(qq[2:])
                            break
                    conc = PyConc(mcorp, 'l', cache_path, orig_corp=corp)
            except (ConcCalculationStatusException, manatee.FileAccessError) as ex:
                logging.getLogger(__name__).error(f'Failed to use cached concordance for {q[:i]}: {ex}')
                cancel_async_task(cache_map, subchash, q[:i])
                continue
            ans = (i, conc)
            break
    logging.getLogger(__name__).debug(f'get_cached_conc({corp.get_conffile()}, [{", ".join(q)}]), '
                                      f'conc: {conc.__class__.__name__}, '
                                      f'missing ops start idx: {i if i < len(q) else "none"}, '
                                      f'time: {(time.time() - start_time):.4f}')
    return ans


class ConcCalculation(GeneralWorker):

    def __init__(self, task_id, cache_factory=None):
        """
        """
        super(ConcCalculation, self).__init__(task_id=task_id, cache_factory=cache_factory)

    def __call__(self, initial_args, subc_dirs, corpus_name, subc_name, subchash, query, samplesize):
        """
        initial_args -- a dict(cachefile=..., already_running=...)
        subc_dirs -- a list of directories where to look for subcorpora
        corpus -- a corpus identifier
        subc_name -- subcorpus name (should be None if not present)
        subchash -- an identifier of current subcorpus (None if no subcorpus is in use)
        query -- a tuple/list containing current query
        samplesize -- row limit
        """
        cache_map = None
        try:
            corpus_manager = CorpusManager(subcpath=subc_dirs)
            corpus_obj = corpus_manager.get_Corpus(corpus_name, subcname=subc_name)
            cache_map = self._cache_factory.get_mapping(corpus_obj)
            if not initial_args['already_running']:
                # The conc object bellow is asynchronous; i.e. you obtain it immediately but it may
                # not be ready yet (this is checked by the 'finished()' method).
                conc = self.compute_conc(corpus_obj, query, samplesize)
                sleeptime = 0.1
                time.sleep(sleeptime)
                cachefile = initial_args['cachefile']
                conc.save(cachefile, False, True)  # partial
                os.chmod(cachefile, 0o664)
                cache_map.update_calc_status(subchash, query, readable=True)
                while not conc.finished():
                    conc.save(cachefile + '.tmp', False, True)
                    os.rename(cachefile + '.tmp', cachefile)
                    sizes = self.get_cached_conc_sizes(corpus_obj, query, initial_args['cachefile'])
                    cache_map.update_calc_status(subchash, query, finished=sizes['finished'],
                                                 concsize=sizes['concsize'], fullsize=sizes['fullsize'],
                                                 relconcsize=sizes['relconcsize'], arf=None, task_id=self._task_id)
                    time.sleep(sleeptime)
                    sleeptime += 0.1

                conc.save(cachefile + '.tmp') # whole
                os.rename(cachefile + '.tmp', cachefile)
                os.chmod(cachefile, 0o664)
                sizes = self.get_cached_conc_sizes(corpus_obj, query, initial_args['cachefile'])
                cache_map.update_calc_status(subchash, query, finished=sizes['finished'],
                                             concsize=conc.size(), fullsize=sizes['fullsize'],
                                             relconcsize=sizes['relconcsize'],
                                             arf=round(conc.compute_ARF(), 2) if not is_subcorpus(
                                                 corpus_obj) else None,
                                             task_id=self._task_id)
        except Exception as e:
            # Please note that there is no need to clean any mess (unfinished cached concordance etc.)
            # here as this is performed by _get_cached_conc()
            # function in case it detects a problem.
            import traceback
            logging.getLogger(__name__).error('Background calculation error: %s' % e)
            logging.getLogger(__name__).error(''.join(traceback.format_exception(*sys.exc_info())))
            if cache_map is not None:
                cache_map.update_calc_status(subchash, query, finished=True, error=e)


class ConcSyncCalculation(GeneralWorker):
    """
    A worker for calculating a concordance synchronously (from Manatee API point of view)
    but still in background.

    Please note that the worker expects you to create required concordance cache
    mapping records.
    """

    def __init__(self, task_id, cache_factory, subc_dirs, corpus_name, subc_name: str, conc_dir: str):
        super().__init__(task_id, cache_factory)
        self.corpus_manager = CorpusManager(subcpath=subc_dirs)
        corpus_manager = CorpusManager(subcpath=subc_dirs)
        self.corpus_obj = corpus_manager.get_Corpus(corpus_name, subcname=subc_name)
        setattr(self.corpus_obj, '_conc_dir', conc_dir)
        self.cache_map = self._cache_factory.get_mapping(self.corpus_obj)

    def _mark_calc_states_err(self, subchash: Optional[str], query: Tuple[str, ...], from_idx: int, err: BaseException):
        for i in range(from_idx, len(query)):
            self.cache_map.update_calc_status(subchash, query[:i + 1], error=err, finished=True)

    def __call__(self,  subchash, query: Tuple[str, ...], samplesize: int):
        try:
            calc_from, conc = find_cached_conc_base(self.corpus_obj, subchash, query, minsize=0)
            if isinstance(conc, EmptyConc):
                calc_status = self.cache_map.add_to_map(subchash, query, CalcStatus())
                conc = self.compute_conc(self.corpus_obj, query, samplesize)
                conc.sync()
                conc.save(calc_status.cachefile)
                self.cache_map.update_calc_status(
                    subchash, query, finished=True, concsize=conc.size())
                calc_from += 1
        except Exception as ex:
            logging.getLogger(__name__).error(ex)
            self._mark_calc_states_err(subchash, query, 0, ex)
            return
        # save additional concordance actions to cache (e.g. sample)
        for act in range(calc_from, len(query)):
            try:
                command, args = query[act][0], query[act][1:]
                conc.exec_command(command, args)
                if command in 'gae':  # user specific/volatile actions, cannot save
                    raise NotImplementedError(f'Cannot run command {command} in background')  # TODO
                status = self.cache_map.get_calc_status(subchash, query[:act + 1])
                # TODO if stored_status then something went wrong
                conc.save(status.cachefile)
                self.cache_map.update_calc_status(
                    subchash, query[:act + 1], readable=True, finished=True, concsize=conc.size())
            except Exception as ex:
                self._mark_calc_states_err(subchash, query, act, ex)
                logging.getLogger(__name__).error(ex)
                return
