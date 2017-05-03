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


configuration XML:

element conc_cache {
  element module { "default_conc_cache" }
  element cache_dir {
    attribute extension-by { "default" }
    { text }
  }
}

"""
import os
import logging
import hashlib
try:
    import cPickle as pickle
except ImportError:
    import pickle

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
    return hashlib.md5('#'.join([q.encode('utf-8') for q in query]) + subchash.encode('utf-8')).hexdigest()


class CacheMapping(AbstractConcCache):
    """
    Mapping looks like this:
    (subchash, q) => [conc_cache_file_hash, stored_conc_size, pidfile]

    Please note that in this case only pickle serialization can be used
    as the key is a tuple of a string and a list.
    """

    CACHE_FILENAME = '00CONCS.map'

    def __init__(self, cache_dir, corpus, lock_factory):
        self._cache_root_dir = cache_dir
        self._corpus = corpus
        self._lock_factory = lock_factory
        self._data = None

    @property
    def data(self):
        if self._data is None:
            self._data = self._load_map()
        return self._data

    def _get_entry(self, subchash, q):
        return self.data.get((subchash, q), None)

    def get_stored_pidfile(self, subchash, q):
        val = self._get_entry(subchash, q)
        return val[2] if val else None

    def get_stored_size(self, subchash, q):
        val = self._get_entry(subchash, q)
        return val[1] if val else None

    def refresh_map(self):
        cache_dir = self._cache_dir_path()
        if not os.path.isdir(cache_dir):
            os.makedirs(cache_dir)

    def _clear_cache(self):
        if os.path.exists(self._cache_map_path()):
            os.unlink(self._cache_map_path())

    def _load_map(self):
        ans = {}
        try:
            with self._lock_factory.create(self._cache_map_path()):
                with open(self._cache_map_path(), 'rb') as f:
                    ans = pickle.load(f)
        except (ValueError, IOError, EOFError, pickle.UnpicklingError) as ex:
            logging.getLogger(__name__).warning('Failed to load/unpickle cache mapping file: %s' % ex)
            self._clear_cache()
        return ans if ans is not None else {}

    def _cache_dir_path(self):
        return os.path.normpath('%s/%s' % (self._cache_root_dir, self._corpus.corpname))

    def cache_file_path(self, subchash, q):
        val = self._get_entry(subchash, q)
        if val:
            return os.path.normpath('%s/%s.conc' % (self._cache_dir_path(), val[0]))
        return None

    def _cache_map_path(self):
        return os.path.normpath('%s/%s' % (self._cache_dir_path(), self.CACHE_FILENAME))

    def add_to_map(self, subchash, query, size, calc_status=None):
        with self._lock_factory.create(self._cache_map_path()):
            if not os.path.exists(self._cache_map_path()):
                with open(self._cache_map_path(), 'wb') as f_new:
                    pickle.dump({}, f_new)
            with open(self._cache_map_path(), 'r+b') as f:
                kmap = pickle.load(f)
                if (subchash, query) in kmap:
                    ret, storedsize, stored_pidfile = kmap[subchash, query]
                    if storedsize < size:
                        kmap[subchash, query] = (ret, size, stored_pidfile)
                        f.seek(0)
                        pickle.dump(kmap, f)
                else:
                    stored_pidfile = None
                    ret = _uniqname(subchash, query)
                    kmap[subchash, query] = (ret, size, calc_status.to_dict())
                    f.seek(0)
                    pickle.dump(kmap, f)
                return os.path.normpath('%s/%s.conc' % (self._cache_dir_path(), ret)), stored_pidfile

    def _del_from_map(self, tuple_key):
        subchash, key = tuple_key

        with self._lock_factory.create(self._cache_map_path()):
            with open(self._cache_map_path(), 'r+b') as f:
                kmap = pickle.load(f)
                try:
                    del kmap[subchash, key]
                    f.seek(0)
                    pickle.dump(kmap, f)
                except KeyError:
                    pass

    def del_entry(self, subchash, q):
        self._del_from_map((subchash, q))
        self._data = None  # forces auto-load on next _get_etry

    def del_full_entry(self, subchash, q):
        for k in self.data.keys():
            if subchash == k[0] and q[0] == k[1][0]:
                # original record's key must be used (k ~ entry_key match can be partial)
                self.del_entry(subchash, k)


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

    def export_tasks(self):
        """
        Export tasks for Celery worker(s)
        """
        from cleanup import run

        def conc_cache_cleanup(ttl, subdir, dry_run):
            from plugins.default_conc_cache import CacheMapping
            return run(root_dir=self._cache_dir,
                       corpus_id=None, ttl=ttl, subdir=subdir, dry_run=dry_run,
                       cache_map_filename=CacheMapping.CACHE_FILENAME,
                       locking_plugin=self._lock_factory)
        return conc_cache_cleanup,


@inject('locking')
def create_instance(settings, lock_factory):
    return CacheMappingFactory(cache_dir=settings.get('plugins', 'conc_cache')['default:cache_dir'],
                               lock_factory=lock_factory)
