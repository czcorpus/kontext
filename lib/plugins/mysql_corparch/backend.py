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

"""
A corparch database backend for MySQL/MariaDB for 'read' operations. Please note
that the backend also covers operations required by mysql_auth plug-in.
"""

from contextlib import asynccontextmanager
from typing import Any, Dict, Iterable, List, Optional, Tuple

from aiomysql.cursors import Cursor
from plugin_types.auth import CorpusAccess
from plugin_types.corparch.backend import DatabaseBackend
from plugin_types.corparch.backend.regkeys import (POS_COLS_MAP, REG_COLS_MAP,
                                                   REG_VAR_COLS_MAP,
                                                   SATTR_COLS_MAP,
                                                   STRUCT_COLS_MAP)
from plugin_types.corparch.corpus import PosCategoryItem, TagsetInfo
from plugins.common.mysql import MySQLOps


class MySQLConfException(Exception):
    pass


DFLT_USER_TABLE = 'kontext_user'
DFLT_USER_CORPLIST_ATTR = 'group_access'
DFLT_CORP_TABLE = 'kontext_corpus'
DFLT_CORP_ID_ATTR = 'name'
DFLT_CORP_PC_ID_ATTR = 'parallel_corpus_id'
DFLT_GROUP_ACC_TABLE = 'kontext_group_access'
DFLT_GROUP_ACC_CORP_ATTR = 'corpus_name'
DFLT_GROUP_ACC_GROUP_ATTR = 'group_access'
DFLT_USER_ACC_TABLE = 'kontext_user_access'
DFLT_USER_ACC_CORP_ATTR = 'corpus_name'
DFLT_GROUP_PC_ACC_TABLE = 'kontext_group_pc_access'
DFLT_GROUP_PC_ACC_PC_ATTR = 'parallel_corpus_id'
DFLT_GROUP_PC_ACC_GROUP_ATTR = 'group_access'
DFLT_USER_PC_ACC_TABLE = 'kontext_user_pc_access'
DFLT_USER_PC_ACC_PC_ATTR = 'parallel_corpus_id'


class Backend(DatabaseBackend):

    def __init__(
        self,
        db: MySQLOps,
        user_table: str = DFLT_USER_TABLE,
        user_group_acc_attr: str = DFLT_USER_CORPLIST_ATTR,
        corp_table: str = DFLT_CORP_TABLE,
        corp_id_attr: str = DFLT_CORP_ID_ATTR,
        corp_pc_id_attr: str = DFLT_CORP_PC_ID_ATTR,
        group_acc_table: str = DFLT_GROUP_ACC_TABLE,
        group_acc_group_attr: str = DFLT_GROUP_ACC_GROUP_ATTR,
        group_acc_corp_attr: str = DFLT_GROUP_ACC_CORP_ATTR,
        user_acc_table: str = DFLT_USER_ACC_TABLE,
        user_acc_corp_attr: str = DFLT_USER_ACC_CORP_ATTR,
        group_pc_acc_table: str = DFLT_GROUP_PC_ACC_TABLE,
        group_pc_acc_pc_attr: str = DFLT_GROUP_PC_ACC_PC_ATTR,
        group_pc_acc_group_attr: str = DFLT_GROUP_PC_ACC_GROUP_ATTR,
        user_pc_acc_table: str = DFLT_USER_PC_ACC_TABLE,
        user_pc_acc_pc_attr: str = DFLT_USER_PC_ACC_PC_ATTR,
        enable_parallel_acc: bool = False,
    ):
        self._db = db
        self._enable_parallel_acc = enable_parallel_acc

        self._user_table = user_table
        self._user_group_acc_attr = user_group_acc_attr
        self._corp_table = corp_table
        self._corp_id_attr = corp_id_attr
        self._corp_pc_id_attr = corp_pc_id_attr
        self._group_acc_table = group_acc_table
        self._user_acc_table = user_acc_table
        self._user_acc_corp_attr = user_acc_corp_attr
        self._group_acc_corp_attr = group_acc_corp_attr
        self._group_acc_group_attr = group_acc_group_attr
        self._group_pc_acc_table = group_pc_acc_table
        self._group_pc_acc_pc_attr = group_pc_acc_pc_attr
        self._group_pc_acc_group_attr = group_pc_acc_group_attr
        self._user_pc_acc_table = user_pc_acc_table
        self._user_pc_acc_pc_attr = user_pc_acc_pc_attr

    @asynccontextmanager
    async def cursor(self, dictionary=True):
        async with self._db.cursor() as cursor:
            yield cursor

    def _corpus_access_query(self, user_id) -> Tuple[str, List[int]]:
        """
        Query to get corpora user has access to. It accepts 2 `user_id` arguments
        """
        return (
            f'''
                SELECT
                    acc.{self._user_acc_corp_attr} AS corpus_id,
                    acc.limited AS limited
                FROM {self._user_acc_table} AS acc
                WHERE acc.user_id = %s
                UNION
                SELECT
                    g_acc.{self._group_acc_corp_attr} AS corpus_id,
                    g_acc.limited AS limited
                FROM {self._group_acc_table} AS g_acc
                WHERE g_acc.{self._group_acc_group_attr} = (
                    SELECT {self._user_table}.{self._user_group_acc_attr}
                    FROM {self._user_table}
                    WHERE {self._user_table}.id = %s
                )
                ''',
            [user_id, user_id]
        )

    def _parallel_access_query(self, user_id) -> Tuple[str, List[int]]:
        """
        Query to get parallel corpora user has access to. It accepts 2 `user_id` arguments.
        """
        return (
            f'''
                SELECT
                    corp.{self._corp_id_attr} AS corpus_id,
                    pc_acc.limited AS limited
                FROM {self._user_pc_acc_table} AS pc_acc
                JOIN {self._corp_table} AS corp ON corp.{self._corp_pc_id_attr} = pc_acc.{self._user_pc_acc_pc_attr}
                WHERE
                    pc_acc.user_id = %s
                UNION
                SELECT
                    corp.{self._corp_id_attr} AS corpus_id,
                    g_pc_acc.limited AS limited
                FROM {self._group_pc_acc_table} AS g_pc_acc
                JOIN {self._corp_table} AS corp ON corp.{self._corp_pc_id_attr} = g_pc_acc.{self._group_pc_acc_pc_attr}
                WHERE g_pc_acc.{self._group_pc_acc_group_attr} = (
                    SELECT user.{self._user_group_acc_attr}
                    FROM {self._user_table} AS user
                    WHERE user.id = %s
                )
                ''',
            [user_id, user_id]
        )

    def _total_access_query(self, user_id) -> Tuple[str, List[int]]:
        corp_acc_sql, corp_acc_args = self._corpus_access_query(user_id)
        if self._enable_parallel_acc:
            par_acc_sql, par_acc_args = self._parallel_access_query(user_id)
            return f'{corp_acc_sql} UNION {par_acc_sql}', corp_acc_args + par_acc_args
        return corp_acc_sql, corp_acc_args

    async def contains_corpus(self, cursor: Cursor, corpus_id: str) -> bool:
        await cursor.execute(f'SELECT name FROM {self._corp_table} WHERE name = %s', (corpus_id,))
        return (await cursor.fetchone()) is not None

    async def load_corpus_articles(self, cursor: Cursor, corpus_id: str) -> Iterable[Dict[str, Any]]:
        await cursor.execute(
            'SELECT ca.role, a.entry '
            'FROM kontext_article AS a '
            'JOIN kontext_corpus_article AS ca ON ca.article_id = a.id '
            'WHERE ca.corpus_name = %s', (corpus_id,))
        return await cursor.fetchall()

    async def load_all_keywords(self, cursor: Cursor) -> Iterable[Dict[str, str]]:
        await cursor.execute(
            'SELECT id, label_cs, label_en, color FROM kontext_keyword ORDER BY display_order')
        return await cursor.fetchall()

    async def load_ttdesc(self, cursor: Cursor, desc_id) -> Iterable[Dict[str, str]]:
        await cursor.execute('SELECT text_cs, text_en FROM kontext_ttdesc WHERE id = %s', (desc_id,))
        return await cursor.fetchall()

    async def load_corpora_descriptions(self, cursor: Cursor, corp_ids: List[str], user_lang: str) -> Dict[str, str]:
        if len(corp_ids) == 0:
            return {}
        placeholders = ', '.join(['%s'] * len(corp_ids))
        col = f'description_{user_lang[:2]}'
        await cursor.execute(
            f'SELECT name AS corpname, {col} AS contents '
            f'FROM {self._corp_table} '
            f'WHERE name IN ({placeholders})', corp_ids)
        return {r['corpname']: r['contents'] async for r in cursor}

    async def load_corpus(self, cursor: Cursor, corp_id: str) -> Dict[str, Any]:
        await cursor.execute(
            'SELECT c.name as id, c.web, c.sentence_struct, c.locale AS collator_locale, '
            'IF (c.speaker_id_struct IS NOT NULL, CONCAT(c.speaker_id_struct, \'.\', c.speaker_id_attr), NULL) '
            '  AS speaker_id_attr, '
            'IF (c.speech_overlap_struct IS NOT NULL AND c.speech_overlap_attr IS NOT NULL, '
            '    CONCAT(c.speech_overlap_struct, \'.\', c.speech_overlap_attr), '
            '    c.speech_overlap_struct) AS speech_overlap_attr, '
            'c.speech_overlap_val, c.use_safe_font, '
            'c.requestable, c.featured, c.text_types_db AS `database`, '
            'c.description_cs, c.description_en, '
            'IF (c.bib_label_attr IS NOT NULL, CONCAT(c.bib_label_struct, \'.\', c.bib_label_attr), NULL) '
            '  AS label_attr, '
            'IF (c.bib_id_attr IS NOT NULL, CONCAT(c.bib_id_struct, \'.\', c.bib_id_attr), NULL) AS id_attr, '
            'IF (c.speech_segment_attr IS NOT NULL, CONCAT(c.speech_segment_struct, \'.\', c.speech_segment_attr), '
            '  NULL) AS speech_segment, '
            'c.bib_group_duplicates, c.description_cs, c.description_en, '
            'c.ttdesc_id AS ttdesc_id, GROUP_CONCAT(kc.keyword_id, \',\') AS keywords, '
            'c.size, rc.name, rc.rencoding AS encoding, rc.language, '
            'c.default_virt_keyboard as default_virt_keyboard, '
            'c.default_view_opts, c.default_tagset, '
            'c.part_of_ml_corpus, c.ml_position_filter '
            f'FROM {self._corp_table} AS c '
            'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_name = c.name '
            'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
            'WHERE c.active = 1 AND c.name = %s '
            'GROUP BY c.name ', (corp_id,))
        return await cursor.fetchone()

    async def list_corpora(
            self, cursor: Cursor, user_id, substrs=None, keywords=None, min_size=0, max_size=None, requestable=False,
            offset=0, limit=10000000000, favourites=()) -> Iterable[Dict[str, Any]]:
        where_cond1 = ['c.active = %s', 'c.requestable = %s']
        values_cond1 = [1, 1]
        where_cond2 = ['c.active = %s']
        values_cond2 = [1]
        if substrs is not None:
            for substr in substrs:
                where_cond1.append(
                    '(rc.name LIKE %s OR c.name LIKE %s OR c.description_cs LIKE %s OR c.description_en LIKE %s)')
                values_cond1.extend(4 * [f'%{substr}%'])
                where_cond2.append(
                    '(rc.name LIKE %s OR c.name LIKE %s OR c.description_cs LIKE %s OR c.description_en LIKE %s)')
                values_cond2.extend(4 * [f'%{substr}%'])
        if keywords is not None and len(keywords) > 0:
            where_cond1.append(
                '({0})'.format(' OR '.join('kc.keyword_id = %s' for _ in keywords)))
            where_cond2.append(
                '({0})'.format(' OR '.join('kc.keyword_id = %s' for _ in keywords)))
            for keyword in keywords:
                values_cond1.append(keyword)
                values_cond2.append(keyword)
        if min_size > 0:
            where_cond1.append('(c.size >= %s)')
            values_cond1.append(min_size)
            where_cond2.append('(c.size >= %s)')
            values_cond2.append(min_size)
        if max_size is not None:
            where_cond1.append('(c.size <= %s)')
            values_cond1.append(max_size)
            where_cond2.append('(c.size <= %s)')
            values_cond2.append(max_size)
        if favourites:
            where_cond1.append('(c.name in (%s))' % ('%s,' * len(favourites))[:-1])
            values_cond1.extend(favourites)
            where_cond2.append('(c.name in (%s))' % ('%s,' * len(favourites))[:-1])
            values_cond2.extend(favourites)
        values_cond1.append(len(keywords) if keywords else 0)  # for num_match_keys >= x
        values_cond2.append(len(keywords) if keywords else 0)  # for num_match_keys >= x

        # performance note: using UNION instead of 'WHERE user_id = x OR c.requestable = 1' increased
        # mysql performance significantly (more than 10x faster).
        sql = ('SELECT IF(count(*) = MAX(requestable), 1, 0) AS requestable, id, web, collator_locale, '
               'speech_segment, speaker_id_attr, speech_overlap_attr, speech_overlap_val, use_safe_font, featured, '
               '`database`, label_attr, id_attr, reference_default, reference_other, ttdesc_id, num_match_keys, size, '
               'name, encoding, language, g_name, version, keywords, description_cs, description_en FROM (')
        where = []
        if requestable:
            where.extend(values_cond1)
            sql += (
                '(SELECT c.name as id, c.web, c.locale AS collator_locale, '
                'NULL as speech_segment, c.requestable, '
                'c.speaker_id_attr,  c.speech_overlap_attr,  c.speech_overlap_val, c.use_safe_font, '
                'c.featured, NULL AS `database`, NULL AS label_attr, NULL AS id_attr, NULL AS reference_default, '
                'NULL AS reference_other, NULL AS ttdesc_id, '
                'c.description_cs, c.description_en, '
                'COUNT(kc.keyword_id) AS num_match_keys, '
                'c.size, ifnull(rc.name, c.name) AS name, rc.rencoding AS encoding, rc.language, '
                'c.group_name AS g_name, c.version AS version, '
                '(SELECT GROUP_CONCAT(kcx.keyword_id, \',\') FROM kontext_keyword_corpus AS kcx '
                'WHERE kcx.corpus_name = c.name) AS keywords '
                f'FROM {self._corp_table} AS c '
                'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_name = c.name '
                'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
                'WHERE {where1} '
                'GROUP BY c.name '
                'HAVING num_match_keys >= %s ) '
                'UNION ').format(where1=' AND '.join('(' + wc + ')' for wc in where_cond1))
        total_acc_sql, total_acc_args = self._total_access_query(user_id)
        where.extend(total_acc_args)
        where.extend(values_cond2)
        sql += (
            '(SELECT c.name as id, c.web, c.locale AS collator_locale, '
            'NULL as speech_segment, 0 as requestable, '
            'c.speaker_id_attr,  c.speech_overlap_attr,  c.speech_overlap_val, c.use_safe_font, '
            'c.featured, NULL AS `database`, NULL AS label_attr, NULL AS id_attr, NULL AS reference_default, '
            'NULL AS reference_other, NULL AS ttdesc_id, '
            'c.description_cs, c.description_en, '
            'COUNT(kc.keyword_id) AS num_match_keys, '
            'c.size, ifnull(rc.name, c.name) AS name, rc.rencoding AS encoding, rc.language, '
            'c.group_name AS g_name, c.version AS version, '
            '(SELECT GROUP_CONCAT(kcx.keyword_id, \',\') FROM kontext_keyword_corpus AS kcx '
            'WHERE kcx.corpus_name = c.name) AS keywords '
            'FROM '
            f'{self._corp_table} AS c '
            'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_name = c.name '
            'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
            'JOIN ('
            f' {total_acc_sql} '
            f') AS kcu ON c.{self._corp_id_attr} = kcu.corpus_id '
            f'WHERE {" AND ".join("(" + wc + ")" for wc in where_cond2)} '
            'GROUP BY c.name '
            'HAVING num_match_keys >= %s ) '
            ') AS ans '
            'GROUP BY id '
            'ORDER BY g_name, version DESC, id '
            'LIMIT %s '
            'OFFSET %s')
        await cursor.execute(sql, where + [limit, offset])
        return await cursor.fetchall()

    async def load_featured_corpora(self, cursor: Cursor, user_lang: str) -> Iterable[Dict[str, str]]:
        desc_col = f'c.description_{user_lang[:2]}'
        await cursor.execute(
            'SELECT c.name AS corpus_id, c.name AS id, ifnull(rc.name, c.name) AS name, '
            f'{desc_col} AS description, c.size '
            f'FROM {self._corp_table} AS c '
            'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
            'WHERE c.active = 1 AND c.featured = 1 ORDER BY c.name')
        return await cursor.fetchall()

    async def load_registry_table(self, cursor: Cursor, corpus_id: str, variant: str) -> Dict[str, str]:
        cols = ([f'rc.{v} AS {k}' for k, v in REG_COLS_MAP.items()] +
                [f'rv.{v} AS {k}' for k, v in REG_VAR_COLS_MAP.items()])
        if variant:
            sql = (
                'SELECT {0} FROM registry_conf AS rc '
                'JOIN registry_variable AS rv ON rv.corpus_name = rc.corpus_name AND rv.variant = %s '
                'WHERE rc.corpus_name = %s').format(', '.join(cols))
            vals = (variant, corpus_id)
        else:
            sql = (
                'SELECT {0} FROM registry_conf AS rc '
                'JOIN registry_variable AS rv ON rv.corpus_name = rc.corpus_name AND rv.variant IS NULL '
                'WHERE rc.corpus_name = %s').format(', '.join(cols))
            vals = (corpus_id, )
        await cursor.execute(sql, vals)
        return await cursor.fetchone()

    async def load_corpus_posattrs(self, cursor: Cursor, corpus_id: str) -> Iterable[Dict[str, Any]]:
        sql = 'SELECT {0} FROM corpus_posattr WHERE corpus_name = %s ORDER BY position'.format(
            ', '.join(['name', 'position'] + [f'`{v}` AS `{k}`' for k, v in POS_COLS_MAP.items()]))
        await cursor.execute(sql, (corpus_id,))
        return await cursor.fetchall()

    async def load_corpus_posattr_references(self, cursor: Cursor, corpus_id: str, posattr_id: str) -> Tuple[str, str]:
        await cursor.execute(
            'SELECT r2.name AS n1, r3.name AS n2 '
            'FROM corpus_posattr AS r1 '
            'LEFT JOIN corpus_posattr AS r2 ON r1.fromattr = r2.name '
            'LEFT JOIN corpus_posattr AS r3 ON r1.mapto = r3.name '
            'WHERE r1.corpus_name = %s AND r1.name = %s', (corpus_id, posattr_id))
        ans = await cursor.fetchone()
        return (ans['n1'], ans['n2']) if ans is not None else (None, None)

    async def load_corpus_alignments(self, cursor: Cursor, corpus_id: str) -> List[str]:
        await cursor.execute(
            'SELECT ca.corpus_name_2 AS id '
            'FROM corpus_alignment AS ca '
            'WHERE ca.corpus_name_1 = %s', (corpus_id,))
        return [row['id'] async for row in cursor]

    async def load_corpus_structures(self, cursor: Cursor, corpus_id: str) -> Iterable[Dict[str, Any]]:
        cols = ['name'] + [f'`{v}` AS `{k}`' for k, v in STRUCT_COLS_MAP.items()]
        sql = 'SELECT {0} FROM corpus_structure WHERE corpus_name = %s'.format(', '.join(cols))
        await cursor.execute(sql, (corpus_id,))
        return await cursor.fetchall()

    async def load_corpus_structattrs(
            self, cursor: Cursor, corpus_id: str, structure_id: Optional[str] = None) -> Iterable[Dict[str, Any]]:
        if structure_id:
            sql = (
                'SELECT {0}, dt_format, structure_name, name '
                'FROM corpus_structattr WHERE corpus_name = %s AND structure_name = %s').format(
                    ', '.join(['name'] + [f'`{v}` AS `{k}`' for k, v in SATTR_COLS_MAP.items()]))
            await cursor.execute(sql, (corpus_id, structure_id))
        else:
            sql = 'SELECT {0}, dt_format, structure_name, name FROM corpus_structattr WHERE corpus_name = %s'.format(
                ', '.join(['name'] + [f'`{v}` AS `{k}`' for k, v in SATTR_COLS_MAP.items()]))
            await cursor.execute(sql, (corpus_id,))
        return await cursor.fetchall()

    async def load_subcorpattrs(self, cursor: Cursor, corpus_id: str) -> List[str]:
        await cursor.execute(
            'SELECT cs.structure_name AS struct, cs.name AS structattr '
            'FROM corpus_structattr AS cs '
            'WHERE cs.subcorpattrs_idx > -1 AND cs.corpus_name = %s '
            'ORDER BY cs.subcorpattrs_idx', (corpus_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) async for x in cursor]

    async def load_freqttattrs(self, cursor: Cursor, corpus_id: str) -> List[str]:
        await cursor.execute(
            'SELECT cs.structure_name AS struct, cs.name AS structattr '
            'FROM corpus_structattr AS cs '
            'WHERE cs.freqttattrs_idx > -1 AND cs.corpus_name = %s '
            'ORDER BY cs.freqttattrs_idx', (corpus_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) async for x in cursor]

    async def load_tckc_providers(self, cursor: Cursor, corpus_id: str) -> Iterable[Dict[str, Any]]:
        await cursor.execute(
            'SELECT provider, type, is_kwic_view FROM kontext_tckc_corpus WHERE corpus_name = %s ORDER BY display_order',
            (corpus_id,))
        return await cursor.fetchall()

    async def corpus_access(self, cursor: Cursor, user_id: str, corpus_id: str) -> CorpusAccess:
        total_acc_sql, total_acc_args = self._total_access_query(user_id)
        args: List[Any] = [user_id] + total_acc_args + [corpus_id]
        await cursor.execute(
            'SELECT %s AS user_id, c.name AS corpus_id, IF (ucp.limited = 1, \'omezeni\', NULL) AS variant '
            'FROM ( '
            f' {total_acc_sql} '
            ') as ucp '
            f'JOIN {self._corp_table} AS c ON ucp.corpus_id = c.id AND c.name = %s '
            'ORDER BY ucp.limited LIMIT 1',
            args)
        row = await cursor.fetchone()
        if not row:
            return CorpusAccess(False, False, '')
        return CorpusAccess(False, True, row['variant'] if row['variant'] else '')

    async def get_permitted_corpora(self, cursor: Cursor, user_id: str) -> List[str]:
        total_acc_sql, total_acc_args = self._total_access_query(user_id)
        await cursor.execute(
            'SELECT %s AS user_id, c.name AS corpus_id, IF (ucp.limited = 1, \'omezeni\', NULL) AS variant '
            'FROM ( '
            f' {total_acc_sql} '
            ') as ucp '
            f'JOIN {self._corp_table} AS c ON ucp.corpus_id = c.id', [user_id] + total_acc_args)
        return [r['corpus_id'] for r in cursor.fetchall()]

    async def load_corpus_tagsets(self, cursor: Cursor, corpus_id: str) -> List[TagsetInfo]:
        await cursor.execute(
            'SELECT ct.corpus_name, ct.pos_attr, ct.feat_attr, t.tagset_type, ct.tagset_name, '
            'ct.kontext_widget_enabled, t.doc_url_local, t.doc_url_en, '
            'GROUP_CONCAT(CONCAT_WS(\',\',tpc.tag_search_pattern,tpc.pos) SEPARATOR \',\') AS patterns_pos '
            'FROM tagset AS t '
            'JOIN corpus_tagset AS ct ON ct.tagset_name = t.name '
            'LEFT JOIN tagset_pos_category AS tpc ON ct.tagset_name = tpc.tagset_name '
            'WHERE ct.corpus_name = %s '
            'GROUP BY tagset_name', (corpus_id, ))
        return [
            TagsetInfo(
                ident=row['tagset_name'],
                type=row['tagset_type'],
                corpus_name=row['corpus_name'],
                pos_attr=row['pos_attr'],
                feat_attr=row['feat_attr'],
                widget_enabled=bool(row['kontext_widget_enabled']),
                doc_url_local=row['doc_url_local'],
                doc_url_en=row['doc_url_en'],
                pos_category=[
                    PosCategoryItem(*pattern_pos)
                    for pattern_pos in list(zip(row['patterns_pos'].split(',')[::2], row['patterns_pos'].split(',')[1::2]))
                    if pattern_pos
                ]
            )
            async for row in cursor
        ]

    async def load_interval_attrs(self, cursor: Cursor, corpus_id):
        await cursor.execute(
            'SELECT interval_struct, interval_attr, widget '
            'FROM kontext_interval_attr '
            'WHERE corpus_name = %s', (corpus_id,))
        return [('{0}.{1}'.format(r['interval_struct'], r['interval_attr']), r['widget']) async for r in cursor]

    async def load_simple_query_default_attrs(self, cursor: Cursor, corpus_id: str) -> List[str]:
        await cursor.execute(
            'SELECT pos_attr FROM kontext_simple_query_default_attrs WHERE corpus_name = %s',
            (corpus_id,))
        return [r['pos_attr'] async for r in cursor]
