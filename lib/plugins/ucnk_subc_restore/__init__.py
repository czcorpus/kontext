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

required entry in config.xml: please see config.rng

"""

import time
import urllib.request
import urllib.parse
import urllib.error
import logging

import werkzeug.urls
import plugins
from plugins.abstract.subc_restore import AbstractSubcRestore
from plugins import inject
import sqlite3


class SQLite3Ops(object):
    def __init__(self, db_path):
        self._db = sqlite3.connect(db_path)
        self._db.row_factory = sqlite3.Row

    def execute(self, sql, args):
        cursor = self._db.cursor()
        cursor.execute(sql, args)
        return cursor

    def commit(self):
        self._db.commit()


class UCNKSubcRestore(AbstractSubcRestore):
    """
    For the documentation of individual methods, please see AbstractSubcRestore class
    """

    COLS = ('id', 'user_id', 'corpname', 'subcname', 'cql', 'timestamp')

    def __init__(self, conf, corparch):
        self._conf = conf
        self._corparch = corparch
        self._db = SQLite3Ops(self._conf.get('plugins')['subc_restore']['ucnk:db_path'])

    def store_query(self,  user_id, corpname, subcname, cql):
        self._db.execute('INSERT INTO subc_archive (user_id, corpname, subcname, cql, timestamp) '
                         'VALUES (?, ?, ?, ?, ?)', (user_id, corpname, subcname, cql, int(time.time())))
        self._db.commit()

    def delete_query(self, user_id, corpname, subcname):
        self._db.execute('DELETE FROM subc_archive WHERE user_id = ? AND corpname = ? AND subcname = ?',
                         (user_id, corpname, subcname))
        self._db.commit()

    def list_queries(self, user_id, from_idx, to_idx=None):
        to_idx = -1 if to_idx is None else to_idx - from_idx
        ans = self._db.execute('SELECT %s ' % ', '.join(self.COLS) +
                               'FROM subc_archive WHERE user_id = ? ORDER BY id LIMIT ?, ?',
                               (user_id, from_idx, to_idx)).fetchall()
        result = []
        for item in ans:
            result.append(dict(list(zip(self.COLS, item))))
        return result

    def get_info(self, user_id, corpname, subcname):
        ans = self._db.execute('SELECT %s ' % ', '.join(self.COLS) +
                               'FROM subc_archive WHERE user_id = ? AND corpname = ? AND subcname = ? ' +
                               'ORDER BY timestamp DESC LIMIT 1', (user_id, corpname, subcname, )).fetchone()
        if ans:
            return dict(list(zip(self.COLS, ans)))
        else:
            return None

    def get_query(self, query_id):
        ans = self._db.execute('SELECT %s ' % ', '.join(self.COLS) +
                               'FROM subc_archive WHERE id = ?', (query_id, )).fetchone()
        if ans:
            return dict(list(zip(self.COLS, ans)))
        else:
            return None

    def extend_subc_list(self, plugin_api, subc_list, filter_args, from_idx, to_idx=None):
        """
        Enriches KonText's original subcorpora list by the information about queries which
        produced these subcorpora. It it also able to insert an information about deleted
        subcorpora.

        Args:
            plugin_api (kontext.PluginApi): a Plugin API instance
            subc_list (list of dict): an original subcorpora list as produced by KonText's respective action
                (= list of dict(n=str, v=???, size=int, created=str, corpname=str, usesubcorp=str))
            filter_args (dict): support for 'show_deleted': 0/1 and 'corpname': str
            from_idx (int): 0..(num_items-1) list offset
            to_idx (int): last item index (None by default)

        Returns:
            list of dict: a new list containing both the original subc_list and also the extended part
        """
        def get_user_subcname(rec):
            return rec.get('orig_subcname') if rec.get('orig_subcname') else rec.get('usesubcorp')

        subc_queries = self.list_queries(plugin_api.user_id, from_idx, to_idx)
        subc_queries_map = {}
        for x in subc_queries:
            subc_queries_map[(x['corpname'], x['subcname'])] = x

        if filter_args.get('show_deleted', False):
            deleted_keys = set(subc_queries_map.keys()) - \
                (set((x['corpname'], get_user_subcname(x)) for x in subc_list))
        else:
            deleted_keys = []

        def corpname_matches(cn):
            filter_cn = filter_args.get('corpname', None)
            return not filter_cn or cn == filter_cn

        def escape_subcname(s):
            return werkzeug.urls.url_quote(s, unsafe='+')

        deleted_items = []
        for dk in deleted_keys:
            try:
                corpus_name = subc_queries_map[dk]['corpname']
                if corpname_matches(corpus_name):
                    corpus_info = self._corparch.get_corpus_info(plugin_api.user_lang, corpus_name)
                    deleted_items.append({
                        'name': '{0} / {1}'.format(corpus_info.id, subc_queries_map[dk]['subcname']),
                        'size': None,
                        'created': subc_queries_map[dk]['timestamp'],
                        'human_corpname': corpus_info.name,
                        'corpname': subc_queries_map[dk]['corpname'],
                        'usesubcorp': escape_subcname(subc_queries_map[dk]['subcname']),
                        'cql': urllib.parse.quote(subc_queries_map[dk]['cql'].encode('utf-8')),
                        'deleted': True,
                        'published': False})
            except Exception as ex:
                logging.getLogger(__name__).warning(ex)
        for subc in subc_list:
            key = (subc['corpname'], get_user_subcname(subc))
            if key in subc_queries_map:
                subc['cql'] = urllib.parse.quote(subc_queries_map[key]['cql'].encode('utf-8'))
            else:
                subc['cql'] = None
            subc['usesubcorp'] = escape_subcname(subc['usesubcorp'])
        return subc_list + deleted_items


@inject(plugins.runtime.CORPARCH)
def create_instance(conf, corparch):
    return UCNKSubcRestore(conf, corparch)
