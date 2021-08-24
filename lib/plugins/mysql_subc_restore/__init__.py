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


from controller.plg import PluginCtx
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import urllib.request
import urllib.parse
import urllib.error
import logging
from mysql.connector.connection import MySQLConnection

import werkzeug.urls
import plugins
from plugins.abstract.corparch import AbstractCorporaArchive
from plugins.abstract.subc_restore import AbstractSubcRestore, SubcRestoreRow
from plugins import inject


class MySQLSubcRestore(AbstractSubcRestore):
    """
    For the documentation of individual methods, please see AbstractSubcRestore class
    """

    TABLE_NAME = 'kontext_subc_archive'

    def __init__(self, plugin_conf: Dict[str, Any], corparch: AbstractCorporaArchive, db: MySQLConnection):
        self._conf = plugin_conf
        self._corparch = corparch
        self._db = db

    def store_query(self, user_id: int, corpname: str, subcname: str, cql: str):
        with self._db.cursor() as cursor:
            cursor.execute(
                f'INSERT INTO {self.TABLE_NAME} '
                '(user_id, corpname, subcname, cql, timestamp) '
                'VALUES (%s, %s, %s, %s, %s)',
                (user_id, corpname, subcname, cql, datetime.now())
            )
        self._db.commit()

    def delete_query(self, user_id: int, corpname: str, subcname: str):
        with self._db.cursor() as cursor:
            cursor.execute(
                f'DELETE FROM {self.TABLE_NAME} '
                'WHERE user_id = %s AND corpname = %s AND subcname = %s',
                (user_id, corpname, subcname)
            )
        self._db.commit()

    def list_queries(self, user_id: int, from_idx: int, to_idx: Optional[int] = None) -> List[SubcRestoreRow]:
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

        with self._db.cursor() as cursor:
            cursor.execute(' '.join(sql), args)
            return [SubcRestoreRow(**row) for row in cursor]

    def get_info(self, user_id: int, corpname: str, subcname: str) -> Optional[SubcRestoreRow]:
        with self._db.cursor() as cursor:
            cursor.execute(
                f'SELECT * FROM {self.TABLE_NAME} '
                'WHERE user_id = %s AND corpname = %s AND subcname = %s '
                'ORDER BY timestamp',
                (user_id, corpname, subcname)
            )
            row = cursor.fetchone()
            return None if row is None else SubcRestoreRow(**row)

    def get_query(self, query_id: int) -> Optional[SubcRestoreRow]:
        with self._db.cursor() as cursor:
            cursor.execute(
                f'SELECT * FROM {self.TABLE_NAME} '
                'WHERE id = %s', (query_id, )
            )
            row = cursor.fetchone()
            return None if row is None else SubcRestoreRow(**row)

    def extend_subc_list(self, plugin_ctx: PluginCtx, subc_list: List[Dict[str, Any]], filter_args: Dict[str, Any], from_idx: int, to_idx: Optional[int]=None, include_cql: bool=False) -> List[Dict[str, Any]]:
        """
        Enriches KonText's original subcorpora list by the information about queries which
        produced these subcorpora. It it also able to insert an information about deleted
        subcorpora.

        Args:
            plugin_ctx (kontext.PluginCtx): a Plugin API instance
            subc_list (list of dict): an original subcorpora list as produced by KonText's respective action
                (= list of dict(n=str, v=???, size=int, created=str, corpname=str, usesubcorp=str))
            filter_args (dict): support for 'show_deleted': 0/1 and 'corpname': str
            from_idx (int): 0..(num_items-1) list offset
            to_idx (int): last item index (None by default)
            include_cql (boolean): total amount of cqls can be quite large, include it into data,
                otherwise leave it empty (False by default)

        Returns:
            list of dict: a new list containing both the original subc_list and also the extended part
        """
        def get_user_subcname(rec: Dict[str, Any]) -> str:
            return rec.get('orig_subcname') if rec.get('orig_subcname') else rec.get('usesubcorp')

        subc_queries = self.list_queries(plugin_ctx.user_id, from_idx, to_idx)
        subc_queries_map: Dict[Tuple[str, str], SubcRestoreRow] = {}
        for x in subc_queries:
            subc_queries_map[(x.corpname, x.subcname)] = x

        if filter_args.get('show_deleted', False):
            deleted_keys = set(subc_queries_map.keys()) - \
                (set((x['corpname'], get_user_subcname(x)) for x in subc_list))
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
                    corpus_info = self._corparch.get_corpus_info(plugin_ctx, corpus_name)
                    deleted_items.append({
                        'name': '{0} / {1}'.format(corpus_info.id, subc_query.subcname),
                        'size': None,
                        'created': int(subc_query.timestamp.timestamp()),
                        'human_corpname': corpus_info.name,
                        'corpname': corpus_name,
                        'usesubcorp': escape_subcname(subc_query.subcname),
                        'cql': urllib.parse.quote(subc_query.cql).encode('utf-8') if include_cql else None,
                        'cqlAvailable': bool(urllib.parse.quote(subc_query.cql)),
                        'deleted': True,
                        'published': False
                    })
            except Exception as ex:
                logging.getLogger(__name__).warning(ex)
        for subc in subc_list:
            key = (subc['corpname'], get_user_subcname(subc))
            if key in subc_queries_map:
                cql_quoted = urllib.parse.quote(subc_queries_map[key].cql)
                subc['cqlAvailable'] = bool(cql_quoted)
                subc['cql'] = cql_quoted.encode('utf-8') if include_cql else None
            else:
                subc['cqlAvailable'] = False
                subc['cql'] = None
            subc['usesubcorp'] = escape_subcname(subc['usesubcorp'])
        return subc_list + deleted_items


@inject(plugins.runtime.CORPARCH, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, corparch, integ_db):
    plugin_conf = conf.get('plugins', 'subc_restore')
    if integ_db.is_active:
        logging.getLogger(__name__).info(f'mysql_subc_restore uses integration_db[{integ_db.info}]')
        return MySQLSubcRestore(plugin_conf, corparch, integ_db)
    else:
        logging.getLogger(__name__).error('mysql_subc_restore - integration DB not provided!')
