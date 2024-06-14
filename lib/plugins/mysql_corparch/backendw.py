# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.


import datetime
import logging
import re
from contextlib import asynccontextmanager

import pytz
from mysql.connector.aio.abstracts import MySQLCursorAbstract
from plugin_types.corparch.backend import DatabaseWriteBackend
from plugin_types.corparch.backend.regkeys import (
    POS_COLS_MAP,
    REG_COLS_MAP,
    REG_VAR_COLS_MAP,
    SATTR_COLS_MAP,
    STRUCT_COLS_MAP)
from plugin_types.integration_db import DatabaseAdapter
from plugins.mysql_corparch.backend import (
    DFLT_CORP_TABLE,
    DFLT_GROUP_ACC_CORP_ATTR,
    DFLT_GROUP_ACC_GROUP_ATTR,
    DFLT_GROUP_ACC_TABLE,
    DFLT_USER_ACC_CORP_ATTR,
    DFLT_USER_ACC_TABLE,
    DFLT_USER_TABLE,
    Backend)


class WriteBackend(DatabaseWriteBackend[MySQLCursorAbstract]):
    """
    This is an extended version of mysql backend used by ucnk scripts
    to import existing corpora.xml/registry files etc.
    """

    def __init__(
            self, db: DatabaseAdapter, ro_backend: Backend, user_table: str = DFLT_USER_TABLE, corp_table: str = DFLT_CORP_TABLE,
            group_acc_table: str = DFLT_GROUP_ACC_TABLE, user_acc_table: str = DFLT_USER_ACC_TABLE,
            user_acc_corp_attr: str = DFLT_USER_ACC_CORP_ATTR, group_acc_corp_attr: str = DFLT_GROUP_ACC_CORP_ATTR,
            group_acc_group_attr: str = DFLT_GROUP_ACC_GROUP_ATTR):
        self._db = db
        self._ro_backend = ro_backend
        self._user_table = user_table
        self._corp_table = corp_table
        self._group_acc_table = group_acc_table
        self._user_acc_table = user_acc_table
        self._user_acc_corp_attr = user_acc_corp_attr
        self._group_acc_corp_attr = group_acc_corp_attr
        self._group_acc_group_attr = group_acc_group_attr

    @asynccontextmanager
    async def cursor(self, dictionary=True):
        async with self._db.cursor() as cursor:
            yield cursor

    async def remove_corpus(self, cursor: MySQLCursorAbstract, corpus_id):
        # articles
        await cursor.execute(
            'SELECT a.id '
            'FROM kontext_article AS a '
            'LEFT JOIN kontext_corpus_article AS ca ON a.id = ca.article_id '
            'WHERE ca.corpus_name IS NULL')
        for row3 in await cursor.fetchall():
            await cursor.execute('DELETE FROM kontext_article WHERE id = %s', (row3['id'],))

        # misc. M:N stuff
        await cursor.execute('DELETE FROM kontext_tckc_corpus WHERE corpus_name = %s', (corpus_id,))
        await cursor.execute('DELETE FROM kontext_keyword_corpus WHERE corpus_name = %s', (corpus_id,))
        await cursor.execute('DELETE FROM kontext_corpus_article WHERE corpus_name = %s', (corpus_id,))

        await cursor.execute('DELETE FROM corpus_alignment WHERE corpus_name_1 = %s OR corpus_name_2 = %s',
                             (corpus_id, corpus_id))
        await cursor.execute('DELETE FROM corpus_posattr WHERE corpus_name = %s', (corpus_id,))
        await cursor.execute('DELETE FROM corpus_structattr WHERE corpus_name = %s', (corpus_id,))
        await cursor.execute('DELETE FROM corpus_structure WHERE corpus_name = %s', (corpus_id,))
        await cursor.execute('DELETE FROM kontext_corpus_user WHERE corpus_name = %s', (corpus_id,))
        await cursor.execute('DELETE FROM registry_conf WHERE corpus_name = %s', (corpus_id,))
        await cursor.execute(f'DELETE FROM {self._corp_table} WHERE id = %s', (corpus_id,))

        # text types description
        await cursor.execute(
            'SELECT t.id '
            'FROM kontext_ttdesc AS t '
            f'LEFT JOIN {self._corp_table} AS kc ON kc.ttdesc_id = t.id '
            'WHERE kc.ttdesc_id IS NULL')
        for row4 in await cursor.fetchall():
            await cursor.execute('DELETE FROM kontext_ttdesc WHERE id = %s', (row4['id'],))

    @staticmethod
    async def _create_structattr_if_none(cursor: MySQLCursorAbstract, corpus_id, name):
        """
        Create a structural attribute (e.g. "doc.author");
        if already present then do nothing.

        arguments:
            corpus_id -- a corpus identifier
            name -- a structural attribute identifier (doc.id, sp.name,...)

        returns:
            a 2-tuple (structure id, attribute id)
            or (None, None) if cannot use passed 'name'

        """
        struct, attr = name.split('.') if name else (None, None)
        if struct and attr:
            await cursor.execute(
                'SELECT COUNT(*) AS cnt FROM corpus_structattr '
                'WHERE corpus_name = %s AND structure_name = %s AND name = %s '
                'LIMIT 1',
                (corpus_id, struct, attr))
            ans = await cursor.fetchone()
            if not ans or ans['cnt'] == 0:
                await cursor.execute(
                    'INSERT INTO corpus_structattr (corpus_name, structure_name, name) '
                    'VALUES (%s, %s, %s)', (corpus_id, struct, attr))
        return struct, attr

    @staticmethod
    async def _find_article(cursor: MySQLCursorAbstract, contents):
        """
        Find an article with exactly same contents.
        """
        await cursor.execute(
            'SELECT id FROM kontext_article WHERE entry LIKE %s LIMIT 1', (contents.strip(),))
        row = await cursor.fetchone()
        return row[0] if row else None

    @staticmethod
    async def _create_struct_if_none(cursor: MySQLCursorAbstract, corpus_id, name):
        """
        Create a structure (e.g. "doc");
        if already present then do nothing.

        arguments:
            corpus_id -- a corpus identifier
            name -- a structure name (doc, p, s, sp, text,...)
        """
        if name:
            await cursor.execute(
                'SELECT COUNT(*) AS cnt FROM corpus_structure '
                'WHERE corpus_name = %s AND name = %s '
                'LIMIT 1', (corpus_id, name))
            ans = await cursor.fetchone()
            if not ans or ans['cnt'] == 0:
                await cursor.execute(
                    'INSERT INTO corpus_structure (corpus_name, name) VALUES (%s, %s)', (corpus_id, name))

    async def save_corpus_article(self, cursor: MySQLCursorAbstract, text):
        await cursor.execute('INSERT INTO kontext_article (entry) VALUES (%s)', (text,))
        await cursor.execute('SELECT last_insert_id() AS last_id')
        return await cursor.fetchone()['last_id']

    async def attach_corpus_article(self, cursor: MySQLCursorAbstract, corpus_id, article_id, role):
        await cursor.execute(
            'INSERT INTO kontext_corpus_article (corpus_name, article_id, role) '
            'VALUES (%s, %s, %s)', (corpus_id, article_id, role))

    @staticmethod
    async def _registry_table_exists(cursor: MySQLCursorAbstract, corpus_id):
        await cursor.execute(
            'SELECT COUNT(*) AS cnt FROM registry_conf WHERE corpus_name = %s LIMIT 1', (corpus_id,))
        row = await cursor.fetchone()
        return row['cnt'] == 1 if row else False

    @staticmethod
    async def _registry_variable_exists(cursor: MySQLCursorAbstract, corpus_id, variant):
        if variant is not None:
            await cursor.execute(
                'SELECT COUNT(*) AS cnt FROM registry_variable '
                'WHERE corpus_name = %s AND variant = %s LIMIT 1', (corpus_id, variant))
        else:
            await cursor.execute(
                'SELECT COUNT(*) AS cnt FROM registry_variable '
                'WHERE corpus_name = %s AND variant IS NULL LIMIT 1', (corpus_id,))
        row = await cursor.fetchone()
        return row['cnt'] == 1 if row else False

    @staticmethod
    def normalize_raw_attrlist(s):
        return re.sub(r'\s+', '', s.replace('|', ','))

    async def get_and_delete_taghelper_rows(self, cursor: MySQLCursorAbstract, corpus_id):
        cols = ['corpus_name', 'pos_attr', 'feat_attr', 'tagset_type', 'tagset_name', 'widget_enabled', 'doc_url_local', 'doc_url_en']
        await cursor.execute(
            'SELECT {} FROM kontext_corpus_taghelper WHERE corpus_name = %s'.format(', '.join(cols)),
            (corpus_id, ))
        rows = await cursor.fetchall()
        await cursor.execute('DELETE FROM kontext_corpus_taghelper WHERE corpus_name = %s', (corpus_id,))
        print(rows)
        return rows

    async def restore_taghelper_rows(self, cursor: MySQLCursorAbstract, corpus_id, rows):
        cols = ['corpus_name', 'pos_attr', 'feat_attr', 'tagset_type', 'tagset_name', 'widget_enabled', 'doc_url_local',
                'doc_url_en']
        for row in rows:
            await cursor.execute(
                'INSERT INTO kontext_corpus_taghelper ({}) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)'.format(', '.join(cols)),
                tuple(row))

    async def save_registry_table(self, cursor: MySQLCursorAbstract, corpus_id, variant, values):
        values = dict(values)
        await self._create_struct_if_none(cursor, corpus_id, values.get('DOCSTRUCTURE', None))
        async with self._db.cursor() as cursor:
            t1 = datetime.datetime.now(
                tz=pytz.timezone('Europe/Prague')).strftime("%Y-%m-%dT%H:%M:%S%z")

            if await self._registry_table_exists(cursor, corpus_id):
                cols = ['updated'] + [REG_COLS_MAP[k]
                                      for k, v in list(values.items()) if k in REG_COLS_MAP]
                vals = [t1]
                for k, v in values.items():
                    if k in ('SUBCORPATTRS', 'FREQTTATTRS'):
                        vals.append(self.normalize_raw_attrlist(v))
                    elif k in REG_COLS_MAP:
                        vals.append(v)
                vals.append(corpus_id)
                sql = 'UPDATE registry_conf SET {0} WHERE corpus_name = %s'.format(
                    ', '.join(f'{c} = %s' for c in cols))
                await cursor.execute(sql, vals)
                created = False
            else:

                cols = ['corpus_name', 'created', 'updated'] + [REG_COLS_MAP[k]
                                                                for k, v in list(values.items()) if k in REG_COLS_MAP]
                vals = [corpus_id, t1, t1]
                for k, v in values.items():
                    if k in ('SUBCORPATTRS', 'FREQTTATTRS'):
                        vals.append(self.normalize_raw_attrlist(v))
                    elif k in REG_COLS_MAP:
                        vals.append(v)
                sql = 'INSERT INTO registry_conf ({0}) VALUES ({1})'.format(
                    ', '.join(cols), ', '.join(len(cols) * ['%s']))
                await cursor.execute(sql, vals)
                created = True

            if await self._registry_variable_exists(cursor, corpus_id, variant):
                if variant is not None:
                    await cursor.execute(
                        'DELETE FROM registry_variable WHERE corpus_name = %s AND variant = %s', (corpus_id, variant))
                else:
                    await cursor.execute(
                        'DELETE FROM registry_variable WHERE corpus_name = %s AND variant IS NULL', (corpus_id,))
            cols = ['corpus_name', 'variant'] + [REG_VAR_COLS_MAP[k] for k, v in list(values.items())
                                                 if k in REG_VAR_COLS_MAP]
            vals = [corpus_id, variant] + \
                [v for k, v in list(values.items()) if k in REG_VAR_COLS_MAP]
            sql = 'INSERT INTO registry_variable ({0}) VALUES ({1})'.format(
                ', '.join(cols), ', '.join(len(cols) * ['%s']))
            await cursor.execute(sql, vals)
            return created

    async def save_corpus_posattr(self, cursor: MySQLCursorAbstract, corpus_id, name, position, values):
        """
        """

        cols = ['corpus_name', 'name', 'position'] + [POS_COLS_MAP[k]
                                                      for k, v in values if k in POS_COLS_MAP]
        vals = [corpus_id, name, position] + [v for k, v in values if k in POS_COLS_MAP]
        try:
            await cursor.execute('SELECT * FROM corpus_posattr WHERE corpus_name = %s AND name = %s', (corpus_id, name))
            row = await cursor.fetchone()
            if row is None:
                sql = 'INSERT INTO corpus_posattr ({0}) VALUES ({1})'.format(
                    ', '.join(cols), ', '.join(['%s'] * len(vals)))
                await cursor.execute(sql, vals)
            else:
                ucols = ', '.join(f'{v} = %s' for v in cols)
                sql = 'UPDATE corpus_posattr SET {0} WHERE corpus_name = %s AND name = %s'.format(
                    ucols)
                await cursor.execute(sql, vals + [corpus_id, name])
        except Exception as ex:
            logging.getLogger(__name__).error(
                'Failed to save registry values: {0}.'.format(list(zip(cols, vals))))
            raise ex

    async def update_corpus_posattr_references(self, cursor: MySQLCursorAbstract, corpus_id, posattr_id, fromattr_id, mapto_id):
        """
        both fromattr_id and mapto_id can be None
        """
        await cursor.execute(
            'UPDATE corpus_posattr SET fromattr = %s, mapto = %s '
            'WHERE corpus_name = %s AND name = %s',
            (fromattr_id, mapto_id, corpus_id, posattr_id))

    async def save_corpus_alignments(self, cursor: MySQLCursorAbstract, corpus_id, aligned_ids):
        for aid in aligned_ids:
            try:
                await cursor.execute(
                    'INSERT INTO corpus_alignment (corpus_name_1, corpus_name_2) '
                    'VALUES (%s, %s)', (corpus_id, aid))
            except Exception as ex:
                logging.getLogger(__name__).error(
                    'Failed to insert values {0}, {1}'.format(corpus_id, aid))
                raise ex

    async def save_corpus_structure(self, cursor: MySQLCursorAbstract, corpus_id, name, position: int, values):
        base_cols = [STRUCT_COLS_MAP[k] for k, v in values if k in STRUCT_COLS_MAP]
        base_vals = [v for k, v in values if k in STRUCT_COLS_MAP]

        await cursor.execute(
            'SELECT position FROM corpus_structure '
            'WHERE corpus_name = %s AND name = %s LIMIT 1', (corpus_id, name))
        row = await cursor.fetchone()
        if row:
            if len(base_vals) > 0 or row['position'] != position:
                cols = ['position'] + base_cols
                vals = [position] + base_vals
                uexpr = ', '.join(f'{c} = %s' for c in cols)
                sql = 'UPDATE corpus_structure SET {0} WHERE corpus_name = %s AND name = %s'.format(
                    uexpr)
                vals = vals + [corpus_id, name]
                await cursor.execute(sql, vals)
        else:
            cols = ['corpus_name', 'name', 'position'] + base_cols
            vals = [corpus_id, name, position] + base_vals
            sql = 'INSERT INTO corpus_structure ({0}) VALUES ({1})'.format(
                ', '.join(cols), ', '.join(['%s'] * len(vals)))
            await cursor.execute(sql, vals)

    @staticmethod
    async def _structattr_exists(cursor: MySQLCursorAbstract, corpus_id, struct_id, name):
        await cursor.execute(
            'SELECT COUNT(*) AS cnt FROM corpus_structattr '
            'WHERE corpus_name = %s AND structure_name = %s AND name = %s',
            (corpus_id, struct_id, name))
        row = await cursor.fetchone()
        return row['cnt'] == 1 if row else False

    async def save_corpus_structattr(self, cursor: MySQLCursorAbstract, corpus_id, struct_id, name, position, values):
        """
        """
        vals = []
        if await self._structattr_exists(cursor, corpus_id, struct_id, name):
            cols = [SATTR_COLS_MAP[k] for k, v in values if k in SATTR_COLS_MAP] + ['position']
            if len(cols) > 0:
                vals = [v for k, v in values if k in SATTR_COLS_MAP] + \
                    [position, corpus_id, struct_id, name]
                sql = (
                    'UPDATE corpus_structattr '
                    'SET {0} '
                    'WHERE corpus_name = %s AND structure_name = %s AND name = %s').format(
                        ', '.join('{0} = %s'.format(c) for c in cols))
            else:
                sql = None
        else:
            cols = ['corpus_name', 'structure_name', 'name', 'position'] + [SATTR_COLS_MAP[k]
                                                                for k, v in values if k in SATTR_COLS_MAP]
            vals = [corpus_id, struct_id, name, position] + [v for k, v in values if k in SATTR_COLS_MAP]
            sql = 'INSERT INTO corpus_structattr ({0}) VALUES ({1})'.format(
                ', '.join(cols), ', '.join(['%s'] * len(vals)))
        try:
            if sql is not None:
                await cursor.execute(sql, vals)
        except Exception as ex:
            logging.getLogger(__name__).error(
                'Failed to insert values {0}'.format(list(zip(cols, vals))))
            raise ex

    async def save_subcorpattr(self, cursor: MySQLCursorAbstract, corpus_id, struct_name, attr_name, idx):
        await cursor.execute(
            'UPDATE corpus_structattr SET subcorpattrs_idx = %s '
            'WHERE corpus_name = %s AND structure_name = %s AND name = %s', (idx, corpus_id, struct_name, attr_name))

    async def save_freqttattr(self, cursor: MySQLCursorAbstract, corpus_id, struct_name, attr_name, idx):
        await cursor.execute(
            'UPDATE corpus_structattr SET freqttattrs_idx = %s '
            'WHERE corpus_name = %s AND structure_name = %s AND name = %s', (idx, corpus_id, struct_name, attr_name))

    async def _find_structures_use(self, cursor: MySQLCursorAbstract, corp_id: str):
        await cursor.execute(
            'SELECT sentence_struct, speech_segment_struct, speaker_id_struct, speech_overlap_struct,'
            f'bib_label_struct, bib_id_struct FROM {self._corp_table} WHERE name = %s', (corp_id,)
        )
        row = await cursor.fetchone()
        return {} if row is None else row

    async def _find_structattr_use(self, cursor: MySQLCursorAbstract, corp_id: str):
        await cursor.execute(
            'SELECT '
            'CONCAT(speech_segment_attr, ".", speech_segment_struct) AS speech_segment_attr, '
            'CONCAT(speaker_id_struct, ".", speaker_id_attr) AS speaker_id_attr, '
            'CONCAT(speech_overlap_struct, ".", speech_overlap_attr) AS speech_overlap_attr, '
            'CONCAT(bib_label_struct, ".", bib_label_attr) AS bib_label_attr, '
            'CONCAT(bib_id_struct, ".", bib_id_attr) AS bib_id_attr '
            f'FROM {self._corp_table} WHERE name = %s', (corp_id,))
        row = await cursor.fetchone()
        return {} if row is None else row
