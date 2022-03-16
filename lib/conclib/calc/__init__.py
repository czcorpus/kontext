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

from typing import Tuple, Optional, List, Union
import os
import time
import logging

import settings
import plugins
from plugins.abstract.conc_cache import AbstractConcCache, ConcCacheStatus
from corplib import CorpusManager
from conclib.empty import InitialConc
from corplib.corpus import AbstractKCorpus
import manatee
from conclib.pyconc import PyConc
from conclib.calc.base import GeneralWorker
from conclib.errors import (ConcCalculationStatusException, ConcNotFoundException, BrokenConcordanceException,
                            extract_manatee_error)
import bgcalc
from bgcalc.errors import CalcTaskNotFoundError

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


def cancel_conc_task(cache_map: AbstractConcCache, subchash: Optional[str], q: Tuple[str, ...]):
    """
    Removes conc. cache entry and also a respective calculation task (silently).
    """
    cachefile = cache_map.readable_cache_path(subchash, q)
    status = cache_map.get_calc_status(subchash, q)
    if status:
        try:
            if status.task_id:
                worker = bgcalc.calc_backend_client(settings)
                worker.control.revoke(status.task_id, terminate=True, signal='SIGKILL')
        except (IOError, CalcTaskNotFoundError):
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
                3) == 0 => we only care whether the file exists => short time limit
    """
    time_limit = 7 if minsize >= 0 else 20   # 7 => ~2s, 20 => ~19s
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
    subchash+q combination (in such case, False is returned).

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
    status.check_for_errors(TASK_TIME_LIMIT)
    if status.error is not None:
        cache_map.del_full_entry(subchash, q)
        raise status.error
    return status.has_some_result(minsize=minsize), status.finished


def require_existing_conc(corp: AbstractKCorpus, q: Union[Tuple[str, ...], List[str]]) -> PyConc:
    """
    Load a cached concordance based on a provided corpus and query.
    If nothing is found, ConcNotFoundException is thrown.
    """
    corpus_manager = CorpusManager(subcpath=[])
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
    subchash = getattr(corp, 'subchash', None)
    status = cache_map.get_calc_status(subchash, q)
    if status is None:
        raise ConcNotFoundException('Concordance not found: {}'.format(', '.join(q)))
    if status.finished and status.readable:
        mcorp = corp
        for qq in reversed(q):  # find the right main corp, if aligned
            if qq.startswith('x-'):
                mcorp = corpus_manager.get_corpus(qq[2:])
                break
        try:
            return PyConc(mcorp, 'l', status.cachefile, orig_corp=corp)
        except manatee.FileAccessError as ex:
            raise ConcNotFoundException(ex)
    raise BrokenConcordanceException(
        'Concordance broken. File: {}, error: {}'.format(status.cachefile, status.error))


def find_cached_conc_base(
        corp: AbstractKCorpus, subchash: Optional[str], q: Tuple[str, ...],
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
    corpus_manager = CorpusManager(subcpath=[])
    start_time = time.time()
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
    cache_map.refresh_map()
    calc_status = cache_map.get_calc_status(subchash, q)
    if calc_status:
        if calc_status.error is None:
            if calc_status.created - corp.corp_mtime < 0:
                logging.getLogger(__name__).warning(
                    'Removed outdated cache file (older than corpus indices)')
                cache_map.del_full_entry(subchash, q)
        else:
            logging.getLogger(__name__).warning(
                'Removed failed calculation cache record (error: {0}'.format(calc_status.error))
            cache_map.del_full_entry(subchash, q)
            raise calc_status.normalized_error

    if _contains_shuffle_seq(q):
        srch_from = 1
    else:
        srch_from = len(q)

    conc = InitialConc(corp=corp)
    ans = (0, conc)
    # try to find the most complete cached operation
    # (e.g. query + filter + sample)
    for i in range(srch_from, 0, -1):
        cache_path = cache_map.readable_cache_path(subchash, q[:i])
        # now we know that someone already calculated the conc (but it might not be finished yet)
        if cache_path:
            try:
                ready = wait_for_conc(cache_map=cache_map, subchash=subchash,
                                      q=q[:i], minsize=minsize)
                if not ready:
                    if minsize != 0:
                        cancel_conc_task(cache_map, subchash, q[:i])
                        logging.getLogger(__name__).warning(
                            'Removed unfinished concordance cache record due to exceeded time limit')
                    continue
                _, finished = _check_result(
                    cache_map=cache_map, subchash=subchash, q=q[:i], minsize=minsize)
                if finished:
                    mcorp = corp
                    for qq in reversed(q[:i]):  # find the right main corp, if aligned
                        if qq.startswith('x-'):
                            mcorp = corpus_manager.get_corpus(qq[2:])
                            break
                    conc = PyConc(mcorp, 'l', cache_path, orig_corp=corp)
            except (ConcCalculationStatusException, manatee.FileAccessError) as ex:
                logging.getLogger(__name__).error(
                    f'Failed to use cached concordance for {q[:i]}: {ex}')
                cancel_conc_task(cache_map, subchash, q[:i])
                continue
            ans = (i, conc)
            break
    logging.getLogger(__name__).debug(f'find_cached_conc_base({corp.get_conffile()}, [{", ".join(q)}]), '
                                      f'conc: {conc.__class__.__name__}, '
                                      f'must calc ops from {i} to {len(q)}, '
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
            corpus_obj = corpus_manager.get_corpus(corpus_name, subcname=subc_name)
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
                cache_map.update_calc_status(subchash, query, readable=True, task_id=self._task_id)
                while not conc.finished():
                    conc.save(cachefile + '.tmp', False, True)
                    os.rename(cachefile + '.tmp', cachefile)
                    sizes = self.get_cached_conc_sizes(corpus_obj, query)
                    cache_map.update_calc_status(subchash, query, finished=sizes.finished,
                                                 concsize=sizes.concsize, fullsize=sizes.fullsize,
                                                 relconcsize=sizes.relconcsize, arf=None, task_id=self._task_id)
                    time.sleep(sleeptime)
                    sleeptime += 0.1

                conc.save(cachefile + '.tmp')  # whole
                os.rename(cachefile + '.tmp', cachefile)
                os.chmod(cachefile, 0o664)
                sizes = self.get_cached_conc_sizes(corpus_obj, query)
                cache_map.update_calc_status(subchash, query, finished=sizes.finished,
                                             concsize=conc.size(), fullsize=sizes.fullsize,
                                             relconcsize=sizes.relconcsize,
                                             arf=round(conc.compute_ARF(), 2) if not corpus_obj.is_subcorpus
                                             else None,
                                             task_id=self._task_id)
        except Exception as e:
            # Please note that there is no need to clean any mess (unfinished cached concordance etc.)
            # here as this is performed by _get_cached_conc()
            # function in case it detects a problem.
            manatee_err = extract_manatee_error(e)
            norm_err = manatee_err if manatee_err else e
            if cache_map is not None:
                cache_map.update_calc_status(subchash, query, finished=True, error=norm_err)


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
        self.corpus_obj = self.corpus_manager.get_corpus(corpus_name, subcname=subc_name)
        setattr(self.corpus_obj, '_conc_dir', conc_dir)
        self.cache_map = self._cache_factory.get_mapping(self.corpus_obj)

    def _mark_calc_states_err(self, subchash: Optional[str], query: Tuple[str, ...], from_idx: int, err: BaseException):
        for i in range(from_idx, len(query)):
            self.cache_map.update_calc_status(subchash, query[:i + 1], error=err, finished=True)

    def __call__(self,  subchash, query: Tuple[str, ...], samplesize: int):
        try:
            calc_from, conc = find_cached_conc_base(self.corpus_obj, subchash, query, minsize=0)
            if isinstance(conc, InitialConc):   # we have nothing, let's start with the 1st operation only
                for i in range(0, len(query)):
                    self.cache_map.add_to_map(subchash, query[:i + 1], ConcCacheStatus(task_id=self._task_id),
                                              overwrite=True)
                calc_status = self.cache_map.get_calc_status(subchash, query[:1])
                conc = self.compute_conc(self.corpus_obj, query[:1], samplesize)
                conc.sync()
                conc.save(calc_status.cachefile)
                os.chmod(calc_status.cachefile, 0o664)
                calc_status.readable = True
                calc_status.finished = True
                calc_status.concsize = conc.size()
                calc_status.fullsize = conc.fullsize()
                calc_status.recalc_relconcsize(self.corpus_obj)
                calc_status.arf = round(conc.compute_ARF(), 2) if not self.corpus_obj.is_subcorpus else None
                self.cache_map.add_to_map(subchash, query[:1], calc_status, overwrite=True)
                calc_from = 1
            else:
                for i in range(calc_from, len(query)):
                    self.cache_map.add_to_map(subchash, query[:i + 1], ConcCacheStatus(task_id=self._task_id),
                                              overwrite=True)
        except Exception as ex:
            logging.getLogger(__name__).error(ex)
            manatee_err = extract_manatee_error(ex)
            norm_err = manatee_err if manatee_err else ex
            self._mark_calc_states_err(subchash, query, 0, norm_err)
            return
        # save additional concordance actions to cache (e.g. sample, aligned corpus without a query,...)
        for act in range(calc_from, len(query)):
            try:
                command, args = query[act][0], query[act][1:]
                conc.exec_command(command, args)
                if command in 'gae':  # user specific/volatile actions, cannot save
                    raise NotImplementedError(f'Cannot run command {command} in background')  # TODO
                calc_status = self.cache_map.get_calc_status(subchash, query[:act + 1])
                conc.save(calc_status.cachefile)
                os.chmod(calc_status.cachefile, 0o664)
                calc_status.readable = True
                calc_status.finished = True
                calc_status.concsize = conc.size()
                calc_status.fullsize = conc.fullsize()
                calc_status.recalc_relconcsize(self.corpus_obj)
                calc_status.arf = round(conc.compute_ARF(), 2) if not self.corpus_obj.is_subcorpus else None
                self.cache_map.add_to_map(subchash, query[:act + 1], calc_status, overwrite=True)
            except Exception as ex:
                self._mark_calc_states_err(subchash, query, act, ex)
                logging.getLogger(__name__).error(ex)
                return
