# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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


import argparse
import sys

import mysql.connector


def order_favitems(mysql_db: mysql.connector.MySQLConnection, dry_run: bool):
    cursor = mysql_db.cursor()
    cursor.execute("SELECT name, corpus_name FROM registry_conf")
    corpus_translate = {row[0]: row[1] for row in cursor}

    cursor.execute(
        "SELECT id, name "
        "FROM kontext_user_fav_item "
        "WHERE name LIKE '% || %'",
    )
    orders = []
    for row in cursor:
        try:
            orders.extend([
                (i, row[0], corpus_translate[name])
                for i, name in enumerate(row[1].split(' || '))
            ])
        except KeyError as e:
            print(f'Skipping entry with missing registry item: {e}')

    if dry_run:
        print('Ordered items:')
        print(orders)

    else:
        for order_item in orders:
            try:
                cursor.execute(
                    "UPDATE kontext_corpus_user_fav_item "
                    "SET corpus_order = %s "
                    "WHERE user_fav_corpus_id = %s AND corpus_name = %s",
                    order_item,
                )
            except Exception as ex:
                print('Failed to update items {}: {}'.format(order_item, ex))
        mysql_db.commit()

    cursor.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Order fav items aligned corpora')
    parser.add_argument('--mysql-host', type=str, default='localhost')
    parser.add_argument('--mysql-port', type=int, default=3306)
    parser.add_argument('--mysql-db', type=str, default='kontext')
    parser.add_argument('--mysql-user', type=str, default='kontext')
    parser.add_argument('--mysql-pwd', type=str, default='kontext-secret')
    parser.add_argument('--dry-run', action='store_true',
                        default=False, help='Only print changes')
    args = parser.parse_args()

    mysql_client = mysql.connector.connect(
        host=args.mysql_host, port=args.mysql_port, user=args.mysql_user, password=args.mysql_pwd, database=args.mysql_db)

    try:
        order_favitems(mysql_client, args.dry_run)
        if not args.dry_run:
            print('Fav items ordered')
    except Exception as ex:
        print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
        sys.exit(1)

    mysql_client.close()
