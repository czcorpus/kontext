# Copyright (c) 2016 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
An implementation of KonText's concordance cache which stores all
the meta-data via DB plug-in.

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
import hashlib
from typing import Union, Tuple, Optional
import logging
import manatee

import plugins
from plugins.abstract.conc_cache import AbstractConcCache, AbstractCacheMappingFactory, CalcStatus
from plugins import inject
from plugins.abstract.general_storage import KeyValueStorage

CachedConcInfo = Tuple[int, CalcStatus, str]


def _uniqname(subchash: Optional[str], query: Tuple[str, ...]):
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
    return hashlib.md5(('#'.join([q for q in query]) + subchash).encode('utf-8')).hexdigest()


class DefaultCacheMapping(AbstractConcCache):
    """
    This class provides cache mapping between subchash+query and cached information
    stored via DB plug-in

    Mapping looks like this:
    md5(subchash, q) => [stored_conc_size, calc_status, hash_of(subchash, q[0])]
    """

    KEY_TEMPLATE = 'conc_cache:{}'

    def __init__(self, cache_dir: str, corpus: manatee.Corpus, db: KeyValueStorage):
        self._cache_root_dir = cache_dir
        self._corpus = corpus
        self._db = db

    def _get_entry(self, subchash, q) -> Union[CalcStatus, None]:
        val = self._db.hash_get(self._mk_key(), _uniqname(subchash, q))
        if val and type(val) is dict:
            return CalcStatus(**val)
        return None

    def _set_entry(self, subchash, q, data: CalcStatus):
        self._db.hash_set(self._mk_key(), _uniqname(subchash, q), data.to_dict())

    def _mk_key(self) -> str:
        return DefaultCacheMapping.KEY_TEMPLATE.format(self._corpus.corpname)

    def get_stored_calc_status(self, subchash: Optional[str], q: Tuple[str, ...]) -> Union[CalcStatus, None]:
        return self._get_entry(subchash, q)

    def get_stored_size(self, subchash: Optional[str], q: Tuple[str, ...]) -> Union[int, None]:
        val = self._get_entry(subchash, q)
        return val.concsize if val else None

    def refresh_map(self):
        """
        TODO change the name to something meaningful
        """
        cache_dir = self._cache_dir_path()
        if not os.path.isdir(cache_dir):
            os.makedirs(cache_dir)
            os.chmod(cache_dir, 0o775)

    def _cache_dir_path(self) -> str:
        return os.path.normpath('%s/%s' % (self._cache_root_dir, self._corpus.corpname))

    def _create_cache_file_path(self, subchash: Optional[str], q: Tuple[str, ...]) -> str:
        return os.path.normpath('%s/%s.conc' % (self._cache_dir_path(), _uniqname(subchash, q)))

    def readable_cache_path(self, subchash, q) -> Optional[str]:
        val = self._get_entry(subchash, q)
        return val.cachefile if val and val.readable else None

    def add_to_map(self, subchash: Optional[str], query: Tuple[str, ...], calc_status: CalcStatus,
                   overwrite: bool = False) -> CalcStatus:
        """
        return:
        path to a created cache file
        """
        prev_status = self._get_entry(subchash, query)
        if prev_status and not overwrite:
            return prev_status
        calc_status.q0hash = _uniqname(subchash, query[:1])
        calc_status.cachefile = self._create_cache_file_path(subchash, query)
        self._set_entry(subchash, query, calc_status)
        return calc_status

    def get_calc_status(self, subchash: Optional[str], query: Tuple[str, ...]) -> Union[CalcStatus, None]:
        return self._get_entry(subchash, query)

    def update_calc_status(self, subchash: Optional[str], query: Tuple[str, ...], **kw):
        stored_data = self._get_entry(subchash, query)
        if stored_data:
            stored_data.update(**kw)
            self._set_entry(subchash, query, stored_data)

    def del_entry(self, subchash: Optional[str], q: Tuple[str, ...]):
        self._db.hash_del(self._mk_key(), _uniqname(subchash, q))

    def del_full_entry(self, subchash: Optional[str], q: Tuple[str, ...]):
        for k, stored in self._db.hash_get_all(self._mk_key()).items():
            if stored:
                if type(stored) is not dict:
                    logging.getLogger(__name__).warning('Removed unsupported conc cache value: {}'.format(stored))
                    self._db.hash_del(self._mk_key(), k)
                else:
                    status = CalcStatus(**stored)
                    if _uniqname(subchash, q[:1]) == status.q0hash:
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
        return DefaultCacheMapping(self._cache_dir, corpus, self._db)

    def export_tasks(self):
        """
        Export tasks for Celery worker(s)
        """
        from .cleanup import run as run_cleanup
        from .monitor import run as run_monitor

        def conc_cache_cleanup(ttl_hours, subdir, dry_run, corpus_id=None):
            return run_cleanup(
                root_dir=self._cache_dir,
                corpus_id=corpus_id, ttl_hours=ttl_hours, subdir=subdir, dry_run=dry_run,
                db_plugin=self._db, entry_key_gen=lambda c: DefaultCacheMapping.KEY_TEMPLATE.format(c))

        def conc_cache_monitor(min_file_age, free_capacity_goal, free_capacity_trigger, elastic_conf):
            """
            This function is exported as a Celery task within KonText's worker and
            is intended to be used via Celery Beat as an additional monitoring and
            protection in situations when system load jumps high.

            arguments:
            min_file_age -- a minimum age a cache file must be of to be deletable (in seconds)
            free_capacity_goal -- a minimum capacity the task will try to free up in a single run (in bytes)
            free_capacity_trigger -- a maximum disk free capacity which triggers file removal process
            elastic_conf -- a tuple (URL, index, type) containing ElasticSearch server, index and document type
                            configuration for storing monitoring info; if None then the function is disabled
            """
            return run_monitor(root_dir=self._cache_dir, db_plugin=self._db,
                               entry_key_gen=lambda c: DefaultCacheMapping.KEY_TEMPLATE.format(c),
                               min_file_age=min_file_age, free_capacity_goal=free_capacity_goal,
                               free_capacity_trigger=free_capacity_trigger, elastic_conf=elastic_conf)

        return conc_cache_cleanup, conc_cache_monitor


@inject(plugins.runtime.DB)
def create_instance(settings, db):
    return CacheMappingFactory(cache_dir=settings.get('plugins', 'conc_cache')['default:cache_dir'], db=db)
