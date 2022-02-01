# Copyright (c) 2015 Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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


class Database(object):
    """
    Provides database operations on the 'metadata' database
    as required by category_tree and metadata_model.

    db_path -- path to a sqlite3 database file where structural metadata are stored
    table_name -- name of table where structural metadata are stored
    corpus_id -- main corpus identifier
    id_attr -- an unique identifier of bibliography items
    aligned_corpora -- a list of corpora identifiers we require the primary corpus to be aligned to
    """

    def __init__(self, db, corpus_id, id_attr, aligned_corpora):
        self._db = db
        self._aligned_corpora = aligned_corpora
        self._cur = db.cursor()
        self._corpus_id = corpus_id
        self._id_attr = id_attr

    @property
    def corpus_id(self):
        return self._corpus_id

    @property
    def struct_attr(self):
        return self._id_attr.split('.')

    def execute(self, sql, args=()):
        return self._cur.execute(sql, args)

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def append_aligned_corp_sql(self, sql, args):
        """
        This function adds one or more JOINs attaching
        required aligned corpora to a partial SQL query
        (query without WHERE and following parts).

        Please note that table is self-joined via
        an artificial attribute 'item_id' which identifies
        a single bibliography item across all the languages
        (i.e. it is language-independent). In case of
        the Czech Nat. Corpus and its InterCorp series
        this is typically achieved by modifying
        id_attr value by stripping its language identification
        prefix (e.g. 'en:Adams-Holisticka_det_k:0' transforms
        into 'Adams-Holisticka_det_k:0').

        arguments:
        sql -- a CQL prefix in form 'SELECT ... FROM ...'
               (i.e. no WHERE, LIIMIT, HAVING...)
        args -- arguments passed to this partial SQL

        returns:
        a 2-tuple (extended SQL string, extended args list)
        """
        i = 1
        ans_sql = sql
        ans_args = args[:]
        for ac in self._aligned_corpora:
            ans_sql += ' JOIN {tn} AS m{t2} ON m{t1}.item_id = m{t2}.item_id AND m{t2}.corpus_id = ?'.format(
                tn=self._table_name, t1=1, t2=i + 1)
            ans_args.append(ac)
            i += 1
        return ans_sql, ans_args

    def _find_count_col(self):
        data = self._cur.execute('PRAGMA table_info(\'item\')').fetchall()
        try:
            return next(d[1] for d in data if 'poscount' in d[1])
        except StopIteration:
            raise Exception('Failed to find column containing position counts in %s' %
                            self._db_path)
