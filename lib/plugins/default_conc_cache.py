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
import hashlib

from butils import flck_sh_lock, flck_ex_lock, flck_unlock


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


class CacheMapping(object):

    CACHE_FILENAME = '00CONCS.map'

    def __init__(self, cache_dir, corpus):
        self._cache_root_dir = cache_dir
        self._corpus = corpus
        self._data = None

    def __getitem__(self, item):
        return self.data.get(item, None)

    def __delitem__(self, key):
        self._del_from_map(key)
        self._data = None  # forces auto-load on next __getitem__

    def refresh_map(self):
        cache_dir = self.cache_dir_path()
        if not os.path.isdir(cache_dir):
            os.makedirs(cache_dir)
        elif os.path.isfile(self.cache_map_path()) and os.stat(self.cache_map_path()).st_mtime < \
                os.stat(self._corpus.get_conf('PATH') + 'word.text').st_mtime:
            os.remove(self.cache_map_path())
            for f in os.listdir(cache_dir):
                os.remove(cache_dir + f)

    @property
    def data(self):
        if self._data is None:
            self._data = self._load_map()
        return self._data

    def _clear_cache(self):
        if os.path.exists(self.cache_map_path()):
            os.unlink(self.cache_map_path())

    def _load_map(self):
        import cPickle
        ans = {}
        try:
            f = open(self.cache_map_path(), 'rb')
            flck_sh_lock(f)
            ans = cPickle.load(f)
            flck_unlock(f)
            f.close()
        except (ValueError, IOError, EOFError, cPickle.UnpicklingError) as ex:
            logging.getLogger(__name__).warning('Failed to load/unpickle cache mapping file: %s' % ex)
            self._clear_cache()
        return ans if ans is not None else {}

    def cache_dir_path(self):
        return os.path.normpath('%s/%s' % (self._cache_root_dir, self._corpus.corpname))

    def cache_file_path(self, subchash, q):
        val = self.__getitem__((subchash, q))
        if val:
            return os.path.normpath('%s/%s.conc' % (self.cache_dir_path(), val[0]))
        return None

    def cache_map_path(self):
        return os.path.normpath('%s/%s' % (self.cache_dir_path(), self.CACHE_FILENAME))

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
        if os.path.exists(self.cache_map_path()):
            f = open(self.cache_map_path(), 'r+b')
        else:
            f = open(self.cache_map_path(), 'wb')
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
                        # in case we check status before any calculation (represented by the
                        # BackgroundCalc class) starts (the calculation updates curr_wait as it
                        # runs), we want to be sure the limit is big enough for BackgroundCalc to
                        # be considered alive
                        'curr_wait': 100,
                        'error': None
                    },
                    pf)
            already_present = False
        f.close()  # also automatically flck_unlock (f)
        return os.path.normpath('%s/%s.conc' % (self.cache_dir_path(), ret)), \
               pidfile, \
               already_present

    def _del_from_map(self, tuple_key):
        subchash, key = tuple_key
        import cPickle
        try:
            f = open(self.cache_map_path(), 'r+b')
        except IOError as e:
            logging.getLogger(__name__).warning('Failed to delete map file %s due to: %s' %
                                                self.cache_map_path(), e)
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
                # original record's key must be used (k ~ entry_key match can be partial)
                self.__delitem__(k)


class CacheMappingFactory(object):

    def __init__(self, cache_dir):
        self._cache_dir = cache_dir

    def get_mapping(self, corpus):
        return CacheMapping(self._cache_dir, corpus)


def create_instance(settings, db):
    return CacheMappingFactory(cache_dir=settings.get('plugins', 'conc_cache')['default:cache_dir'])
