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
from collections import OrderedDict, defaultdict
import pytz
import logging
import re
import mysql.connector
from plugin_types.corparch.backend import DatabaseWriteBackend
from plugins.mysql_corparch.backend import (
    Backend,
    DFLT_USER_TABLE, DFLT_CORP_TABLE, DFLT_GROUP_ACC_TABLE, DFLT_USER_ACC_TABLE, DFLT_USER_ACC_CORP_ATTR,
    DFLT_GROUP_ACC_CORP_ATTR, DFLT_GROUP_ACC_GROUP_ATTR)
from plugin_types.corparch.backend.regkeys import (
    REG_COLS_MAP, REG_VAR_COLS_MAP, POS_COLS_MAP, STRUCT_COLS_MAP, SATTR_COLS_MAP)


class WriteBackend(DatabaseWriteBackend):
    """
    This is an extended version of mysql backend used by ucnk scripts
    to import existing corpora.xml/registry files etc.
    """

    def __init__(self, db, ro_backend: Backend, user_table: str = DFLT_USER_TABLE, corp_table: str = DFLT_CORP_TABLE,
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
        cursor.execute(
            'SELECT a.id '
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
        cursor.execute('SELECT id FROM kontext_article WHERE entry LIKE %s LIMIT 1',
                       (contents.strip(),))
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

    def save_corpus_config(self, install_json, registry_conf, corp_size):
        t1 = datetime.datetime.now(
            tz=pytz.timezone('Europe/Prague')).strftime("%Y-%m-%dT%H:%M:%S%z")
        cursor = self._db.cursor()

        vals1 = (
            install_json.ident,
            install_json.get_group_name(),
            install_json.get_version(),
            t1,
            t1,
            1,
            install_json.web,
            install_json.collator_locale,
            install_json.use_safe_font,
            corp_size)
        cursor.execute(
            f'INSERT INTO {self._corp_table} (name, group_name, version, created, updated, active, web, '
            'collator_locale, use_safe_font, size) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
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
        avail_keywords = set(x['id'] for x in self._ro_backend.load_all_keywords())
        for k in install_json.metadata.keywords:
            if k in avail_keywords:
                vals4 = (install_json.ident, k)
                cursor.execute(
                    'INSERT INTO kontext_keyword_corpus (corpus_name, keyword_id) VALUES (%s, %s)', vals4)
            else:
                logging.getLogger(__name__).warning(
                    'Ignoring metadata label "{0}" - not supported'.format(k))

        # TC/KC providers
        for i, p in enumerate(install_json.token_connect):
            vals5 = (install_json.ident, p, 'tc', i, False)
            cursor.execute(
                'INSERT INTO tckc_corpus (corpus_id, provider, type, display_order, is_kwic_view) '
                'VALUES (%s, %s, %s, %s, %s)', vals5)

        for p in install_json.kwic_connect:
            vals6 = (install_json.ident, p, 'kc', i, False)
            cursor.execute(
                'INSERT INTO tckc_corpus (corpus_id, provider, type, display_order, is_kwic_view) '
                'VALUES (%s, %s, %s, %s, %s)', vals6)

        # reg-based structures, structural attributes
        # TODO !!!

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
        cursor.execute(
            f'UPDATE {self._corp_table} SET sentence_struct = %s, '
            'speech_segment_struct = %s, speech_segment_attr = %s, '
            'speaker_id_struct = %s, speaker_id_attr = %s, '
            'speech_overlap_struct = %s, speech_overlap_attr = %s, '
            'bib_label_struct = %s, bib_label_attr = %s, '
            'bib_id_struct = %s, bib_id_attr = %s, '
            'text_types_db = %s, featured = %s '
            'WHERE name = %s',
            (install_json.sentence_struct, sseg_struct, sseg_attr, spk_struct, spk_attr, spe_struct,
            spe_attr, bla_struct, bla_attr, bli_struct, bli_attr, install_json.metadata.database,
            int(install_json.metadata.featured), install_json.ident))

    def update_corpus_config(self, install_json, registry_conf, corp_size):
        t1 = datetime.datetime.now(
            tz=pytz.timezone('Europe/Prague')).strftime("%Y-%m-%dT%H:%M:%S%z")

        # simple type properties
        cursor = self._db.cursor()
        vals1 = (
            install_json.get_group_name(),
            install_json.get_version(),
            t1,
            1,
            install_json.web,
            install_json.collator_locale,
            install_json.use_safe_font,
            registry_conf.find_simple_attr('INFO'),
            corp_size,
            install_json.ident)
        cursor.execute(
            f'UPDATE {self._corp_table} SET '
            'group_name = IF(group_name IS NULL, %s, group_name), '
            'version = IF(version IS NULL, %s, version), '
            'updated = %s, '
            'active = IF(active IS NULL, %s, active), '
            'web = IF(web IS NULL, %s, web), '
            'collator_locale = IF(collator_locale IS NULL, %s, collator_locale), '
            'use_safe_font = IF(use_safe_font IS NULL, %s, use_safe_font), '
            'description_cs = IF(description_cs is NULL, %s, description_cs), '
            'size = %s '
            'WHERE name = %s',
            vals1)

        # normalize LOCALE
        misc_locales = defaultdict(lambda: 0)
        for struct in registry_conf.structs:
            for attr in struct.attributes:
                loc = attr.find_property('LOCALE')
                if loc:
                    rm = attr.clear_property('LOCALE')
                    misc_locales[rm] += 1
        for pa in registry_conf.posattrs:
            loc = pa.find_property('LOCALE')
            if loc:
                rm = pa.clear_property('LOCALE')
                misc_locales[rm] += 1
        if len(misc_locales) > 0:
            print('WARNING: found attr-defined locales used in the file: {}'.format(misc_locales.keys()))
            max_k = None
            max_v = 0
            for k, v in misc_locales.items():
                if v > max_v:
                    max_k = k
                    max_v = v
            glob_locale = registry_conf.find_simple_attr('LOCALE')
            if not glob_locale:
                print('INFO: main LOCALE not set')
                print('INFO: using the most frequent particular locale {}'.format(max_k))
                registry_conf.set_simple_item('LOCALE', max_k)
        # positional attributes
        cursor.execute(
            'SELECT name FROM corpus_posattr WHERE corpus_name = %s', (install_json.ident,))
        curr_posattrs = set(row['name'] for row in cursor.fetchall())
        new_posattrs = OrderedDict()
        for new_posattr in registry_conf.posattrs:
            new_posattrs[new_posattr.name] = new_posattr
        added_posattrs = new_posattrs.keys()  # added or updated; NOTE: the keys() order works for Py 3.7+ !!

        removed_structattrs = curr_posattrs - set(new_posattrs.keys())
        for rma in removed_structattrs:
            cursor.execute(
                'DELETE FROM corpus_posattr WHERE corpus_name = %s AND name = %s',
                (install_json.ident, rma))
        for i, aa in enumerate(added_posattrs):
            keyvals = [(v.name, v.value) for v in new_posattrs[aa].non_empty_items]
            self.save_corpus_posattr(install_json.ident, aa, i, keyvals)

        # structural attributes
        cursor.execute(
            'SELECT CONCAT(structure_name, ".", name) AS name '
            'FROM corpus_structattr '
            'WHERE corpus_name = %s', (install_json.ident,))
        curr_structattrs = set(row['name'] for row in cursor.fetchall())
        new_structattrs = OrderedDict()
        for new_structattr in registry_conf.structs:
            for x in new_structattr.attributes:
                new_structattrs[f'{new_structattr.name}.{x.name}'] = x
        added_structattrs = new_structattrs.keys()  # added or updated
        # we must wait with adding of structattrs for structures to be ready
        removed_structattrs = curr_structattrs - set(new_structattrs.keys())

        # clear references to structural attributes to be removed
        for prop, structattr in self._find_structattr_use(install_json.ident).items():
            if structattr in removed_structattrs:
                cursor.execute(
                    f'UPDATE {self._corp_table} SET {prop} = NULL WHERE name = %s', (install_json.ident,))

        # structures
        cursor.execute('SELECT name FROM corpus_structure WHERE corpus_name = %s', (install_json.ident,))
        curr_structs = set(row['name'] for row in cursor.fetchall())
        new_structs = OrderedDict()
        for struct in registry_conf.structs:
            new_structs[struct.name] = struct
        for i, struct in enumerate(new_structs.keys()):
            self.save_corpus_structure(
                install_json.ident, struct, i,
                [(a.name, a.value) for a in new_structs[struct].simple_items])
        removed_structures = curr_structs - set(new_structs.keys())

        # clear references to structures to be removed
        for prop, struct in self._find_structures_use(install_json.ident).items():
            if struct in removed_structures:
                cursor.execute(
                    f'UPDATE {self._corp_table} SET {prop} = NULL WHERE name = %s', (install_json.ident,))

        # add new structural attributes (depended on structures)
        for i, item in enumerate(added_structattrs):
            s, a = item.split('.')
            props = [(x.name, x.value) for x in new_structattrs[item].attrs]
            self.save_corpus_structattr(install_json.ident, s, a, i, props)

        for structattr in removed_structattrs:
            struct, attr = structattr.split('.')
            cursor.execute(
                f'DELETE FROM corpus_structattr WHERE name = %s AND structure_name = %s AND corpus_name = %s',
                (attr, struct, install_json.ident))
        for struct in removed_structures:
            cursor.execute(
                f'DELETE FROM corpus_structure WHERE name = %s AND corpus_name = %s',
                (struct, install_json.ident))

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

    @staticmethod
    def normalize_raw_attrlist(s):
        return re.sub(r'\s+', '', s.replace('|', ','))

    def save_registry_table(self, corpus_id, variant, values):
        values = dict(values)
        self._create_struct_if_none(corpus_id, values.get('DOCSTRUCTURE', None))
        cursor = self._db.cursor()
        t1 = datetime.datetime.now(
            tz=pytz.timezone('Europe/Prague')).strftime("%Y-%m-%dT%H:%M:%S%z")

        if self._registry_table_exists(corpus_id):
            cols = ['updated'] + [REG_COLS_MAP[k] for k, v in list(values.items()) if k in REG_COLS_MAP]
            vals = [t1]
            for k, v in values.items():
                if k in ('SUBCORPATTRS', 'FREQTTATTRS'):
                    vals.append(self.normalize_raw_attrlist(v))
                elif k in REG_COLS_MAP:
                    vals.append(v)
            vals.append(corpus_id)
            sql = 'UPDATE registry_conf SET {0} WHERE corpus_name = %s'.format(
                ', '.join(f'{c} = %s' for c in cols))
            cursor.execute(sql, vals)
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
            cursor.execute(sql, vals)
            created = True

        if self._registry_variable_exists(corpus_id, variant):
            if variant is not None:
                cursor.execute('DELETE FROM registry_variable WHERE corpus_name = %s AND variant = %s',
                               (corpus_id, variant))
            else:
                cursor.execute('DELETE FROM registry_variable WHERE corpus_name = %s AND variant IS NULL',
                               (corpus_id,))
        cols = ['corpus_name', 'variant'] + [REG_VAR_COLS_MAP[k] for k, v in list(values.items())
                                             if k in REG_VAR_COLS_MAP]
        vals = [corpus_id, variant] + [v for k, v in list(values.items()) if k in REG_VAR_COLS_MAP]
        sql = 'INSERT INTO registry_variable ({0}) VALUES ({1})'.format(
            ', '.join(cols), ', '.join(len(cols) * ['%s']))
        cursor.execute(sql, vals)
        return created

    def save_corpus_posattr(self, corpus_id, name, position, values):
        """
        """

        cols = ['corpus_name', 'name', 'position'] + [POS_COLS_MAP[k]
                                                      for k, v in values if k in POS_COLS_MAP]
        vals = [corpus_id, name, position] + [v for k, v in values if k in POS_COLS_MAP]
        cursor = self._db.cursor()
        try:
            cursor.execute('SELECT * FROM corpus_posattr WHERE corpus_name = %s AND name = %s', (corpus_id, name))
            row = cursor.fetchone()
            if row is None:
                sql = 'INSERT INTO corpus_posattr ({0}) VALUES ({1})'.format(
                    ', '.join(cols), ', '.join(['%s'] * len(vals)))
                cursor.execute(sql, vals)
            else:
                ucols = ', '.join(f'{v} = %s' for v in cols)
                sql = 'UPDATE corpus_posattr SET {0} WHERE corpus_name = %s AND name = %s'.format(ucols)
                cursor.execute(sql, vals + [corpus_id, name])
        except mysql.connector.errors.Error as ex:
            logging.getLogger(__name__).error(
                'Failed to save registry values: {0}.'.format(list(zip(cols, vals))))
            raise ex

    def update_corpus_posattr_references(self, corpus_id, posattr_id, fromattr_id, mapto_id):
        """
        both fromattr_id and mapto_id can be None
        """
        cursor = self._db.cursor()
        cursor.execute(
            'UPDATE corpus_posattr SET fromattr = %s, mapto = %s '
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

    def save_corpus_structure(self, corpus_id, name, position: int, values):
        base_cols = [STRUCT_COLS_MAP[k] for k, v in values if k in STRUCT_COLS_MAP]
        base_vals = [v for k, v in values if k in STRUCT_COLS_MAP]
        cursor = self._db.cursor()

        cursor.execute(
            'SELECT position FROM corpus_structure '
            'WHERE corpus_name = %s AND name = %s LIMIT 1', (corpus_id, name))
        row = cursor.fetchone()
        if row:
            if len(base_vals) > 0 or row['position'] != position:
                cols = ['position'] + base_cols
                vals = [position] + base_vals
                uexpr = ', '.join(f'{c} = %s' for c in cols)
                sql = 'UPDATE corpus_structure SET {0} WHERE corpus_name = %s AND name = %s'.format(
                    uexpr)
                vals = vals + [corpus_id, name]
                cursor.execute(sql, vals)
        else:
            cols = ['corpus_name', 'name', 'position'] + base_cols
            vals = [corpus_id, name, position] + base_vals
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

    def save_corpus_structattr(self, corpus_id, struct_id, name, position, values):
        """
        """
        if self._structattr_exists(corpus_id, struct_id, name):
            cols = [SATTR_COLS_MAP[k] for k, v in values if k in SATTR_COLS_MAP] + ['position']
            if len(cols) > 0:
                vals = [v for k, v in values if k in SATTR_COLS_MAP] + [position, corpus_id, struct_id, name]
                sql = (
                    'UPDATE corpus_structattr '
                    'SET {0} '
                    'WHERE corpus_name = %s AND structure_name = %s AND name = %s').format(
                        ', '.join('{0} = %s'.format(c) for c in cols))
            else:
                sql = None
        else:
            cols = ['corpus_name', 'structure_name', 'name'] + [SATTR_COLS_MAP[k]
                                                                for k, v in values if k in SATTR_COLS_MAP]
            vals = [corpus_id, struct_id, name] + [v for k, v in values if k in SATTR_COLS_MAP]
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

    def _find_structures_use(self, corp_id: str):
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT sentence_struct, speech_segment_struct, speaker_id_struct, speech_overlap_struct,'
            f'bib_label_struct, bib_id_struct FROM {self._corp_table} WHERE name = %s', (corp_id,)
        )
        row = cursor.fetchone()
        return {} if row is None else row

    def _find_structattr_use(self, corp_id: str):
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT '
            'CONCAT(speech_segment_attr, ".", speech_segment_struct) AS speech_segment_attr, '
            'CONCAT(speaker_id_struct, ".", speaker_id_attr) AS speaker_id_attr, '
            'CONCAT(speech_overlap_struct, ".", speech_overlap_attr) AS speech_overlap_attr, '
            'CONCAT(bib_label_struct, ".", bib_label_attr) AS bib_label_attr, '
            'CONCAT(bib_id_struct, ".", bib_id_attr) AS bib_id_attr '
            f'FROM {self._corp_table} WHERE name = %s', (corp_id,))
        row = cursor.fetchone()
        return {} if row is None else row