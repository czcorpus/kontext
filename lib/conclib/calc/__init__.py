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
import os
import time
from typing import Callable, List, Optional, Tuple, Union

import aiofiles.os
import bgcalc
import manatee
import plugins
import settings
from bgcalc.errors import CalcTaskNotFoundError
from conclib.calc.base import GeneralWorker
from conclib.empty import InitialConc
from conclib.errors import (
    UnreadableConcordanceException, ConcCalculationStatusException, ConcNotFoundException, extract_manatee_error)
from conclib.pyconc import PyConc
from corplib import CorpusFactory
from corplib.corpus import AbstractKCorpus
from corplib.subcorpus import SubcorpusRecord
from plugin_types.conc_cache import AbstractConcCache, ConcCacheStatus

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


async def del_silent(path: str):
    """
    Remove a file without complaining in case of a error (OSError, TypeError)
    """
    try:
        await aiofiles.os.remove(path)
    except (OSError, TypeError) as ex:
        logging.getLogger(__name__).warning(f'del_silent problem: {ex} (file: {path}')


async def cancel_conc_task(
        cache_map: AbstractConcCache, corp_cache_key: Optional[str], q: Tuple[str, ...], cutoff: int):
    """
    Removes conc. cache entry and also a respective calculation task (silently).
    """
    cachefile = await cache_map.readable_cache_path(corp_cache_key, q, cutoff)
    status = await cache_map.get_calc_status(corp_cache_key, q, cutoff)
    if status:
        try:
            if status.task_id:
                worker = bgcalc.calc_backend_client(settings)
                worker.control.revoke(status.task_id, terminate=True, signal='SIGKILL')
        except (IOError, CalcTaskNotFoundError):
            pass
    await cache_map.del_entry(corp_cache_key, q, cutoff)
    await del_silent(cachefile)


async def wait_for_conc(
        cache_map: AbstractConcCache,
        corp_cache_key: Optional[str],
        q: Tuple[str, ...],
        cutoff: int,
        minsize: int) -> bool:
    """
    Find a conc. calculation record in cache (matching provided corp_cache_key and query)
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
    has_min_result, finished = await _check_result(cache_map, corp_cache_key, q, cutoff, minsize)
    while not (finished or has_min_result) and t1 - t0 < time_limit:
        time.sleep(i * 0.1)
        i += 1
        t1 = time.time()
        has_min_result, finished = await _check_result(cache_map, corp_cache_key, q, cutoff, minsize)
    if not has_min_result:
        if finished:  # cache vs. filesystem mismatch
            await cache_map.del_entry(corp_cache_key, q, cutoff)
        return False
    return True


async def _check_result(
        cache_map: AbstractConcCache,
        corp_cache_key: Optional[str],
        q: Tuple[str, ...],
        cutoff: int,
        minsize: int) -> Tuple[bool, bool]:
    """
    Check for result status while validating calculation
    status. In case of an error an Exception can be thrown.
    It is perfectly fine to not find an entry for some
    corp_cache_key+q combination (in such case, False is returned).

    return:
    2-tuple ["has min. acceptable result", "is finished"]
    Return True if a specific concordance calculation
    has not reached a minimal viewable size yet.
    Otherwise it returns False (= we can show a partial
    result).

    In case the calculation finished due to an error
    the function throws a ConcCalculationStatusException.
    """
    status = await cache_map.get_calc_status(corp_cache_key, q, cutoff)
    if status is None:
        return False, False
    status.check_for_errors(TASK_TIME_LIMIT)
    if status.error is not None:
        await cache_map.del_full_entry(corp_cache_key, q, cutoff)
        raise status.error
    return status.has_some_result(minsize=minsize), status.finished


async def require_existing_conc(
        corp: AbstractKCorpus,
        q: Union[Tuple[str, ...], List[str]],
        cutoff: int) -> PyConc:
    """
    Load a cached concordance based on a provided corpus and query.
    If nothing is found, ConcNotFoundException is thrown which should
    be understood as a trigger for 'restore_conc' action.
    In case the concordance is not ready yet or finished with an
    error, UnreadableConcordanceException is thrown.
    """
    corpus_factory = CorpusFactory()
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
    status = await cache_map.get_calc_status(corp.cache_key, q, cutoff)
    if status is None:
        raise ConcNotFoundException('Concordance not found: {}'.format(', '.join(q)))
    if status.finished and status.readable:
        mcorp = corp
        for qq in reversed(q):  # find the right main corp, if aligned
            if qq.startswith('x-'):
                mcorp = await corpus_factory.get_corpus(qq[2:])
                break
        try:
            return PyConc(mcorp, 'l', status.cachefile, orig_corp=corp)
        except manatee.FileAccessError as ex:
            raise ConcNotFoundException(ex)
    logging.getLogger(__name__).error('Unreadable concordance, status: {}'.format(status.to_dict()))
    raise UnreadableConcordanceException(
        'Unreadable concordance. File: {}, error: {}'.format(status.cachefile, status.error))


async def find_cached_conc_base(
        corp: AbstractKCorpus, q: Tuple[str, ...], cutoff: int,
        minsize: int) -> Tuple[Optional[int], Union[PyConc, InitialConc]]:
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
    corpus_factory = CorpusFactory()
    start_time = time.time()
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
    await cache_map.ensure_writable_storage()
    calc_status = await cache_map.get_calc_status(corp.cache_key, q, cutoff)
    if calc_status:
        if calc_status.error is None:
            if (calc_status.created - (await corp.corp_mtime)) < 0:
                logging.getLogger(__name__).warning(
                    'Removed outdated cache file (older than corpus indices)')
                await cache_map.del_full_entry(corp.cache_key, q, cutoff)
        else:
            logging.getLogger(__name__).warning(
                'Removed failed calculation cache record (reason: {0})'.format(calc_status.error))
            await cache_map.del_full_entry(corp.cache_key, q, cutoff)
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
        cache_path = await cache_map.readable_cache_path(corp.cache_key, q[:i], cutoff)
        # now we know that someone already calculated the conc (but it might not be finished yet)
        if cache_path:
            try:
                ready = await wait_for_conc(
                    cache_map=cache_map, corp_cache_key=corp.cache_key, q=q[:i], cutoff=cutoff, minsize=minsize)
                if not ready:
                    if minsize != 0:
                        await cancel_conc_task(cache_map, corp.cache_key, q[:i], cutoff)
                        logging.getLogger(__name__).warning(
                            'Removed unfinished concordance cache record due to exceeded time limit')
                    continue
                _, finished = await _check_result(
                    cache_map=cache_map, corp_cache_key=corp.cache_key, q=q[:i], cutoff=cutoff, minsize=minsize)
                if finished:
                    mcorp = corp
                    for qq in reversed(q[:i]):  # find the right main corp, if aligned
                        if qq.startswith('x-'):
                            mcorp = await corpus_factory.get_corpus(qq[2:])
                            break
                    conc = PyConc(mcorp, 'l', cache_path, orig_corp=corp)
            except (ConcCalculationStatusException, manatee.FileAccessError) as ex:
                logging.getLogger(__name__).error(
                    f'Failed to use cached concordance for {q[:i]}: {ex}')
                await cancel_conc_task(cache_map, corp.cache_key, q[:i], cutoff)
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
        super().__init__(task_id=task_id, cache_factory=cache_factory)

    async def run(
            self,
            initial_args,
            subc_root,
            corpus_ident: Union[str, SubcorpusRecord],
            corp_cache_key,
            query,
            cutoff):
        """
        initial_args -- a dict(cachefile=..., already_running=...)
        subc_dirs -- a list of directories where to look for subcorpora
        corpus_ident -- a corpus system identifier
        subc_name -- subcorpus name (should be None if not present)
        corp_cache_key -- an identifier of current subcorpus (None if no subcorpus is in use)
        query -- a tuple/list containing current query
        cutoff -- row limit
        """
        cache_map = None
        try:
            corpus_factory = CorpusFactory(subc_root=subc_root)
            corpus_obj = await corpus_factory.get_corpus(corpus_ident)
            cache_map = self._cache_factory.get_mapping(corpus_obj)
            if not initial_args['already_running']:
                # The conc object bellow is asynchronous; i.e. you obtain it immediately but it may
                # not be ready yet (this is checked by the 'finished()' method).
                conc = self.compute_conc(corpus_obj, query, cutoff)
                sleeptime = 0.1
                time.sleep(sleeptime)
                cachefile = initial_args['cachefile']
                conc.save(cachefile, False, True)  # partial
                os.chmod(cachefile, 0o664)
                await cache_map.update_calc_status(
                    corp_cache_key, query, cutoff, readable=True, task_id=self._task_id)
                while not conc.finished():
                    conc.save(cachefile + '.tmp', False, True)
                    await aiofiles.os.rename(cachefile + '.tmp', cachefile)
                    sizes = await self.get_cached_conc_sizes(corpus_obj, query, cutoff)
                    await cache_map.update_calc_status(
                        corp_cache_key, query, cutoff,
                        finished=sizes.finished,
                        concsize=sizes.concsize,
                        fullsize=sizes.fullsize,
                        relconcsize=sizes.relconcsize,
                        arf=None,
                        task_id=self._task_id)
                    time.sleep(sleeptime)
                    sleeptime += 0.1

                conc.save(cachefile + '.tmp')  # whole
                await aiofiles.os.rename(cachefile + '.tmp', cachefile)
                os.chmod(cachefile, 0o664)
                sizes = await self.get_cached_conc_sizes(corpus_obj, query, cutoff)
                await cache_map.update_calc_status(
                    corp_cache_key, query, cutoff,
                    finished=sizes.finished,
                    concsize=conc.size(),
                    fullsize=sizes.fullsize,
                    relconcsize=sizes.relconcsize,
                    arf=round(conc.compute_ARF(), 2) if not corpus_obj.subcorpus_id else None,
                    task_id=self._task_id)
        except Exception as e:
            # Please note that there is no need to clean any mess (unfinished cached concordance etc.)
            # here as this is performed by _get_cached_conc()
            # function in case it detects a problem.
            manatee_err = extract_manatee_error(e)
            norm_err = manatee_err if manatee_err else e
            if cache_map is not None:
                await cache_map.update_calc_status(corp_cache_key, query, cutoff, finished=True, error=norm_err)


class ConcSyncCalculation(GeneralWorker):
    """
    A worker for calculating a concordance synchronously (from Manatee API point of view)
    but still in background.

    Please note that the worker expects you to create required concordance cache
    mapping records.
    """

    def __init__(
            self, task_id, cache_factory, subc_root, corpus_ident: Union[str, SubcorpusRecord], conc_dir: str):
        super().__init__(task_id, cache_factory)
        self.corpus_factory = CorpusFactory(subc_root=subc_root)
        self.corpus_ident = corpus_ident
        self.corpus_obj = None
        self.cache_map = None
        self.conc_dir = conc_dir

    async def _mark_calc_states_err(
            self, corp_cache_key: Optional[str], query: Tuple[str, ...], cutoff: int, from_idx: int, err: BaseException):
        for i in range(from_idx, len(query)):
            await self.cache_map.update_calc_status(
                corp_cache_key, query[:i + 1], cutoff, error=err, finished=True)

    async def run(self,  corp_cache_key, query: Tuple[str, ...], cutoff: int):
        self.corpus_obj = await self.corpus_factory.get_corpus(self.corpus_ident)
        setattr(self.corpus_obj, '_conc_dir', self.conc_dir)
        self.cache_map = self._cache_factory.get_mapping(self.corpus_obj)

        try:
            calc_from, conc = await find_cached_conc_base(
                self.corpus_obj, query, cutoff, minsize=0)
            if isinstance(conc, InitialConc):   # we have nothing, let's start with the 1st operation only
                for i in range(0, len(query)):
                    await self.cache_map.add_to_map(
                        corp_cache_key, query[:i + 1], cutoff,
                        ConcCacheStatus(task_id=self._task_id), overwrite=True)
                calc_status = await self.cache_map.get_calc_status(corp_cache_key, query[:1], cutoff)
                conc = self.compute_conc(self.corpus_obj, query[:1], cutoff)
                conc.sync()
                conc.save(calc_status.cachefile)
                os.chmod(calc_status.cachefile, 0o664)
                calc_status.readable = True
                calc_status.finished = True
                calc_status.concsize = conc.size()
                calc_status.fullsize = conc.fullsize()
                calc_status.recalc_relconcsize(self.corpus_obj)
                calc_status.arf = round(
                    conc.compute_ARF(), 2) if not self.corpus_obj.subcorpus_id else None
                await self.cache_map.add_to_map(corp_cache_key, query[:1], cutoff, calc_status, overwrite=True)
                calc_from = 1
            else:
                for i in range(calc_from, len(query)):
                    await self.cache_map.add_to_map(
                        corp_cache_key, query[:i + 1], cutoff, ConcCacheStatus(task_id=self._task_id),
                        overwrite=True)
        except Exception as ex:
            logging.getLogger(__name__).error(ex)
            manatee_err = extract_manatee_error(ex)
            norm_err = manatee_err if manatee_err else ex
            await self._mark_calc_states_err(corp_cache_key, query, cutoff, 0, norm_err)
            return
        # save additional concordance actions to cache (e.g. sample, aligned corpus without a query,...)
        for act in range(calc_from, len(query)):
            try:
                command, args = query[act][0], query[act][1:]
                conc.exec_command(command, args)
                if command in 'gae':  # user specific/volatile actions, cannot save
                    raise NotImplementedError(f'Cannot run command {command} in background')  # TODO
                calc_status = await self.cache_map.get_calc_status(corp_cache_key, query[:act + 1], cutoff)
                conc.save(calc_status.cachefile)
                os.chmod(calc_status.cachefile, 0o664)
                calc_status.readable = True
                calc_status.finished = True
                calc_status.concsize = conc.size()
                calc_status.fullsize = conc.fullsize()
                calc_status.recalc_relconcsize(self.corpus_obj)
                calc_status.arf = round(
                    conc.compute_ARF(), 2) if not self.corpus_obj.subcorpus_id else None
                await self.cache_map.add_to_map(
                    corp_cache_key, query[:act + 1], cutoff, calc_status, overwrite=True)
            except Exception as ex:
                await self._mark_calc_states_err(corp_cache_key, query, cutoff, act, ex)
                logging.getLogger(__name__).error(ex)
                return
