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
import importlib
import logging
import os
import time
from dataclasses import asdict, dataclass, field, InitVar
from typing import Any, Dict, List, Optional, Tuple, Union

from corplib.corpus import AbstractKCorpus

QueryType = Tuple[str, ...]


class ConcCacheStatusException(Exception):
    pass


class UnrecognizedSerializedException(ConcCacheStatusException):
    pass


@dataclass
class ConcCacheStatus:

    task_id: Optional[str] = field(default=None)
    concsize: int = field(default=0)
    fullsize: int = field(default=0)
    relconcsize: float = field(default=0)
    arf: float = field(default=0)
    error: InitVar[Optional[List[str]]] = field(default=None)
    _error: Optional[Exception] = field(default=None, init=False)
    finished: bool = field(default=False)
    q0hash: Optional[str] = field(default=None)
    cachefile: Optional[str] = field(default=None)
    readable: bool = field(default=False)
    pid: int = field(default_factory=lambda: os.getpid())
    created: float = field(default_factory=lambda: time.time())
    last_upd: float = field(default_factory=lambda: time.time())

    def __post_init__(self, error: Optional[List[str]]):
        self._error = ConcCacheStatus.deserialize_error(error)

    def is_consistent(self) -> bool:
        """
        The method tests if there is consistent situation between
        metadata attributes ('finished', 'readable') and actual data
        file existence. Inconsistent state can happen e.g. if someone
        manually deletes cache files while leaving corresponding
        Redis records.
        """
        if self.readable:
            return self.cachefile and os.path.isfile(self.cachefile)
        return True

    def recalc_relconcsize(self, corp: AbstractKCorpus):
        """
        Update relative frequency based on current fullsize/concsize and provided corpus (and its size).
        Please note that ARF is not updated here as it requires a respective (finished) concordance instance.
        """
        if self.fullsize > 0:
            self.relconcsize = 1000000.0 * self.fullsize / corp.search_size
        else:
            self.relconcsize = 1000000.0 * self.concsize / corp.search_size

    @staticmethod
    def from_storage(**kw):
        return ConcCacheStatus(**kw)

    @property
    def normalized_error(self):
        return ConcCacheStatus.normalize_error(self._error)

    @property
    def error(self):
        return self._error

    def to_dict(self) -> Dict[str, Any]:
        ans = asdict(self)
        ans['error'] = ConcCacheStatus.serialize_error(self.normalized_error)
        del ans['_error']
        return ans

    def check_for_errors(self, time_limit: int):
        """
        check_for_errors checks for possible additional errors not detected
        during calc. process - typically a timeout error. It also tries
        to keep the status consistent (e.g. self.error => self.finished == True)
        """
        if self.normalized_error is not None and not self.finished:
            logging.getLogger(__name__).warning(
                'ConcCacheStatus.test_error - self.error set but self.finished is False - fixing')
        t1 = time.time()
        if not self.finished and t1 - self.last_upd > time_limit:
            self._error = ConcCacheStatusException(
                f'Wait limit for initial data exceeded (waited {t1 - self.last_upd:.2f} '
                f', limit: {time_limit})')
            self.finished = True

    def has_some_result(self, minsize: int) -> bool:
        return self.finished or (self.readable and self.concsize >= minsize)

    def update(self, **kw) -> 'ConcCacheStatus':
        self.task_id = kw.get('task_id', self.task_id)
        self.concsize = kw.get('concsize', self.concsize)
        self.fullsize = kw.get('fullsize', self.fullsize)
        self.relconcsize = kw.get('relconcsize', self.relconcsize)
        self.arf = kw.get('arf', self.arf)
        self._error = kw.get('error', self._error)
        self.finished = kw.get('finished', self.finished)
        self.q0hash = kw.get('q0hash', self.q0hash)
        self.cachefile = kw.get('cachefile', self.cachefile)
        self.readable = kw.get('readable', self.readable)
        self.pid = kw.get('pid', self.pid)
        self.created = kw.get('created', self.created)
        self.last_upd = time.time()
        return self

    @staticmethod
    def normalize_error(err: Union[Exception, str, None]) -> Optional[Exception]:
        """
        normalize_error transforms possible alternative str-based error specification
        into a proper exception. None is also accepted (and passed without transformation).
        """
        if err is None:
            return None
        elif isinstance(err, Exception):
            return err
        return ConcCacheStatusException(str(err))

    @staticmethod
    def serialize_error(err: Union[Exception, None]):
        """
        serialize_error transforms an actual optional error into
        a tuple of two values (fully_qualified_class_name, error_message)
        so it can be JSON-serialized
        """
        if err is None:
            return err
        elif type(err) is str:
            return 'Exception', err
        else:
            m = err.__class__.__module__
            if m == 'builtins':
                return err.__class__.__qualname__, str(err)
            else:
                return f'{err.__module__}.{err.__class__.__qualname__}', str(err)

    @staticmethod
    def deserialize_error(err: List[str]) -> Optional[Exception]:
        """
        deserialize_error is a reverse function to serialize_error
        """
        if type(err) is tuple or type(err) is list:
            try:
                mname, cname = err[0].rsplit('.', 1) if '.' in err[0] else ('builtins', err[0])
                mod = importlib.import_module(mname)
                clazz = getattr(mod, cname)
                return clazz(err[1])
            except (ModuleNotFoundError, AttributeError, IndexError) as ex:
                raise UnrecognizedSerializedException(ex)
        return None


class AbstractConcCache(abc.ABC):

    @abc.abstractmethod
    async def get_stored_size(
            self, corp_cache_key: str, q: QueryType, cutoff: int) -> Union[Tuple[int, int], Tuple[None, None]]:
        """
        Return stored concordance size and fullsize (differs in case there is an implicit sample used).
        The method should return None if no record is found at all.

        Arguments:
        corp_cache_key -- a unique key/hash representing corpus(+subcorpus)
        q -- a list of query elements
        """

    @abc.abstractmethod
    async def get_calc_status(self, corp_cache_key: str, query: QueryType, cutoff: int) -> Union[ConcCacheStatus, None]:
        pass

    @abc.abstractmethod
    async def ensure_writable_storage(self):
        """
        Make sure the storage backend is able to accept writing
        of cached data. This can be e.g. checking and creating target
        filesystem directory.
        """

    @abc.abstractmethod
    async def readable_cache_path(self, corp_cache_key: str, q: QueryType, cutoff: int) -> Optional[str]:
        """
        Return a path to a cache file matching provided subcorpus hash and query
        elements. If there is no entry matching (corp_cache_key, q) or if a respective
        entry is not in the 'readable' state then None must be returned.

        arguments:
        corp_cache_key -- a unique key/hash representing corpus(+subcorpus)
        q -- a list of query items
        """

    @abc.abstractmethod
    async def add_to_map(
            self,
            corp_cache_key: Optional[str],
            query: QueryType,
            cutoff: int,
            calc_status: ConcCacheStatus,
            overwrite: bool = False) -> ConcCacheStatus:
        """
        Add a cache entry. If already present, the stored version is returned unless overwrite is set to True

        arguments:
        corp_cache_key -- a unique key/hash representing corpus(+subcorpus)
        query -- a list/tuple of query elements
        size -- current size of a respective concordance (the one defined by corpus, corp_cache_key
                and query)
        calc_status -- an instance of ConcCacheStatus
        overwrite -- if true then the new calc_status value is always used
        returns:
            an updated version of the original calc_status (e.g. with cachefile set)
        """

    @abc.abstractmethod
    async def del_entry(self, corp_cache_key: Optional[str], q: QueryType, cutoff: int):
        """
        Remove a specific entry with concrete corp_cache_key and query.

        corp_cache_key -- a unique key/hash representing corpus(+subcorpus)
        q -- a list of query elements
        """

    @abc.abstractmethod
    async def del_full_entry(self, corp_cache_key: Optional[str], q: QueryType, cutoff: int):
        """
        Removes all the entries with the same base query no matter
        what other operations the query (e.g. shuffle, filter) contains.

        corp_cache_key -- a unique key/hash representing corpus(+subcorpus)
        q -- a list of query elements
        """

    @abc.abstractmethod
    async def update_calc_status(self, corp_cache_key: Optional[str], query: QueryType, cutoff: int, **kw):
        pass


class AbstractCacheMappingFactory(abc.ABC):
    """
    A factory which provides AbstractConcCache instances. Please note
    that your module's 'create_instance' should return this factory and
    not the cache itself.
    """

    @abc.abstractmethod
    def get_mapping(self, corpus: AbstractKCorpus) -> AbstractConcCache:
        """
        returns:
        an AbstractConcCache compatible instance
        """
