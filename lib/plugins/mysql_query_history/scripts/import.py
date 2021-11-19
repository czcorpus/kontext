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
import datetime

sys.path.insert(0, os.path.realpath('%s/../../..' % os.path.dirname(os.path.realpath(__file__))))

import settings
import initializer
import plugins

# imports data from KeyValueStorage query persistence plugin db
# into mysql integration database query history table
# all parameters are defined in config.xml

if __name__ == "__main__":
    logging.basicConfig()
    conf_path = os.path.realpath(os.path.join(os.path.dirname(
        __file__), '..', '..', '..', '..', 'conf', 'config.xml'))
    settings.load(conf_path, defaultdict(lambda: None))

    initializer.init_plugin('integration_db')
    initializer.init_plugin('db')
    initializer.init_plugin('query_persistence')

    with plugins.runtime.DB as db, plugins.runtime.INTEGRATION_DB as integration_db, plugins.runtime.QUERY_PERSISTENCE as qp:
        full_data = []
        for query_history_user in db.keys('query_history:user:'):
            user_id = int(query_history_user.split(':')[-1])
            for item in db.list_get(query_history_user):
                if 'query_id' in item:
                    query_id = item['query_id']
                    q_supertype = item.get('q_supertype', item.get('qtype', 'conc'))
                    corpora = qp.open(query_id)['corpora']
                    created = datetime.datetime.fromtimestamp(item['created'])

                    full_data.extend([
                        (user_id, query_id, q_supertype, created, item['name'], corpus)
                        for corpus in corpora
                    ])

                else:
                    logging.warning('Unsupported history item for user %s: %s', user_id, item)

        unique_entries_count = len(set(full_data))
        print(f'{unique_entries_count} entries will be inserted. {len(full_data) - unique_entries_count} duplicate entries will be ignored.')

        cursor = integration_db.cursor()
        cursor.executemany('''
            INSERT IGNORE INTO kontext_query_history (user_id, query_id, q_supertype, created, name, corpus_name)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', full_data)
        integration_db.commit()

        print(f'{cursor.rowcount} entries has been inserted.')
