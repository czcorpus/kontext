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
import json
import redis
import mysql.connector
import argparse


def import_sqlite_db(redis_client: redis.Redis, mysql_client: mysql.connector.MySQLConnection, dry_run: bool):
    inserted, skipped = 0, 0

    cursor = mysql_client.cursor()
    favitem_keys = redis_client.keys('favitems:user:*')
    for favitem_key in favitem_keys:
        _, _, user_id = favitem_key.decode().split(':')
        favitems = redis_client.hgetall(favitem_key)
        for favitem in map(json.loads, favitems.values()):
            values = (favitem['name'], favitem['subcorpus_id'],
                      favitem['subcorpus_orig_id'], int(user_id))

            cursor.execute(
                'SELECT count(*) as count from kontext_user_fav_item where name = %s and subcorpus_id = %s and subcorpus_orig_id = %s and user_id = %s ',
                values
            )
            if cursor.fetchone()[0] == 0:
                inserted += 1
                if not dry_run:
                    cursor.execute(
                        'INSERT INTO kontext_user_fav_item (name, subcorpus_id, subcorpus_orig_id, user_id) '
                        'VALUES (%s, %s, %s, %s)',
                        values
                    )
                    favitem_id = cursor.lastrowid
                    cursor.executemany(
                        'INSERT INTO kontext_corpus_user_fav_item (user_fav_corpus_id, corpus_name) '
                        'VALUES (%s, %s)',
                        [(favitem_id, corp['id']) for corp in favitem['corpora']]
                    )
                    mysql_client.commit()
            else:
                skipped += 1

    print(f'Found total {skipped + inserted} entries')
    print(f'    {inserted} entries will be inserted')
    print(f'    {skipped} duplicates will be skipped')

    cursor.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Import user items from redis to mysql')
    parser.add_argument('--redis-host', type=str, default='localhost')
    parser.add_argument('--redis-port', type=int, default=6379)
    parser.add_argument('--redis-db', type=int, default=1)
    parser.add_argument('--mysql-host', type=str, default='localhost')
    parser.add_argument('--mysql-port', type=int, default=3306)
    parser.add_argument('--mysql-db', type=str, default='kontext')
    parser.add_argument('--mysql-user', type=str, default='kontext')
    parser.add_argument('--mysql-pwd', type=str, default='kontext-secret')
    parser.add_argument('--dry-run', action='store_true',
                        default=False, help='Only print changes')
    args = parser.parse_args()

    redis_client = redis.Redis(host=args.redis_host, port=args.redis_port, db=args.redis_db)
    mysql_client = mysql.connector.connect(
        host=args.mysql_host, port=args.mysql_port, user=args.mysql_user, password=args.mysql_pwd, database=args.mysql_db)

    try:
        import_sqlite_db(redis_client, mysql_client, args.dry_run)
        if not args.dry_run:
            print('Data imported')
    except Exception as ex:
        print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
        sys.exit(1)

    redis_client.close()
    mysql_client.close()
