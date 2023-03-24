# Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import plugins
import ujson as json
from action.argmapping.subcorpus import (
    CreateSubcorpusArgs, CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs)
from corplib.subcorpus import SubcorpusRecord
from plugin_types.auth import UserInfo
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.subc_storage import AbstractSubcArchive, SubcArchiveException
from plugins import inject

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
        author_fullname=row['author_fullname'],
        size=row['size'],
        created=datetime.fromtimestamp(row['created']),
        public_description=k_markdown(row['public_description']),
        public_description_raw=row['public_description'],
        archived=None if row['archived'] is None else datetime.fromtimestamp(row['archived']),
        cql=row['cql'],
        within_cond=json.loads(row['within_cond']) if row['within_cond'] else None,
        text_types=json.loads(row['text_types']) if row['text_types'] else None,
        aligned=json.loads(row['aligned']) if row['aligned'] else None,
    )


class SQLiteSubcArchive(AbstractSubcArchive):
    """
    For the documentation of individual methods, please see AbstractSubcArchive class
    """

    SUBC_TABLE_NAME = 'subcorpora'

    def __init__(
            self,
            plugin_conf: Dict[str, Any],
            corparch: AbstractCorporaArchive,
    ):
        self._conf = plugin_conf
        self._corparch = corparch

        db_exists = os.path.isfile(plugin_conf['db_path'])
        self._db = sqlite3.connect(plugin_conf['db_path'])
        self._db.row_factory = sqlite3.Row
        if not db_exists:
            self._db.execute(f'''
                CREATE TABLE {self.SUBC_TABLE_NAME} (
                    id VARCHAR(32) PRIMARY KEY,
                    name VARCHAR(127) NOT NULL,
                    is_draft INTEGER NOT NULL DEFAULT 0,
                    user_id INTEGER, -- if NULL then the subcorpus is deleted for the user but it still exists (e.g. to be avail. if published)
                    author_id INTEGER NOT NULL,
                    author_fullname varchar(127) NOT NULL,
                    corpus_name varchar(63) NOT NULL,
                    aligned TEXT,
                    size INTEGER NOT NULL,
                    cql TEXT,
                    within_cond TEXT,
                    text_types TEXT,
                    created REAL NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    archived REAL NULL,
                    public_description TEXT
                )
            ''')
            self._db.commit()
            logging.getLogger(__name__).info(f'default_subc_storage created new database')

    async def create(
            self,
            ident: str,
            author: UserInfo,
            size: int,
            public_description,
            data: Union[CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs, CreateSubcorpusArgs],
            aligned: List[str],
            is_draft: bool = False,
    ):
        if isinstance(data, CreateSubcorpusRawCQLArgs):
            column, value = 'cql', data.cql
        elif isinstance(data, CreateSubcorpusWithinArgs):
            column, value = 'within_cond', json.dumps(data.within)
        elif isinstance(data, CreateSubcorpusArgs):
            column, value = 'text_types', json.dumps(data.text_types)

        cursor = self._db.cursor()
        try:
            cursor.execute(
                f'INSERT INTO {self.SUBC_TABLE_NAME} '
                f'(id, user_id, author_id, author_fullname, corpus_name, name, {column}, created, public_description, size, is_draft, aligned) '
                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                (ident, author['id'], author['id'], author['fullname'], data.corpname, data.subcname, value, datetime.now().timestamp(), public_description, size, 1 if is_draft else 0, json.dumps(aligned) if aligned else ''))
            self._db.commit()
        except sqlite3.IntegrityError as ex:
            cursor.execute(
                f'SELECT is_draft FROM {self.SUBC_TABLE_NAME} WHERE id = ? AND author_id = ?',
                (ident, author['id']))
            row = cursor.fetchone()
            if row['is_draft'] == 1:
                await cursor.execute(
                    f'UPDATE {self.SUBC_TABLE_NAME} '
                    f'SET name = ?, {column} = ?, public_description = ?, size = ?, is_draft = 0, aligned = ? '
                    'WHERE id = ? AND author_id = ?',
                    (data.subcname, value, public_description, size, ident, author['id'], json.dumps(aligned) if aligned else ''))
            else:
                raise ex
        finally:
            cursor.close()

    async def update_draft(
            self,
            ident: str,
            author: UserInfo,
            size: int,
            public_description: str,
            data: Union[CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs, CreateSubcorpusArgs],
            aligned: List[str],
    ):
        column1, column2, column3 = 'cql', 'within_cond', 'text_types'
        if isinstance(data, CreateSubcorpusRawCQLArgs):
            value1, value2, value3 = data.cql, None, None
        elif isinstance(data, CreateSubcorpusWithinArgs):
            value1, value2, value3 = None, json.dumps(data.within), None
        elif isinstance(data, CreateSubcorpusArgs):
            value1, value2, value3 = None, None, json.dumps(data.text_types)

        cursor = self._db.cursor()
        try:
            cursor.execute(
                f'UPDATE {self.SUBC_TABLE_NAME} '
                f'SET name = ?, {column1} = ?, {column2} = ?, {column3} = ?, public_description = ?, size = ?, aligned = ? '
                'WHERE id = ? AND author_id = ? AND is_draft = 1',
                (data.subcname, value1, value2, value3, public_description, size, ident, author['id'], json.dumps(aligned) if aligned else ''))
        finally:
            cursor.close()

    async def archive(self, user_id: int, corpname: str, subc_id: str) -> datetime:
        cursor = self._db.cursor()
        try:
            cursor.execute(
                f'UPDATE {self.SUBC_TABLE_NAME} SET archived = ? '
                'WHERE user_id = ? AND corpus_name = ? AND id = ?',
                (datetime.now().timestamp(), user_id, corpname, subc_id)
            )
            self._db.commit()

            cursor.execute(
                f'SELECT archived FROM {self.SUBC_TABLE_NAME} '
                'WHERE user_id = ? AND corpus_name = ? AND id = ?',
                (user_id, corpname, subc_id)
            )
            row = cursor.fetchone()
        finally:
            cursor.close()

        return datetime.fromtimestamp(row['archived'])

    async def restore(self, user_id: int, corpname: str, subc_id: str):
        cursor = self._db.cursor()
        try:
            cursor.execute(
                f'UPDATE {self.SUBC_TABLE_NAME} SET archived = NULL '
                'WHERE user_id = ? AND corpus_name = ? AND id = ?',
                (user_id, corpname, subc_id)
            )
            self._db.commit()
        finally:
            cursor.close()

    async def list_corpora(
            self,
            user_id: int,
    ) -> List[str]:
        sql = f"""
            SELECT DISTINCT corpus_name
            FROM {self.SUBC_TABLE_NAME}
            WHERE user_id = ?
            ORDER BY corpus_name
        """

        cursor = self._db.cursor()
        try:
            cursor.execute(sql, (user_id,))
            data = [row['corpus_name'] for row in cursor]
        finally:
            cursor.close()
        return data

    async def list(self, user_id, filter_args, corpname=None, offset=0, limit=None, include_drafts=False):
        if (filter_args.archived_only and filter_args.active_only) or \
           (filter_args.archived_only and filter_args.published_only):
            raise SubcArchiveException('Invalid filter specified')

        where, args = ['t1.user_id IS NOT NULL'], []
        if user_id is not None:
            where.append('t1.user_id = ?')
            args.append(user_id)
        if corpname is not None:
            where.append('t1.corpus_name = ?')
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
            where.append('(t1.name LIKE ? OR t1.public_description LIKE ?)')
            args.extend([v, v])

        if filter_args.ia_query:
            v = f'{filter_args.ia_query}%'
            where.append('(t1.id LIKE ? OR t1.author_fullname LIKE ?)')
            args.extend([v, v])

        if limit is None:
            limit = 1000000000
        args.extend((limit, offset))

        if not include_drafts:
            where.append('t1.is_draft = 0')

        sql = f"""SELECT
            t1.*
            FROM {self.SUBC_TABLE_NAME} AS t1
            WHERE {" AND ".join(where)} ORDER BY t1.id LIMIT ? OFFSET ?"""
        cursor = self._db.cursor()
        try:
            cursor.execute(sql, args)
            data = [_subc_from_row(row) for row in cursor]
        finally:
            cursor.close()
        return data

    async def get_info(self, subc_id: str) -> Optional[SubcorpusRecord]:
        cursor = self._db.cursor()
        try:
            cursor.execute(
                f"""SELECT
                t1.*
                FROM {self.SUBC_TABLE_NAME} AS t1
                WHERE t1.id = ?
                ORDER BY t1.created
                LIMIT 1""",
                (subc_id, )
            )
            row = cursor.fetchone()
        finally:
            cursor.close()
        return None if row is None else _subc_from_row(row)

    async def get_names(self, subc_ids):
        ans = {}
        if len(subc_ids) == 0:
            return ans
        cursor = self._db.cursor()
        try:
            wc = ', '.join(['?'] * len(subc_ids))
            cursor.execute(
                f"SELECT id, name FROM {self.SUBC_TABLE_NAME} WHERE id IN ({wc})",
                tuple(subc_ids)
            )
            for row in cursor:
                ans[row['id']] = row['name']
        finally:
            cursor.close()
        return ans

    async def get_query(self, subc_id: str) -> Optional[SubcorpusRecord]:
        cursor = self._db.cursor()
        try:
            cursor.execute(
                f'SELECT * FROM {self.SUBC_TABLE_NAME} '
                'WHERE id = ?', (subc_id, )
            )
            row = cursor.fetchone()
        finally:
            cursor.close()
        return None if row is None else SubcorpusRecord(**{
            **row,
            'within_cond': json.loads(row['within_cond']) if row['within_cond'] else None,
            'text_types': json.loads(row['text_types']) if row['text_types'] else None,
            'aligned': json.loads(row['aligned']) if row['aligned'] else None,
        })

    async def delete_query(self, user_id: int, corpname: str, subc_id: str) -> None:
        cursor = self._db.cursor()
        try:
            cursor.execute(
                f'UPDATE {self.SUBC_TABLE_NAME} '
                'SET archived = CASE WHEN archived IS NULL THEN ? ELSE archived END, user_id = NULL '
                'WHERE user_id = ? AND corpus_name = ? AND id = ?',
                (datetime.now().timestamp(), user_id, corpname, subc_id)
            )
            self._db.commit()
        finally:
            cursor.close()

    async def update_name_and_description(self, user_id: int, subc_id: str, subcname: str, description: str, preview_only: bool):
        if not preview_only:
            cursor = self._db.cursor()
            try:
                cursor.execute(
                    f'UPDATE {self.SUBC_TABLE_NAME} '
                    'SET name = ?, public_description = ? '
                    'WHERE user_id = ? AND id = ?',
                    (subcname, description, user_id, subc_id)
                )
                self._db.commit()
            finally:
                cursor.close()

        return k_markdown(description)


@inject(plugins.runtime.CORPARCH)
def create_instance(conf, corparch: AbstractCorporaArchive):
    plugin_conf = conf.get('plugins', 'subc_storage')
    return SQLiteSubcArchive(plugin_conf, corparch)
