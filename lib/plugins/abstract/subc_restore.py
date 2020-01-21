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
A plug-in template for storing Subcorpus parameters to be able to restore
it if needed. This plug-in is optional.

Expected factory method signature: create_instance(config, db)
"""

import abc


class AbstractSubcRestore(abc.ABC):

    @abc.abstractmethod
    def store_query(self, user_id, corpname, subcname, cql):
        """
        Store user's subcorpus query. Please note that the method should
        also:
        1. store a current UNIX timestamp
        2. generate and store unique (on its own, i.e. even without user_id) string ID for the record

        arguments:
        user_id -- int, ID of a user
        corpname -- a name of a corpus
        subcname -- a name of a subcorpus
        cql -- a query used to define the subcorpus
        returns:
        None
        """

    @abc.abstractmethod
    def delete_query(self, user_id, corpname, subcname):
        """
        Remove a query from archive

        arguments:
        user_id -- int, ID of a user
        corpname -- a name of a corpus
        subcname -- a name of a subcorpus

        returns:
        None
        """

    @abc.abstractmethod
    def list_queries(self, user_id, from_idx, to_idx):
        """
        List all user subcorpus queries from index from_idx to index to_idx
        (including both ends). The method is not expected to support negative
        indices (like e.g. Python does).

        arguments:
        user_id -- int, ID of a user
        from_idx -- values from 0 to num_of_user_queries - 1
        to_idx -- values from 0 to num_of_user_queries - 1

        returns:
        a list/tuple of dicts with following structure:
        {
            'id': str,
            'user_id': int,
            'corpname': str,
            'subcname': str,
            'struct_name': str,
            'condition': str,
            'timestamp': int
        }
        If nothing is found then an empty list/tuple is returned.
        """

    @abc.abstractmethod
    def get_info(self, user_id, corpname, subcname):
        """
        Returns an information about the most recent record matching provided arguments
        """

    @abc.abstractmethod
    def get_query(self, query_id):
        """
        Returns a query with ID == query_id

        returns:
        a dict with the following structure:
        {
            'id': str,
            'user_id': int,
            'corpname': str,
            'subcname': str,
            'struct_name': str,
            'condition': str,
            'timestamp': int
        }
        If nothing is found then None is returned.
        """
