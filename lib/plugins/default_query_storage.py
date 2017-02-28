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
A plugin providing a storage for user's queries for services such as 'query history'.

Required config.xml/plugins entries:

element query_storage {
  element module { "default_query_storage" }
  element num_kept_records {
    attribute extension-by { "default" }
    text # how many records to keep stored per user
  }
  element page_num_records {
    attribute extension-by { "default" }
    text # how many records to show in 'recent queries' page
  }
  element page_append_records {
    attribute extension-by { "default" }
    text # how many records to load in case user clicks 'more'
  }
}
"""

from datetime import datetime
import time
import random

from abstract.query_storage import AbstractQueryStorage
from plugins import inject


class QueryStorage(AbstractQueryStorage):

    PROB_DELETE_OLD_RECORDS = 0.1

    def __init__(self, conf, db):
        """
        arguments:
        conf -- the 'settings' module (or some compatible object)
        db -- default_db storage backend
        """
        tmp = conf.get('plugins', 'query_storage').get('default:num_kept_records', None)
        self.num_kept_records = int(tmp) if tmp else 10
        self.db = db

    def _current_timestamp(self):
        return int(time.time())

    def _mk_key(self, user_id):
        return 'query_history:user:%d' % user_id

    def write(self, user_id, corpname, subcorpname, query, query_type, params=None):
        """
        stores information about a query

        arguments:
        user_id -- a numeric ID of a user
        corpname -- corpus name
        subcorpname -- subcorpus name (None if there is no subcorpus used)
        query -- a query to be stored
        query_type -- an identification of the query (iquery, cql, lemma,...)
        params -- additional arguments
        """
        data_key = self._mk_key(user_id)
        item = {
            'params': params if type(params) is dict else {},
            'corpname': corpname,
            'subcorpname': subcorpname,
            'query': query,
            'query_type': query_type,
            'created': self._current_timestamp()
        }
        self.db.list_append(data_key, item)
        if random.random() < QueryStorage.PROB_DELETE_OLD_RECORDS:
            self.delete_old_records(data_key)

    def get_user_queries(self, user_id, from_date=None, to_date=None, query_type=None, corpname=None, offset=0, limit=None):
        """
        Returns list of queries of a specific user.

        arguments:
        user_id -- database user ID
        from_date -- YYYY-MM-DD date string
        to_date -- YYY-MM-DD date string
        query_type -- one of {iquery, lemma, phrase, word, char, cql}
        corpus_name -- internal corpus name (i.e. including possible path-like prefix)
        offset -- where to start the list (starts from zero)
        limit -- how many rows will be selected
        """

        data = self.db.list_get(self._mk_key(user_id))

        if from_date:
            from_date = [int(d) for d in from_date.split('-')]
            from_date = time.mktime(datetime(from_date[0], from_date[1], from_date[2], 0, 0, 0).timetuple())
            data = filter(lambda x: x['created'] >= from_date, data)

        if to_date:
            to_date = [int(d) for d in to_date.split('-')]
            to_date = time.mktime(datetime(to_date[0], to_date[1], to_date[2], 23, 59, 59).timetuple())
            data = filter(lambda x: x['created'] <= to_date, data)

        if query_type:
            data = filter(lambda x: x['query_type'] == query_type, data)

        if corpname:
            data = filter(lambda x: x['corpname'] == corpname, data)

        if limit is None:
            limit = len(data)

        return sorted(data, key=lambda x: x['created'], reverse=True)[offset:(offset + limit)]

    def delete_old_records(self, data_key):
        """
        Deletes oldest records until the final length of the list equals <num_kept_records> configuration value
        """
        num_over = max(0, self.db.list_len(data_key) - self.num_kept_records)
        if num_over > 0:
            self.db.list_trim(data_key, num_over, -1)


@inject('db')
def create_instance(settings, db):
    """
    arguments:
    settings -- the settings.py module
    db -- a 'db' plugin implementation
    """
    return QueryStorage(settings, db)
