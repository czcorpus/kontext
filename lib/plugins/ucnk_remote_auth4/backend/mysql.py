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
A corparch-plugin database backend for MySQL with some minor UCNK-specific stuff added (requestable corpus).
It can be used along with rdbms_corparch as an alternative backend to the sqlite3 one - in such case
you have to copy the whole 'mysql' directory/package to rdbms_corparch/backend directory.
"""

from __future__ import absolute_import
import mysql.connector
import mysql.connector.errors
import logging
import urlparse
from types import ModuleType

from plugins.rdbms_corparch.backend import DatabaseBackend


class MySQLConfException(Exception):
    pass


class MySQLConf(object):
    """
    MySQL backend configuration wrapper which is able to read
    set-up from "auth" plug-in XML subtree or from its own (very
    similar) subtree. It is also possible to instantiate it
    as empty and attach values manually (which is used when
    running from CMD).
    """

    def __init__(self, conf=None):
        self.pool_name = 'kontext_mysql_pool'
        if isinstance(conf, ModuleType):
            if conf.get('plugins', 'auth', {}).get('module') == 'ucnk_remote_auth4':
                self.host = conf.get('plugins', 'auth')['ucnk:sync_host']
                self.database = conf.get('plugins', 'auth')['ucnk:sync_db']
                self.user = conf.get('plugins', 'auth')['ucnk:sync_user']
                self.password = conf.get('plugins', 'auth')['ucnk:sync_passwd']
                self.pool_size = int(conf.get('plugins', 'auth')['ucnk:sync_pool_size'])
                self.conn_retry_delay = int(conf.get('plugins', 'auth')['ucnk:sync_retry_delay'])
                self.conn_retry_attempts = int(conf.get('plugins', 'auth')[
                                               'ucnk:sync_retry_attempts'])
            else:
                self.host = conf.get('plugins', 'corparch')['ucnk:mysql_host']
                self.database = conf.get('plugins', 'corparch')['ucnk:mysql_db']
                self.user = conf.get('plugins', 'corparch')['ucnk:mysql_user']
                self.password = conf.get('plugins', 'corparch')['ucnk:mysql_passwd']
                self.pool_size = int(conf.get('plugins', 'corparch')['ucnk:mysql_pool_size'])
                self.conn_retry_delay = int(conf.get('plugins', 'corparch')[
                                            'ucnk:mysql_retry_delay'])
                self.conn_retry_attempts = int(conf.get('plugins', 'corparch')[
                                               'ucnk:mysql_retry_attempts'])
        elif type(conf) is str:
            parsed = urlparse.urlparse(conf)
            self.host = parsed.netloc
            if parsed.query:
                p_query = parsed.query
                self.database = parsed.path.strip('/')
            else:
                p_db, p_query = parsed.path.rsplit('?')
                self.database = p_db.strip('/')
            for k, v in urlparse.parse_qs(p_query).items():
                setattr(self, k, v[0])
            self.pool_size = 1
            self.conn_retry_delay = 2
            self.conn_retry_attempts = 1
        elif conf is not None:
            raise MySQLConfException(
                'Unknown configuration source. Use either a "settings" module object or a connection URL (found: {0}'.format(type(conf)))

    @property
    def conn_dict(self):
        return dict(host=self.host, database=self.database, user=self.user,
                    password=self.password, pool_size=self.pool_size, pool_name=self.pool_name)


class MySQL(object):
    """
    A simple wrapper for mysql.connector with ability
    to reconnect.
    """

    def __init__(self, mysql_conf):
        self._conn = mysql.connector.connect(**mysql_conf.conn_dict)
        self._conn_retry_delay = mysql_conf.conn_retry_delay
        self._conn_retry_attempts = mysql_conf.conn_retry_attempts

    def cursor(self, dictionary=True, buffered=False):
        try:
            return self._conn.cursor(dictionary=dictionary, buffered=buffered)
        except mysql.connector.errors.OperationalError as ex:
            if 'MySQL Connection not available' in ex.msg:
                logging.getLogger(__name__).warning(
                    'Lost connection to MySQL server - reconnecting')
                self._conn.reconnect(delay=self._conn_retry_delay,
                                     attempts=self._conn_retry_attempts)
                return self._conn.cursor(dictionary=dictionary, buffered=buffered)

    @property
    def connection(self):
        return self._conn

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()


class Backend(DatabaseBackend):
    """
    UCNK's custom MySQL backend. With some minor modifications it should be
    also usable with general rdbms_corparch but it is not tested in such
    a configuration.
    """

    def __init__(self, conf):
        self._db = MySQL(conf)

    def contains_corpus(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT name FROM kontext_corpus WHERE name = %s', (corpus_id,))
        return cursor.fetchone() is not None

    def load_corpus_articles(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT ca.role, a.entry '
                       'FROM kontext_article AS a '
                       'JOIN kontext_corpus_article AS ca ON ca.article_id = a.id '
                       'WHERE ca.corpus_name = %s', (corpus_id,))
        return cursor.fetchall()

    def load_all_keywords(self):
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT id, label_cs, label_en, color FROM kontext_keyword ORDER BY display_order')
        return cursor.fetchall()

    def load_ttdesc(self, desc_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT text_cs, text_en FROM kontext_ttdesc WHERE id = %s', (desc_id,))
        return cursor.fetchall()

    def load_corpora_descriptions(self, corp_ids, user_lang):
        if len(corp_ids) == 0:
            return {}
        cursor = self._db.cursor()
        placeholders = ', '.join(['%s'] * len(corp_ids))
        col = 'description_{0}'.format(user_lang[:2])
        cursor.execute('SELECT name AS corpname, {0} AS contents '
                       'FROM corpora '
                       'WHERE name IN ({1})'.format(col, placeholders), corp_ids)
        return dict((r['corpname'], r['contents']) for r in cursor.fetchall())

    def load_corpus(self, corp_id):
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT c.name as id, c.web, cs.name AS sentence_struct, c.tagset, c.collator_locale, '
            'IF (c.speaker_id_struct IS NOT NULL, CONCAT(c.speaker_id_struct, \'.\', c.speaker_id_attr), NULL) '
            '  AS speaker_id_attr, '
            'IF (c.speech_overlap_struct IS NOT NULL AND c.speech_overlap_attr IS NOT NULL, '
            '    CONCAT(c.speech_overlap_struct, \'.\', c.speech_overlap_attr), '
            '    c.speech_overlap_struct) AS speech_overlap_attr, '
            'c.speech_overlap_val, c.use_safe_font, '
            'c.requestable, c.featured, c.text_types_db AS `database`, '
            'IF (c.bib_label_attr IS NOT NULL, CONCAT(c.bib_label_struct, \'.\', c.bib_label_attr), NULL) '
            '  AS label_attr, '
            'IF (c.bib_id_attr IS NOT NULL, CONCAT(c.bib_id_struct, \'.\', c.bib_id_attr), NULL) AS id_attr, '
            'IF (c.speech_segment_attr IS NOT NULL, CONCAT(c.speech_segment_struct, \'.\', c.speech_segment_attr), '
            '  NULL) AS speech_segment, '
            'bib_group_duplicates, '
            'c.ttdesc_id AS ttdesc_id, GROUP_CONCAT(kc.keyword_id, \',\') AS keywords, '
            'c.size, rc.info, rc.name, rc.rencoding AS encoding, rc.language '
            'FROM corpora AS c '
            'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_name = c.name '
            'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
            'LEFT JOIN corpus_structure AS cs ON cs.corpus_name = kc.corpus_name '
            '  AND c.sentence_struct = cs.name '
            'WHERE c.active = 1 AND c.name = %s '
            'GROUP BY c.name ', (corp_id,))
        return cursor.fetchone()

    def load_all_corpora(self, user_id, substrs=None, keywords=None, min_size=0, max_size=None, offset=0,
                         limit=10000000000):
        where_cond1 = ['c.active = %s', 'c.requestable = %s']
        values_cond1 = [1, 1]
        where_cond2 = ['c.active = %s', 'kcu.user_id = %s']
        values_cond2 = [1, user_id]
        if substrs is not None:
            for substr in substrs:
                where_cond1.append(u'(rc.name LIKE %s OR c.name LIKE %s OR rc.info LIKE %s)')
                values_cond1.append(u'%{0}%'.format(substr))
                values_cond1.append(u'%{0}%'.format(substr))
                values_cond1.append(u'%{0}%'.format(substr))
                where_cond2.append(u'(rc.name LIKE %s OR c.name LIKE %s OR rc.info LIKE %s)')
                values_cond2.append(u'%{0}%'.format(substr))
                values_cond2.append(u'%{0}%'.format(substr))
                values_cond2.append(u'%{0}%'.format(substr))
        if keywords is not None and len(keywords) > 0:
            where_cond1.append(u'({0})'.format(' OR '.join(
                u'kc.keyword_id = %s' for _ in range(len(keywords)))))
            where_cond2.append(u'({0})'.format(' OR '.join(
                u'kc.keyword_id = %s' for _ in range(len(keywords)))))
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
        values_cond1.append(len(keywords) if keywords else 0)
        values_cond2.append(len(keywords) if keywords else 0)

        c = self._db.cursor()
        sql = ('(SELECT c.name as id, c.web, c.tagset, c.collator_locale, NULL as speech_segment, c.requestable, '
               'c.speaker_id_attr,  c.speech_overlap_attr,  c.speech_overlap_val, c.use_safe_font, '
               'c.featured, NULL AS `database`, NULL AS label_attr, NULL AS id_attr, NULL AS reference_default, '
               'NULL AS reference_other, NULL AS ttdesc_id, '
               'COUNT(kc.keyword_id) AS num_match_keys, '
               'c.size, rc.info, ifnull(rc.name, c.name) AS name, rc.rencoding AS encoding, rc.language, '
               'c.group_name AS g_name, c.version AS version, '
               '(SELECT GROUP_CONCAT(kcx.keyword_id, \',\') FROM kontext_keyword_corpus AS kcx '
               'WHERE kcx.corpus_name = c.name) AS keywords '
               'FROM corpora AS c '
               'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_name = c.name '
               'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
               'WHERE {where1} '
               'GROUP BY c.name '
               'HAVING num_match_keys >= %s ) '
               'UNION '
               '(SELECT c.name as id, c.web, c.tagset, c.collator_locale, NULL as speech_segment, 0 as requestable, '
               'c.speaker_id_attr,  c.speech_overlap_attr,  c.speech_overlap_val, c.use_safe_font, '
               'c.featured, NULL AS `database`, NULL AS label_attr, NULL AS id_attr, NULL AS reference_default, '
               'NULL AS reference_other, NULL AS ttdesc_id, '
               'COUNT(kc.keyword_id) AS num_match_keys, '
               'c.size, rc.info, ifnull(rc.name, c.name) AS name, rc.rencoding AS encoding, rc.language, '
               'c.group_name AS g_name, c.version AS version, '
               '(SELECT GROUP_CONCAT(kcx.keyword_id, \',\') FROM kontext_keyword_corpus AS kcx '
               'WHERE kcx.corpus_name = c.name) AS keywords '
               'FROM corpora AS c '
               'LEFT JOIN kontext_keyword_corpus AS kc ON kc.corpus_name = c.name '
               'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
               'LEFT JOIN kontext_corpus_user AS kcu ON c.name = kcu.corpus_name '
               'WHERE {where2} '
               'GROUP BY c.name '
               'HAVING num_match_keys >= %s ) '
               'ORDER BY g_name, version DESC, id '
               'LIMIT %s '
               'OFFSET %s').format(where1=' AND '.join('(' + wc + ')' for wc in where_cond1),
                                   where2=' AND '.join('(' + wc + ')' for wc in where_cond2))
        c.execute(sql, values_cond1 + values_cond2 + [limit, offset])
        return c.fetchall()

    def load_featured_corpora(self, user_lang):
        cursor = self._db.cursor()
        desc_col = 'c.description_{0}'.format(user_lang[:2])
        cursor.execute('SELECT c.name AS corpus_id, c.name AS id, ifnull(rc.name, c.name) AS name, '
                       '{0} AS description, c.size '
                       'FROM corpora AS c '
                       'LEFT JOIN registry_conf AS rc ON rc.corpus_name = c.name '
                       'WHERE c.active = 1 AND c.featured = 1'.format(desc_col))
        return cursor.fetchall()

    def load_registry_table(self, corpus_id, variant):
        cols = (['rc.{0} AS {1}'.format(v, k) for k, v in self.REG_COLS_MAP.items()] +
                ['rv.{0} AS {1}'.format(v, k) for k, v in self.REG_VAR_COLS_MAP.items()])
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

    def load_corpus_posattrs(self, corpus_id):
        sql = 'SELECT {0} FROM corpus_posattr WHERE corpus_name = %s ORDER BY position'.format(
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
                       'WHERE r1.corpus_name = %s AND r1.name = %s', (corpus_id, posattr_id))
        ans = cursor.fetchone()
        return (ans['n1'], ans['n2']) if ans is not None else (None, None)

    def load_corpus_alignments(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT ca.corpus_name_2 AS id '
                       'FROM corpus_alignment AS ca '
                       'WHERE ca.corpus_name_1 = %s', (corpus_id,))
        return [row['id'] for row in cursor.fetchall()]

    def load_corpus_structures(self, corpus_id):
        cols = ['name'] + ['`{0}` AS `{1}`'.format(v, k) for k, v in self.STRUCT_COLS_MAP.items()]
        sql = 'SELECT {0} FROM corpus_structure WHERE corpus_name = %s'.format(', '.join(cols))
        cursor = self._db.cursor()
        cursor.execute(sql, (corpus_id,))
        return cursor.fetchall()

    def load_corpus_structattrs(self, corpus_id, structure_id):
        cursor = self._db.cursor()
        sql = 'SELECT {0} FROM corpus_structattr WHERE corpus_name = %s AND structure_name = %s'.format(
            ', '.join(['name'] + ['`{0}` AS `{1}`'.format(v, k) for k, v in self.SATTR_COLS_MAP.items()]))
        cursor.execute(sql, (corpus_id, structure_id))
        return cursor.fetchall()

    def load_subcorpattrs(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT cs.structure_name AS struct, cs.name AS structattr '
                       'FROM corpus_structattr AS cs '
                       'WHERE cs.subcorpattrs_idx > -1 AND cs.corpus_name = %s '
                       'ORDER BY cs.subcorpattrs_idx', (corpus_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def load_freqttattrs(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT cs.structure_name AS struct, cs.name AS structattr '
                       'FROM corpus_structattr AS cs '
                       'WHERE cs.freqttattrs_idx > -1 AND cs.corpus_name = %s '
                       'ORDER BY cs.freqttattrs_idx', (corpus_id,))
        return ['{0}.{1}'.format(x['struct'], x['structattr']) for x in cursor.fetchall()]

    def load_tckc_providers(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute(
            'SELECT provider, type FROM kontext_tckc_corpus WHERE corpus_name = %s ORDER BY display_order',
            (corpus_id,))
        return cursor.fetchall()

    # TODO this function should be improved as it loads all the registry info to cache user permissions
    # -- we should get rid of this caching and join our selects directly to a list of user avail. corpora
    def refresh_user_permissions(self, user_id):
        cursor = self._db.cursor(dictionary=False)
        cursor.callproc('user_corpus_proc', (user_id,))
        # stored procedure returns: user_id, corpus_id, limited, name
        rows = []
        for result in cursor.stored_results():
            rows = result.fetchall()
        curr_perm = []
        for row in rows:
            curr_perm.append((user_id, row[3].split('/')[-1] if row[2]
                              else row[3], 'omezeni' if row[2] else None))

        cursor.execute(
            'SELECT user_id, corpus_name, variant FROM kontext_corpus_user WHERE user_id = %s', (user_id,))
        cached_perm = [(row[0], row[1], row[2]) for row in cursor.fetchall()]

        curr_perm = set(curr_perm)
        cached_perm = set(cached_perm)
        to_del = cached_perm - curr_perm
        to_add = curr_perm - cached_perm

        for item in to_del:
            if item[2] is None:
                cursor.execute('DELETE FROM kontext_corpus_user '
                               'WHERE user_id = %s AND corpus_name = %s AND variant IS NULL', (user_id, item[1]))
            else:
                cursor.execute('DELETE FROM kontext_corpus_user '
                               'WHERE user_id = %s AND corpus_name = %s AND variant = %s',
                               (user_id, item[1], item[2]))
        try:
            cursor.executemany(
                'INSERT INTO kontext_corpus_user (user_id, corpus_name, variant) VALUES (%s, %s, %s)',
                list(to_add))
        except mysql.connector.errors.IntegrityError:
            pass  # we deliberately ignore this
        self._db.commit()
        if len(to_del) > 0 or len(to_add) > 0:
            logging.getLogger(__name__).info('Corp permissions sync: added {0}, removed {1}, user: {2}'.format(
                len(to_add), len(to_del), user_id))

    def get_permitted_corpora(self, user_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT kcu.corpus_name AS corpus_id, kcu.variant '
                       'FROM kontext_corpus_user AS kcu '
                       'WHERE kcu.user_id = %s', (user_id,))
        return [(r['corpus_id'], r['variant']) for r in cursor.fetchall()]

    def load_interval_attrs(self, corpus_id):
        cursor = self._db.cursor()
        cursor.execute('SELECT interval_struct, interval_attr '
                       'FROM kontext_interval_attr '
                       'WHERE corpus_name = %s', (corpus_id,))
        return ['{0}.{1}'.format(r['interval_struct'], r['interval_attr']) for r in cursor.fetchall()]
