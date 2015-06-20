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

<query_storage>
    <module>ucnk_query_storage</module>
    <db_path extension-by="ucnk">[path to a sqlite3-compatible database file]</db_path>
    <num_kept_records extension-by="ucnk">[how many records to keep stored per user]</num_kept_records>
    <page_num_records extension-by="ucnk">[how many records to show in 'recent queries' page]</page_num_records>
    <page_append_records extension-by="ucnk">[how many records to load in case user clicks 'more']</page_append_records>
</query_storage>

Required SQL table:

CREATE TABLE kontext_saved_queries (
  id int(11) NOT NULL AUTO_INCREMENT,
  user_id int(11) NOT NULL,
  corpname varchar(255) NOT NULL,
  subcorpname varchar(255),
  query TEXT NOT NULL,
  query_type VARCHAR(31) NOT NULL,
  params text,
  created int(11) NOT NULL,
  PRIMARY KEY (id),
  KEY user_id (user_id),
  FOREIGN KEY (user_id) REFERENCES user (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

"""


from datetime import datetime
import time
import random

from abstract.query_storage import AbstractQueryStorage
from plugins import inject


TABLE_NAME = 'kontext_saved_queries'


class QueryStorage(AbstractQueryStorage):

    cols = ('id', 'user_id', 'corpname', 'subcorpname', 'query', 'query_type', 'params', 'created')

    PROB_DELETE_OLD_RECORDS = 0.1

    def __init__(self, conf, db_provider):
        """
        arguments:
        db_provider -- a callable providing a database proxy
        conf -- the 'settings' module (or some compatible object)
        """
        self.db_provider = db_provider
        tmp = conf.get('plugins', 'query_storage').get('ucnk:num_kept_records', None)
        self.num_kept_records = int(tmp) if tmp else 10

    def write(self, user_id, corpname, subcorpname, query, query_type, params=None):
        """
        Writes data as a new saved query

        Returns
        -------
        str : id of the query (either new or existing)
        """
        db = self.db_provider()
        with db.begin() as transaction:
            created = int(time.mktime(datetime.now().timetuple()))
            db.execute(u"INSERT INTO %s " % TABLE_NAME +
                       u"(%s) " % ', '.join(QueryStorage.cols[1:]) +
                       (u"VALUES (%s)" % ', '.join(['%s'] * (len(QueryStorage.cols) - 1))),
                      (user_id, corpname, subcorpname, query, query_type, params, created))
            if random.random() < QueryStorage.PROB_DELETE_OLD_RECORDS:
                self.delete_old_records(db, user_id)
        db.close()

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

        sql_params = []
        opt_sql = []

        if from_date:
            from_date = [int(d) for d in from_date.split('-')]
            from_date = time.mktime(datetime(from_date[0], from_date[1], from_date[2], 0, 0, 0).timetuple())
            opt_sql.append('created >= %s')
            sql_params.append(from_date)

        if to_date:
            to_date = [int(d) for d in to_date.split('-')]
            to_date = time.mktime(datetime(to_date[0], to_date[1], to_date[2], 23, 59, 59).timetuple())
            opt_sql.append('created <= %s')
            sql_params.append(to_date)

        if query_type:
            opt_sql.append('query_type = %s')
            sql_params.append(query_type)

        if corpname:
            opt_sql.append('corpname = %s')
            sql_params.append(corpname)

        if limit is not None:
            limit_sql = "LIMIT %s OFFSET %s"
            sql_params.append(limit)
            sql_params.append(offset)
        else:
            limit_sql = ''

        if len(opt_sql) > 0:
            opt_sql.insert(0, '')

        sql = ("SELECT %s FROM %s"
               " WHERE user_id = %%s "
               " %s "
               " ORDER BY created DESC "
               "%s") % (', '.join(QueryStorage.cols), TABLE_NAME, ' AND '.join(opt_sql), limit_sql)
        sql_params.insert(0, user_id)
        db = self.db_provider()
        ans = db.execute(sql, tuple(sql_params))
        rows = [dict(x) for x in ans]
        db.close()
        return rows

    def delete_old_records(self, db, user_id):
        """
        """
        # Current solution is not very effective but makes MySQL to complain less
        # in case of active replication and multiple engines used.
        # Typically this will delete just one old record which should be ok.
        rows = db.execute(("SELECT id FROM %s WHERE user_id = %%s "
                          " ORDER BY created DESC LIMIT %%s, 100") % TABLE_NAME,
                          (user_id, self.num_kept_records)).fetchall()
        for row in rows:
            db.execute(("DELETE FROM %s WHERE user_id = %%s "
                       " AND id = %%s") % TABLE_NAME, (user_id, row[0]))


@inject('db')
def create_instance(settings, db):
    """
    arguments:
    settings -- the settings.py module
    db -- a 'db' plugin implementation
    """
    return QueryStorage(settings, db)