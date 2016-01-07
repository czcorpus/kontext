# Copyright (c) 2003-2014  Pavel Rychly, Vojtech Kovar, Milos Jakubicek
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
"""
Functions for handling cache file mapping between (query, subcorpus) key
and filename containing respective saved concordances.

Please note that the current version uses a 2-tuple as a cache keys
which prevents Celery worker backend to use JSON as a message format
(i.e. pickle must be used).
"""
import os
import logging
import hashlib

from plugins.abstract.conc_cache import AbstractConcCache, AbstractCacheMappingFactory
from plugins import inject


def _uniqname(subchash, query):
    """
    Returns an unique hash based on subcorpus identifier/hash and a CQL query

    arguments:
    subchash -- a unique identifier of a corpus (actually any unique string is ok here); can be None too
    query -- a list/tuple containing CQL query elements (base query, filters, aligned corpora etc.)

    returns:
    an md5 hexadecimal digest of passed data
    """
    if subchash is None:
        subchash = ''
    return hashlib.md5('#'.join([q.encode('utf-8') for q in query]) + subchash).hexdigest()


class CacheMapping(AbstractConcCache):

    CACHE_FILENAME = '00CONCS.map'

    def __init__(self, cache_dir, corpus, lock_factory):
        self._cache_root_dir = cache_dir
        self._corpus = corpus
        self._lock_factory = lock_factory
        self._data = None

    def __getitem__(self, item):
        return self.data.get(item, None)

    def __delitem__(self, key):
        self._del_from_map(key)
        self._data = None  # forces auto-load on next __getitem__

    def refresh_map(self):
        cache_dir = self._cache_dir_path()
        if not os.path.isdir(cache_dir):
            os.makedirs(cache_dir)

    @property
    def data(self):
        if self._data is None:
            self._data = self._load_map()
        return self._data

    def _clear_cache(self):
        if os.path.exists(self._cache_map_path()):
            os.unlink(self._cache_map_path())

    def _load_map(self):
        import cPickle
        ans = {}
        try:
            with self._lock_factory.create(self._cache_map_path()):
                with open(self._cache_map_path(), 'rb') as f:
                    ans = cPickle.load(f)
        except (ValueError, IOError, EOFError,    cPickle.UnpicklingError) as ex:
            logging.getLogger(__name__).warning('Failed to load/unpickle cache mapping file: %s' % ex)
            self._clear_cache()
        return ans if ans is not None else {}

    def _cache_dir_path(self):
        return os.path.normpath('%s/%s' % (self._cache_root_dir, self._corpus.corpname))

    def cache_file_path(self, subchash, q):
        val = self.__getitem__((subchash, q))
        if val:
            return os.path.normpath('%s/%s.conc' % (self._cache_dir_path(), val[0]))
        return None

    def _cache_map_path(self):
        return os.path.normpath('%s/%s' % (self._cache_dir_path(), self.CACHE_FILENAME))

    def add_to_map(self, subchash, query, size, pid_file=None):
        import cPickle
        with self._lock_factory.create(self._cache_map_path()):
            if not os.path.exists(self._cache_map_path()):
                with open(self._cache_map_path(), 'wb') as f_new:
                    cPickle.dump({}, f_new)
            with open(self._cache_map_path(), 'r+b') as f:
                kmap = cPickle.load(f)
                if (subchash, query) in kmap:
                    ret, storedsize, stored_pidfile = kmap[subchash, query]
                    if storedsize < size:
                        kmap[subchash, query] = (ret, size, stored_pidfile)
                        f.seek(0)
                        cPickle.dump(kmap, f)
                else:
                    stored_pidfile = None
                    ret = _uniqname(subchash, query)
                    kmap[subchash, query] = (ret, size, pid_file)
                    f.seek(0)
                    cPickle.dump(kmap, f)
                return os.path.normpath('%s/%s.conc' % (self._cache_dir_path(), ret)), stored_pidfile

    def _del_from_map(self, tuple_key):
        subchash, key = tuple_key
        import cPickle

        with self._lock_factory.create(self._cache_map_path()):
            with open(self._cache_map_path(), 'r+b') as f:
                kmap = cPickle.load(f)
                try:
                    del kmap[subchash, key]
                    f.seek(0)
                    cPickle.dump(kmap, f)
                except KeyError:
                    pass

    def del_full_entry(self, entry_key):
        for k in self.data.keys():
            if entry_key[0] == k[0] and entry_key[1][0] == k[1][0]:
                # original record's key must be used (k ~ entry_key match can be partial)
                self.__delitem__(k)


class CacheMappingFactory(AbstractCacheMappingFactory):
    """
    In case of concordance cache the plug-in is in fact this factory instance
    which produces individual instances (distinguished by cache_dir) of actual
    cache-control object.
    """

    def __init__(self, cache_dir, lock_factory):
        self._cache_dir = cache_dir
        self._lock_factory = lock_factory

    def get_mapping(self, corpus):
        return CacheMapping(self._cache_dir, corpus, self._lock_factory)


@inject('locking')
def create_instance(settings, lock_factory):
    return CacheMappingFactory(cache_dir=settings.get('plugins', 'conc_cache')['default:cache_dir'],
                               lock_factory=lock_factory)
