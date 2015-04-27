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

from butils import flck_sh_lock, flck_ex_lock, flck_unlock


def _uniqname(key, used):
    name = '#'.join([''.join([c for c in w if c.isalnum()]) for w in key])
    name = name[1:15].encode('UTF-8')  # UTF-8 because os.path manipulations
    if not name:
        name = 'noalnums'
    if name in used:
        used = [w[len(name):] for w in used if w.startswith(name)]
        i = 0
        while str(i) in used:
            i += 1
        name += str(i)
    return name


class CacheMapping(object):

    CACHE_FILENAME = '00CONCS.map'

    def __init__(self, cache_dir):
        self._cache_dir = cache_dir
        self._data = None

    @property
    def data(self):
        if self._data is None:
            self._data = self._load_map()
        return self._data

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
            try:  # TODO - the 'except' is here temporarily to monitor invalid cache map entries
                ret = _uniqname(key, [r for (r, s) in kmap.values()])
            except Exception as e:
                logging.getLogger(__name__).error('Failed to unpack value from cache map: %s, entry: %s' %
                                                  (e, filter(lambda x: type(x) is not tuple, kmap.values()), ))
                tmp = map(lambda x: x if type(x) is tuple else (x, 0), kmap.values())
                ret = _uniqname(key, [r for (r, s) in tmp])
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

    def get_mapping(self, cache_dir):
        return CacheMapping(cache_dir)


def create_instance(settings, db):
    return CacheMappingFactory()
