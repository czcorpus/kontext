# Copyright (c) 2024 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2024 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2024 Martin Zimandl <martin.zimandl@gmail.com>
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
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import logging
from datetime import datetime, timezone
from urllib.parse import urljoin
import ujson as json

import plugins
from action.argmapping.user import FullSearchArgs
from plugin_types.query_persistence import AbstractQueryPersistence
from plugin_types.subc_storage import AbstractSubcArchive
from plugin_types.auth import AbstractAuth
from plugin_types.general_storage import KeyValueStorage
from plugins import inject
from plugins.mysql_query_history import MySqlQueryHistory
from plugins.mysql_integration_db import MySqlIntegrationDb
from plugins.common.mysql.adhocdb import AdhocDB
from plugins.common.mysql import MySQLConf


class UcnkQueryHistory(MySqlQueryHistory):
    """
    UcnkQueryHistory is a modified version of MySqlQueryHistory containing
    fulltext search in queries using an external service (Camus).
    """

    def __init__(
            self,
            conf,
            db: MySqlIntegrationDb,
            kvdb: KeyValueStorage,
            query_persistence: AbstractQueryPersistence,
            subc_archive: AbstractSubcArchive,
            auth: AbstractAuth):
        super().__init__(conf, db, query_persistence, subc_archive, auth)
        self._kvdb = kvdb
        self._del_channel = conf.get('plugins', 'query_history').get(
            'fulltext_deleting_channel', 'query_history_fulltext_del_channel'
        )
        self._del_chunk_size = int(conf.get('plugins', 'query_history').get(
            'fulltext_num_delete_per_check', '500')
        )
        self._fulltext_service_url = conf.get('plugins', 'query_history').get(
            'fulltext_service_url', None
        )

    def supports_fulltext_search(self):
        return True

    async def delete_old_records(self):
        """
        Deletes records older than ttl_days. Named records are
        kept intact.
        """
        async with self._db.connection() as conn:
            async with await conn.cursor(dictionary=True) as cursor:
                await self._db.begin_tx(cursor)
                try:
                    await cursor.execute(
                        f'SELECT query_id, user_id, created FROM {self.TABLE_NAME} WHERE created < %s AND name IS NULL LIMIT %s',
                        (int(datetime.now(tz=timezone.utc).timestamp()) - self.ttl_days * 3600 * 24, self._del_chunk_size)
                    )
                    for row in await cursor.fetchall():
                        await cursor.execute(
                            f'DELETE FROM {self.TABLE_NAME} WHERE query_id = %s AND user_id = %s AND created = %s',
                            (row['query_id'], row['user_id'], row['created']))
                        await self._kvdb.publish_channel(self._del_channel, json.dumps(row))
                    await conn.commit_tx()
                except Exception as ex:
                    await conn.rollback_tx()
                    raise ex
    
    def generate_query_string(self, full_search_args: FullSearchArgs):
        parts = []
        if full_search_args.posattr_name:
            parts.append(f'pos_attr_names:{full_search_args.posattr_name}')
        if full_search_args.posattr_value:
            parts.append(f'pos_attr_values:{full_search_args.posattr_value}')
        if full_search_args.structattr_name:
            parts.append(f'struct_attr_names:{full_search_args.structattr_name}')
        if full_search_args.structattr_value:
            parts.append(f'struct_attr_values:{full_search_args.structattr_value}')
        return ' '.join(parts)

    async def get_user_queries(
            self, plugin_ctx, user_id, corpus_factory, from_date=None, to_date=None, q_supertype=None, corpname=None,
            archived_only=False, offset=0, limit=None, full_search_args=None):
        
        data = await super().get_user_queries(plugin_ctx, user_id, corpus_factory, from_date, to_date, q_supertype, corpname, archived_only, offset, limit, full_search_args)
        if full_search_args is not None:
            q = self.generate_query_string(full_search_args)
            async with plugin_ctx.request.ctx.http_client.get(urljoin(self._fulltext_service_url, f'/indexer/search') + f'?q={q}') as resp:
                ids = [hit['id'] for hit in (await resp.json())['hits']]
        return data


@inject(
    plugins.runtime.INTEGRATION_DB,
    plugins.runtime.QUERY_PERSISTENCE,
    plugins.runtime.SUBC_STORAGE,
    plugins.runtime.AUTH,
    plugins.runtime.DB
)
def create_instance(
        conf,
        integ_db: MySqlIntegrationDb,
        query_persistence: AbstractQueryPersistence,
        subc_archive: AbstractSubcArchive,
        auth: AbstractAuth,
        kvdb: KeyValueStorage
):
    auth_plg_conf = conf.get('plugins', 'auth')
    if integ_db and integ_db.is_active and 'mysql_host' not in auth_plg_conf:
        db = integ_db
        logging.getLogger(__name__).info(f'ucnk_query_history uses integration_db[{integ_db.info}]')
    else:
        db = AdhocDB(MySQLConf.from_conf(auth_plg_conf))
    return UcnkQueryHistory(conf, db, kvdb, query_persistence, subc_archive, auth)
