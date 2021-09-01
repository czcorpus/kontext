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
A corparch database backend for MySQL/MariaDB for 'read' operations
"""
import json
from typing import Any, Dict, Iterable, List, Tuple
from plugins.abstract.corparch.corpus import TagsetInfo, PosCategoryItem
from plugins.abstract.corparch.backend import DatabaseBackend
from plugins.abstract.corparch.backend.regkeys import (
    REG_COLS_MAP, REG_VAR_COLS_MAP, POS_COLS_MAP, STRUCT_COLS_MAP, SATTR_COLS_MAP)


class MySQLConfException(Exception):
    pass


DFLT_USER_TABLE = 'kontext_user'
DFLT_CORP_TABLE = 'kontext_corpus'
DFLT_GROUP_ACC_TABLE = 'kontext_group_access'
DFLT_GROUP_ACC_CORP_ATTR = 'corpus_name'
DFLT_GROUP_ACC_GROUP_ATTR = 'group_access'
DFLT_USER_ACC_TABLE = 'kontext_user_access'
DFLT_USER_ACC_CORP_ATTR = 'corpus_name'


class Backend(DatabaseBackend):

    def __init__(self, db, user_table: str = DFLT_USER_TABLE, corp_table: str = DFLT_CORP_TABLE,
                 group_acc_table: str = DFLT_GROUP_ACC_TABLE, user_acc_table: str = DFLT_USER_ACC_TABLE,
                 user_acc_corp_attr: str = DFLT_USER_ACC_CORP_ATTR, group_acc_corp_attr: str = DFLT_GROUP_ACC_CORP_ATTR,
                 group_acc_group_attr: str = DFLT_GROUP_ACC_GROUP_ATTR):
        self._db = db
        self._user_table = user_table
        self._corp_table = corp_table
        self._group_acc_table = group_acc_table
        self._user_acc_table = user_acc_table
        self._user_acc_corp_attr = user_acc_corp_attr
        self._group_acc_corp_attr = group_acc_corp_attr
        self._group_acc_group_attr = group_acc_group_attr

    def contains_corpus(self, corpus_id: str) -> bool:
        cursor = self._db.cursor()
        cursor.execute(f'SELECT name FROM {self._corp_table} WHERE name = %s', (corpus_id,))
        return cursor.fetchone() is not None

    def load_corpus_articles(self, corpus_id: str) -> Iterable[Dict[str, Any]]:
        cursor = self._db.cursor()
        cursor.execute('SELECT ca.role, a.entry '
                       'FROM kontext_article AS a '
                       'JOIN kontext_corpus_article AS ca ON ca.article_id = a.id '
                       'WHERE ca.corpus_name = %s', (corpus_id,))
        return cursor.fetchall()

    def load_all_keywords(self) -> Iterable[Dict[str, str]]:
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT id, label_cs, label_en, color FROM kontext_keyword ORDER BY display_order')
        return cursor.fetchall()

    def load_ttdesc(self, desc_id) -> Iterable[Dict[str, str]]:
        cursor = self._db.cursor()
        cursor.execute('SELECT text_cs, text_en FROM kontext_ttdesc WHERE id = %s', (desc_id,))
        return cursor.fetchall()

    def load_corpora_descriptions(self, corp_ids: List[str], user_lang: str) -> Dict[str, str]:
        if len(corp_ids) == 0:
            return {}
        cursor = self._db.cursor()
        placeholders = ', '.join(['%s'] * len(corp_ids))
        col = 'description_{0}'.format(user_lang[:2])
        cursor.execute(f'SELECT name AS corpname, {col} AS contents '
                       f'FROM {self._corp_table} '
                       f'WHERE name IN ({placeholders})', corp_ids)
        return dict((r['corpname'], r['contents']) for r in cursor.fetchall())

    def load_corpus(self, corp_id: str) -> Dict[str, Any]:
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT c.name as id, c.web, cs.name AS sentence_struct, c.collator_locale, '
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
            'c.default_view_opts, c.default_tagset '
            f'FROM {self._corp_table} AS c '
            'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_name = c.name '
            'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
            'LEFT JOIN corpus_structure AS cs ON cs.corpus_name = kc.corpus_name '
            '  AND c.sentence_struct = cs.name '
            'WHERE c.active = 1 AND c.name = %s '
            'GROUP BY c.name ', (corp_id,))
        return cursor.fetchone()

    def load_all_corpora(self, user_id, substrs=None, keywords=None, min_size=0, max_size=None, requestable=False,
                         offset=0, limit=10000000000, favourites=()) -> Iterable[Dict[str, Any]]:
        where_cond1 = ['c.active = %s', 'c.requestable = %s']
        values_cond1 = [1, 1]
        where_cond2 = ['c.active = %s']
        # the first item belongs to setting a special @ variable
        values_cond2 = [user_id, user_id, 1]
        if substrs is not None:
            for substr in substrs:
                where_cond1.append(
                    '(rc.name LIKE %s OR c.name LIKE %s OR c.description_cs LIKE %s OR c.description_en LIKE %s)')
                values_cond1.append('%{0}%'.format(substr))
                values_cond1.append('%{0}%'.format(substr))
                values_cond1.append('%{0}%'.format(substr))
                values_cond1.append('%{0}%'.format(substr))
                where_cond2.append(
                    '(rc.name LIKE %s OR c.name LIKE %s OR c.description_cs LIKE %s OR c.description_en LIKE %s)')
                values_cond2.append('%{0}%'.format(substr))
                values_cond2.append('%{0}%'.format(substr))
                values_cond2.append('%{0}%'.format(substr))
                values_cond2.append('%{0}%'.format(substr))
        if keywords is not None and len(keywords) > 0:
            where_cond1.append('({0})'.format(' OR '.join(
                'kc.keyword_id = %s' for _ in range(len(keywords)))))
            where_cond2.append('({0})'.format(' OR '.join(
                'kc.keyword_id = %s' for _ in range(len(keywords)))))
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

        c = self._db.cursor()
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
                '(SELECT c.name as id, c.web, c.collator_locale, NULL as speech_segment, c.requestable, '
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
        where.extend(values_cond2)
        sql += (
            '(SELECT c.name as id, c.web, c.collator_locale, NULL as speech_segment, 0 as requestable, '
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
            'LEFT JOIN ('
            f'  SELECT {self._user_acc_table}.{self._user_acc_corp_attr} AS corpus_id, '
            f'    {self._user_acc_table}.limited AS limited '
            f'  FROM {self._user_acc_table} WHERE ({self._user_acc_table}.user_id = %s) '
            '  UNION '
            f'  SELECT {self._group_acc_table}.{self._group_acc_corp_attr} AS corpus_id, '
            f'    {self._group_acc_table}.limited AS limited '
            f'  FROM {self._group_acc_table} '
            f'  WHERE ({self._group_acc_table}.{self._group_acc_group_attr} = '
            f'     (SELECT {self._user_table}.{self._group_acc_group_attr} '
            f'          FROM {self._user_table} WHERE ({self._user_table}.id = %s))) '
            ') AS kcu ON c.id = kcu.corpus_id '
            f'WHERE {" AND ".join("(" + wc + ")" for wc in where_cond2)} '
            'GROUP BY c.name '
            'HAVING num_match_keys >= %s ) '
            ') AS ans '
            'GROUP BY id '
            'ORDER BY g_name, version DESC, id '
            'LIMIT %s '
            'OFFSET %s')
        c.execute(sql, where + [limit, offset])
        return c.fetchall()

    def load_featured_corpora(self, user_lang: str) -> Iterable[Dict[str, str]]:
        cursor = self._db.cursor()
        desc_col = 'c.description_{0}'.format(user_lang[:2])
        cursor.execute('SELECT c.name AS corpus_id, c.name AS id, ifnull(rc.name, c.name) AS name, '
                       f'{desc_col} AS description, c.size '
                       f'FROM {self._corp_table} AS c '
                       'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
                       'WHERE c.active = 1 AND c.featured = 1 ORDER BY c.name')
        return cursor.fetchall()

    def load_registry_table(self, corpus_id: str, variant: str) -> Dict[str, str]:
        cols = (['rc.{0} AS {1}'.format(v, k) for k, v in list(REG_COLS_MAP.items())] +
                ['rv.{0} AS {1}'.format(v, k) for k, v in list(REG_VAR_COLS_MAP.items())])
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
        cursor = self._db.cursor()
        cursor.execute(sql, vals)
        return cursor.fetchone()

    def load_corpus_posattrs(self, corpus_id: str) -> Iterable[Dict[str, Any]]:
        sql = 'SELECT {0} FROM corpus_posattr WHERE corpus_name = %s ORDER BY position'.format(
            ', '.join(['name', 'position'] + ['`{0}` AS `{1}`'.format(v, k) for k, v in list(POS_COLS_MAP.items())]))
        cursor = self._db.cursor()
        cursor.execute(sql, (corpus_id,))
        return cursor.fetchall()

    def load_corpus_posattr_references(self, corpus_id: str, posattr_id: str) -> Tuple[str, str]:
        cursor = self._db.cursor()
        cursor.execute('SELECT r2.name AS n1, r3.name AS n2 '
                       'FROM corpus_posattr AS r1 '
                       'LEFT JOIN corpus_posattr AS r2 ON r1.fromattr = r2.name '
                       'LEFT JOIN corpus_posattr AS r3 ON r1.mapto = r3.name '
                       'WHERE r1.corpus_name = %s AND r1.name = %s', (corpus_id, posattr_id))
        ans = cursor.fetchone()
        return (ans['n1'], ans['n2']) if ans is not None else (None, None)

    def load_corpus_alignments(self, corpus_id: str) -> List[str]:
        cursor = self._db.cursor()
        cursor.execute('SELECT ca.corpus_name_2 AS id '
                       'FROM corpus_alignment AS ca '
                       'WHERE ca.corpus_name_1 = %s', (corpus_id,))
        return [row['id'] for row in cursor.fetchall()]

    def load_corpus_structures(self, corpus_id: str) -> Iterable[Dict[str, Any]]:
        cols = ['name'] + ['`{0}` AS `{1}`'.format(v, k)
                           for k, v in list(STRUCT_COLS_MAP.items())]
        sql = 'SELECT {0} FROM corpus_structure WHERE corpus_name = %s'.format(', '.join(cols))
        cursor = self._db.cursor()
        cursor.execute(sql, (corpus_id,))
        return cursor.fetchall()

    def load_corpus_structattrs(self, corpus_id: str, structure_id: str) -> Iterable[Dict[str, Any]]:
        cursor = self._db.cursor()
        sql = 'SELECT {0} FROM corpus_structattr WHERE corpus_name = %s AND structure_name = %s'.format(
            ', '.join(['name'] + ['`{0}` AS `{1}`'.format(v, k) for k, v in list(SATTR_COLS_MAP.items())]))
        cursor.execute(sql, (corpus_id, structure_id))
        return cursor.fetchall()

    def load_subcorpattrs(self, corpus_id: str) -> List[str]:
        cursor = self._db.cursor()
        cursor.execute('SELECT cs.structure_name AS struct, cs.name AS structattr '
                       'FROM corpus_structattr AS cs '
                       'WHERE cs.subcorpattrs_idx > -1 AND cs.corpus_name = %s '
                       'ORDER BY cs.subcorpattrs_idx', (corpus_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def load_freqttattrs(self, corpus_id: str) -> List[str]:
        cursor = self._db.cursor()
        cursor.execute('SELECT cs.structure_name AS struct, cs.name AS structattr '
                       'FROM corpus_structattr AS cs '
                       'WHERE cs.freqttattrs_idx > -1 AND cs.corpus_name = %s '
                       'ORDER BY cs.freqttattrs_idx', (corpus_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def load_tckc_providers(self, corpus_id: str) -> Iterable[Dict[str, Any]]:
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT provider, type, is_kwic_view FROM kontext_tckc_corpus WHERE corpus_name = %s ORDER BY display_order',
            (corpus_id,))
        return cursor.fetchall()

    def corpus_access(self, user_id: str, corpus_id: str) -> Tuple[bool, bool, str]:
        cursor = self._db.cursor()
        cursor.execute('SELECT %s AS user_id, c.name AS corpus_id, IF (ucp.limited = 1, \'omezeni\', NULL) AS variant '
                       'FROM ( '
                       f'  SELECT {self._user_acc_table}.{self._user_acc_corp_attr} AS corpus_id, '
                       f'    {self._user_acc_table}.limited AS limited '
                       f'  FROM {self._user_acc_table} WHERE ({self._user_acc_table}.user_id = %s) '
                       '  UNION '
                       f'  SELECT {self._group_acc_table}.{self._group_acc_corp_attr} AS corpus_id, '
                       f'    {self._group_acc_table}.limited AS limited '
                       f'  FROM {self._group_acc_table} '
                       f'  WHERE ({self._group_acc_table}.{self._group_acc_group_attr} = '
                       f'      (SELECT {self._user_table}.{self._group_acc_group_attr} '
                       f'           FROM {self._user_table} WHERE ({self._user_table}.id = %s))) '
                       ') as ucp '
                       f'JOIN {self._corp_table} AS c ON ucp.corpus_id = c.id AND c.name = %s '
                       'ORDER BY ucp.limited LIMIT 1',
                       (user_id, user_id, user_id, corpus_id))
        row = cursor.fetchone()
        if not row:
            return False, False, ''
        return False, True, row['variant'] if row['variant'] else ''

    def get_permitted_corpora(self, user_id: str) -> List[str]:
        cursor = self._db.cursor()
        cursor.execute('SELECT %s AS user_id, c.name AS corpus_id, IF (ucp.limited = 1, \'omezeni\', NULL) AS variant '
                       'FROM ( '
                       f'  SELECT {self._user_acc_table}.{self._user_acc_corp_attr} AS corpus_id, '
                       f'    {self._user_acc_table}.limited AS limited '
                       f'  FROM {self._user_acc_table} WHERE ({self._user_acc_table}.user_id = %s) '
                       '  UNION '
                       f'  SELECT {self._group_acc_table}.{self._group_acc_corp_attr} AS corpus_id, '
                       f'     {self._group_acc_table}.limited AS limited '
                       f'  FROM {self._group_acc_table} '
                       f'  WHERE ({self._group_acc_table}.{self._group_acc_group_attr} = '
                       f'      (SELECT {self._user_table}.{self._group_acc_group_attr} '
                       f'           FROM {self._user_table} WHERE ({self._user_table}.id = %s))) '
                       ') as ucp '
                       f'JOIN {self._corp_table} AS c ON ucp.corpus_id = c.id', (user_id, user_id, user_id))
        return [r['corpus_id'] for r in cursor.fetchall()]

    def load_corpus_tagsets(self, corpus_id: str) -> List[TagsetInfo]:
        cursor = self._db.cursor()
        cursor.execute("SELECT ct.corpus_name, ct.pos_attr, ct.feat_attr, t.tagset_type, ct.tagset_name, "
                       "ct.kontext_widget_enabled, t.doc_url_local, t.doc_url_en, "
                       "GROUP_CONCAT(CONCAT_WS(',',tpc.tag_search_pattern,tpc.pos) SEPARATOR ',') AS patterns_pos "
                       "FROM tagset AS t "
                       "JOIN corpus_tagset AS ct ON ct.tagset_name = t.name "
                       "LEFT JOIN tagset_pos_category AS tpc ON ct.tagset_name = tpc.tagset_name "
                       "WHERE ct.corpus_name = %s "
                       "GROUP BY tagset_name", (corpus_id, ))
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
            for row in cursor
        ]

    def load_interval_attrs(self, corpus_id: str) -> List[str]:
        cursor = self._db.cursor()
        cursor.execute('SELECT interval_struct, interval_attr, widget '
                       'FROM kontext_interval_attr '
                       'WHERE corpus_name = %s', (corpus_id,))
        return [('{0}.{1}'.format(r['interval_struct'], r['interval_attr']), r['widget']) for r in cursor.fetchall()]

    def load_simple_query_default_attrs(self, corpus_id: str) -> List[str]:
        cursor = self._db.cursor()
        cursor.execute('SELECT pos_attr FROM kontext_simple_query_default_attrs WHERE corpus_name = %s',
                       (corpus_id,))
        return [r['pos_attr'] for r in cursor.fetchall()]
