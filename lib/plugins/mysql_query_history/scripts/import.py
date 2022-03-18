# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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


from collections import defaultdict
import logging
import sys
import os

sys.path.insert(0, os.path.realpath('%s/../../..' % os.path.dirname(os.path.realpath(__file__))))

import settings
from action.plugin import initializer
import plugins
from plugins import sqlite3_db

# imports data from KeyValueStorage query persistence plugin db
# into mysql integration database query history table
# all parameters are defined in config.xml


class CustomDB:

    def __init__(self, db_plugin):
        self._db_plugin = db_plugin

    def keys(self, startswith=None):
        if isinstance(self._db_plugin, sqlite3_db.DefaultDb):
            cursor = getattr(self._db_plugin, '_conn')().cursor()
            if startswith:
                cursor.execute('SELECT key from data WHERE key LIKE ?', (f'{startswith}%',))
            else:
                cursor.execute('SELECT key from data')
            return [row for row in cursor]
        else:
            return [x for x in getattr(self._db_plugin, 'redis').scan_iter(f'{startswith}*')]

    def list_get(self, key, from_idx=0, to_idx=-1):
        return self._db_plugin.list_get(key, from_idx, to_idx)


if __name__ == '__main__':
    logging.basicConfig()
    conf_path = os.path.realpath(os.path.join(os.path.dirname(
        __file__), '..', '..', '..', '..', 'conf', 'config.xml'))
    settings.load(conf_path, defaultdict(lambda: None))

    initializer.init_plugin('integration_db')
    initializer.init_plugin('db')
    initializer.init_plugin('query_persistence')

    with plugins.runtime.DB as db, plugins.runtime.INTEGRATION_DB as integration_db, plugins.runtime.QUERY_PERSISTENCE as qp:
        full_data = []
        custom_db = CustomDB(db)
        for query_history_user in custom_db.keys('query_history:user:'):
            user_id = int(query_history_user.decode().split(':')[-1])
            for item in custom_db.list_get(query_history_user):
                if 'query_id' in item:
                    query_id = item['query_id']
                    q_supertype = item.get('q_supertype', item.get('qtype', 'conc'))
                    try:
                        corpora = qp.open(query_id)['corpora']
                        created = item['created']

                        full_data.extend([
                            (user_id, query_id, q_supertype, created, item['name'], corpus)
                            for corpus in corpora
                        ])
                    except Exception as ex:
                        print(f'Failed to add query {query_id}: {ex}')

                else:
                    logging.warning('Unsupported history item for user %s: %s', user_id, item)

        unique_entries_count = len(set(full_data))
        print(f'{unique_entries_count} entries will be inserted. ')
        print(f'{len(full_data) - unique_entries_count} duplicate entries will be ignored.')

        with integration_db.connection_sync() as conn:
            with conn.cursor() as cursor:
                cursor.executemany(
                    'INSERT IGNORE INTO kontext_query_history (user_id, query_id, q_supertype, created, name, corpus_name)'
                    'VALUES (%s, %s, %s, %s, %s, %s)',
                    full_data)
            conn.commit()

        print(f'\n{max(cursor.rowcount, 0)} entries has been inserted.')
