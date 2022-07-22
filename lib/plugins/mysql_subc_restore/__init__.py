# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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
from datetime import datetime
from typing import Any, Dict, Optional, Union

import plugins
import ujson as json
from action.argmapping.subcorpus import (
    CreateSubcorpusArgs, CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs)
from corplib.subcorpus import SubcorpusRecord
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.subc_restore import AbstractSubcArchive, SubcArchiveException
from plugins import inject
from plugins.errors import PluginCompatibilityException
from plugins.mysql_integration_db import MySqlIntegrationDb


class MySQLSubcArchive(AbstractSubcArchive):
    """
    For the documentation of individual methods, please see AbstractSubcArchive class
    """

    TABLE_NAME = 'kontext_subcorpus'

    def __init__(
            self,
            plugin_conf: Dict[str, Any],
            corparch: AbstractCorporaArchive,
            db: MySqlIntegrationDb):
        self._conf = plugin_conf
        self._corparch = corparch
        self._db = db

    async def create(
            self, ident: str, user_id: int, corpname: str, subcname: str, size: int, public_description, data_path: str,
            data: Union[CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs, CreateSubcorpusArgs]):
        async with self._db.cursor() as cursor:
            if isinstance(data, CreateSubcorpusRawCQLArgs):
                column, value = 'cql', data.cql
            elif isinstance(data, CreateSubcorpusWithinArgs):
                column, value = 'within_cond', json.dumps(data.within)
            elif isinstance(data, CreateSubcorpusArgs):
                column, value = 'text_types', json.dumps(data.text_types)

            await cursor.execute(
                f'INSERT INTO {self.TABLE_NAME} '
                f'(id, user_id, author_id, corpus_name, name, {column}, created, public_description, data_path, size) '
                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                (ident, user_id, user_id, data.corpname, data.subcname, value, datetime.now(), public_description,
                 data_path, size))
            await cursor.connection.commit()

    async def archive(self, user_id: int, corpname: str, subcname: str):
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'UPDATE {self.TABLE_NAME} SET archived = NOW() '
                'WHERE user_id = %s AND corpus_name = %s AND name = %s',
                (user_id, corpname, subcname)
            )
        await cursor.connection.commit()

    async def list(self, user_id, filter_args, offset=0, limit=None):
        if filter_args.archived_only and filter_args.active_only:
            raise SubcArchiveException('Invalid filter specified')

        where = ['user_id = %s']
        args = [user_id]
        if filter_args.corpus:
            where.append('corpus_name = %s')
            args.append(filter_args.corpus)
        if filter_args.archived_only:
            where.append('archived IS NOT NULL')
        elif filter_args.active_only:
            where.append('archived IS NULL')

        if limit is None:
            limit = 1000000000
        args += (limit, offset)

        sql = 'SELECT * FROM {} WHERE {} ORDER BY id LIMIT %s OFFSET %s'.format(
            self.TABLE_NAME, ' AND '.join(where)
        )
        async with self._db.cursor() as cursor:
            await cursor.execute(sql, args)
            return [SubcorpusRecord(**row) async for row in cursor]

    async def get_info(self, user_id: int, corpname: str, subc_id: str) -> Optional[SubcorpusRecord]:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'SELECT * FROM {self.TABLE_NAME} '
                'WHERE user_id = %s AND corpus_name = %s AND id = %s '
                'ORDER BY created '
                'LIMIT 1',
                (user_id, corpname, subc_id)
            )
            row = await cursor.fetchone()
            return None if row is None else SubcorpusRecord(**row)

    async def get_query(self, query_id: int) -> Optional[SubcorpusRecord]:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'SELECT * FROM {self.TABLE_NAME} '
                'WHERE id = %s', (query_id, )
            )
            row = await cursor.fetchone()
            return None if row is None else SubcorpusRecord(**row)


@inject(plugins.runtime.CORPARCH, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, corparch: AbstractCorporaArchive, integ_db: MySqlIntegrationDb):
    plugin_conf = conf.get('plugins', 'subc_restore')
    if integ_db.is_active:
        logging.getLogger(__name__).info(f'mysql_subc_restore uses integration_db[{integ_db.info}]')
        return MySQLSubcArchive(plugin_conf, corparch, integ_db)
    else:
        raise PluginCompatibilityException(
            'mysql_subc_restore works only with integration_db enabled')
