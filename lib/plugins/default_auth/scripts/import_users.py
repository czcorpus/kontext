# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
import sys
import os
import argparse
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..'))
from plugin_types.auth.hash import mk_pwd_hash_default


def import_user_redis(data):
    import redis
    db = redis.StrictRedis(host=db_conf['host'],
                           port=db_conf['port'], db=db_conf['id'])
    data['pwd_hash'] = mk_pwd_hash_default(data['pwd']) if data['pwd'] else None
    del data['pwd']
    db.set('corplist:user:{0}'.format(data['id']), json.dumps(data.get('permitted_corpora', [])))
    del data['permitted_corpora']
    db.set('user:{0}'.format(data['id']), json.dumps(data))
    db.hset('user_index', data['username'], json.dumps('user:{0}'.format(data['id'])))
    print(('Installed user {}'.format(data['username'])))


def import_user_sqlite3(data):
    import sqlite3
    db = sqlite3.connect(db_conf['db_path'])
    cursor = db.cursor()
    cursor.execute('BEGIN')
    data['pwd_hash'] = mk_pwd_hash_default(data['pwd']) if data['pwd'] else None
    del data['pwd']
    cursor.execute('INSERT INTO data (key, value, expires) VALUES (?, ?, -1)', ('corplist:user:{0}'.format(data['id']),
                                                                                json.dumps(data.get('permitted_corpora', []))))
    del data['permitted_corpora']
    cursor.execute('INSERT INTO data (key, value, expires) VALUES (?, ?, -1)', ('user:{0}'.format(data['id']),
                                                                                json.dumps(data)))
    cursor.execute('SELECT value FROM data WHERE key = ?', ('user_index',))
    tmp = cursor.fetchone()
    if not tmp:
        uindex = {}
    else:
        uindex = json.loads(tmp[0])
    uindex[data['username']] = 'user:{0}'.format(data['id'])

    cursor.execute('INSERT OR REPLACE INTO data (key, value, expires) VALUES (?, ?, -1)',
                   ('user_index', json.dumps(uindex)))
    cursor.execute('COMMIT')
    print(('Installed user {}'.format(data['username'])))


if __name__ == '__main__':
    argparser = argparse.ArgumentParser(description="default_auth - initial data import")
    argparser.add_argument('file', metavar="FILE",
                           help="a JSON file containing a list of users to be imported")
    args = argparser.parse_args()

    sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../../lib')))
    import settings
    conf_path = os.path.realpath(os.path.join(
        os.path.dirname(__file__), '../../../../conf/config.xml'))
    settings.load(conf_path)
    db_conf = settings.get('plugins', 'db')

    with open(args.file, 'rb') as fr:
        for user in json.load(fr):
            if db_conf['module'] == 'redis_db':
                import_user_redis(user)
            elif db_conf['module'] == 'sqlite3_db':
                import_user_sqlite3(user)
            else:
                print(
                    'Sorry, the script currently supports only Redis or Sqlite3 db backends. '
                    'To import users into a MySQL/Mariadb instance, please refer to the mysql_auth plugin scripts')
                sys.exit(1)
