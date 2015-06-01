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
A SQLite3-based subc_restore implementation.

required schema:

CREATE TABLE subc_archive (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  corpname TEXT NOT NULL,
  subcname TEXT NOT NULL,
  struct_name TEXT NOT NULL,
  condition TEXT NOT NULL,
  timestamp INTEGER NOT NULL
);

required entry in config.xml:

<plugins>
...
    <subc_restore>
        <module>ucnk_subc_restore</module>
        <db_path extension-by="ucnk">/path/to/a/sqlite3/db/file</db_path>
    </subc_restore>
...
</plugins>

"""

import time
import logging
import urllib
LOG = logging.getLogger(__name__).debug

from sqlalchemy import create_engine
import werkzeug.urls

from abstract.subc_restore import AbstractSubcRestore
import datetime


class UCNKSubcRestore(AbstractSubcRestore):
    """
    For the documentation of individual methods, please see AbstractSubcRestore class
    """

    COLS = ('id', 'user_id', 'corpname', 'subcname', 'struct_name', 'condition', 'timestamp')

    def __init__(self, conf):
        self._conf = conf
        self._db = create_engine('sqlite:///%s' % self._conf.get('plugins')['subc_restore']['ucnk:db_path'])

    def store_query(self, user_id, corpname, subcname, structname, condition):
        self._db.execute('INSERT INTO subc_archive (user_id, corpname, subcname, struct_name, condition, timestamp) '
                         'VALUES (?, ?, ?, ?, ?, ?)', (user_id, corpname, subcname, structname, condition,
                                                       int(time.time())))

    def delete_query(self, user_id, corpname, subcname):
        self._db.execute('DELETE FROM subc_archive WHERE user_id = ? AND corpname = ? AND subcname = ?',
                         (user_id, corpname, subcname))

    def list_queries(self, user_id, from_idx, to_idx=None):
        to_idx = -1 if to_idx is None else to_idx - from_idx
        ans = self._db.execute('SELECT %s ' % ', '.join(self.COLS) +
                               'FROM subc_archive WHERE user_id = ? ORDER BY id LIMIT ?, ?',
                               (user_id, from_idx, to_idx)).fetchall()
        result = []
        for item in ans:
            result.append(dict(zip(self.COLS, item)))
        return result

    def get_query(self, query_id):
        ans = self._db.execute('SELECT %s ' % ', '.join(self.COLS) +
                               'FROM subc_archive WHERE id = ?', (query_id, )).fetchone()
        if ans:
            return dict(zip(self.COLS, ans))
        else:
            return None

    def extend_subc_list(self, subc_list, user_id, show_deleted, from_idx, to_idx=None):
        """
        Enriches KonText's original subcorpora list by the information about queries which
        produced these subcorpora. It it also able to insert an information about deleted
        subcorpora.

        arguments:
        subc_list -- an original subcorpora list as produced by KonText's respective action
                     (= list of dict(n=str, v=???, size=int, created=str, corpname=str, usesubcorp=str))
        user_id -- a database user ID
        show_deleted -- if True then the method includes removed subcorpora too (though without
                        some properties obtained from subcorpora files which are not available in such
                        case)
        from_idx -- 0..(num_items-1) list offset
        to_idx -- last item index (None by default)

        returns:
        a corplist sorted by creation date
        """
        subc_queries = self.list_queries(user_id, from_idx, to_idx)
        subc_queries_map = {}
        for x in subc_queries:
            subc_queries_map['%s:%s' % (x['corpname'], x['subcname'])] = x

        if show_deleted:
            deleted_keys = set(subc_queries_map.keys()) - (set([x['n'] for x in subc_list]))
        else:
            deleted_keys = []

        escape_subcname = lambda s: werkzeug.urls.url_quote(s, unsafe='+')

        deleted_items = []
        for dk in deleted_keys:
            deleted_items.append({
                'n': dk,
                'v': dk,
                'size': None,
                'created': datetime.datetime.fromtimestamp(subc_queries_map[dk]['timestamp']),
                'corpname': subc_queries_map[dk]['corpname'],
                'usesubcorp': escape_subcname(subc_queries_map[dk]['subcname']),
                'struct_name': subc_queries_map[dk]['struct_name'],
                'condition': urllib.quote(subc_queries_map[dk]['condition'].encode('utf-8')),
                'deleted': True
            })

        for subc in subc_list:
            if subc['n'] in subc_queries_map:
                subc['struct_name'] = subc_queries_map[subc['n']]['struct_name']
                subc['condition'] = urllib.quote(subc_queries_map[subc['n']]['condition'].encode('utf-8'))
            else:
                subc['struct_name'] = None
                subc['condition'] = None
            subc['usesubcorp'] = escape_subcname(subc['usesubcorp'])

        return sorted(subc_list + deleted_items, key=lambda t: t['n'])


def create_instance(conf, *args):
    return UCNKSubcRestore(conf)