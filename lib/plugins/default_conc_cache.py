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
"""
import os
import logging
import time
from hashlib import md5, sha1

from butils import flck_sh_lock, flck_ex_lock, flck_unlock


def fspath_hash(path):
    return sha1(path).hexdigest()


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
    return md5('#'.join([q.encode('utf-8') for q in query]) + subchash).hexdigest()


class DummyMetadata(object):
    """
    This is just a dummy replacement for CacheMetadata class
    in case there is no need to store any metadata for
    cached files.
    """
    def log_file_use(self, path):
        pass


class CacheMetadata(object):
    """
    This class stores additional metadata for individual cached
    files. It expects a KeyValueStorage instance as a storage.
    Stored information can be used by independently running cache
    clean-up script.
    """

    def __init__(self, db, ttl, initial_health):
        self._db = db
        self._ttl = ttl
        self._initial_health = initial_health

    @staticmethod
    def _mk_key(path_hash):
        return 'conc_cache:%s' % path_hash[:8]

    def load_item(self, path_hash):
        """
        Loads an item from storage

        arguments:
        path_hash -- a hash (determined by function fspath_hash) of cache file's absolute path

        returns:
        a matching item or None
        """
        return self._db.get(self._mk_key(path_hash), {})

    def save_item(self, path_hash, data):
        """
        Saves respective item to the storage.

        arguments:
        path_hash -- a hash (determined by function fspath_hash) of cache file's absolute path
        data -- a dict containing cache file metadata
        """
        self._db.set(self._mk_key(path_hash), data)

    def remove_item(self, path_hash):
        """
        Removes an item from the storage

        arguments:
        path_hash -- a hash (determined by function fspath_hash) of cache file's absolute path
        """
        self._db.remove(self._mk_key(path_hash))

    def log_file_use(self, path):
        """
        Logs cache file access. In case no metadata is present for the file yet
        it creates a new record.
        The file is given following properties:
          * counter (initialized to 1) - keeps track on how many times the file has been used
          * health - a "magic" value initialized to some empiric value and then decreased by the clean-up script
          * path - the value of the 'path' argument
          * created - a timestamp with creation time

        arguments:
        path -- an absolute path to the cache file (i.e. no hash here)
        """
        key = fspath_hash(path)
        data = self.load_item(key)
        if not data:
            data['counter'] = 1
            data['health'] = self._initial_health
            data['path'] = path
            data['created'] = int(round(time.time()))
            self.save_item(key, data)
            self._db.set_ttl(self._mk_key(key), self._ttl)
        else:
            data['counter'] += 1
            self.save_item(key, data)

    def apply_on_entries(self, fn, match='conc_cache:*'):
        """
        Applies a function "fn" to a set of matching keys in a following
        manner: fn(plugins.redis_db.RedisDb, key)
        """
        self._db.apply_on_entries(fn, match=match)


class CacheMapping(object):
    """
    A slightly modified version of Bonito's original CacheMapping.
    """

    CACHE_FILENAME = '00CONCS.map'

    def __init__(self, cache_dir, metadb):
        self._cache_dir = cache_dir
        self._data = None
        self._metadb = metadb

    @property
    def data(self):
        if self._data is None:
            self._data = self._load_map()
        return self._data

    def log_use(self, path):
        """
        Logs an information that a passed cache file has been read.
        This may be used by a cache-cleaning script.
        """
        self._metadb.log_file_use(path)

    def _clear_cache(self):
        if os.path.exists(self._cache_dir + self.CACHE_FILENAME):
            os.unlink(self._cache_dir + self.CACHE_FILENAME)

    def _load_map(self):
        import cPickle
        ans = {}
        try:
            f = open(self._cache_dir + self.CACHE_FILENAME, 'rb')
            flck_sh_lock(f)
            ans = cPickle.load(f)
            flck_unlock(f)
            f.close()
        except (ValueError, IOError, EOFError, cPickle.UnpicklingError) as ex:
            logging.getLogger(__name__).warning('Failed to load/unpickle cache mapping file: %s' % ex)
            self._clear_cache()
        return ans if ans is not None else {}

    def add_to_map(self, pid_dir, subchash, key, size):
        """
        returns:
        3-tuple
            cache_file_path -- path to a cache file
            pidfile_path -- path to a pidfile
            already_present -- True if the record already exists
        """
        import cPickle
        kmap = None
        try:
            f = open(self._cache_dir + self.CACHE_FILENAME, 'r+b')
        except IOError:
            f = open(self._cache_dir + self.CACHE_FILENAME, 'wb')
            kmap = {}
        flck_ex_lock(f)
        if kmap is None:
            kmap = cPickle.load(f)
        if (subchash, key) in kmap:
            ret, storedsize = kmap[subchash, key]
            if storedsize < size:
                kmap[subchash, key] = (ret, size)
                f.seek(0)
                cPickle.dump(kmap, f)
            pidfile = pid_dir + ret + '.pid',
            already_present = True
        else:
            ret = _uniqname(subchash, key)
            kmap[subchash, key] = (ret, size)
            f.seek(0)
            cPickle.dump(kmap, f)
            pidfile = pid_dir + ret + '.pid'
            with open(pidfile, 'wb') as pf:
                cPickle.dump(
                    {
                        'pid': os.getpid(),
                        'last_check': int(time.time()),
                        # in case we check status before any calculation (represented by the BackgroundCalc class)
                        # starts (the calculation updates curr_wait as it runs), we want to be
                        # sure the limit is big enough for BackgroundCalc to be considered alive
                        'curr_wait': 100,
                        'error': None
                    },
                    pf)
            already_present = False
        f.close()  # also automatically flck_unlock (f)
        return self._cache_dir + ret + '.conc', pidfile, already_present

    def _del_from_map(self, tuple_key):
        subchash, key = tuple_key
        import cPickle
        try:
            f = open(self._cache_dir + self.CACHE_FILENAME, 'r+b')
        except IOError:
            return
        flck_ex_lock(f)
        kmap = cPickle.load(f)
        try:
            del kmap[subchash, key]
            f.seek(0)
            cPickle.dump(kmap, f)
        except KeyError:
            pass
        f.close()  # also automatically flck_unlock (f)

    def del_full_entry(self, entry_key):
        """
        Removes all the entries with the same base query no matter
        what other parameters (e.g. shuffle) of the query are.

        arguments:
        entry_key -- a 2-tuple (subchash, query) where query is a tuple of min length 1
        """
        for k in self.data.keys():
            if entry_key[0] == k[0] and entry_key[1][0] == k[1][0]:
                self.__delitem__(k)   # original record's key must be used (k ~ entry_key match can be partial)

    def __getitem__(self, item):
        return self.data.get(item, None)

    def __delitem__(self, key):
        self._del_from_map(key)
        self._data = None  # forces auto-load on next __getitem__


class CacheMappingFactory(object):
    """
    In case of concordance cache the plug-in is in fact this factory instance
    which produces individual instances (distinguished by cache_dir) of actual
    cache-control object.
    """

    def __init__(self, db, conf):
        """
        arguments:
        db -- a KeyValueStorage compatible object
        conf -- KonText settings
        """
        ttl = 3600 * int(conf.get('plugins', 'conc_cache').get('default:fallback_ttl', 5))
        initial_health = float(conf.get('plugins', 'conc_cache').get('default:initial_health', 5))
        tmp = conf.get('plugins', 'conc_cache').get('default:log_access', False)
        log_access = tmp in (True, 'true', '1')
        self._metadb = CacheMetadata(db=db, ttl=ttl, initial_health=initial_health) if log_access else DummyMetadata()

    def get_mapping(self, cache_dir):
        """
        Creates a new CacheMapping instance

        arguments:
        cache_dir -- a directory where the cache should operate
        """
        # please note that the _metadb is shared between all CacheMapping instances
        return CacheMapping(cache_dir, self._metadb)

    @property
    def metadb(self):
        """
        Returns a metadata object (CacheMetadata or DummyMetadata)
        """
        return self._metadb


def create_instance(settings, db):
    return CacheMappingFactory(db, settings)
