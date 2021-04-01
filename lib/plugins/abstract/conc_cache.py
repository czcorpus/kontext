# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
Interfaces for concordance cache and its factory. Please note
that the plug-in factory 'create_instance' must return an instance
of AbstractCacheMappingFactory (i.e. not AbstractConcCache) because
the instance of AbstractConcCache is request-dependent.
"""

import abc
from typing import Dict, Any, Optional, Union, Tuple
from manatee import Corpus

import os
import time

QueryType = Tuple[str, ...]


class CalcStatusException(Exception):
    pass


class CalcStatus(object):

    def __init__(self, task_id: Optional[str] = None, pid: Optional[int] = None, created: Optional[int] = None,
                 last_upd: Optional[int] = None, concsize: Optional[int] = 0, fullsize: Optional[int] = 0,
                 relconcsize: Optional[int] = 0, arf: Optional[float] = 0,
                 error: Union[str, BaseException, None] = None, finished: Optional[bool] = False,
                 q0hash: str = None, cachefile: str = None, readable: bool = False) -> None:
        self.task_id: Optional[str] = task_id
        self.pid = pid if pid else os.getpid()
        self.created = created if created else int(time.time())
        self.last_upd = last_upd if last_upd else self.created
        self.concsize = concsize
        self.fullsize = fullsize
        self.relconcsize = relconcsize
        self.arf = arf
        self.error: str = str(error) if isinstance(error, BaseException) else error
        self.finished = finished
        self.q0hash = q0hash
        self.cachefile = cachefile
        self.readable = readable

    def to_dict(self) -> Dict[str, Any]:
        return dict(self.__dict__)

    def test_error(self, time_limit: int) -> Optional[BaseException]:
        if self.error is not None:
            return CalcStatusException(self.error)
        t1 = time.time()
        if not self.finished and t1 - self.last_upd > time_limit:
            return CalcStatusException(f'Wait limit for initial data exceeded (waited {t1 - self.last_upd} '
                                       f', limit: {time_limit})')
        return None

    def has_some_result(self, minsize: int) -> bool:
        return self.finished or (self.readable and self.concsize >= minsize)

    def update(self, **kw) -> 'CalcStatus':
        for k, v in kw.items():
            if hasattr(self, k):
                v_norm = str(v) if isinstance(v, BaseException) else v
                setattr(self, k, v_norm)
            else:
                raise AssertionError(f'Unknown {self.__class__.__name__}  attribute: {k}')
        self.last_upd = int(time.time())
        return self


class AbstractConcCache(abc.ABC):

    @abc.abstractmethod
    def get_stored_size(self, subchash: str, q: QueryType) -> Union[int, None]:
        """
        Return stored concordance size.
        The method should return None if no record is found at all.

        Arguments:
        subchash -- a md5 hash generated from subcorpus identifier by
                    CorpusManager.get_corpus()
        q -- a list of query elements
        """

    @abc.abstractmethod
    def get_calc_status(self, subchash: str, query: QueryType) -> CalcStatus:
        pass

    @abc.abstractmethod
    def refresh_map(self):
        """
        Test whether the data for a given corpus (the one this instance
        has been created for) is ready and valid (e.g. a directory
        for the corpus cache files exists). If there is something missing
        then the method has a chance to fix it.

        Some implementations may probably leave this method empty
        as long as their other interface methods ensure they can
        handle 'missing initialization / invalid cache' situations
        themselves.
        """

    @abc.abstractmethod
    def readable_cache_path(self, subchash: str, q: QueryType) -> Optional[str]:
        """
        Return a path to a cache file matching provided subcorpus hash and query
        elements. If there is no entry matching (subchash, q) or if a respective
        entry is not in the 'readable' state then None must be returned.

        arguments:
        subchash -- hashed subcorpus identifier (corplib.CorpusManager does this)
        q -- a list of query items
        """

    @abc.abstractmethod
    def add_to_map(self, subchash: Optional[str], query: QueryType, calc_status: CalcStatus, overwrite: bool = False
                   ) -> CalcStatus:
        """
        Add a cache entry. If already present, the stored version is returned unless overwrite is set to True

        arguments:
        subchash -- a subcorpus identifier hash (see corplib.CorpusManager.get_Corpus)
        query -- a list/tuple of query elements
        size -- current size of a respective concordance (the one defined by corpus, subchash
                and query)
        calc_status -- an instance of CalcStatus
        overwrite -- if true then the new calc_status value is always used
        returns:
            an updated version of the original calc_status (e.g. with cachefile set)
        """

    @abc.abstractmethod
    def del_entry(self, subchash: Optional[str], q: QueryType):
        """
        Remove a specific entry with concrete subchash and query.

        subchash -- a md5 hash generated from subcorpus identifier by
                    CorpusManager.get_corpus()
        q -- a list of query elements
        """

    @abc.abstractmethod
    def del_full_entry(self, subchash: Optional[str], q: QueryType):
        """
        Removes all the entries with the same base query no matter
        what other operations the query (e.g. shuffle, filter) contains.

        subchash -- a md5 hash generated from subcorpus identifier by
                    CorpusManager.get_corpus()
        q -- a list of query elements
        """

    @abc.abstractmethod
    def update_calc_status(self, subchash: Optional[str], query: Tuple[str, ...], **kw):
        pass


class AbstractCacheMappingFactory(abc.ABC):
    """
    A factory which provides AbstractConcCache instances. Please note
    that your module's 'create_instance' should return this factory and
    not the cache itself.
    """

    @abc.abstractmethod
    def get_mapping(self, corpus: Corpus) -> AbstractConcCache:
        """
        returns:
        an AbstractConcCache compatible instance
        """
