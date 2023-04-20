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
import os
import struct
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import aiofiles
import plugins
import ujson as json
from action.argmapping.subcorpus import (
    CreateSubcorpusArgs, CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs)
from corplib.abstract import create_new_subc_ident
from corplib.subcorpus import SubcorpusRecord
from plugin_types.auth import UserInfo
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.subc_storage import AbstractSubcArchive, SubcArchiveException
from plugins import inject
from plugins.errors import PluginCompatibilityException
from plugins.mysql_integration_db import MySqlIntegrationDb
from pymysql.err import IntegrityError
from sanic import Sanic

try:
    from markdown import markdown
    from markdown.extensions import Extension

    class EscapeHtml(Extension):
        def extendMarkdown(self, md):
            md.preprocessors.deregister('html_block')
            md.inlinePatterns.deregister('html')

    def k_markdown(s): return markdown(s, extensions=[EscapeHtml(), 'tables']) if s else ''

except ImportError:
    import html

    def k_markdown(s): return html.escape(s) if s else ''


def _subc_from_row(row: Dict) -> SubcorpusRecord:
    return SubcorpusRecord(
        id=row['id'],
        corpus_name=row['corpus_name'],
        name=row['name'],
        is_draft=row['is_draft'],
        user_id=row['user_id'],
        author_id=row['author_id'],
        author_fullname=row['fullname'],
        size=row['size'],
        created=row['created'],
        public_description=k_markdown(row['public_description']),
        public_description_raw=row['public_description'],
        version=row['version'],
        archived=row['archived'],
        cql=row['cql'],
        within_cond=json.loads(row['within_cond']) if row['within_cond'] else None,
        text_types=json.loads(row['text_types']) if row['text_types'] else None,
        bib_id_attr=row['bib_id_attr'],
        bib_label_attr=row['bib_label_attr'],
        aligned=json.loads(row['aligned']) if row['aligned'] else [],
    )


@dataclass
class BackendConfig:
    user_table: str = 'kontext_user'
    subccorp_table: str = 'kontext_subcorpus'
    corpora_table: str = 'kontext_corpus'
    user_table_firstname_col: str = 'firstname'
    user_table_lastname_col: str = 'lastname'


class MySQLSubcArchive(AbstractSubcArchive):
    """
    For the documentation of individual methods, please see AbstractSubcArchive class
    """

    def __init__(
            self,
            plugin_conf: Dict[str, Any],
            corparch: AbstractCorporaArchive,
            db: MySqlIntegrationDb,
            backend_conf: BackendConfig
    ):
        self._conf = plugin_conf
        self._bconf = backend_conf
        self._corparch = corparch
        self._db = db

    @property
    def shared_subc_user_id(self) -> int:
        return int(self._conf['shared_subc_user_id'])

    @property
    def preflight_subcorpus_size(self) -> int:
        return int(self._conf['preflight_subcorpus_size'])

    async def create(
            self,
            ident: str,
            author: UserInfo,
            size: int,
            public_description: str,
            data: Union[CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs, CreateSubcorpusArgs],
            aligned: List[str],
            is_draft: bool = False,
    ):
        async with self._db.cursor() as cursor:
            if isinstance(data, CreateSubcorpusRawCQLArgs):
                column, value = 'cql', data.cql
            elif isinstance(data, CreateSubcorpusWithinArgs):
                column, value = 'within_cond', json.dumps(data.within)
            elif isinstance(data, CreateSubcorpusArgs):
                column, value = 'text_types', json.dumps(data.text_types)
            try:
                await cursor.execute(
                    f'INSERT INTO {self._bconf.subccorp_table} '
                    f'(id, user_id, author_id, corpus_name, name, {column}, created, public_description, size, is_draft, aligned) '
                    'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                    (ident, author['id'], author['id'], data.corpname, data.subcname, value, datetime.now(), public_description,
                     size, 1 if is_draft else 0, json.dumps(aligned) if aligned else ''))
                await cursor.connection.commit()
            except IntegrityError as ex:
                await cursor.execute(
                    f'SELECT is_draft FROM {self._bconf.subccorp_table} WHERE id = %s AND author_id = %s',
                    (ident, author['id']))
                row = await cursor.fetchone()
                if row['is_draft'] == 1:
                    await cursor.execute(
                        f'UPDATE {self._bconf.subccorp_table} '
                        f'SET name = %s, {column} = %s, public_description = %s, size = %s, is_draft = 0, aligned = %s '
                        'WHERE id = %s AND author_id = %s',
                        (data.subcname, value, public_description, size, json.dumps(aligned) if aligned else '',
                         ident, author['id']))
                else:
                    raise ex

    async def create_preflight(self, subc_root_dir, corpname):
        """
        create a preflight subcorpus with fixed size, attached to a special
        user.

        Returns:
            new ID of the subcorpsu
        """
        subc_id = await create_new_subc_ident(subc_root_dir, corpname)
        async with aiofiles.open(os.path.join(subc_root_dir, subc_id.data_path), 'wb') as fw:
            await fw.write(struct.pack('<q', 0))
            await fw.write(struct.pack('<q', self.preflight_subcorpus_size))
        subcname = f'{corpname}-preflight'
        # TODO transaction here
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'INSERT INTO {self._bconf.subccorp_table} '
                f'(id, user_id, author_id, corpus_name, name, created, size, is_draft, aligned) '
                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, NULL)',
                (subc_id.id, self.shared_subc_user_id, self.shared_subc_user_id, corpname, subcname, datetime.now(),
                 self.preflight_subcorpus_size, 0))
            await cursor.execute(
                'INSERT INTO kontext_preflight_subc (id, corpus_name) '
                'VALUES (%s, %s)',
                (subc_id.id, corpname)
            )
        await Sanic.get_app('kontext').dispatch('kontext.internal.reset')
        return subc_id.id

    async def update_draft(
            self,
            ident: str,
            author: UserInfo,
            size: int,
            public_description: str,
            data: Union[CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs, CreateSubcorpusArgs],
            aligned: List[str],
    ):
        async with self._db.cursor() as cursor:
            column1, column2, column3 = 'cql', 'within_cond', 'text_types'
            if isinstance(data, CreateSubcorpusRawCQLArgs):
                value1, value2, value3 = data.cql, None, None
            elif isinstance(data, CreateSubcorpusWithinArgs):
                value1, value2, value3 = None, json.dumps(data.within), None
            elif isinstance(data, CreateSubcorpusArgs):
                value1, value2, value3 = None, None, json.dumps(data.text_types)

            await cursor.execute(
                f'UPDATE {self._bconf.subccorp_table} '
                f'SET name = %s, {column1} = %s, {column2} = %s, {column3} = %s, '
                'public_description = %s, size = %s, aligned = %s '
                'WHERE id = %s AND author_id = %s AND is_draft = 1',
                (data.subcname, value1, value2, value3,
                 public_description, size, json.dumps(aligned) if aligned else None,
                 ident, author['id']))

    async def archive(self, user_id: int, corpname: str, subc_id: str) -> datetime:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'UPDATE {self._bconf.subccorp_table} SET archived = %s '
                'WHERE user_id = %s AND corpus_name = %s AND id = %s',
                (datetime.now(), user_id, corpname, subc_id)
            )
            await cursor.connection.commit()

            await cursor.execute(
                f'SELECT archived FROM {self._bconf.subccorp_table} '
                'WHERE user_id = %s AND corpus_name = %s AND id = %s',
                (user_id, corpname, subc_id)
            )
            row = await cursor.fetchone()
            return row['archived']

    async def restore(self, user_id: int, corpname: str, subc_id: str):
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'UPDATE {self._bconf.subccorp_table} SET archived = NULL '
                'WHERE user_id = %s AND corpus_name = %s AND id = %s',
                (user_id, corpname, subc_id)
            )
            await cursor.connection.commit()

    async def list_corpora(
            self,
            user_id: int,
    ) -> List[str]:
        sql = f"""
            SELECT DISTINCT corpus_name
            FROM {self._bconf.subccorp_table}
            WHERE user_id = %s
            ORDER BY corpus_name
        """

        async with self._db.cursor() as cursor:
            await cursor.execute(sql, (user_id,))
            return [row['corpus_name'] async for row in cursor]

    async def list(self, user_id, filter_args, corpname=None, offset=0, limit=None, include_drafts=False):
        if (filter_args.archived_only and filter_args.active_only) or \
           (filter_args.archived_only and filter_args.published_only):
            raise SubcArchiveException('Invalid filter specified')

        where, args = ['t1.user_id IS NOT NULL'], []
        if user_id is not None:
            where.append('t1.user_id = %s')
            args.append(user_id)
        if corpname is not None:
            where.append('t1.corpus_name = %s')
            args.append(corpname)
        if filter_args.archived_only:
            where.append('t1.archived IS NOT NULL')
        else:
            if filter_args.active_only:
                where.append('t1.archived IS NULL')
            if filter_args.published_only:
                where.append('LENGTH(t1.public_description) > 0')

        if filter_args.pattern:
            v = f'%{filter_args.pattern}%'
            where.append('(t1.name LIKE %s OR t1.public_description LIKE %s)')
            args.extend([v, v])

        if filter_args.ia_query:
            v = f'{filter_args.ia_query}%'
            where.append(f'(t1.id LIKE %s OR t2.{self._bconf.user_table_lastname_col} LIKE %s)')
            args.extend([v, v])

        if limit is None:
            limit = 1000000000
        args.extend((limit, offset))

        if not include_drafts:
            where.append('t1.is_draft = 0')

        sql = f"""SELECT
            t1.*, CONCAT(t3.bib_id_struct, '.', t3.bib_id_attr) AS bib_id_attr,
            CONCAT(t3.bib_label_struct, '.', t3.bib_label_attr) AS bib_label_attr,
            CONCAT(t2.{self._bconf.user_table_firstname_col}, ' ', {self._bconf.user_table_lastname_col}) AS fullname
            FROM {self._bconf.subccorp_table} AS t1
            JOIN {self._bconf.user_table} AS t2 ON t1.author_id = t2.id
            JOIN {self._bconf.corpora_table} AS t3 ON t3.name = t1.corpus_name
            WHERE {" AND ".join(where)} ORDER BY t1.id LIMIT %s OFFSET %s"""
        async with self._db.cursor() as cursor:
            await cursor.execute(sql, args)
            return [_subc_from_row(row) async for row in cursor]

    async def get_info(self, subc_id: str) -> Optional[SubcorpusRecord]:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f"""SELECT
                t1.*, CONCAT(t3.bib_id_struct, '.', t3.bib_id_attr) AS bib_id_attr,
                CONCAT(t3.bib_label_struct, '.', t3.bib_label_attr) AS bib_label_attr,
                CONCAT(t2.{self._bconf.user_table_firstname_col}, ' ', {self._bconf.user_table_lastname_col}) AS fullname
                FROM {self._bconf.subccorp_table} AS t1
                JOIN {self._bconf.user_table} AS t2 ON t1.author_id = t2.id
                JOIN {self._bconf.corpora_table} AS t3 ON t3.name = t1.corpus_name
                WHERE t1.id = %s
                ORDER BY t1.created
                LIMIT 1""",
                (subc_id, )
            )
            row = await cursor.fetchone()
            return None if row is None else _subc_from_row(row)

    async def get_info_by_name(self, corpname, subc_name, user_id):
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f"""SELECT
                t1.*,
                CONCAT(t2.{self._bconf.user_table_firstname_col}, ' ', {self._bconf.user_table_lastname_col}) AS fullname
                FROM {self._bconf.subccorp_table} AS t1
                JOIN {self._bconf.user_table} AS t2 ON t1.author_id = t2.id
                WHERE t1.corpus_name = %s AND t1.name = %s AND t1.author_id = %s
                ORDER BY t1.created
                LIMIT 1""",
                (corpname, subc_name, user_id)
            )
            row = await cursor.fetchone()
            return None if row is None else _subc_from_row(row)

    async def get_names(self, subc_ids):
        ans = {}
        if len(subc_ids) == 0:
            return ans
        async with self._db.cursor() as cursor:
            wc = ', '.join(['%s'] * len(subc_ids))
            await cursor.execute(
                f"SELECT id, name FROM {self._bconf.subccorp_table} WHERE id IN ({wc})",
                tuple(subc_ids)
            )
            async for row in cursor:
                ans[row['id']] = row['name']
            return ans

    async def get_query(self, subc_id: str) -> Optional[SubcorpusRecord]:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'SELECT * FROM {self._bconf.subccorp_table} '
                'WHERE id = %s', (subc_id, )
            )
            row = await cursor.fetchone()
            return None if row is None else SubcorpusRecord(**{
                **row,
                'within_cond': json.loads(row['within_cond']) if row['within_cond'] else None,
                'text_types': json.loads(row['text_types']) if row['text_types'] else None,
                'aligned': json.loads(row['aligned']) if row['aligned'] else None,
            })

    async def delete_query(self, user_id: int, corpname: str, subc_id: str) -> None:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                f'UPDATE {self._bconf.subccorp_table} '
                'SET archived = IF (archived IS NULL, %s, archived), user_id = NULL '
                'WHERE user_id = %s AND corpus_name = %s AND id = %s',
                (datetime.now(), user_id, corpname, subc_id)
            )
            await cursor.connection.commit()

    async def update_name_and_description(self, user_id: int, subc_id: str, subcname: str, description: str, preview_only: bool):
        if not preview_only:
            async with self._db.cursor() as cursor:
                await cursor.execute(
                    f'UPDATE {self._bconf.subccorp_table} '
                    'SET name = %s, public_description = %s '
                    'WHERE user_id = %s AND id = %s',
                    (subcname, description, user_id, subc_id)
                )
                await cursor.connection.commit()
        return k_markdown(description)


@inject(plugins.runtime.CORPARCH, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, corparch: AbstractCorporaArchive, integ_db: MySqlIntegrationDb):
    plugin_conf = conf.get('plugins', 'subc_storage')
    if integ_db.is_active:
        logging.getLogger(__name__).info(f'mysql_subc_storage uses integration_db[{integ_db.info}]')
        return MySQLSubcArchive(plugin_conf, corparch, integ_db, BackendConfig())
    else:
        raise PluginCompatibilityException(
            'mysql_subc_storage works only with integration_db enabled')
