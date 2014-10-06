# Copyright (c) 2003-2009  Pavel Rychly
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

    def _load_map(self):
        import cPickle
        ans = {}
        try:
            f = open(self._cache_dir + self.CACHE_FILENAME, 'rb')
            flck_sh_lock(f)
            ans = cPickle.load(f)
            flck_unlock(f)
            f.close()
        except cPickle.UnpicklingError as ex:
            logging.getLogger(__name__).warning('Failed to unpickle cache mapping file: %s' % ex)
            os.unlink(self._cache_dir + self.CACHE_FILENAME)
        except IOError as ex:
            logging.getLogger(__name__).warning('Failed to load concordance cache mapping: %s' % ex)
        return ans if ans is not None else {}

    def add_to_map(self, pid_dir, subchash, key, size):
        import cPickle
        kmap = pidfile = None
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
        else:
            ret = _uniqname(key, [r for (r, s) in kmap.values()])
            kmap[subchash, key] = (ret, size)
            f.seek(0)
            cPickle.dump(kmap, f)
            pidfile = open(pid_dir + ret + '.pid', 'w')
            pidfile.write(str(os.getpid()) + '\n')
            pidfile.flush()
        f.close()  # also automatically flck_unlock (f)
        if not pidfile:
            pidfile = pid_dir + ret + '.pid'
        return self._cache_dir + ret + '.conc', pidfile

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

    def __getitem__(self, item):
        if self._data is None:
            self._data = self._load_map()
        return self._data.get(item, None)

    def __delitem__(self, key):
        self._del_from_map(key)
        self._data = None  # forces load on next __getitem__



