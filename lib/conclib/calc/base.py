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
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple, Union

import aiofiles.os
import manatee
import plugins
import settings
from conclib.errors import ConcCalculationStatusException
from conclib.pyconc import PyConc
from corplib import CorpusFactory
from corplib.corpus import AbstractKCorpus
from corplib.subcorpus import SubcorpusRecord
from plugin_types.conc_cache import ConcCacheStatus

TASK_TIME_LIMIT = settings.get_int('calc_backend', 'task_time_limit', 300)


@dataclass
class CachedConcSizes:
    finished: bool = False
    concsize: int = 0
    fullsize: int = 0
    relconcsize: float = 0
    "concordance size recalculated to a million corpus (aka i.p.m.)"
    arf: Optional[float] = None
    "ARF of the result (this is calculated only for the finished result, i.e. no intermediate values)"
    error: Optional[Exception] = None


class GeneralWorker:

    def __init__(self, task_id=None, cache_factory=None, translate: Callable[[str], str] = lambda x: x):
        self._cache_factory = cache_factory if cache_factory is not None else plugins.runtime.CONC_CACHE.instance
        self._task_id = task_id
        self._translate = translate

    def create_new_calc_status(self) -> ConcCacheStatus:
        return ConcCacheStatus(task_id=self._task_id)

    async def get_cached_conc_sizes(self, corp: AbstractKCorpus, q: Tuple[str, ...]=None, cutoff: int=0) -> CachedConcSizes:
        """
        Extract concordance size, ipm etc. from a concordance file (specified by provided corpus and query).
        """
        import struct

        if q is None:
            q = ()
        ans = CachedConcSizes()
        cache_map = self._cache_factory.get_mapping(corp)
        status = await cache_map.get_calc_status(corp.cache_key, q, cutoff)
        if not status:
            raise ConcCalculationStatusException('Concordance calculation not found', None)
        status.check_for_errors(TASK_TIME_LIMIT)
        if status.error:
            ans.finished = True
            ans.error = status.error
        elif status.cachefile and await aiofiles.os.path.isfile(status.cachefile):
            cache = open(status.cachefile, 'rb')
            cache.seek(15)
            finished = bool(ord(cache.read(1)))
            (fullsize,) = struct.unpack('q', cache.read(8))
            cache.seek(32)
            (concsize,) = struct.unpack('i', cache.read(4))
            if fullsize > 0:
                relconcsize = 1000000.0 * fullsize / corp.search_size
            else:
                relconcsize = 1000000.0 * concsize / corp.search_size

            if finished and not corp.subcorpus_id:
                conc = manatee.Concordance(corp.unwrap(), status.cachefile)
                result_arf = round(conc.compute_ARF(), 2)
            else:
                result_arf = None

            ans.finished = finished
            ans.concsize = concsize
            ans.fullsize = fullsize
            ans.relconcsize = relconcsize
            ans.arf = result_arf
        return ans

    def compute_conc(self, corp: AbstractKCorpus, q: Tuple[str, ...], cutoff: int) -> PyConc:
        start_time = time.time()
        q = tuple(q)
        if q[0][0] != 'R':
            ans_conc = PyConc(corp, q[0][0], q[0][1:], cutoff)
        else:
            raise NotImplementedError('Function "online sample" is not supported')
        logging.getLogger(__name__).debug(
            f'compute_conc({corp.corpname}, [{", ".join(q)}]) '
            f'-> {(time.time() - start_time):.4f}')
        return ans_conc


class ConcRegistration(GeneralWorker):

    def __init__(self, task_id: Optional[str]):
        super().__init__(task_id=task_id)

    async def run(
        self,
            corpus_ident: Union[str, SubcorpusRecord],
            corp_cache_key: str,
            query: Tuple[str, ...],
            cutoff: int) -> Dict[str, Any]:
        corpus_factory = CorpusFactory(subc_root=settings.get('corpora', 'subcorpora_dir'))
        corpus_obj = await corpus_factory.get_corpus(corpus_ident)
        cache_map = self._cache_factory.get_mapping(corpus_obj)
        status = await cache_map.get_calc_status(corp_cache_key, query, cutoff)
        if status is None or status.error:
            status = self.create_new_calc_status()
            status = await cache_map.add_to_map(corp_cache_key, query, cutoff, status, overwrite=True)
            already_running = False
        else:
            already_running = True
        return dict(cachefile=status.cachefile, already_running=already_running)
