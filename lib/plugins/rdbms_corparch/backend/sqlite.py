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

import sqlite3
import time
import logging

from plugins.rdbms_corparch.backend import DatabaseBackend


class Backend(DatabaseBackend):

    def __init__(self, db_path):
        self._db = sqlite3.connect(db_path)
        self._db.row_factory = sqlite3.Row
        self._db.execute('PRAGMA foreign_keys = ON')

    def contains_corpus(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT id FROM kontext_corpus WHERE id = ?', (corpus_id,))
        return cursor.fetchone() is not None

    def load_corpus_articles(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT ca.role, a.entry '
                       'FROM kontext_article AS a '
                       'JOIN kontext_corpus_article AS ca ON ca.article_id = a.id '
                       'WHERE ca.corpus_id = ?', (corpus_id,))
        return cursor.fetchall()

    def load_all_keywords(self):
        cursor = self._db.cursor()
        cursor.execute('SELECT id, label_cs, label_en, color FROM kontext_keyword ORDER BY id')
        return cursor.fetchall()

    def load_ttdesc(self, desc_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT text_cs, text_en FROM kontext_ttdesc WHERE id = ?', (desc_id,))
        return cursor.fetchall()

    def load_corpus(self, corp_id):
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT c.id as id, c.web, cs.name AS sentence_struct, c.tagset, c.tagset_type, c.tagset_pos_attr, '
            'c.tagset_feat_attr, c.collator_locale, '
            '(CASE WHEN c.speaker_id_struct IS NOT NULL '
            '    THEN c.speaker_id_struct || \'.\' || c.speaker_id_attr ELSE NULL END) AS speaker_id_attr,  '
            '(CASE WHEN c.speech_overlap_struct IS NOT NULL '
            '    THEN c.speech_overlap_struct || \'.\' || c.speech_overlap_attr ELSE NULL END) AS speech_overlap_attr, '
            'c.speech_overlap_val, c.use_safe_font, '
            'c.requestable, c.featured, c.text_types_db AS `database`, '
            '(CASE WHEN c.bib_label_attr IS NOT NULL THEN c.bib_label_struct || \'.\' || c.bib_label_attr '
            '  ELSE NULL END) AS label_attr, '
            '(CASE WHEN c.bib_id_attr IS NOT NULL THEN c.bib_id_struct || \'.\' || c.bib_id_attr ELSE NULL END) '
            '  AS id_attr, '
            '(CASE WHEN c.speech_segment_attr IS NOT NULL THEN c.speech_segment_struct || \'.\' || '
            '  c.speech_segment_attr ELSE NULL END) AS speech_segment, '
            'c.bib_group_duplicates, '
            'tc.id AS ttdesc_id, GROUP_CONCAT(kc.keyword_id, \',\') AS keywords, '
            'c.size, rc.info, rc.name, rc.rencoding AS encoding, rc.language '
            'FROM kontext_corpus AS c '
            'LEFT JOIN kontext_ttdesc AS tc ON tc.id = c.ttdesc_id '
            'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_id = c.id '
            'LEFT JOIN registry_conf AS rc ON rc.corpus_id = c.id '
            'LEFT JOIN corpus_structure AS cs ON c.id = kc.corpus_id '
            '  AND c.sentence_struct = cs.name '
            'WHERE c.active = 1 AND c.id = ? '
            'GROUP BY c.id ', (corp_id,))
        return cursor.fetchone()

    def load_all_corpora(self, user_id, substrs=None, keywords=None, min_size=0, max_size=None, requestable=False,
                         offset=0, limit=-1):
        if requestable:
            where_cond = ['c.active = ?', '(kcu.user_id = ? OR c.requestable = ?)']
            values_cond = [1, user_id, 1]
        else:
            where_cond = ['c.active = ?', 'kcu.user_id = ?']
            values_cond = [1, user_id]
        if substrs is not None:
            for substr in substrs:
                where_cond.append(u'(rc.name LIKE ? OR c.id LIKE ? OR rc.info LIKE ?)')
                values_cond.append(u'%{0}%'.format(substr))
                values_cond.append(u'%{0}%'.format(substr))
                values_cond.append(u'%{0}%'.format(substr))
        if keywords is not None and len(keywords) > 0:
            where_cond.append(u'({0})'.format(' OR '.join(
                'ukc.keyword_id = ?' for _ in range(len(keywords)))))
            for keyword in keywords:
                values_cond.append(keyword)
        if min_size > 0:
            where_cond.append('(c.size >= ?)')
            values_cond.append(min_size)
        if max_size is not None:
            where_cond.append('(c.size <= ?)')
            values_cond.append(max_size)
        values_cond.append(len(keywords) if keywords else 0)
        values_cond.append(limit)
        values_cond.append(offset)

        c = self._db.cursor()
        sql = ('SELECT c.id, c.web, c.tagset, c.tagset_type, c.tagset_pos_attr, c.tagset_feat_attr, c.collator_locale, '
               'NULL as speech_segment, c.requestable, c.speaker_id_attr,  c.speech_overlap_attr,  '
               'c.speech_overlap_val, c.use_safe_font, '
               'c.featured, NULL AS `database`, NULL AS label_attr, NULL AS id_attr, NULL AS reference_default, '
               'NULL AS reference_other, NULL AS ttdesc_id, '
               'COUNT(kc.keyword_id) AS num_match_keys, '
               'c.size, rc.info, ifnull(rc.name, c.id) AS name, rc.rencoding AS encoding, rc.language,'
               '(SELECT GROUP_CONCAT(kcx.keyword_id, \',\') FROM kontext_keyword_corpus AS kcx '
               'WHERE kcx.corpus_id = c.id) AS keywords '
               'FROM kontext_corpus AS c '
               'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_id = c.id '
               'LEFT JOIN registry_conf AS rc ON rc.corpus_id = c.id '
               'JOIN kontext_corpus_user AS kcu ON c.id = kcu.corpus_id '
               'WHERE {0} '
               'GROUP BY c.id '
               'HAVING num_match_keys >= ? '
               'ORDER BY c.group_name, c.version DESC, c.id '
               'LIMIT ? '
               'OFFSET ?').format(' AND '.join(where_cond))
        c.execute(sql, values_cond)
        return c.fetchall()

    def load_featured_corpora(self, user_lang):
        cursor = self._db.cursor()
        desc_col = 'c.description_{0}'.format(user_lang[:2])
        cursor.execute('SELECT c.id AS corpus_id, c.id, ifnull(rc.name, c.id) AS name, '
                       '{0} AS description, c.size '
                       'FROM kontext_corpus AS c '
                       'LEFT JOIN registry_conf AS rc ON rc.name = c.id '
                       'WHERE c.active = 1 AND c.featured = 1'.format(desc_col))
        return cursor.fetchall()

    def load_registry_table(self, corpus_id, variant):
        cols = (['rc.{0} AS {1}'.format(v, k) for k, v in self.REG_COLS_MAP.items()] +
                ['rv.{0} AS {1}'.format(v, k) for k, v in self.REG_VAR_COLS_MAP.items()])
        if variant:
            sql = (
                'SELECT {0} FROM rc. AS rc '
                'JOIN registry_variable AS rv ON rv.corpus_id = rc.corpus_id AND rv.variant = ? '
                'WHERE rc.corpus_id = ?').format(', '.join(cols))
            vals = (variant, corpus_id)
        else:
            sql = (
                'SELECT {0} FROM registry_conf AS rc '
                'JOIN registry_variable AS rv ON rv.corpus_id = rc.corpus_id AND rv.variant IS NULL '
                'WHERE rc.corpus_id = ?').format(', '.join(cols))
            vals = (corpus_id, )
        cursor = self._db.cursor()
        cursor.execute(sql, vals)
        return cursor.fetchone()

    def load_corpus_posattrs(self, corpus_id):
        sql = 'SELECT {0} FROM corpus_posattr WHERE corpus_id = ? ORDER BY position'.format(
            ', '.join(['name', 'position'] + ['`{0}` AS `{1}`'.format(v, k) for k, v in self.POS_COLS_MAP.items()]))
        cursor = self._db.cursor()
        cursor.execute(sql, (corpus_id,))
        return cursor.fetchall()

    def load_corpus_posattr_references(self, corpus_id, posattr_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT r2.name AS n1, r3.name AS n2 '
                       'FROM corpus_posattr AS r1 '
                       'LEFT JOIN corpus_posattr AS r2 ON r1.fromattr = r2.name '
                       'LEFT JOIN corpus_posattr AS r3 ON r1.mapto = r3.name '
                       'WHERE r1.corpus_id = ? AND r1.name = ?', (corpus_id, posattr_id))
        ans = cursor.fetchone()
        return (ans['n1'], ans['n2']) if ans is not None else (None, None)

    def load_corpus_alignments(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT ca.corpus_id_2 AS id '
                       'FROM kontext_corpus_alignment AS ca '
                       'WHERE ca.corpus_id_1 = ?', (corpus_id,))
        return [row['id'] for row in cursor.fetchall()]

    def load_corpus_structures(self, corpus_id):
        cols = ['name'] + ['`{0}` AS `{1}`'.format(v, k) for k, v in self.STRUCT_COLS_MAP.items()]
        sql = 'SELECT {0} FROM corpus_structure WHERE corpus_id = ?'.format(', '.join(cols))
        cursor = self._db.cursor()
        cursor.execute(sql, (corpus_id,))
        return cursor.fetchall()

    def load_corpus_structattrs(self, corpus_id, structure_id):
        cursor = self._db.cursor()
        sql = 'SELECT {0} FROM corpus_structattr WHERE corpus_id = ? AND structure_name = ?'.format(
            ', '.join(['name'] + ['`{0}` AS `{1}`'.format(v, k) for k, v in self.SATTR_COLS_MAP.items()]))
        cursor.execute(sql, (corpus_id, structure_id))
        return cursor.fetchall()

    def load_subcorpattrs(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT cs.structure_name AS struct, cs.name AS structattr '
                       'FROM corpus_structattr AS cs '
                       'WHERE cs.subcorpattrs_idx > -1 AND cs.corpus_id = ? '
                       'ORDER BY cs.subcorpattrs_idx', (corpus_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def load_freqttattrs(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT cs.structure_name AS struct, cs.name AS structattr '
                       'FROM corpus_structattr AS cs '
                       'WHERE cs.freqttattrs_idx > -1 AND cs.corpus_id = ? '
                       'ORDER BY cs.freqttattrs_idx', (corpus_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def load_tckc_providers(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT provider, type FROM kontext_tckc_corpus WHERE corpus_id = ?', (corpus_id,))
        return cursor.fetchall()

    def get_permitted_corpora(self, user_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT kcu.corpus_id AS corpus_id, kcu.variant '
                       'FROM kontext_corpus_user AS kcu '
                       'WHERE kcu.user_id = ?', (user_id,))
        return [(r['corpus_id'], r['variant']) for r in cursor.fetchall()]
