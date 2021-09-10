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
from typing import Optional
import mysql.connector
import argparse
from collections import defaultdict


def import_data(sqlite_db: sqlite3.Connection, mysql_db: mysql.connector.MySQLConnection, batch: int, corpus_id: Optional[str] = None):
    mysql_cursor = mysql_db.cursor()
    sqlite_cursor = sqlite_db.cursor()

    if corpus_id is not None:
        sqlite_cursor.execute(
            'select count(*) as count from item where corpus_id = ?', (corpus_id,))
    else:
        sqlite_cursor.execute('select count(*) as count from item')
    row_count = sqlite_cursor.fetchone()['count']

    if corpus_id is None:
        sqlite_cursor.execute('select distinct corpus_id from item')
        corpora = [row[0] for row in sqlite_cursor]
    else:
        corpora = [corpus_id]

    mysql_cursor.execute(
        'select id, corpus_name, structure_name, structattr_name, value from corpus_structattr_value where corpus_name in (%s)',
        (', '.join(corpora),))
    present_values = {tuple(corp_struct_atrr_value): id for id, *
                      corp_struct_atrr_value in mysql_cursor}

    mysql_cursor.execute('select item, id from corpus_parallel_items')
    present_items = {item: id for item, id in mysql_cursor}

    present_corpus_struct_attrs = defaultdict(lambda: set())
    mysql_cursor.execute(
        'select corpus_name, structure_name, name from corpus_structattr where corpus_name in (%s)',
        (', '.join(corpora),))
    for corp, struct, attr in mysql_cursor:
        present_corpus_struct_attrs[corp].update(struct)
        present_corpus_struct_attrs[corp].update(f'{struct}_{attr}')

    foreign_connections = []
    if corpus_id is not None:
        sqlite_cursor.execute('select * from item where corpus_id = ?', (corpus_id,))
    else:
        sqlite_cursor.execute('select * from item')
    for i, row in enumerate(sqlite_cursor):
        corpus_name = row['corpus_id']
        poscount = row['poscount']
        wordcount = row['wordcount']

        try:
            item = row['item_id']
        except IndexError:
            item_id = None
        else:
            try:
                item_id = present_items[item]
            except KeyError:
                mysql_cursor.execute(
                    'insert ignore into corpus_parallel_item (item) values (%s)', (item,))
                item_id = mysql_cursor.lastrowid
                if item_id == 0:
                    mysql_cursor.execute(
                        'select id from corpus_parallel_item where item = %s', (item,))
                    item_id = mysql_cursor.fetchone()[0]
                present_items[item] = item_id

        # add new structattr value tuple
        mysql_cursor.execute(
            'insert into corpus_structattr_value_tuple (corpus_name, poscount, wordcount, item_id) values (%s, %s, %s, %s)',
            (corpus_name, poscount, wordcount, item_id))
        value_tuple_id = mysql_cursor.lastrowid

        for key in row.keys():
            if key not in ('id', 'corpus_id', 'poscount', 'wordcount', 'item_id'):
                struct, attr = key.split('_', 1)
                # insert structures and structattrs if needed
                if key not in present_corpus_struct_attrs[corpus_name]:
                    if struct not in present_corpus_struct_attrs[corpus_name]:
                        mysql_cursor.execute(
                            'insert ignore into corpus_structure (corpus_name, name) values (%s, %s)',
                            (corpus_name, struct))
                        present_corpus_struct_attrs[corpus_name].add(struct)
                    mysql_cursor.execute(
                        'insert ignore into corpus_structattr (corpus_name, structure_name, name) values (%s, %s, %s)',
                        (corpus_name, struct, attr))
                    present_corpus_struct_attrs[corpus_name].add(key)

                # insert structattr values if needed
                value = row[key]
                value_index = (corpus_name, struct, attr, value)
                try:
                    value_id = present_values[value_index]
                except KeyError:
                    mysql_cursor.execute(
                        'insert ignore into corpus_structattr_value (corpus_name, structure_name, structattr_name, value) values (%s, %s, %s, %s)',
                        value_index)
                    present_values[value_index] = mysql_cursor.lastrowid
                    value_id = mysql_cursor.lastrowid

                foreign_connections.append((value_tuple_id, value_id))

        if i % batch == 0:
            # add mapping of value tuple onto its structattr values
            mysql_cursor.executemany(
                'insert ignore into corpus_structattr_value_mapping (value_tuple_id, value_id) values (%s, %s)',
                foreign_connections)
            foreign_connections = []

            print(f'Row {i}/{row_count} imported')

    if foreign_connections:
        # add mapping of value tuple onto its structattr values
        mysql_cursor.executemany(
            'insert ignore into corpus_structattr_value_mapping (value_tuple_id, value_id) values (%s, %s)',
            foreign_connections)

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
    parser.add_argument('--batch', type=int, default=1000)
    parser.add_argument('--corpus-id', type=str, default=None)
    args = parser.parse_args()

    sqlite_client = sqlite3.connect(args.sqlite_path)
    sqlite_client.row_factory = sqlite3.Row
    mysql_client = mysql.connector.connect(
        host=args.mysql_host, port=args.mysql_port, user=args.mysql_user, password=args.mysql_pwd, database=args.mysql_db)

    try:
        import_data(sqlite_client, mysql_client, args.batch, args.corpus_id)
        print('Data imported')
    except Exception as ex:
        print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
        sys.exit(1)

    sqlite_client.close()
    mysql_client.close()
