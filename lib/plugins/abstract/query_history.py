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
Query history plug-in works as a backend for the 'recent queries' function.
"""

import abc


class AbstractQueryHistory(abc.ABC):

    @abc.abstractmethod
    def store(self, user_id: int, query_id: str, q_supertype: str):
        """
        Store data as a new saved query

        arguments:
        user_id -- a numeric ID of a user
        query_id -- a query identifier as produced by query_history plug-in
        q_supertype -- a super-type of the query (do not confuse with 'query type')
            conc - concordance (for backward compatibility reasons, None means also 'conc')
            wlist - word list
            pquery - paradigmatic query

        returns:
        an ID of the query (either new or existing)
        """

    @abc.abstractmethod
    def make_persistent(self, user_id, query_id, name):
        """
        Finds (if implemented) a specific query history
        record based on its respective concordance record.
        If not supported then the function

        arguments:
        user_id -- a user ID
        query_id -- a query ID (in URLs: q=~[query_id])
        name -- a name user gave to the query
        """

    @abc.abstractmethod
    def make_transient(self, user_id, query_id, name):
        """
        Remove name from the history item and let it be
        removed once it gets too old
        """

    @abc.abstractmethod
    def delete(self, user_id, query_id, created):
        """
        Delete a named query from history.

        Note: items should be searched by both query_id
        and created as multiple items may have the same query_id.
        In a theoretical case in which multiple items have
        the same query_id and creation timestamp, all of them
        should be removed.

        arguments:
        user_id -- user ID
        query_id -- query ID
        created -- creation UNIX timestamp
        """

    @abc.abstractmethod
    def get_user_queries(self, user_id, corpus_manager, from_date=None, to_date=None, q_supertype=None, corpname=None,
                         archived_only=False, offset=0, limit=None):
        """
        Returns list of queries of a specific user.

        arguments:
        user_id -- database user ID
        corpus_manager -- a corplib.CorpusManager instance
        from_date -- YYYY-MM-DD date string
        to_date -- YYY-MM-DD date string
        q_supertype -- one of {conc, pquery, wlist}
        corpus_name -- internal corpus name (i.e. including possible path-like prefix)
        archived_only -- if True then only archived items should be displayed
        offset -- where to start the list (starts from zero)
        limit -- how many rows will be selected
        """

    @abc.abstractmethod
    def find_by_qkey(self, query_key):
        """
        Searches for a record based on its 'query key' which is basically
        a concatenation of query persistence ID and a timestamp:
        [query persist ID]:[query timestamp].

        The method should be able to accept None as query_key and return
        None in such case.
        """

    @abc.abstractmethod
    def delete_old_records(self, user_id):
        """
        Remove old records to keep the query history
        list of a reasonable size. There are no
        strict rules on how this should behave - it
        is up to a concrete plug-in implementation.

        arguments:
        user_id -- user ID
        """
