# Copyright (c) 2003-2014  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
# Copyright (c) 2014 Institute of the Czech National Corpus
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
try:
    import cPickle as pickle
except ImportError:
    import pickle
import os
import sys
from plugins.abstract import conc_cache

import plugins
from conclib import PyConc
from corplib import CorpusManager


class GeneralWorker(object):

    def __init__(self, task_id=None, cache_factory=None):
        self._cache_factory = cache_factory if cache_factory is not None else plugins.get('conc_cache')
        self._task_id = task_id

    def _create_new_calc_status(self):
        return conc_cache.CalcStatus(task_id=self._task_id)

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
            relconcsize : float (concordance size recalculated to a million corpus)
        }
        """
        import struct

        if q is None:
            q = []
        ans = {'finished': False, 'concsize': None, 'fullsize': None, 'relconcsize': None}
        if not cachefile:  # AJAX call
            q = tuple(q)
            subchash = getattr(corp, 'subchash', None)
            cache_map = self._cache_factory.get_mapping(corp)
            cachefile = cache_map.cache_file_path(subchash, q)

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

            ans['finished'] = finished
            ans['concsize'] = concsize
            ans['fullsize'] = fullsize
            ans['relconcsize'] = relconcsize
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

    def __call__(self, corpus_name, subc_name, subchash, query, samplesize):
        corpus_manager = CorpusManager()
        corpus_obj = corpus_manager.get_Corpus(corpus_name)
        cache_map = self._cache_factory.get_mapping(corpus_obj)
        new_status = self._create_new_calc_status()
        cachefile, prev_status = cache_map.add_to_map(subchash, query, 0, new_status)
        return dict(
            cachefile=cachefile,
            already_running=prev_status is not None)


class ConcCalculation(GeneralWorker):

    def __init__(self, task_id, cache_factory=None):
        """
        """
        super(ConcCalculation, self).__init__(task_id=task_id, cache_factory=cache_factory)

    def __call__(self, initial_args, subc_dir, corpus_name, subc_name, subchash, query, samplesize):
        """
        initial_args -- a dict(cachefile=..., already_running=...)
        subc_dir -- a directory where user's subcorpora are stored
        corpus -- a corpus identifier
        subc_name -- subcorpus name (should be None if not present)
        subchash -- an identifier of current subcorpus (None if no subcorpus is in use)
        query -- a tuple/list containing current query
        samplesize -- row limit
        """
        sleeptime = None
        cache_map = None
        try:
            corpus_manager = CorpusManager(subcpath=(subc_dir,))
            corpus_obj = corpus_manager.get_Corpus(corpus_name, subc_name)
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
                    cache_map.update_calc_status(subchash, query, dict(
                        curr_wait=sleeptime,
                        finished=sizes['finished'],
                        concsize=sizes['concsize'],
                        fullsize=sizes['fullsize'],
                        relconcsize=sizes['relconcsize'],
                        task_id=self._task_id))
                tmp_cachefile = initial_args['cachefile'] + '.tmp'
                conc.save(tmp_cachefile)  # whole
                os.rename(tmp_cachefile, initial_args['cachefile'])
                sizes = self.get_cached_conc_sizes(corpus_obj, query, initial_args['cachefile'])
                cache_map.update_calc_status(subchash, query, dict(
                    curr_wait=sleeptime,
                    finished=sizes['finished'],
                    concsize=sizes['concsize'],
                    fullsize=sizes['fullsize'],
                    relconcsize=sizes['relconcsize'],
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
                cache_map.update_calc_status(subchash, query, dict(curr_wait=sleeptime, error=str(e)))
