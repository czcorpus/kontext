# Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
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
from typing import Dict, Any, List, Optional, Union, Tuple
from manatee import Corpus

import os
import time
import math

QueryType = Union[List[str], Tuple[str]]


class CalcStatusException(Exception):
    pass


class CalcStatus(object):

    def __init__(self, task_id: Optional[str] = None) -> None:
        self.task_id: Optional[str] = task_id
        self.pid: int = os.getpid()
        self.created: int = int(time.time())
        self.last_upd: int = self.created
        # in case we check status before any calculation (represented by the
        # BackgroundCalc class) starts (the calculation updates curr_wait as it
        # runs), we want to be sure the limit is big enough for BackgroundCalc to
        # be considered alive
        self.curr_wait: int = 100
        self.concsize: int = 0
        self.fullsize: int = 0
        self.relconcsize: int = 0
        self.arf = None
        self.error: Optional[BaseException] = None
        self.finished: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return dict(self.__dict__)

    def test_error(self):
        if self.error is not None:
            raise CalcStatusException(self.error)
        if math.ceil(self.last_upd + self.curr_wait) < math.floor(time.time()):
            raise CalcStatusException('Wait limit for initial data exceeded')

    def has_some_result(self, minsize: int) -> bool:
        if minsize == -1:
            if self.finished:  # whole conc
                return True
        elif self.concsize >= minsize or self.finished:
            return True
        return False

    def update(self, data: Dict[str, Any]) -> 'CalcStatus':
        for k, v in list(data.items()):
            if hasattr(self, k):
                setattr(self, k, v)
            else:
                raise CalcStatusException('Unknow calc. attribute: %s' % (k,))
        self.last_upd = int(time.time())
        return self


class AbstractConcCache(abc.ABC):

    @abc.abstractmethod
    def get_stored_size(self, subchash: str, q: QueryType) -> int:
        """
        Return stored concordance size.
        The method should return None if no record is found at all.

        Arguments:
        subchash -- a md5 hash generated from subcorpus identifier by
                    CorpusManager.get_Corpus()
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
    def cache_file_path(self, subchash: str, q: QueryType) -> str:
        """
        Return a path to a cache file matching provided subcorpus hash and query
        elements. If there is no entry matching (subchash, q) then None must be
        returned.

        arguments:
        subchash -- hashed subcorpus identifier (corplib.CorpusManager does this)
        q -- a list of query items
        """

    @abc.abstractmethod
    def add_to_map(self, subchash: str, query: QueryType, size: int, calc_status: Optional[CalcStatus] = None):
        """
        Add or update a cache map entry

        ------
        TODO: the current implementation has serious issues
        regarding hidden arguments and cache status relationships
        user cannot possibly understand. I.e. if a record is
        not present yet then calc_status cannot be None.
        ------

        arguments:
        subchash -- a subcorpus identifier hash (see corplib.CorpusManager.get_Corpus)
        query -- a list/tuple of query elements
        size -- current size of a respective concordance (the one defined by corpus, subchash
                and query)
        calc_status -- an instance of CalcStatus
        returns:
        2-tuple
            cache_file_path -- path to a respective cache file
            previous_status -- an instance of CalcStatus storing previous calc. state
        """

    @abc.abstractmethod
    def del_entry(self, subchash: str, q: QueryType):
        """
        Remove a specific entry with concrete subchash and query.

        subchash -- a md5 hash generated from subcorpus identifier by
                    CorpusManager.get_Corpus()
        q -- a list of query elements
        """

    @abc.abstractmethod
    def del_full_entry(self, subchash: str, q: QueryType):
        """
        Removes all the entries with the same base query no matter
        what other operations the query (e.g. shuffle, filter) contains.

        subchash -- a md5 hash generated from subcorpus identifier by
                    CorpusManager.get_Corpus()
        q -- a list of query elements
        """


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

    @abc.abstractmethod
    def fork(self) -> 'AbstractCacheMappingFactory':
        """
        Create a new instance with forked db plug-in. This is
        used only in case 'multiprocessing' is defined for
        background/asynchronous tasks.
        """
