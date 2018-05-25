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

    def commit(self):
        self._db.commit()

    def load_corpus_keywords(self, corp_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT id, label_cs, label_en, color FROM keyword_corpus AS kc JOIN keyword AS k '
                       'ON kc.keyword_id = k.id WHERE kc.corpus_id = ?', (corp_id,))
        ans = {}
        for row in cursor.fetchall():
            ans[row['id']] = dict(cs=row['label_cs'], en=row['label_en'])
        return ans

    def load_all_keywords(self):
        cursor = self._db.cursor()
        cursor.execute('SELECT id, label_cs, label_en, color FROM keyword ORDER BY id')
        return cursor.fetchall()

    def load_descriptions(self):
        cursor = self._db.cursor()
        cursor.execute('SELECT id, text_cs, text_en FROM ttdesc')
        return cursor.fetchall()

    def load_all_corpora(self):
        c = self._db.cursor()
        c.execute('SELECT c.id, c.web, c.sentence_struct, c.tagset, c.collator_locale, c.speech_segment, '
                  'c.speaker_id_attr,  c.speech_overlap_attr,  c.speech_overlap_val, c.use_safe_font, '
                  'm.database, m.label_attr, m.id_attr, m.featured, m.reference_default, m.reference_other, '
                  'tc.ttdesc_id AS ttdesc_id '
                  'FROM corpus AS c '
                  'LEFT JOIN metadata AS m ON c.id = m.corpus_id '
                  'LEFT JOIN ttdesc_corpus AS tc ON tc.corpus_id = m.corpus_id '
                  'WHERE c.active = 1 '
                  'ORDER BY c.group_name, c.version DESC, c.id')
        return c.fetchall()

    def save_registry_table(self, corpus_id, variant, values):
        t1 = int(time.time())
        cols = ['corpus_id', 'variant', 'created', 'updated'] + [self.REG_COLS_MAP[k]
                                                                 for k, v in values if k in self.REG_COLS_MAP]
        vals = [corpus_id, variant, t1, t1] + [v for k, v in values if k in self.REG_COLS_MAP]
        sql = 'INSERT OR REPLACE INTO registry ({0}) VALUES ({1})'.format(
            ', '.join(cols), ', '.join(['?'] * len(vals)))
        cursor = self._db.cursor()
        cursor.execute(sql, vals)
        cursor.execute('SELECT last_insert_rowid()')
        return cursor.fetchone()[0]

    def load_registry_table(self, corpus_id, variant):
        cols = ['id'] + ['{0} AS {1}'.format(v, k) for k, v in self.REG_COLS_MAP.items()]
        if variant:
            sql = 'SELECT {0} FROM registry WHERE corpus_id = ? AND variant = ?'.format(
                ', '.join(cols))
            vals = (corpus_id, variant)
        else:
            sql = 'SELECT {0} FROM registry WHERE corpus_id = ? AND variant IS NULL'.format(
                ', '.join(cols))
            vals = (corpus_id,)
            print(vals)
        cursor = self._db.cursor()
        cursor.execute(sql, vals)
        return cursor.fetchone()

    def save_registry_posattr(self, registry_id, name, values):
        """
        """
        cols = ['registry_id', 'name'] + [self.POS_COLS_MAP[k]
                                          for k, v in values if k in self.POS_COLS_MAP]
        vals = [registry_id, name] + [v for k, v in values if k in self.POS_COLS_MAP]
        sql = 'INSERT INTO rattribute ({0}) VALUES ({1})'.format(
            ', '.join(cols), ', '.join(['?'] * len(vals)))
        cursor = self._db.cursor()
        try:
            cursor.execute(sql, vals)
        except sqlite3.Error as ex:
            logging.getLogger(__name__).error(
                u'Failed to save registry values: {0}.'.format(zip(cols, vals)))
            raise ex
        cursor.execute('SELECT last_insert_rowid()')
        return cursor.fetchone()[0]

    def load_registry_posattrs(self, registry_id):
        sql = 'SELECT {0} FROM rattribute WHERE registry_id = ?'.format(
            ', '.join(['id', 'name'] + ['{0} AS {1}'.format(v, k) for k, v in self.POS_COLS_MAP.items()]))
        cursor = self._db.cursor()
        cursor.execute(sql, (registry_id,))
        return cursor.fetchall()

    def update_registry_posattr_references(self, posattr_id, fromattr_id, mapto_id):
        """
        both fromattr_id and mapto_id can be None
        """
        cursor = self._db.cursor()
        cursor.execute('UPDATE rattribute SET fromattr_id = ?, mapto_id = ? WHERE id = ?',
                       (fromattr_id, mapto_id, posattr_id))

    def load_registry_posattr_references(self, posattr_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT r2.name AS n1, r3.name AS n2 '
                       'FROM rattribute AS r1 '
                       'LEFT JOIN rattribute AS r2 ON r1.fromattr_id = r2.id '
                       'LEFT JOIN rattribute AS r3 ON r1.mapto_id = r3.id '
                       'WHERE r1.id = ?', (posattr_id,))
        ans = cursor.fetchone()
        return (ans['n1'], ans['n2']) if ans is not None else (None, None)

    def save_registry_alignments(self, registry_id, aligned_ids):
        cursor = self._db.cursor()
        for aid in aligned_ids:
            try:
                cursor.execute(
                    'INSERT INTO ralignment (registry1_id, registry2_id) VALUES (?, ?)', (registry_id, aid))
            except sqlite3.Error as ex:
                logging.getLogger(__name__).error(
                    u'Failed to insert values {0}, {1}'.format(registry_id, aid))
                raise ex

    def load_registry_alignments(self, registry_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT r2.corpus_id AS id '
                       'FROM ralignment AS ra '
                       'JOIN registry AS r2 ON ra.registry2_id = r2.id '
                       'WHERE ra.registry1_id = ?', (registry_id,))
        return [row['id'] for row in cursor.fetchall()]

    def save_registry_structure(self, registry_id, name, values):
        cols = ['registry_id', 'name'] + [self.STRUCT_COLS_MAP[k]
                                          for k, v in values if k in self.STRUCT_COLS_MAP]
        vals = [registry_id, name] + [v for k, v in values if k in self.STRUCT_COLS_MAP]
        sql = 'INSERT INTO rstructure ({0}) VALUES ({1})'.format(
            ', '.join(cols), ', '.join(['?'] * len(vals)))
        cursor = self._db.cursor()
        cursor.execute(sql, vals)
        cursor.execute('SELECT last_insert_rowid()')
        return cursor.fetchone()[0]

    def load_registry_structures(self, registry_id):
        cols = ['id', 'registry_id', 'name'] + \
            ['{0} AS {1}'.format(v, k) for k, v in self.STRUCT_COLS_MAP.items()]
        sql = 'SELECT {0} FROM rstructure WHERE registry_id = ?'.format(', '.join(cols))
        cursor = self._db.cursor()
        cursor.execute(sql, (registry_id,))
        return cursor.fetchall()

    def save_registry_structattr(self, struct_id, name, values):
        """
        """
        cols = ['rstructure_id', 'name'] + [self.SATTR_COLS_MAP[k]
                                            for k, v in values if k in self.SATTR_COLS_MAP]
        vals = [struct_id, name] + [v for k, v in values if k in self.SATTR_COLS_MAP]
        sql = 'INSERT INTO rstructattr ({0}) VALUES ({1})'.format(
            ', '.join(cols), ', '.join(['?'] * len(vals)))
        cursor = self._db.cursor()
        try:
            cursor.execute(sql, vals)
        except sqlite3.Error as ex:
            logging.getLogger(__name__).error(
                u'Failed to insert values {0}'.format(zip(cols, vals)))
            raise ex
        cursor.execute('SELECT last_insert_rowid()')
        return cursor.fetchone()[0]

    def load_registry_structattrs(self, struct_id):
        cursor = self._db.cursor()
        sql = 'SELECT {0} FROM rstructattr WHERE rstructure_id = ?'.format(
            ', '.join(['id', 'name'] + ['{0} AS {1}'.format(v, k) for k, v in self.SATTR_COLS_MAP.items()]))
        cursor.execute(sql, (struct_id,))
        return cursor.fetchall()

    def save_subcorpattr(self, struct_id, idx):
        cursor = self._db.cursor()
        cursor.execute('UPDATE rstructattr SET subcorpattrs_idx = ? WHERE id = ?', (idx, struct_id))

    def load_subcorpattrs(self, registry_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT r.name AS struct, rs.name AS structattr '
                       'FROM rstructure AS r JOIN rstructattr AS rs ON r.id = rs.rstructure_id '
                       'WHERE rs.subcorpattrs_idx > -1 AND r.registry_id = ? '
                       'ORDER BY rs.subcorpattrs_idx', (registry_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def save_freqttattr(self, struct_id, idx):
        cursor = self._db.cursor()
        cursor.execute('UPDATE rstructattr SET freqttattrs_idx = ? WHERE id = ?', (idx, struct_id))

    def load_freqttattrs(self, registry_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT r.name AS struct, rs.name AS structattr '
                       'FROM rstructure AS r JOIN rstructattr AS rs ON r.id = rs.rstructure_id '
                       'WHERE rs.freqttattrs_idx > -1 AND r.registry_id = ?'
                       'ORDER BY rs.freqttattrs_idx', (registry_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def load_tckc_providers(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT provider, type FROM tckc_corpus WHERE corpus_id = ?', (corpus_id,))
        return cursor.fetchall()
