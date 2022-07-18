# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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


import logging
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union

import plugins
import ujson as json
import werkzeug.urls
from action.model.subcorpus import (CreateSubcorpusArgs,
                                    CreateSubcorpusRawCQLArgs,
                                    CreateSubcorpusWithinArgs)
from action.model.subcorpus.listing import ListingItem
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.subc_restore import AbstractSubcRestore, SubcRestoreRow
from plugins import inject
from plugins.errors import PluginCompatibilityException
from plugins.mysql_integration_db import MySqlIntegrationDb


class MySQLSubcRestore(AbstractSubcRestore):
    """
    For the documentation of individual methods, please see AbstractSubcRestore class
    """

    TABLE_NAME = 'kontext_subc_archive'

    def __init__(
            self,
            plugin_conf: Dict[str, Any],
            corparch: AbstractCorporaArchive,
            db: MySqlIntegrationDb):
        self._conf = plugin_conf
        self._corparch = corparch
        self._db = db

    async def store_query(self, user_id: int, data: Union[CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs, CreateSubcorpusArgs]):
        async with self._db.cursor() as cursor:
            if isinstance(data, CreateSubcorpusRawCQLArgs):
                column, value = 'cql', data.cql
            elif isinstance(data, CreateSubcorpusWithinArgs):
                column, value = 'within', json.dumps(data.within)
            elif isinstance(data, CreateSubcorpusArgs):
                column, value = 'text_types', json.dumps(data.text_types)

            await cursor.execute(
                f'INSERT INTO {self.TABLE_NAME} '
                f'(user_id, corpname, subcname, {column}, timestamp) '
                'VALUES (%s, %s, %s, %s, %s)',
                (user_id, data.corpname, data.subcname, value, datetime.now())
            )
        await cursor.connection.commit()

    async def delete_query(self, user_id: int, corpname: str, subcname: str):
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'DELETE FROM {self.TABLE_NAME} '
                'WHERE user_id = %s AND corpname = %s AND subcname = %s',
                (user_id, corpname, subcname)
            )
        await cursor.connection.commit()

    async def list_queries(self, user_id: int, from_idx: int, to_idx: Optional[int] = None) -> List[SubcRestoreRow]:
        sql = [
            'SELECT * FROM kontext_subc_archive',
            'WHERE user_id = %s ORDER BY id',
        ]
        args = (user_id,)
        if to_idx is not None:
            sql.append('LIMIT %s, %s')
            args += (from_idx, to_idx - from_idx)
        else:
            sql.append('OFFSET %s ROWS')
            args += (from_idx,)

        async with self._db.cursor() as cursor:
            await cursor.execute(' '.join(sql), args)
            return [SubcRestoreRow(**row) async for row in cursor]

    async def get_info(self, user_id: int, corpname: str, subcname: str) -> Optional[SubcRestoreRow]:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'SELECT * FROM {self.TABLE_NAME} '
                'WHERE user_id = %s AND corpname = %s AND subcname = %s '
                'ORDER BY timestamp '
                'LIMIT 1',
                (user_id, corpname, subcname)
            )
            row = await cursor.fetchone()
            return None if row is None else SubcRestoreRow(**row)

    async def get_query(self, query_id: int) -> Optional[SubcRestoreRow]:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'SELECT * FROM {self.TABLE_NAME} '
                'WHERE id = %s', (query_id, )
            )
            row = await cursor.fetchone()
            return None if row is None else SubcRestoreRow(**row)

    async def extend_subc_list(
            self, plugin_ctx, subc_list, filter_args, from_idx, to_idx=None, include_cql=False):
        """
        Enriches KonText's original subcorpora list by the information about queries which
        produced these subcorpora. It it also able to insert an information about deleted
        subcorpora.

        Args:
            plugin_ctx: a Plugin API instance
            subc_list: an original subcorpora list as produced by KonText's respective action
            filter_args: support for 'show_deleted': 0/1 and 'corpname': str
            from_idx: 0..(num_items-1) list offset
            to_idx: last item index (None by default)
            include_cql: total amount of cqls can be quite large, include it into data,
                otherwise leave it empty (False by default)

        Returns:
            a new list containing both the original subc_list and also the extended part
        """
        def get_user_subcname(rec: ListingItem) -> str:
            return rec.orig_subcname if rec.orig_subcname else rec.usesubcorp

        subc_queries = await self.list_queries(plugin_ctx.user_id, from_idx, to_idx)
        subc_queries_map: Dict[Tuple[str, str], SubcRestoreRow] = {}
        for x in subc_queries:
            subc_queries_map[(x.corpname, x.subcname)] = x

        if filter_args.get('show_deleted', False):
            deleted_keys = set(subc_queries_map.keys()) - \
                (set((x.corpname, get_user_subcname(x)) for x in subc_list))
        else:
            deleted_keys = []

        def corpname_matches(cn: str) -> bool:
            filter_cn = filter_args.get('corpname', None)
            return not filter_cn or cn == filter_cn

        def escape_subcname(s: str) -> str:
            return werkzeug.urls.url_quote(s, unsafe='+')

        deleted_items = []
        for dk in deleted_keys:
            try:
                subc_query = subc_queries_map[dk]
                corpus_name = subc_query.corpname
                if corpname_matches(corpus_name):
                    corpus_info = await self._corparch.get_corpus_info(plugin_ctx, corpus_name)
                    deleted_items.append(ListingItem(
                        name=f'{corpus_info.id} / {subc_query.subcname}',
                        size=None,
                        created=int(subc_query.timestamp.timestamp()),
                        human_corpname=corpus_info.name,
                        corpname=corpus_name,
                        usesubcorp=escape_subcname(subc_query.subcname),
                        cql=urllib.parse.quote(subc_query.cql).encode(
                            'utf-8') if include_cql else None,
                        cqlAvailable=bool(urllib.parse.quote(subc_query.cql)),
                        deleted=True,
                        published=False))
            except Exception as ex:
                logging.getLogger(__name__).warning(ex)
        for subc in subc_list:
            key = (subc.corpname, get_user_subcname(subc))
            if key in subc_queries_map:
                cql_quoted = urllib.parse.quote(subc_queries_map[key].cql)
                subc.cqlAvailable = bool(cql_quoted)
                subc.cql = cql_quoted.encode('utf-8') if include_cql else None
            else:
                subc.cqlAvailable = False
                subc.cql = None
            subc.usesubcorp = escape_subcname(subc.usesubcorp)
        return subc_list + deleted_items


@inject(plugins.runtime.CORPARCH, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, corparch: AbstractCorporaArchive, integ_db: MySqlIntegrationDb):
    plugin_conf = conf.get('plugins', 'subc_restore')
    if integ_db.is_active:
        logging.getLogger(__name__).info(f'mysql_subc_restore uses integration_db[{integ_db.info}]')
        return MySQLSubcRestore(plugin_conf, corparch, integ_db)
    else:
        raise PluginCompatibilityException(
            'mysql_subc_restore works only with integration_db enabled')
