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
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'scripts'))
import autoconf
import initializer
initializer.init_plugin('integration_db')
initializer.init_plugin('auth')
import plugins
from plugin_types.auth.hash import mk_pwd_hash_default


def import_user(data):
    with plugins.runtime.AUTH as auth:
        cursor = auth.db.cursor()
        data['pwd_hash'] = mk_pwd_hash_default(data['pwd']) if data['pwd'] else None
        del data['pwd']
        try:
            cursor.execute(
                'INSERT INTO kontext_user (username, firstname, lastname, email, affiliation, pwd_hash) '
                'VALUES (%s, %s, %s, %s, %s, %s)',
                (data['username'], data['firstname'], data['lastname'], data['email'], data.get('affiliation'),
                 data['pwd_hash']))
            user_id = cursor.lastrowid
            for corp in data['permitted_corpora']:
                cursor.execute(
                    'INSERT INTO kontext_user_access (user_id, corpus_name, limited) '
                    'VALUES (%s, %s, 0)', (user_id, corp))
            auth.db.commit()
            print(('Installed user {}'.format(data['username'])))
            return 1
        except Exception as ex:
            print(ex)
            return 0


def find_anonymous_user():
    with plugins.runtime.AUTH as auth:
        cursor = auth.db.cursor()
        cursor.execute('SELECT id FROM kontext_user WHERE username = \'anonymous\'')
        row = cursor.fetchone()
        if row:
            print(
                f'The anonymous user ID is {row["id"]}. '
                'Please make sure config.xml (plugins/auth/anonymous_user_id) is configured properly.')


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
    print()
    with open(args.file, 'rb') as fr:
        total = 0
        for user in json.load(fr):
            total += import_user(user)
        print('----------------------------------')
        print(f'Finished importing {total} user(s)')
        print('----------------------------------')
        find_anonymous_user()
        print()
