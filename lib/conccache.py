# Copyright (c) 2003-2009  Pavel Rychly
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
Functions for handling cache file mapping between queries+subcorpora and filenames
containing respective saved concordances.
"""

from butils import flck_sh_lock, flck_ex_lock, flck_unlock
import os


CACHE_FILENAME = '00CONCS.map'


def load_map(cache_dir):
    import cPickle
    try:
        f = open(cache_dir + CACHE_FILENAME, 'rb')
    except IOError:
        return {}
    try:
        flck_sh_lock(f)
        ret = cPickle.load(f)
        flck_unlock(f)
    except cPickle.UnpicklingError:
        os.rename(cache_dir + CACHE_FILENAME,
                  cache_dir + '00CONCS-broken-%d.map' % os.getpid())
        return {}
    return ret


def uniqname(key, used):
    name = '#'.join([''.join([c for c in w if c.isalnum()]) for w in key])
    name = name[1:15].encode("UTF-8")  # UTF-8 because os.path manipulations
    if not name:
        name = 'noalnums'
    if name in used:
        used = [w[len(name):] for w in used if w.startswith(name)]
        i = 0
        while str(i) in used:
            i += 1
        name += str(i)
    return name


def add_to_map(cache_dir, pid_dir, subchash, key, size):
    import cPickle
    kmap = pidfile = None
    try:
        f = open(cache_dir + CACHE_FILENAME, 'r+b')
    except IOError:
        f = open(cache_dir + CACHE_FILENAME, 'wb')
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
        ret = uniqname(key, [r for (r, s) in kmap.values()])
        kmap[subchash, key] = (ret, size)
        f.seek(0)
        cPickle.dump(kmap, f)
        pidfile = open(pid_dir + ret + ".pid", "w")
        pidfile.write(str(os.getpid()) + "\n")
        pidfile.flush()
    f.close()  # also automatically flck_unlock (f)
    if not pidfile:
        pidfile = pid_dir + ret + ".pid"
    return cache_dir + ret + ".conc", pidfile


def del_from_map(cache_dir, subchash, key):
    import cPickle
    try:
        f = open(cache_dir + CACHE_FILENAME, 'r+b')
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