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

'''
Script to import ucnk_live_attributes data from sqlite to mysql
'''

import sqlite3
import sys
import mysql.connector
import argparse


def import_data(sqlite_db: sqlite3.Connection, mysql_db: mysql.connector.MySQLConnection, dry_run: bool):
    mysql_cursor = mysql_db.cursor()

    sqlite_cursor = sqlite_db.cursor()
    sqlite_cursor.execute('select count(*) as count from item')
    row_count = sqlite_cursor.fetchone()['count']

    added_struct_attrs = set()
    sqlite_cursor.execute('select * from item')
    for i, row in enumerate(sqlite_cursor):
        corpus_name = row['corpus_id']
        poscount = row['poscount']
        wordcount = row['wordcount']

        # add new structattr value tuple
        mysql_cursor.execute(
            'insert into corpus_structattr_value_tuple (corpus_name, poscount, wordcount) values (%s, %s, %s)',
            (corpus_name, poscount, wordcount))
        value_tuple_id = mysql_cursor.lastrowid

        for key in row.keys():
            if key not in ('id', 'corpus_id', 'poscount', 'wordcount'):
                struct, attr = key.split('_', 1)
                # insert structures and structattrs if needed
                if key not in added_struct_attrs:
                    mysql_cursor.execute(
                        'insert ignore into corpus_structure (corpus_name, name) values (%s, %s)',
                        (corpus_name, struct))
                    mysql_cursor.execute(
                        'insert ignore into corpus_structattr (corpus_name, structure_name, name) values (%s, %s, %s)',
                        (corpus_name, struct, attr))
                    added_struct_attrs.add(key)

                # insert structattr values if needed
                mysql_cursor.execute(
                    'insert ignore into corpus_structattr_value (corpus_name, structure_name, structattr_name, value) values (%s, %s, %s, %s)',
                    (corpus_name, struct, attr, row[key]))
                value_id = mysql_cursor.lastrowid
                if mysql_cursor.lastrowid == 0:
                    mysql_cursor.execute(
                        'select id from corpus_structattr_value where corpus_name = %s and structure_name = %s and structattr_name = %s and value = %s',
                        (corpus_name, struct, attr, row[key]))
                    value_id = mysql_cursor.fetchone()[0]

                # add mapping of value tuple onto its structattr values
                mysql_cursor.execute(
                    'insert ignore into corpus_structattr_value_mapping (value_tuple_id, value_id) values (%s, %s)',
                    (value_tuple_id, value_id))

        if i % 1000 == 0:
            print(f'Row {i}/{row_count} imported')

    sqlite_cursor.close()
    mysql_db.commit()
    mysql_cursor.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Import user items from redis to mysql')
    parser.add_argument('--sqlite-path', type=str)
    parser.add_argument('--mysql-host', type=str, default='localhost')
    parser.add_argument('--mysql-port', type=int, default=3306)
    parser.add_argument('--mysql-db', type=str, default='kontext')
    parser.add_argument('--mysql-user', type=str, default='kontext')
    parser.add_argument('--mysql-pwd', type=str, default='kontext-secret')
    parser.add_argument('--dry-run', action='store_true',
                        default=False, help='Only print changes')
    args = parser.parse_args()

    sqlite_client = sqlite3.connect(args.sqlite_path)
    sqlite_client.row_factory = sqlite3.Row
    mysql_client = mysql.connector.connect(
        host=args.mysql_host, port=args.mysql_port, user=args.mysql_user, password=args.mysql_pwd, database=args.mysql_db)

    try:
        import_data(sqlite_client, mysql_client, args.dry_run)
        if not args.dry_run:
            print('Data imported')
    except Exception as ex:
        print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
        sys.exit(1)

    sqlite_client.close()
    mysql_client.close()
