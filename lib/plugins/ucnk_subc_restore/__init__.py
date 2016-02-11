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
  cql TEXT NOT NULL,
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
import urllib

from sqlalchemy import create_engine
import werkzeug.urls
from ..abstract.subc_restore import AbstractSubcRestore
import datetime
from plugins import inject


class UCNKSubcRestore(AbstractSubcRestore):
    """
    For the documentation of individual methods, please see AbstractSubcRestore class
    """

    COLS = ('id', 'user_id', 'corpname', 'subcname', 'cql', 'timestamp')

    def __init__(self, conf, corparch):
        self._conf = conf
        self._corparch = corparch
        self._db = create_engine('sqlite:///%s' % self._conf.get('plugins')['subc_restore']['ucnk:db_path'])

    def store_query(self,  user_id, corpname, subcname, cql):
        self._db.execute('INSERT INTO subc_archive (user_id, corpname, subcname, cql, timestamp) '
                         'VALUES (?, ?, ?, ?, ?)', (user_id, corpname, subcname, cql, int(time.time())))

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

    def get_info(self, user_id, corpname, subcname):
        ans = self._db.execute('SELECT %s ' % ', '.join(self.COLS) +
                               'FROM subc_archive WHERE user_id = ? AND corpname = ? AND subcname = ? ' +
                               'ORDER BY timestamp DESC LIMIT 1', (user_id, corpname, subcname, )).fetchone()
        if ans:
            return dict(zip(self.COLS, ans))
        else:
            return None

    def get_query(self, query_id):
        ans = self._db.execute('SELECT %s ' % ', '.join(self.COLS) +
                               'FROM subc_archive WHERE id = ?', (query_id, )).fetchone()
        if ans:
            return dict(zip(self.COLS, ans))
        else:
            return None

    def extend_subc_list(self, subc_list, user_id, corpname_canonizer, show_deleted, from_idx, to_idx=None):
        """
        Enriches KonText's original subcorpora list by the information about queries which
        produced these subcorpora. It it also able to insert an information about deleted
        subcorpora.

        arguments:
        subc_list -- an original subcorpora list as produced by KonText's respective action
                     (= list of dict(n=str, v=???, size=int, created=str, corpname=str, usesubcorp=str))
        user_id -- a database user ID
        corpname_canonizer -- a function providing a canonized version of a corpus name
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
            subc_queries_map[u'%s:%s' % (x['corpname'], x['subcname'])] = x

        if show_deleted:
            deleted_keys = set(subc_queries_map.keys()) - (set([x['internal_n'] for x in subc_list]))
        else:
            deleted_keys = []

        escape_subcname = lambda s: werkzeug.urls.url_quote(s, unsafe='+')
        deleted_items = []
        for dk in deleted_keys:
            corpus_info = self._corparch.get_corpus_info(subc_queries_map[dk]['corpname'])
            deleted_items.append({
                'n': corpname_canonizer(dk),
                'internal_n': subc_queries_map[dk]['corpname'],
                'v': dk,
                'size': None,
                'created': datetime.datetime.fromtimestamp(subc_queries_map[dk]['timestamp']),
                'human_corpname': corpus_info.name,
                'corpname': subc_queries_map[dk]['corpname'],
                'usesubcorp': escape_subcname(subc_queries_map[dk]['subcname']),
                'cql': urllib.quote(subc_queries_map[dk]['cql'].encode('utf-8')),
                'deleted': True
            })

        for subc in subc_list:
            if subc['internal_n'] in subc_queries_map:
                subc['cql'] = urllib.quote(subc_queries_map[subc['internal_n']]['cql'].encode('utf-8'))
            else:
                subc['cql'] = None
            subc['usesubcorp'] = escape_subcname(subc['usesubcorp'])

        return sorted(subc_list + deleted_items, key=lambda t: t['n'])


@inject('corparch')
def create_instance(conf, corparch):
    return UCNKSubcRestore(conf, corparch)
