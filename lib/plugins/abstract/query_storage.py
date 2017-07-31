# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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
Query storage plug-in works as a backend for the 'recent queries' function.
"""


class AbstractQueryStorage(object):

    def write(self, user_id, query_id):
        """
        Write data as a new saved query

        arguments:
        user_id -- a numeric ID of a user
        query_id -- a query identifier as produced by query_storage plug-in

        returns:
        an ID of the query (either new or existing)
        """
        raise NotImplementedError()

    def get_user_queries(self, user_id, corpus_manager, from_date=None, to_date=None, query_type=None, corpname=None,
                         offset=0, limit=None):
        """
        Returns list of queries of a specific user.

        arguments:
        user_id -- database user ID
        corpus_manager -- a corplib.CorpusManager instance
        from_date -- YYYY-MM-DD date string
        to_date -- YYY-MM-DD date string
        query_type -- one of {iquery, lemma, phrase, word, char, cql}
        corpus_name -- internal corpus name (i.e. including possible path-like prefix)
        offset -- where to start the list (starts from zero)
        limit -- how many rows will be selected
        """
        raise NotImplementedError()

    def delete_old_records(self, db, user_id):
        """
        arguments:
        db -- a database connection adapter
        user_id -- user ID
        """
        raise NotImplementedError()
