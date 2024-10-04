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
import re
from urllib.parse import quote
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


def escape_bleve_chars(s: str) -> str:
    """
    According to documentation the characters are
    "+-=&|><!(){}[]^\"~*?:\\/ "
    (note: there is empty space)
    """

    for ch in '\\+-=&|><!(){}[]^"~*?:/':
        s = s.replace(ch, f'\\{ch}')
    return s


def make_bleve_field(field: str, values_string: str) -> str:
    """
    Builds bleve field query using regex
    spaces serve as OR in regex
    """
    values = []
    for v in values_string.split(" "):
        if v:
            values.append(re.escape(v))
    if len(values) > 0:
        return f'{field}:/.*({"|".join(values)}).*/'
    return ''


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

    @staticmethod
    def generate_query_string(
            q_supertype: str,
            user_id: int,
            corpname: str,
            full_search_args: FullSearchArgs
    ) -> str:
        parts = [f'+user_id:{user_id}']
        if q_supertype:
            parts.append(f'+query_supertype:{q_supertype}')

        if corpname:
            parts.append(f'+corpora:{escape_bleve_chars(corpname)}')

        if full_search_args.subcorpus:
            parts.append(make_bleve_field('+subcorpus', full_search_args.subcorpus))

        if full_search_args.any_property_value:
            parts.append(make_bleve_field('+_all', full_search_args.any_property_value))

        else:
            if q_supertype in ('conc', 'pquery'):
                if full_search_args.posattr_name:
                    parts.append(make_bleve_field('+pos_attr_names', full_search_args.posattr_name))
                if full_search_args.posattr_value:
                    parts.append(make_bleve_field('+pos_attr_values', full_search_args.posattr_value))
                if full_search_args.structattr_name:
                    parts.append(make_bleve_field('+struct_attr_names', full_search_args.structattr_name))
                if full_search_args.structattr_value:
                    parts.append(make_bleve_field('+struct_attr_values', full_search_args.structattr_value))

            elif q_supertype == 'wlist':
                if full_search_args.wl_pat:
                    parts.append(make_bleve_field('+raw_query', full_search_args.wl_pat))
                if full_search_args.wl_attr:
                    parts.append(make_bleve_field('+pos_attr_names', full_search_args.wl_attr))
                if full_search_args.wl_pfilter:
                    parts.append(make_bleve_field('+pfilter_words', full_search_args.wl_pfilter))
                if full_search_args.wl_nfilter:
                    parts.append(make_bleve_field('+nfilter_words', full_search_args.wl_nfilter))

            elif q_supertype == 'kwords':
                if full_search_args.wl_attr:
                    parts.append(make_bleve_field('+pos_attr_names', full_search_args.posattr_name))

        return quote(' '.join(parts))

    async def get_user_queries(
            self, plugin_ctx, user_id, corpus_factory, from_date=None, to_date=None, q_supertype=None, corpname=None,
            archived_only=False, offset=0, limit=None, full_search_args=None):

        if full_search_args is None:
            return await super().get_user_queries(plugin_ctx, user_id, corpus_factory, from_date, to_date, q_supertype, corpname, archived_only, offset, limit)

        q = self.generate_query_string(q_supertype, user_id, corpname, full_search_args)
        async with plugin_ctx.request.ctx.http_client.get(
                urljoin(self._fulltext_service_url, f'/indexer/search') + f'?q={q}') as resp:
            index_data = await resp.json()
            logging.debug(index_data['hits'])
            return await self.get_user_queries_from_ids(plugin_ctx, corpus_factory, user_id, index_data['hits'])

    async def get_user_queries_from_ids(self, plugin_ctx, corpus_factory, user_id, queries):
        if len(queries) == 0:
            return []
        async with self._db.cursor() as cursor:
            await cursor.execute(f'''
                WITH q(sort, id) AS ( VALUES {', '.join('(%s, %s)' for _ in queries)} )
                SELECT q.sort, t.query_id, t.created, t.name, t.q_supertype
                FROM q
                JOIN {self.TABLE_NAME} AS t ON q.id = t.query_id
                WHERE user_id = %s
                ORDER BY q.sort ASC, t.created DESC
            ''', [*(x for i, q in enumerate(queries) for x in (i, q['id'])), user_id])

            rows = [item for item in await cursor.fetchall()]
            full_data = await self._process_rows(plugin_ctx, corpus_factory, rows)

        for i, item in enumerate(full_data):
            item['idx'] = i

        return full_data


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
