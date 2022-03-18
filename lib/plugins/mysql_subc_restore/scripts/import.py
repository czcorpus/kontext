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


import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.realpath('%s/../../..' % os.path.dirname(os.path.realpath(__file__))))

import sqlite3
import argparse
import datetime
from action.plugin import initializer
import settings
import plugins


def import_sqlite_db(db_path, chunk_size):
    ucnk_db = sqlite3.connect(db_path)

    cursor = ucnk_db.cursor()
    with plugins.runtime.INTEGRATION_DB as mysql_db:
        with mysql_db.connection_sync() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    'SELECT user_id, corpname, subcname, cql, timestamp FROM subc_archive')
                while True:
                    data = cursor.fetchmany(chunk_size)
                    if len(data):
                        cursor.executemany(
                            'INSERT IGNORE INTO kontext_subc_archive (user_id, corpname, subcname, cql, timestamp) '
                            'VALUES (%s, %s, %s, %s, %s)',
                            [(
                                d[0],
                                d[1],
                                d[2],
                                d[3],
                                datetime.datetime.fromtimestamp(d[4])
                            ) for d in data]
                        )
                        conn.commit()
                    else:
                        break

    cursor.close()
    ucnk_db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Import subc restore archive from sqlite3 to mysql')
    parser.add_argument('path', metavar='PATH', type=str, help='Path to sqlite3 db')
    parser.add_argument('-c', '--chunk_size', type=int, default=1000,
                        help='Chunk size for import cycle. Default is 1000')
    args = parser.parse_args()
    conf_path = os.path.realpath(os.path.join(os.path.dirname(
        __file__), '..', '..', '..', '..', 'conf', 'config.xml'))
    settings.load(conf_path, defaultdict(lambda: None))
    initializer.init_plugin('integration_db')
    try:
        import_sqlite_db(args.path, args.chunk_size)
        print('Data imported')
    except Exception as ex:
        print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
        sys.exit(1)
