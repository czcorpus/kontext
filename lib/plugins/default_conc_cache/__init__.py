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
    { text }
  }
}

"""
import hashlib
import logging
import os
from typing import Optional, Tuple, Union

import aiofiles.os
import plugins
from corplib.corpus import KCorpus
from plugin_types.conc_cache import (AbstractCacheMappingFactory,
                                     AbstractConcCache, ConcCacheStatus)
from plugin_types.general_storage import KeyValueStorage
from plugins import inject


def _uniqname(corp_cache_key: Optional[str], query: Tuple[str, ...], cutoff: int):
    """
    Returns a unique hash based on subcorpus identifier/hash and a CQL query

    arguments:
    conc_cache_key -- a unique identifier of a corpus (actually any unique string is ok here); can be None too
    query -- a list/tuple containing CQL query elements (base query, filters, aligned corpora etc.)
    cutoff -- a limit applied to a respective concordance size

    returns:
    a hash string representing all the cache entry identifiers (= all the input args)
    """
    if corp_cache_key is None:
        corp_cache_key = ''
    return hashlib.sha1(('#'.join([q for q in query]) + corp_cache_key + str(cutoff)).encode('utf-8')).hexdigest()


class DefaultCacheMapping(AbstractConcCache):
    """
    This class provides cache mapping between corp_cache_key+query and cached information
    stored via DB plug-in

    Mapping looks like this:
    md5(corp_cache_key, q) => [stored_conc_size, calc_status, hash_of(corp_cache_key, q[0])]
    """

    KEY_TEMPLATE = 'conc_cache:{}'

    def __init__(self, cache_dir: str, corpus: KCorpus, db: KeyValueStorage):
        self._cache_root_dir = cache_dir
        self._corpus = corpus
        self._db = db

    async def _get_entry(self, corp_cache_key, q, cutoff) -> Union[ConcCacheStatus, None]:
        val = await self._db.hash_get(self._mk_key(), _uniqname(corp_cache_key, q, cutoff))
        if val and type(val) is dict:
            return ConcCacheStatus.from_storage(**val)
        return None

    async def _set_entry(self, corp_cache_key, q, cutoff, data: ConcCacheStatus):
        await self._db.hash_set(self._mk_key(), _uniqname(corp_cache_key, q, cutoff), data.to_dict())

    def _mk_key(self) -> str:
        return DefaultCacheMapping.KEY_TEMPLATE.format(self._corpus.corpname.lower())

    async def get_stored_calc_status(
            self, corp_cache_key: Optional[str], q: Tuple[str, ...], cutoff: int) -> Union[ConcCacheStatus, None]:
        return await self._get_entry(corp_cache_key, q, cutoff)

    async def get_stored_size(self, corp_cache_key, q, cutoff):
        val = await self._get_entry(corp_cache_key, q, cutoff)
        if val:
            return val.concsize, val.fullsize
        return None, None

    async def ensure_writable_storage(self):
        cache_dir = self._cache_dir_path()
        if not await aiofiles.os.path.isdir(cache_dir):
            await aiofiles.os.makedirs(cache_dir)
            os.chmod(cache_dir, 0o775)

    def _cache_dir_path(self) -> str:
        return os.path.join(self._cache_root_dir, self._corpus.corpname.lower())

    def _create_cache_file_path(self, corp_cache_key: Optional[str], q: Tuple[str, ...], cutoff: int) -> str:
        return os.path.normpath('{}/{}.conc'.format(self._cache_dir_path(), _uniqname(corp_cache_key, q, cutoff)))

    async def readable_cache_path(self, corp_cache_key, q, cutoff) -> Optional[str]:
        val = await self._get_entry(corp_cache_key, q, cutoff)
        return val.cachefile if val and val.readable and os.path.isfile(val.cachefile) else None

    async def add_to_map(self, corp_cache_key, query, cutoff, calc_status, overwrite=False) -> ConcCacheStatus:
        """
        return:
        path to a created cache file
        """
        prev_status = await self._get_entry(corp_cache_key, query, cutoff)
        if prev_status and not overwrite:
            return prev_status
        calc_status.q0hash = _uniqname(corp_cache_key, query[:1], cutoff)
        calc_status.cachefile = self._create_cache_file_path(corp_cache_key, query, cutoff)
        await self._set_entry(corp_cache_key, query, cutoff, calc_status)
        return calc_status

    async def get_calc_status(
            self, corp_cache_key, query, cutoff) -> Union[ConcCacheStatus, None]:
        return await self._get_entry(corp_cache_key, query, cutoff)

    async def update_calc_status(self, corp_cache_key, query, cutoff, **kw):
        stored_data = await self._get_entry(corp_cache_key, query, cutoff)
        if stored_data:
            stored_data.update(**kw)
            await self._set_entry(corp_cache_key, query, cutoff, stored_data)

    async def del_entry(self, corp_cache_key, q, cutoff):
        await self._db.hash_del(self._mk_key(), _uniqname(corp_cache_key, q, cutoff))

    async def del_full_entry(self, corp_cache_key, q, cutoff):
        for k, stored in (await self._db.hash_get_all(self._mk_key())).items():
            if stored:
                if type(stored) is not dict:
                    logging.getLogger(__name__).warning(
                        'Removed unsupported conc cache value: {}'.format(stored))
                    await self._db.hash_del(self._mk_key(), k)
                else:
                    status = ConcCacheStatus.from_storage(**stored)
                    if _uniqname(corp_cache_key, q[:1], cutoff) == status.q0hash:
                        # original record's key must be used (k ~ entry_key match can be partial)
                        # must use direct access here (no del_entry())
                        await self._db.hash_del(self._mk_key(), k)


class CacheMappingFactory(AbstractCacheMappingFactory):
    """
    In case of concordance cache the plug-in is in fact this factory instance
    which produces individual instances (distinguished by cache_dir) of actual
    cache-control object.
    """

    def __init__(self, cache_dir: str, db: KeyValueStorage):
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

        async def conc_cache_cleanup(ttl_hours, subdir, dry_run, corpus_id=None):
            return await run_cleanup(
                root_dir=self._cache_dir,
                corpus_id=corpus_id, ttl_hours=ttl_hours, subdir=subdir, dry_run=dry_run,
                db_plugin=self._db, entry_key_gen=lambda c: DefaultCacheMapping.KEY_TEMPLATE.format(c))

        async def conc_cache_monitor(min_file_age, free_capacity_goal, free_capacity_trigger, elastic_conf):
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
            return await run_monitor(root_dir=self._cache_dir, db_plugin=self._db,
                                     entry_key_gen=lambda c: DefaultCacheMapping.KEY_TEMPLATE.format(
                                         c),
                                     min_file_age=min_file_age, free_capacity_goal=free_capacity_goal,
                                     free_capacity_trigger=free_capacity_trigger, elastic_conf=elastic_conf)

        return conc_cache_cleanup, conc_cache_monitor


@inject(plugins.runtime.DB)
def create_instance(settings, db):
    return CacheMappingFactory(cache_dir=settings.get('plugins', 'conc_cache')['cache_dir'], db=db)
