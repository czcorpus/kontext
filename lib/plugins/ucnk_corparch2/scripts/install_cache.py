import os
import sys
import argparse
import mysql.connector
import mysql.connector.errors

sys.path.insert(0, '/opt/manatee/2.158.8/lib/python2.7/site-packages/')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from plugins.ucnk_remote_auth4.backend.mysql import MySQL, MySQLConf


def clear_cache(db, user_id):
    cur = db.cursor()
    cur.execute('DELETE FROM kontext_corpus_user WHERE user_id = %s', (user_id,))


def user_add_permissions(db, user_id):
    cur = db.cursor()
    cur.callproc('user_corpus_proc', (user_id,))
    for result in cur.stored_results():
        rows = result.fetchall()
        print(('\t {0} permissions'.format(len(rows))))
        for row in rows:
            # print(row)
            try:
                cur.execute(
                    'INSERT INTO kontext_corpus_user (user_id, corpus_name, variant) VALUES (%s, %s, %s)',
                    (user_id, row[3].split('/')[-1], 'omezeni' if row[2] else None))
            except mysql.connector.errors.IntegrityError:
                pass  # we deliberately ignore this


def update_cache(db, offset, limit):
    cur = db.cursor()
    cur.execute('SELECT id FROM user ORDER BY ID LIMIT %s OFFSET %s', (limit, offset,))
    rows = cur.fetchall()
    for row in rows:
        print(('adding permissions for user {0}'.format(row['id'])))
        clear_cache(db, row['id'])
        user_add_permissions(db, row['id'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Import N records starting from offset')
    parser.add_argument('conf_path', metavar='CONFPATH', type=str)
    parser.add_argument('data_offset', metavar='DATA_OFFSET', type=int)
    parser.add_argument('data_limit', metavar='DATA_LIMIT', type=int)
    args = parser.parse_args()
    import settings
    settings.load(args.conf_path)
    db = MySQL(MySQLConf(settings))
    update_cache(db, args.data_offset, args.data_limit)
    db.commit()
