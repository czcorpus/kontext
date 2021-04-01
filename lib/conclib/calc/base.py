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
from typing import Tuple, Optional,  Dict, Any

from corplib import CorpusManager
from corplib.corpus import KCorpus
from plugins.abstract.conc_cache import CalcStatus
import plugins
from conclib.errors import ConcCalculationStatusException
from conclib.pyconc import PyConc
import manatee
import settings


TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


class GeneralWorker(object):

    def __init__(self, task_id=None, cache_factory=None):
        self._cache_factory = cache_factory if cache_factory is not None else plugins.runtime.CONC_CACHE.instance
        self._task_id = task_id

    def create_new_calc_status(self) -> CalcStatus:
        return CalcStatus(task_id=self._task_id)

    def get_cached_conc_sizes(self, corp: KCorpus, q: Tuple[str, ...] = None) -> Dict[str, Any]:
        """
        arguments:
        corp --
        q -- a list containing preprocessed query
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
            q = ()
        ans = dict(finished=False, concsize=0, fullsize=0, relconcsize=0, error=None)
        cache_map = self._cache_factory.get_mapping(corp)
        status = cache_map.get_calc_status(corp.subchash, q)
        if not status:
            raise ConcCalculationStatusException('Concordance calculation not found', None)
        status.test_error(TASK_TIME_LIMIT)
        if status.error is not None:
            raise ConcCalculationStatusException('Concordance calculation failed', status.error)

        if status.error:
            ans['finished'] = True
            ans['error'] = status.error
        elif status.cachefile and os.path.isfile(status.cachefile):
            cache = open(status.cachefile, 'rb')
            cache.seek(15)
            finished = bool(ord(cache.read(1)))
            (fullsize,) = struct.unpack('q', cache.read(8))
            cache.seek(32)
            (concsize,) = struct.unpack('i', cache.read(4))

            if fullsize > 0:
                relconcsize = 1000000.0 * fullsize / corp.search_size()
            else:
                relconcsize = 1000000.0 * concsize / corp.search_size()

            if finished and not corp.is_subcorpus:
                conc = manatee.Concordance(corp.unwrap(), status.cachefile)
                result_arf = round(conc.compute_ARF(), 2)
            else:
                result_arf = None

            ans['finished'] = finished
            ans['concsize'] = concsize
            ans['fullsize'] = fullsize
            ans['relconcsize'] = relconcsize
            ans['arf'] = result_arf
        return ans

    def compute_conc(self, corp: manatee.Corpus, q: Tuple[str, ...], samplesize: int) -> PyConc:
        start_time = time.time()
        q = tuple(q)
        if q[0][0] != 'R':
            ans_conc = PyConc(corp, q[0][0], q[0][1:], samplesize)
        else:
            raise NotImplementedError('Function "online sample" is not supported')
        logging.getLogger(__name__).debug(f'compute_conc({corp.corpname}, [{", ".join(q)}]) '
                                          f'-> {(time.time() - start_time):.4f}')
        return ans_conc


class TaskRegistration(GeneralWorker):

    def __init__(self, task_id: str):
        super(TaskRegistration, self).__init__(task_id=task_id)

    def __call__(self, corpus_name: str, subc_name: str, subchash: Optional[str], subcpaths: Tuple[str, ...],
                 query: Tuple[str, ...], samplesize: int) -> Dict[str, Any]:
        corpus_manager = CorpusManager(subcpath=subcpaths)
        corpus_obj = corpus_manager.get_corpus(corpus_name, subcname=subc_name)
        cache_map = self._cache_factory.get_mapping(corpus_obj)
        status = cache_map.get_calc_status(subchash, query)
        if status is None or status.error:
            status = self.create_new_calc_status()
            status = cache_map.add_to_map(subchash, query, status, overwrite=True)
            already_running = False
        else:
            already_running = True
        return dict(cachefile=status.cachefile, already_running=already_running)
