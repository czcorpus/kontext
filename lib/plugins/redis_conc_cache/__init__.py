# Copyright (c) 2016 Institute of the Czech National Corpus
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

This version uses simple string hashes as cache keys which makes it
suitable for use with Celery configured to use a JSON message format.

configuration XML:

element conc_cache {
  element module { "redis_conc_cache" }
  element cache_dir {
    attribute extension-by { "default" }
    { text }
  }
}

"""
import os
import hashlib
import json

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


class RedisCacheMapping(AbstractConcCache):
    """
    This class provides cache mapping between subchash+query and cached information
    stored within Redis (as opposed to the "default_conc_cache" which uses a special
    pickle-serialized mapping file).

    Mapping looks like this:
    md5(subchash, q) => [stored_conc_size, pidfile, hash_of(subchash, q[0])]
    """

    KEY_TEMPLATE = 'conc_cache:%s'

    def __init__(self, cache_dir, corpus, db):
        self._cache_root_dir = cache_dir
        self._corpus = corpus
        self._db = db

    def _get_entry(self, subchash, q):
        val = self._db.hash_get(self._mk_key(), _uniqname(subchash, q))
        if val:
            return json.loads(val)
        return None

    def _set_entry(self, subchash, q, data):
        self._db.hash_set(self._mk_key(), _uniqname(subchash, q), json.dumps(data))

    def _mk_key(self):
        return RedisCacheMapping.KEY_TEMPLATE % self._corpus.corpname

    def get_stored_pidfile(self, subchash, q):
        val = self._get_entry(subchash, q)
        return val[1] if val else None

    def get_stored_size(self, subchash, q):
        val = self._get_entry(subchash, q)
        return val[0] if val else None

    def refresh_map(self):
        cache_dir = self._cache_dir_path()
        if not os.path.isdir(cache_dir):
            os.makedirs(cache_dir)

    def _cache_dir_path(self):
        return os.path.normpath('%s/%s' % (self._cache_root_dir, self._corpus.corpname))

    def _create_cache_file_path(self, subchash, q):
        return os.path.normpath('%s/%s.conc' % (self._cache_dir_path(), _uniqname(subchash, q)))

    def cache_file_path(self, subchash, q):
        val = self._get_entry(subchash, q)
        if val:
            return self._create_cache_file_path(subchash, q)
        return None

    def add_to_map(self, subchash, query, size, pid_file=None):
        stored_data = self._get_entry(subchash, query)
        if stored_data:
            storedsize, stored_pidfile, q0hash = stored_data
            if storedsize < size:
                self._set_entry(subchash, query, [size, stored_pidfile, q0hash])
        else:
            stored_pidfile = None
            self._set_entry(subchash, query, [size, pid_file, _uniqname(subchash, query[:1])])
        return self._create_cache_file_path(subchash, query), stored_pidfile

    def del_entry(self, subchash, q):
        self._db.hash_del(self._mk_key(), _uniqname(subchash, q))

    def del_full_entry(self, subchash, q):
        for k, v in self._db.hash_get_all(self._mk_key()).items():
            stored = json.loads(v)
            if _uniqname(subchash, q[:1]) == stored[2]:  # stored[2] = q0hash
                # original record's key must be used (k ~ entry_key match can be partial)
                self._db.hash_del(self._mk_key(), k)  # must use direct access here (no del_entry())


class CacheMappingFactory(AbstractCacheMappingFactory):
    """
    In case of concordance cache the plug-in is in fact this factory instance
    which produces individual instances (distinguished by cache_dir) of actual
    cache-control object.
    """

    def __init__(self, cache_dir, db):
        self._cache_dir = cache_dir
        self._db = db

    def get_mapping(self, corpus):
        return RedisCacheMapping(self._cache_dir, corpus, self._db)

    def export_tasks(self):
        """
        Export tasks for Celery worker(s)
        """
        from cleanup import run

        def conc_cache_cleanup(ttl, subdir, dry_run):
            return run(root_dir=self._cache_dir,
                       corpus_id=None, ttl=ttl, subdir=subdir, dry_run=dry_run,
                       db_plugin=self._db, entry_key_gen=lambda c: RedisCacheMapping.KEY_TEMPLATE % c)
        return conc_cache_cleanup,


@inject('db')
def create_instance(settings, db):
    return CacheMappingFactory(cache_dir=settings.get('plugins', 'conc_cache')['default:cache_dir'], db=db)
