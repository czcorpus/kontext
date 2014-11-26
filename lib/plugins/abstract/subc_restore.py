# Copyright (c) 2014 Institute of the Czech National Corpus
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

"""
A plug-in template for storing Subcorpus parameters to be able to restore
it if needed. This plug-in is optional.

Expected factory method signature: create_instance(config, db)
"""


class SubcRestore(object):

    def store_query(self, user_id, struct_name, condition):
        """
        Stores user's subcorpus query. Please note that the method should
        also:
        1. store a current UNIX timestamp
        2. generate and store unique (on its own, i.e. even without user_id) string ID for the record

        arguments:
        user_id -- int identifier of a user
        struct_name -- name of a structure used to define a subcorpus
        condition -- a CQL-compatible conjunctive normal form describing required attribute values
                     e.g.: srclang="en" & (txtype="FAC" | txtype="IMA") & txtype_group="fiction"
        returns:
        a string ID of the record
        """
        raise NotImplementedError()

    def list_queries(self, user_id, from_idx, to_idx):
        """
        Lists all user subcorpus-creation queries from index from_idx to index to_idx
        (including both ends). The method is not expected to support negative indices (like Python does).

        arguments:
        user_id -- int identifier of a user
        from_idx -- values from 0 to num_of_user_queries - 1
        to_idx -- values from 0 to num_of_user_queries - 1

        returns:
        a list/tuple of dicts with following structure:
        { 'id': str, 'user_id': int, 'struct_name': str, 'condition': str, 'timestamp': int }
        """
        raise NotImplementedError()

    def get_query(self, query_id):
        """
        Returns a query with ID == query_id

        returns:
        a dict with following structure:
        { 'id': str, 'user_id': int, 'struct_name': str, 'condition': str, 'timestamp': int }
        """
        raise NotImplementedError()
