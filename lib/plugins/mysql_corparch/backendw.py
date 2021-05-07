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
import pytz
import logging
import mysql.connector
from plugins.mysql_corparch.backend import (
    Backend, DFLT_CORP_TABLE, DFLT_GROUP_ACC_TABLE, DFLT_USER_ACC_TABLE, DFLT_USER_ACC_CORP_ATTR,
    DFLT_GROUP_ACC_CORP_ATTR, DFLT_GROUP_ACC_GROUP_ATTR)


class WritableBackend(Backend):
    """
    This is an extended version of mysql backend used by ucnk scripts
    to import existing corpora.xml/registry files etc.
    """

    def __init__(self, db, corp_table: str = DFLT_CORP_TABLE, group_acc_table: str = DFLT_GROUP_ACC_TABLE,
                 user_acc_table: str = DFLT_USER_ACC_TABLE, user_acc_corp_attr: str = DFLT_USER_ACC_CORP_ATTR,
                 group_acc_corp_attr: str = DFLT_GROUP_ACC_CORP_ATTR,
                 group_acc_group_attr: str = DFLT_GROUP_ACC_GROUP_ATTR):
        super().__init__(db, corp_table, group_acc_table, user_acc_table, user_acc_corp_attr, group_acc_corp_attr,
                         group_acc_group_attr)
        self.autocommit = False

    def commit(self):
        """
        Commits the transaction. Please note that
        mysql-connector running behind this class
        has autocommit disabled so you have to
        use this method to make database changes
        permanent.
        """
        self._db.commit()

    def remove_corpus(self, corpus_id):
        cursor = self._db.cursor()

        # articles
        cursor.execute('SELECT a.id '
                       'FROM kontext_article AS a '
                       'LEFT JOIN kontext_corpus_article AS ca ON a.id = ca.article_id '
                       'WHERE ca.corpus_name IS NULL')
        for row3 in cursor.fetchall():
            cursor.execute('DELETE FROM kontext_article WHERE id = %s', (row3['id'],))

        # misc. M:N stuff
        cursor.execute('DELETE FROM kontext_tckc_corpus WHERE corpus_name = %s', (corpus_id,))
        cursor.execute('DELETE FROM kontext_keyword_corpus WHERE corpus_name = %s', (corpus_id,))
        cursor.execute('DELETE FROM kontext_corpus_article WHERE corpus_name = %s', (corpus_id,))

        cursor.execute('DELETE FROM corpus_alignment WHERE corpus_name_1 = %s OR corpus_name_2 = %s',
                       (corpus_id, corpus_id))
        cursor.execute('DELETE FROM corpus_posattr WHERE corpus_name = %s', (corpus_id,))
        cursor.execute('DELETE FROM corpus_structattr WHERE corpus_name = %s', (corpus_id,))
        cursor.execute('DELETE FROM corpus_structure WHERE corpus_name = %s', (corpus_id,))
        cursor.execute('DELETE FROM kontext_corpus_user WHERE corpus_name = %s', (corpus_id,))
        cursor.execute('DELETE FROM registry_conf WHERE corpus_name = %s', (corpus_id,))
        cursor.execute(f'DELETE FROM {self._corp_table} WHERE id = %s', (corpus_id,))

        # text types description
        cursor.execute('SELECT t.id '
                       'FROM kontext_ttdesc AS t '
                       f'LEFT JOIN {self._corp_table} AS kc ON kc.ttdesc_id = t.id '
                       'WHERE kc.ttdesc_id IS NULL')
        for row4 in cursor.fetchall():
            cursor.execute('DELETE FROM kontext_ttdesc WHERE id = %s', (row4['id'],))

    def _create_structattr_if_none(self, corpus_id, name):
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
            cursor = self._db.cursor()
            cursor.execute('SELECT COUNT(*) AS cnt FROM corpus_structattr '
                           'WHERE corpus_name = %s AND structure_name = %s AND name = %s '
                           'LIMIT 1',
                           (corpus_id, struct, attr))
            ans = cursor.fetchone()
            if not ans or ans['cnt'] == 0:
                cursor.execute('INSERT INTO corpus_structattr (corpus_name, structure_name, name) '
                               'VALUES (%s, %s, %s)', (corpus_id, struct, attr))
        return struct, attr

    def _find_article(self, contents):
        """
        Find an article with exactly same contents.
        """
        cursor = self._db.cursor()
        cursor.execute('SELECT id FROM kontext_article WHERE entry LIKE %s', (contents.strip(),))
        row = cursor.fetchone()
        return row[0] if row else None

    def _create_struct_if_none(self, corpus_id, name):
        """
        Create a structure (e.g. "doc");
        if already present then do nothing.

        arguments:
            corpus_id -- a corpus identifier
            name -- a structure name (doc, p, s, sp, text,...)
        """
        if name:
            cursor = self._db.cursor()
            cursor.execute('SELECT COUNT(*) AS cnt FROM corpus_structure '
                           'WHERE corpus_name = %s AND name = %s '
                           'LIMIT 1', (corpus_id, name))
            ans = cursor.fetchone()
            if not ans or ans['cnt'] == 0:
                cursor.execute('INSERT INTO corpus_structure (corpus_name, name) VALUES (%s, %s)',
                               (corpus_id, name))

    def save_corpus_config(self, install_json, registry_dir, corp_size):
        t1 = datetime.datetime.now(tz=pytz.timezone('Europe/Prague')
                                   ).strftime("%Y-%m-%dT%H:%M:%S%z")
        cursor = self._db.cursor()

        vals1 = (
            install_json.ident,
            install_json.get_group_name(),
            install_json.get_version(),
            t1,
            t1,
            1,
            install_json.web,
            install_json.tagset,
            install_json.collator_locale,
            install_json.use_safe_font,
            corp_size
        )
        cursor.execute('INSERT INTO kontext_corpus (name, group_name, version, created, updated, active, web, '
                       'tagset, collator_locale, use_safe_font, size) '
                       'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
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

        # keywords
        avail_keywords = set(x['id'] for x in self.load_all_keywords())
        for k in install_json.metadata.keywords:
            if k in avail_keywords:
                vals4 = (install_json.ident, k)
                cursor.execute(
                    'INSERT INTO kontext_keyword_corpus (corpus_name, keyword_id) VALUES (%s, %s)', vals4)
            else:
                logging.getLogger(__name__).warning(
                    'Ignoring metadata label "{0}" - not supported'.format(k))

        # TC/KC providers
        for p in install_json.token_connect:
            vals5 = (install_json.ident, p, 'tc')
            cursor.execute(
                'INSERT INTO tckc_corpus (corpus_id, provider, type) VALUES (%s, %s, %s)', vals5)

        for p in install_json.kwic_connect:
            vals6 = (install_json.ident, p, 'kc')
            cursor.execute(
                'INSERT INTO tckc_corpus (corpus_id, provider, type) VALUES (%s, %s, %s)', vals6)

        # Dependent stuctures, structural attributes
        self._create_struct_if_none(install_json.ident, install_json.sentence_struct)
        sseg_struct, sseg_attr = self._create_structattr_if_none(
            install_json.ident, install_json.speech_segment)
        spk_struct, spk_attr = self._create_structattr_if_none(
            install_json.ident, install_json.speaker_id_attr)
        spe_struct, spe_attr = self._create_structattr_if_none(
            install_json.ident, install_json.speech_overlap_attr)
        bla_struct, bla_attr = self._create_structattr_if_none(
            install_json.ident, install_json.metadata.label_attr)
        bli_struct, bli_attr = self._create_structattr_if_none(
            install_json.ident, install_json.metadata.id_attr)
        cursor.execute(f'UPDATE {self._corp_table} SET sentence_struct = %s, '
                       'speech_segment_struct = %s, speech_segment_attr = %s, '
                       'speaker_id_struct = %s, speaker_id_attr = %s, '
                       'speech_overlap_struct = %s, speech_overlap_attr = %s, '
                       'bib_label_struct = %s, bib_label_attr = %s, '
                       'bib_id_struct = %s, bib_id_attr = %s, '
                       'text_types_db = %s, featured = %s, '
                       'WHERE name = %s',
                       (install_json.sentence_struct, sseg_struct, sseg_attr, spk_struct, spk_attr, spe_struct,
                        spe_attr, bla_struct, bla_attr, bli_struct, bli_attr, install_json.metadata.database,
                        int(install_json.metadata.featured), install_json.ident))

    def save_corpus_article(self, text):
        cursor = self._db.cursor()
        cursor.execute('INSERT INTO kontext_article (entry) VALUES (%s)', (text,))
        cursor.execute('SELECT last_insert_id() AS last_id')
        return cursor.fetchone()['last_id']

    def attach_corpus_article(self, corpus_id, article_id, role):
        cursor = self._db.cursor()
        cursor.execute('INSERT INTO kontext_corpus_article (corpus_name, article_id, role) '
                       'VALUES (%s, %s, %s)', (corpus_id, article_id, role))

    def _registry_table_exists(self, corpus_id):
        cursor = self._db.cursor(buffered=True)
        cursor.execute(
            'SELECT COUNT(*) AS cnt FROM registry_conf WHERE corpus_name = %s LIMIT 1', (corpus_id,))
        row = cursor.fetchone()
        return row['cnt'] == 1 if row else False

    def _registry_variable_exists(self, corpus_id, variant):
        cursor = self._db.cursor(buffered=True)
        if variant is not None:
            cursor.execute('SELECT COUNT(*) AS cnt FROM registry_variable '
                           'WHERE corpus_name = %s AND variant = %s LIMIT 1', (corpus_id, variant))
        else:
            cursor.execute('SELECT COUNT(*) AS cnt FROM registry_variable '
                           'WHERE corpus_name = %s AND variant IS NULL LIMIT 1', (corpus_id,))
        row = cursor.fetchone()
        return row['cnt'] == 1 if row else False

    def save_registry_table(self, corpus_id, variant, values):
        values = dict(values)
        self._create_struct_if_none(corpus_id, values.get('DOCSTRUCTURE', None))
        cursor = self._db.cursor()

        if self._registry_table_exists(corpus_id):
            created = False
        else:
            t1 = datetime.datetime.now(tz=pytz.timezone('Europe/Prague')
                                       ).strftime("%Y-%m-%dT%H:%M:%S%z")
            cols = ['corpus_name', 'created', 'updated'] + [self.REG_COLS_MAP[k]
                                                            for k, v in list(values.items()) if k in self.REG_COLS_MAP]
            vals = [corpus_id, t1, t1] + \
                [v for k, v in list(values.items()) if k in self.REG_COLS_MAP]
            sql = 'INSERT INTO registry_conf ({0}) VALUES ({1})'.format(
                ', '.join(cols), ', '.join(len(cols) * ['%s']))
            cursor.execute(sql, vals)
            created = True

        if self._registry_variable_exists(corpus_id, variant):
            if variant is not None:
                cursor.execute('DELETE FROM registry_variable WHERE corpus_name = %s AND variant = %s',
                               (corpus_id, variant))
            else:
                cursor.execute('DELETE FROM registry_variable WHERE corpus_name = %s AND variant IS NULL',
                               (corpus_id,))
        cols = ['corpus_name', 'variant'] + [self.REG_VAR_COLS_MAP[k] for k, v in list(values.items())
                                             if k in self.REG_VAR_COLS_MAP]
        vals = [corpus_id, variant] + \
            [v for k, v in list(values.items()) if k in self.REG_VAR_COLS_MAP]
        sql = 'INSERT INTO registry_variable ({0}) VALUES ({1})'.format(
            ', '.join(cols), ', '.join(len(cols) * ['%s']))
        cursor.execute(sql, vals)
        return created

    def save_corpus_posattr(self, corpus_id, name, position, values):
        """
        """
        cols = ['corpus_name', 'name', 'position'] + [self.POS_COLS_MAP[k]
                                                      for k, v in values if k in self.POS_COLS_MAP]
        vals = [corpus_id, name, position] + [v for k, v in values if k in self.POS_COLS_MAP]
        sql = 'INSERT INTO corpus_posattr ({0}) VALUES ({1})'.format(
            ', '.join(cols), ', '.join(['%s'] * len(vals)))
        cursor = self._db.cursor()
        try:
            cursor.execute(sql, vals)
        except mysql.connector.errors.Error as ex:
            logging.getLogger(__name__).error(
                'Failed to save registry values: {0}.'.format(list(zip(cols, vals))))
            raise ex
        cursor.execute('SELECT last_insert_id() AS last_id')
        return cursor.fetchone()['last_id']

    def update_corpus_posattr_references(self, corpus_id, posattr_id, fromattr_id, mapto_id):
        """
        both fromattr_id and mapto_id can be None
        """
        cursor = self._db.cursor()
        cursor.execute('UPDATE corpus_posattr SET fromattr = %s, mapto = %s '
                       'WHERE corpus_name = %s AND name = %s',
                       (fromattr_id, mapto_id, corpus_id, posattr_id))

    def save_corpus_alignments(self, corpus_id, aligned_ids):
        cursor = self._db.cursor()
        for aid in aligned_ids:
            try:
                cursor.execute(
                    'INSERT INTO corpus_alignment (corpus_name_1, corpus_name_2) '
                    'VALUES (%s, %s)', (corpus_id, aid))
            except mysql.connector.errors.Error as ex:
                logging.getLogger(__name__).error(
                    'Failed to insert values {0}, {1}'.format(corpus_id, aid))
                raise ex

    def save_corpus_structure(self, corpus_id, name, values):
        base_cols = [self.STRUCT_COLS_MAP[k] for k, v in values if k in self.STRUCT_COLS_MAP]
        base_vals = [v for k, v in values if k in self.STRUCT_COLS_MAP]
        cursor = self._db.cursor()

        cursor.execute('SELECT COUNT(*) AS cnt FROM corpus_structure '
                       'WHERE corpus_name = %s AND name = %s LIMIT 1', (corpus_id, name))
        row = cursor.fetchone()
        if row and row['cnt'] == 1:
            if len(base_vals) > 0:
                uexpr = ', '.join('{0} = %s'.format(c) for c in base_cols)
                sql = 'UPDATE corpus_structure SET {0} WHERE corpus_name = %s AND name = %s'.format(
                    uexpr)
                vals = base_vals + [corpus_id, name]
                cursor.execute(sql, vals)
        else:
            cols = ['corpus_name', 'name'] + base_cols
            vals = [corpus_id, name] + base_vals
            sql = 'INSERT INTO corpus_structure ({0}) VALUES ({1})'.format(
                ', '.join(cols), ', '.join(['%s'] * len(vals)))
            cursor.execute(sql, vals)

    def _structattr_exists(self, corpus_id, struct_id, name):
        cursor = self._db.cursor()
        cursor.execute('SELECT COUNT(*) AS cnt FROM corpus_structattr '
                       'WHERE corpus_name = %s AND structure_name = %s AND name = %s',
                       (corpus_id, struct_id, name))
        row = cursor.fetchone()
        return row['cnt'] == 1 if row else False

    def save_corpus_structattr(self, corpus_id, struct_id, name, values):
        """
        """
        if self._structattr_exists(corpus_id, struct_id, name):
            cols = [self.SATTR_COLS_MAP[k] for k, v in values if k in self.SATTR_COLS_MAP]
            if len(cols) > 0:
                vals = [v for k, v in values if k in self.SATTR_COLS_MAP] + \
                    [corpus_id, struct_id, name]
                sql = ('UPDATE corpus_structattr '
                       'SET {0} '
                       'WHERE corpus_name = %s AND structure_name = %s AND name = %s').format(
                    ', '.join('{0} = %s'.format(c) for c in cols))
            else:
                sql = None
        else:
            cols = ['corpus_name', 'structure_name', 'name'] + [self.SATTR_COLS_MAP[k]
                                                                for k, v in values if k in self.SATTR_COLS_MAP]
            vals = [corpus_id, struct_id, name] + [v for k, v in values if k in self.SATTR_COLS_MAP]
            sql = 'INSERT INTO corpus_structattr ({0}) VALUES ({1})'.format(
                ', '.join(cols), ', '.join(['%s'] * len(vals)))
        cursor = self._db.cursor()
        try:
            if sql is not None:
                cursor.execute(sql, vals)
        except mysql.connector.errors.Error as ex:
            logging.getLogger(__name__).error(
                'Failed to insert values {0}'.format(list(zip(cols, vals))))
            raise ex

    def save_subcorpattr(self, corpus_id, struct_name, attr_name, idx):
        cursor = self._db.cursor()
        cursor.execute(
            'UPDATE corpus_structattr SET subcorpattrs_idx = %s '
            'WHERE corpus_name = %s AND structure_name = %s AND name = %s', (idx, corpus_id, struct_name, attr_name))

    def save_freqttattr(self, corpus_id, struct_name, attr_name, idx):
        cursor = self._db.cursor()
        cursor.execute(
            'UPDATE corpus_structattr SET freqttattrs_idx = %s '
            'WHERE corpus_name = %s AND structure_name = %s AND name = %s', (idx, corpus_id, struct_name, attr_name))
