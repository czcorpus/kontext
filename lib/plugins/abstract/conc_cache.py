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

import os
import time
import importlib
import logging
import abc
from typing import Dict, Any, Optional, Union, Tuple, List
from corplib.corpus import KCorpus

QueryType = Tuple[str, ...]


class ConcCacheStatusException(Exception):
    pass


class UnrecognizedSerializedException(ConcCacheStatusException):
    pass


class ConcCacheStatus(object):

    def __init__(self, task_id: Optional[str] = None, pid: Optional[int] = None, created: Optional[int] = None,
                 last_upd: Optional[int] = None, concsize: Optional[int] = 0, fullsize: Optional[int] = 0,
                 relconcsize: Optional[int] = 0, arf: Optional[float] = 0,
                 error: Union[str, Exception, None] = None, finished: Optional[bool] = False,
                 q0hash: str = None, cachefile: str = None, readable: bool = False) -> None:
        self.task_id: Optional[str] = task_id
        self.pid = pid if pid else os.getpid()
        self.created = created if created else int(time.time())
        self.last_upd = last_upd if last_upd else self.created
        self.concsize = concsize
        self.fullsize = fullsize
        self.relconcsize = relconcsize
        self.arf = arf
        self.error = ConcCacheStatus.normalize_error(error)
        self.finished = finished
        self.q0hash = q0hash
        self.cachefile = cachefile
        self.readable = readable

    @staticmethod
    def from_storage(
            task_id: Optional[str] = None, pid: Optional[int] = None, created: Optional[int] = None,
            last_upd: Optional[int] = None, concsize: Optional[int] = 0, fullsize: Optional[int] = 0,
            relconcsize: Optional[int] = 0, arf: Optional[float] = 0,
            error: Optional[List[str]] = None, finished: Optional[bool] = False,
            q0hash: str = None, cachefile: str = None, readable: bool = False):
        return ConcCacheStatus(
            task_id=task_id, pid=pid, created=created, last_upd=last_upd, concsize=concsize, fullsize=fullsize,
            relconcsize=relconcsize, arf=arf, error=ConcCacheStatus.deserialize_error(error),
            finished=finished, q0hash=q0hash, cachefile=cachefile, readable=readable)

    def to_dict(self) -> Dict[str, Any]:
        ans = dict(self.__dict__)
        ans['error'] = ConcCacheStatus.serialize_error(self.error)
        return ans

    def check_for_errors(self, time_limit: int):
        """
        check_for_errors checks for possible additional errors not detected
        during calc. process - typically a timeout error. It also tries
        to keep the status consistent (e.g. self.error => self.finished == True)
        """
        if self.error is not None and not self.finished:
            logging.getLogger(__name__).warning(
                'ConcCacheStatus.test_error - self.error set but self.finished is False - fixing')
        t1 = time.time()
        if not self.finished and t1 - self.last_upd > time_limit:
            self.error = ConcCacheStatusException(
                f'Wait limit for initial data exceeded (waited {t1 - self.last_upd} '
                f', limit: {time_limit})')
            self.finished = True

    def has_some_result(self, minsize: int) -> bool:
        return self.finished or (self.readable and self.concsize >= minsize)

    def update(self, **kw) -> 'ConcCacheStatus':
        for k, v in kw.items():
            if hasattr(self, k):
                if k == 'error':
                    self.error = ConcCacheStatus.normalize_error(v)
                else:
                    setattr(self, k, str(v))
            else:
                raise AssertionError(f'Unknown {self.__class__.__name__}  attribute: {k}')
        self.last_upd = int(time.time())
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
            m = err.__module__
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
                mname, cname = err[0].rsplit('.', 1)
                mod = importlib.import_module(mname)
                clazz = getattr(mod, cname)
                return clazz(err[1])
            except (ModuleNotFoundError, AttributeError, IndexError) as ex:
                raise UnrecognizedSerializedException(ex)
        return None


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
    def get_calc_status(self, subchash: str, query: QueryType) -> ConcCacheStatus:
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
    def add_to_map(self, subchash: Optional[str], query: QueryType, calc_status: ConcCacheStatus,
                   overwrite: bool = False) -> ConcCacheStatus:
        """
        Add a cache entry. If already present, the stored version is returned unless overwrite is set to True

        arguments:
        subchash -- a subcorpus identifier hash (see corplib.CorpusManager.get_corpus)
        query -- a list/tuple of query elements
        size -- current size of a respective concordance (the one defined by corpus, subchash
                and query)
        calc_status -- an instance of ConcCacheStatus
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
    def get_mapping(self, corpus: KCorpus) -> AbstractConcCache:
        """
        returns:
        an AbstractConcCache compatible instance
        """
