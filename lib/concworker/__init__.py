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
import time
import os
import sys
from typing import Union, Tuple

import plugins
from plugins.abstract.conc_cache import CalcStatus, AbstractConcCache
from conclib import PyConc
from corplib import CorpusManager, is_subcorpus
import manatee
from concworker.errors import ConcCalculationStatusException


class GeneralWorker(object):

    def __init__(self, task_id=None, cache_factory=None):
        self._cache_factory = cache_factory if cache_factory is not None else plugins.runtime.CONC_CACHE.instance
        self._task_id = task_id

    def create_new_calc_status(self):
        return CalcStatus(task_id=self._task_id)

    def get_cached_conc_sizes(self, corp, q=None, cachefile=None):
        """
        arguments:
        corp -- manatee.Corpus instance
        q -- a list containing preprocessed query
        cachefile -- if not provided then the path is determined automatically
        using CACHE_ROOT_DIR and corpus name, corpus name and the query

        returns:
        a dictionary {
            finished : 0/1,
            concsize : int,
            fullsize : int,
            relconcsize : float (concordance size recalculated to a million corpus),
            arf : ARF of the result (this is calculated only for the finished result, i.e. no intermediate values)
        }
        """
        import struct

        if q is None:
            q = []
        ans = dict(finished=False, concsize=0, fullsize=0, relconcsize=0)
        if not cachefile:  # AJAX call
            q = tuple(q)
            subchash = getattr(corp, 'subchash', None)
            cache_map = self._cache_factory.get_mapping(corp)
            cachefile = cache_map.cache_file_path(subchash, q)
            status = cache_map.get_calc_status(subchash, q)
            if not status:
                raise ConcCalculationStatusException('Concordance calculation not found', None)
            elif status.error is not None:
                raise ConcCalculationStatusException('Concordance calculation failed', status.error)

        if cachefile and os.path.isfile(cachefile):
            cache = open(cachefile, 'rb')
            cache.seek(15)
            finished = bool(ord(cache.read(1)))
            (fullsize,) = struct.unpack('q', cache.read(8))
            cache.seek(32)
            (concsize,) = struct.unpack('i', cache.read(4))

            if fullsize > 0:
                relconcsize = 1000000.0 * fullsize / corp.search_size()
            else:
                relconcsize = 1000000.0 * concsize / corp.search_size()

            if finished and not is_subcorpus(corp):
                conc = manatee.Concordance(corp, cachefile)
                result_arf = round(conc.compute_ARF(), 2)
            else:
                result_arf = None

            ans['finished'] = finished
            ans['concsize'] = concsize
            ans['fullsize'] = fullsize
            ans['relconcsize'] = relconcsize
            ans['arf'] = result_arf
        return ans

    def compute_conc(self, corp, q, samplesize):
        start_time = time.time()
        q = tuple(q)
        if q[0][0] != 'R':
            ans_conc = PyConc(corp, q[0][0], q[0][1:], samplesize)
        else:
            raise NotImplementedError('Function "online sample" is not supported')
        logging.getLogger(__name__).debug('compute_conc(%s, [%s]) -> %01.4f' %
                                          (corp.corpname, ','.join(q), time.time() - start_time))
        return ans_conc


class TaskRegistration(GeneralWorker):
    def __init__(self, task_id):
        super(TaskRegistration, self).__init__(task_id=task_id)

    def __call__(self, corpus_name, subc_name, subchash, subcpaths, query, samplesize):
        corpus_manager = CorpusManager(subcpath=subcpaths)
        corpus_obj = corpus_manager.get_Corpus(corpus_name, subcname=subc_name)
        cache_map = self._cache_factory.get_mapping(corpus_obj)
        new_status = self.create_new_calc_status()
        cachefile, prev_status = cache_map.add_to_map(subchash, query, 0, new_status)
        return dict(
            cachefile=cachefile,
            already_running=prev_status is not None)


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
        sleeptime = None
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
                conc.save(initial_args['cachefile'], False, True, False)  # partial
                while not conc.finished():
                    # TODO it looks like append=True does not work with Manatee 2.121.1 properly
                    tmp_cachefile = initial_args['cachefile'] + '.tmp'
                    conc.save(tmp_cachefile, False, True, False)
                    os.rename(tmp_cachefile, initial_args['cachefile'])
                    time.sleep(sleeptime)
                    sleeptime += 0.1
                    sizes = self.get_cached_conc_sizes(corpus_obj, query, initial_args['cachefile'])
                    cache_map.update_calc_status(subchash, query, CalcStatus(
                        curr_wait=sleeptime,
                        finished=sizes['finished'],
                        concsize=sizes['concsize'],
                        fullsize=sizes['fullsize'],
                        relconcsize=sizes['relconcsize'],
                        arf=None,
                        task_id=self._task_id))
                tmp_cachefile = initial_args['cachefile'] + '.tmp'
                conc.save(tmp_cachefile)  # whole
                os.rename(tmp_cachefile, initial_args['cachefile'])
                sizes = self.get_cached_conc_sizes(corpus_obj, query, initial_args['cachefile'])
                cache_map.update_calc_status(subchash, query, CalcStatus(
                    curr_wait=sleeptime,
                    finished=sizes['finished'],
                    concsize=sizes['concsize'],
                    fullsize=sizes['fullsize'],
                    relconcsize=sizes['relconcsize'],
                    arf=round(conc.compute_ARF(), 2) if not is_subcorpus(corpus_obj) else None,
                    task_id=self._task_id))
                # update size in map file
                cache_map.add_to_map(subchash, query, conc.size())
        except Exception as e:
            # Please note that there is no need to clean any mess (unfinished cached concordance etc.)
            # here as this is performed by _get_cached_conc()
            # function in case it detects a problem.
            import traceback
            logging.getLogger(__name__).error('Background calculation error: %s' % e)
            logging.getLogger(__name__).error(''.join(traceback.format_exception(*sys.exc_info())))
            if cache_map is not None:
                cache_map.update_calc_status(
                    subchash, query, CalcStatus(
                        finished=True,
                        curr_wait=sleeptime,
                        error=e))


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

    def _mark_calc_states_err(self, subchash: Union[str, None], query: Tuple[str], from_idx: int, err: BaseException):
        for i in range(from_idx, len(query)):
            self.cache_map.update_calc_status(
                subchash, query[:i + 1], CalcStatus(error=err, finished=True))

    def __call__(self,  subchash, query: Tuple[str], samplesize: int, calc_from: int):
        try:
            conc = self.compute_conc(self.corpus_obj, query, samplesize)
            conc.sync()  # wait for the computation to finish
            conc.save(self.cache_map.cache_file_path(subchash, query[:1]))
            self.cache_map.update_calc_status(
                subchash, query[:1], CalcStatus(finished=True, concsize=conc.size()))
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
                cachefile = self.cache_map.cache_file_path(subchash, query[:act + 1])
                # TODO if stored_status then something went wrong
                conc.save(cachefile)
                self.cache_map.update_calc_status(
                    subchash, query[:act + 1], CalcStatus(finished=True, concsize=conc.size()))
            except Exception as ex:
                self._mark_calc_states_err(subchash, query, act, ex)
                logging.getLogger(__name__).error(ex)
                return
