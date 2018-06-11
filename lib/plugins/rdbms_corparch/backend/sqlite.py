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
import os

from plugins.rdbms_corparch.backend import DatabaseBackend, InstallCorpusInfo


class Backend(DatabaseBackend):

    def __init__(self, db_path):
        self._db = sqlite3.connect(db_path)
        self._db.row_factory = sqlite3.Row
        self._db.execute('PRAGMA foreign_keys = ON')

    def commit(self):
        self._db.commit()

    def contains_corpus(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT id FROM kontext_corpus WHERE id = ?', (corpus_id,))
        return cursor.fetchone() is not None

    def remove_corpus(self, corpus_id):
        cursor = self._db.cursor()

        # articles
        cursor.execute('SELECT a.id '
                       'FROM kontext_article AS a '
                       'LEFT JOIN kontext_corpus_article AS ca ON a.id = ca.article_id '
                       'WHERE ca.corpus_id IS NULL')
        for row3 in cursor.fetchall():
            cursor.execute('DELETE FROM kontext_article WHERE id = ?', (row3['id'],))

        # text types description
        cursor.execute('SELECT t.id '
                       'FROM kontext_ttdesc AS t '
                       'LEFT JOIN kontext_metadata AS m ON m.ttdesc_id = t.id '
                       'WHERE m.ttdesc_id IS NULL')
        for row4 in cursor.fetchall():
            cursor.execute('DELETE FROM kontext_ttdesc WHERE id = ?', (row4['id'],))

        # metadata
        cursor.execute('DELETE FROM kontext_metadata WHERE corpus_id = ?', (corpus_id,))

        # misc. M:N stuff
        cursor.execute('DELETE FROM kontext_tckc_corpus WHERE corpus_id = ?', (corpus_id,))
        cursor.execute('DELETE FROM kontext_keyword_corpus WHERE corpus_id = ?', (corpus_id,))
        cursor.execute('DELETE FROM kontext_corpus_article WHERE corpus_id = ?', (corpus_id,))

        # registry
        cursor.execute('SELECT id FROM registry_conf WHERE corpus_id = ?', (corpus_id,))

        for row in cursor.fetchall():
            reg_id = row['id']
            cursor.execute('DELETE FROM registry_alignment WHERE registry1_id = ? OR registry2_id = ?',
                           (reg_id, reg_id))
            cursor.execute('DELETE FROM registry_attribute WHERE registry_id = ?', (reg_id,))

            cursor.execute('SELECT id FROM registry_structure WHERE registry_id = ?', (reg_id,))
            for row2 in cursor.fetchall():
                cursor.execute(
                    'DELETE FROM registry_structattr WHERE rstructure_id = ?', (row2['id'],))

            cursor.execute('DELETE FROM registry_structure WHERE registry_id = ?', (reg_id,))
            cursor.execute('DELETE FROM registry_conf_user WHERE registry_conf_id = ?', (reg_id,))

            cursor.execute('DELETE FROM registry_conf WHERE id = ?', (reg_id,))

        cursor.execute('DELETE FROM kontext_corpus WHERE id = ?', (corpus_id,))

    def _find_article(self, contents):
        cursor = self._db.cursor()
        cursor.execute('SELECT id FROM kontext_article WHERE entry LIKE ?', (contents.strip(),))
        row = cursor.fetchone()
        return row[0] if row else None

    def save_corpus_config(self, install_json, registry_dir):
        curr_time = time.time()
        cursor = self._db.cursor()

        vals1 = (
            install_json.ident,
            install_json.get_group_name(),
            install_json.get_version(),
            int(curr_time),
            int(curr_time),
            1,
            install_json.web,
            install_json.tagset,
            install_json.collator_locale,
            install_json.speech_segment,
            install_json.speaker_id_attr,
            install_json.speech_overlap_attr,
            install_json.speech_overlap_val,
            install_json.use_safe_font
        )
        cursor.execute('INSERT INTO kontext_corpus (id, group_name, version, created, updated, active, web, '
                       'tagset, collator_locale, speech_segment, speaker_id_attr, '
                       'speech_overlap_attr, speech_overlap_val, use_safe_font) '
                       'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                       vals1)

        # articles

        articles = []
        def_art_id = None
        if install_json.reference.default:
            def_art_id = self._find_article(install_json.reference.default)
            if def_art_id is None:
                def_art_id = self.save_corpus_article(install_json.reference.default)
        articles.append((def_art_id, 'default'))

        other_art_id = None
        if install_json.reference.other_bibliography:
            other_art_id = self._find_article(install_json.reference.other_bibliography)
            if other_art_id is None:
                other_art_id = self.save_corpus_article(install_json.reference.other_bibliography)
        articles.append((other_art_id, 'other'))

        for art in install_json.reference.articles:
            std_art_id = self._find_article(art)
            if std_art_id is None:
                std_art_id = self.save_corpus_article(art)
            articles.append((std_art_id, 'standard'))

        for article_id, art_type in articles:
            if article_id:
                self.attach_corpus_article(install_json.ident, article_id, art_type)

        # metadata

        vals2 = (
            install_json.ident,
            install_json.metadata.database,
            install_json.metadata.label_attr,
            install_json.metadata.id_attr,
            int(install_json.metadata.featured)
        )
        cursor.execute('INSERT INTO kontext_metadata (corpus_id, database, label_attr, id_attr, featured) '
                       'VALUES (?, ?, ?, ?, ?)', vals2)

        avail_keywords = set(x['id'] for x in self.load_all_keywords())
        for k in install_json.metadata.keywords:
            if k in avail_keywords:
                vals4 = (install_json.ident, k)
                cursor.execute(
                    'INSERT INTO kontext_keyword_corpus (corpus_id, keyword_id) VALUES (?, ?)', vals4)
            else:
                logging.getLogger(__name__).warning(
                    'Ignoring metadata label "{0}" - not supported'.format(k))

        for p in install_json.token_connect:
            vals5 = (install_json.ident, p, 'tc')
            cursor.execute(
                'INSERT INTO tckc_corpus (corpus_id, provider, type) VALUES (?, ?, ?)', vals5)

        for p in install_json.kwic_connect:
            vals6 = (install_json.ident, p, 'kc')
            cursor.execute(
                'INSERT INTO tckc_corpus (corpus_id, provider, type) VALUES (?, ?, ?)', vals6)

        sentence_struct_id = self.create_initial_registry(reg_path=registry_dir,
                                                          sentence_struct=install_json.sentence_struct)
        cursor.execute('UPDATE kontext_corpus SET sentence_struct_id = ? WHERE id = ?',
                       (sentence_struct_id, install_json.ident))

    def save_corpus_article(self, text):
        cursor = self._db.cursor()
        cursor.execute('INSERT INTO kontext_article (entry) VALUES (?)', (text,))
        cursor.execute('SELECT last_insert_rowid()')
        return cursor.fetchone()[0]

    def attach_corpus_article(self, corpus_id, article_id, role):
        cursor = self._db.cursor()
        cursor.execute('INSERT INTO kontext_corpus_article (corpus_id, article_id, role) '
                       'VALUES (?, ?, ?)', (corpus_id, article_id, role))

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

    def load_description(self, desc_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT text_cs, text_en FROM kontext_ttdesc WHERE id = ?', (desc_id,))
        return cursor.fetchall()

    def load_corpus(self, corp_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT c.id, c.web, rs.name AS sentence_struct, c.tagset, c.collator_locale, c.speech_segment, '
                       'c.speaker_id_attr,  c.speech_overlap_attr,  c.speech_overlap_val, c.use_safe_font, '
                       'm.featured, m.database, m.label_attr, m.id_attr, '
                       'tc.id AS ttdesc_id, GROUP_CONCAT(kc.keyword_id, \',\') AS keywords, '
                       'c.size, rc.info, rc.name, rc.rencoding AS encoding, rc.language '
                       'FROM kontext_corpus AS c '
                       'LEFT JOIN kontext_metadata AS m ON c.id = m.corpus_id '
                       'LEFT JOIN kontext_ttdesc AS tc ON tc.id = m.ttdesc_id '
                       'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_id = c.id '
                       'LEFT JOIN registry_conf AS rc ON rc.corpus_id = c.id '
                       'LEFT JOIN registry_structure AS rs ON rs.registry_id = rc.id '
                       'WHERE c.active = 1 AND c.id = ? '
                       'GROUP BY c.id ', (corp_id,))
        return cursor.fetchone()

    def load_all_corpora(self, user_id, substrs=None, keywords=None, min_size=0, max_size=None, offset=0, limit=-1):
        where_cond = ['c.active = ?', 'rcu.user_id = ?']
        values_cond = [1, user_id]
        if substrs is not None:
            for substr in substrs:
                where_cond.append('(rc.name LIKE ? OR c.id LIKE ? OR rc.info LIKE ?)')
                values_cond.append('%{0}%'.format(substr))
                values_cond.append('%{0}%'.format(substr))
                values_cond.append('%{0}%'.format(substr))
        if keywords is not None and len(keywords) > 0:
            where_cond.append('({0})'.format(' OR '.join(
                'kc.keyword_id = ?' for _ in range(len(keywords)))))
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
        sql = ('SELECT c.id, c.web, c.tagset, c.collator_locale, c.speech_segment, '
               'c.speaker_id_attr,  c.speech_overlap_attr,  c.speech_overlap_val, c.use_safe_font, '
               'm.featured, NULL AS database, NULL AS label_attr, NULL AS id_attr, NULL AS reference_default, '
               'NULL AS reference_other, NULL AS ttdesc_id, '
               'COUNT(kc.keyword_id) AS num_match_keys, '
               'c.size, rc.info, ifnull(rc.name, c.id) AS name, rc.rencoding AS encoding, rc.language,'
               'm.featured, '
               '(SELECT GROUP_CONCAT(kcx.keyword_id, \',\') FROM kontext_keyword_corpus AS kcx '
               'WHERE kcx.corpus_id = c.id)  AS keywords '
               'FROM kontext_corpus AS c '
               'LEFT JOIN kontext_metadata AS m ON m.corpus_id = c.id '
               'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_id = c.id '
               'JOIN registry_conf AS rc ON rc.corpus_id = c.id '
               'JOIN kontext_registry_conf_user AS rcu ON rc.id = rcu.registry_conf_id '
               'WHERE {0} '
               'GROUP BY c.id '
               'HAVING num_match_keys >= ? '
               'ORDER BY c.group_name, c.version DESC, c.id '
               'LIMIT ? '
               'OFFSET ?').format(' AND '.join(where_cond))
        c.execute(sql, values_cond)
        return c.fetchall()

    def save_registry_table(self, corpus_id, variant, values):
        cursor = self._db.cursor()
        if variant:
            cursor.execute(
                'SELECT id FROM registry_conf WHERE corpus_id = ? AND variant = ?', (corpus_id, variant))
        else:
            cursor.execute(
                'SELECT id FROM registry_conf WHERE corpus_id = ? AND variant IS NULL', (corpus_id,))
        row = cursor.fetchone()
        if row is None:
            raise Exception(
                'Cannot import registry for "{0}" - corpus not installed'.format(corpus_id))

        reg_id = row[0]
        cols = [self.REG_COLS_MAP[k] for k, v in values if k in self.REG_COLS_MAP]
        vals = [v for k, v in values if k in self.REG_COLS_MAP] + [reg_id]
        sql = 'UPDATE registry_conf SET {0} WHERE id = ?'.format(
            ', '.join(['{0} = ?'.format(x) for x in cols]))
        cursor.execute(sql, vals)
        return reg_id

    def load_registry_table(self, corpus_id, variant):
        cols = ['id'] + ['{0} AS {1}'.format(v, k) for k, v in self.REG_COLS_MAP.items()]
        if variant:
            sql = 'SELECT {0} FROM registry_conf WHERE corpus_id = ? AND variant = ?'.format(
                ', '.join(cols))
            vals = (corpus_id, variant)
        else:
            sql = 'SELECT {0} FROM registry_conf WHERE corpus_id = ? AND variant IS NULL'.format(
                ', '.join(cols))
            vals = (corpus_id,)
        cursor = self._db.cursor()
        cursor.execute(sql, vals)
        return cursor.fetchone()

    def save_registry_posattr(self, registry_id, name, position, values):
        """
        """
        cols = ['registry_id', 'name', 'position'] + [self.POS_COLS_MAP[k]
                                                      for k, v in values if k in self.POS_COLS_MAP]
        vals = [registry_id, name, position] + [v for k, v in values if k in self.POS_COLS_MAP]
        sql = 'INSERT INTO registry_attribute ({0}) VALUES ({1})'.format(
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
        sql = 'SELECT {0} FROM registry_attribute WHERE registry_id = ? ORDER BY position'.format(
            ', '.join(['id', 'name', 'position'] + ['{0} AS {1}'.format(v, k) for k, v in self.POS_COLS_MAP.items()]))
        cursor = self._db.cursor()
        cursor.execute(sql, (registry_id,))
        return cursor.fetchall()

    def update_registry_posattr_references(self, posattr_id, fromattr_id, mapto_id):
        """
        both fromattr_id and mapto_id can be None
        """
        cursor = self._db.cursor()
        cursor.execute('UPDATE registry_attribute SET fromattr_id = ?, mapto_id = ? WHERE id = ?',
                       (fromattr_id, mapto_id, posattr_id))

    def load_registry_posattr_references(self, posattr_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT r2.name AS n1, r3.name AS n2 '
                       'FROM registry_attribute AS r1 '
                       'LEFT JOIN registry_attribute AS r2 ON r1.fromattr_id = r2.id '
                       'LEFT JOIN registry_attribute AS r3 ON r1.mapto_id = r3.id '
                       'WHERE r1.id = ?', (posattr_id,))
        ans = cursor.fetchone()
        return (ans['n1'], ans['n2']) if ans is not None else (None, None)

    def save_registry_alignments(self, registry_id, aligned_ids):
        cursor = self._db.cursor()
        for aid in aligned_ids:
            try:
                cursor.execute(
                    'INSERT INTO registry_alignment (registry1_id, registry2_id) VALUES (?, ?)', (registry_id, aid))
            except sqlite3.Error as ex:
                logging.getLogger(__name__).error(
                    u'Failed to insert values {0}, {1}'.format(registry_id, aid))
                raise ex

    def load_registry_alignments(self, registry_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT r2.corpus_id AS id '
                       'FROM registry_alignment AS ra '
                       'JOIN registry_conf AS r2 ON ra.registry2_id = r2.id '
                       'WHERE ra.registry1_id = ?', (registry_id,))
        return [row['id'] for row in cursor.fetchall()]

    def save_registry_structure(self, registry_id, name, values, update_existing=False):
        base_cols = [self.STRUCT_COLS_MAP[k] for k, v in values if k in self.STRUCT_COLS_MAP]
        base_vals = [v for k, v in values if k in self.STRUCT_COLS_MAP]
        cursor = self._db.cursor()

        if update_existing:
            cursor.execute('SELECT id FROM registry_structure WHERE registry_id = ? AND name = ?',
                           (registry_id, name))
            row = cursor.fetchone()
            if row and len(base_vals) > 0:
                uexpr = ', '.join('{0} = ?'.format(c) for c in base_cols)
                sql = 'UPDATE registry_structure SET {0} WHERE id = ?'.format(uexpr)
                vals = base_vals + [row[0]]
                cursor.execute(sql, vals)
                return row[0]
            else:
                raise Exception(
                    'Cannot update existing registry structure {0} of registry {1} - not found'.format(
                        name, registry_id))
        else:
            cols = ['registry_id', 'name'] + base_cols
            vals = [registry_id, name] + base_vals
            sql = 'INSERT INTO registry_structure ({0}) VALUES ({1})'.format(
                ', '.join(cols), ', '.join(['?'] * len(vals)))
            cursor.execute(sql, vals)
            cursor.execute('SELECT last_insert_rowid()')
            return cursor.fetchone()[0]

    def load_registry_structures(self, registry_id):
        cols = ['id', 'registry_id', 'name'] + \
            ['{0} AS {1}'.format(v, k) for k, v in self.STRUCT_COLS_MAP.items()]
        sql = 'SELECT {0} FROM registry_structure WHERE registry_id = ?'.format(', '.join(cols))
        cursor = self._db.cursor()
        cursor.execute(sql, (registry_id,))
        return cursor.fetchall()

    def save_registry_structattr(self, struct_id, name, values):
        """
        """
        cols = ['rstructure_id', 'name'] + [self.SATTR_COLS_MAP[k]
                                            for k, v in values if k in self.SATTR_COLS_MAP]
        vals = [struct_id, name] + [v for k, v in values if k in self.SATTR_COLS_MAP]
        sql = 'INSERT INTO registry_structattr ({0}) VALUES ({1})'.format(
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
        sql = 'SELECT {0} FROM registry_structattr WHERE rstructure_id = ?'.format(
            ', '.join(['id', 'name'] + ['{0} AS {1}'.format(v, k) for k, v in self.SATTR_COLS_MAP.items()]))
        cursor.execute(sql, (struct_id,))
        return cursor.fetchall()

    def save_subcorpattr(self, struct_id, idx):
        cursor = self._db.cursor()
        cursor.execute(
            'UPDATE registry_structattr SET subcorpattrs_idx = ? WHERE id = ?', (idx, struct_id))

    def load_subcorpattrs(self, registry_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT r.name AS struct, rs.name AS structattr '
                       'FROM registry_structure AS r '
                       'JOIN registry_structattr AS rs ON r.id = rs.rstructure_id '
                       'WHERE rs.subcorpattrs_idx > -1 AND r.registry_id = ? '
                       'ORDER BY rs.subcorpattrs_idx', (registry_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def save_freqttattr(self, struct_id, idx):
        cursor = self._db.cursor()
        cursor.execute(
            'UPDATE registry_structattr SET freqttattrs_idx = ? WHERE id = ?', (idx, struct_id))

    def load_freqttattrs(self, registry_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT r.name AS struct, rs.name AS structattr '
                       'FROM registry_structure AS r '
                       'JOIN registry_structattr AS rs ON r.id = rs.rstructure_id '
                       'WHERE rs.freqttattrs_idx > -1 AND r.registry_id = ?'
                       'ORDER BY rs.freqttattrs_idx', (registry_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def load_tckc_providers(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT provider, type FROM kontext_tckc_corpus WHERE corpus_id = ?', (corpus_id,))
        return cursor.fetchall()

    def save_permitted_corpora(self, user_id, corpora):
        cursor = self._db.cursor()
        cursor.execute('DELETE FROM kontext_user_corpus WHERE user_id = ?', (user_id,))
        for corp, variant in corpora:
            cursor.execute(
                'INSERT INTO kontext_user_corpus (user_id, corpus_id) VALUES (?, ?)', (user_id, corp))

    def load_permitted_corpora(self, user_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT rc.corpus_id, rc.variant '
                       'FROM registry_conf_user AS rcu '
                       'JOIN registry_conf AS rc ON rcu.registry_conf_id = rc.id '
                       'WHERE rcu.user_id = ?', (user_id,))
        return cursor.fetchall()

    def create_initial_registry(self, reg_path, sentence_struct):
        corpus_id = os.path.basename(reg_path)
        corpus_info = InstallCorpusInfo(os.path.dirname(reg_path))
        t1 = int(time.time())
        cursor = self._db.cursor()
        cursor.execute('INSERT INTO registry_conf (corpus_id, path, name, info, rencoding, created, updated) '
                       'VALUES (?, ?, ?, ?, ?, ?, ?)',
                       (corpus_id, corpus_info.get_data_path(corpus_id), corpus_info.get_corpus_name(corpus_id),
                        corpus_info.get_corpus_description(
                            corpus_id), corpus_info.get_corpus_encoding(corpus_id),
                        t1, t1))
        cursor.execute('SELECT last_insert_rowid()')

        if sentence_struct:
            reg_id = cursor.fetchone()[0]
            cursor.execute('INSERT INTO registry_structure (registry_id, name) VALUES (?, ?)',
                           (reg_id, sentence_struct))
            cursor.execute('SELECT last_insert_rowid()')
            struct_id = cursor.fetchone()[0]
        else:
            struct_id = None
        return struct_id
