# Copyright (c) 2013 Institute of the Czech National Corpus
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
This module implements /dev/null-like query storage
"""


class QueryStorage(object):

    def __init__(self, conf, db):
        """
        Parameters
        ----------

        conf : the 'settings' module (or some compatible object)
        """
        self.db = db
        self.num_kept_records = conf.get('plugins', 'query_storage').get('ucnk:num_kept_records', None)
        self.num_kept_records = int(self.num_kept_records) if self.num_kept_records else 10

    def _users_last_record_url(self, user_id):
        return None

    def write(self, user_id, corpname, url, public, tmp, params=None, description=None,  query_id=None):
        """
        Writes data as a new saved query

        Returns
        -------
        str : id of the query (either new or existing)
        """
        return None

    def get_user_queries(self, user_id, from_date=None, to_date=None, offset=0, limit=None, types=None):
        """
        Returns list of queries of a specific user.
        """
        return []

    def delete_old_records(self, cursor, user_id):
        """
        """
        pass

    def get_user_query(self, user_id, id):
        """
        Returns concrete query specified by its ID.
        In case the query is not public also user identifier has to match (else None is returned.
        """
        return None

    def delete_user_query(self, user_id, id):
        pass

    def undelete_user_query(self, user_id, id):
        pass

    def decode_description(self, s):
        """
        Converts a restructuredText-formatted string into HTML
        """
        return s