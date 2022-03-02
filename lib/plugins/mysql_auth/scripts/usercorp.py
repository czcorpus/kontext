# Copyright (c) 2019 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2019 Tomas Machalek <tomas.machalek@gmail.com>
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

import os
import sys
import argparse
import re
from typing import Union, Tuple

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../..')))
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../../scripts')))
import autoconf
from action.plugin import initializer
import plugins
initializer.init_plugin('integration_db')
initializer.init_plugin('auth')


def add_corpora(user_id, corpora):
    with plugins.runtime.AUTH as auth:
        cursor = auth.db.cursor()
        for corp in corpora:
            try:
                cursor.execute(
                    'INSERT INTO kontext_user_access (user_id, corpus_name, limited) '
                    'VALUES (%s, %s, 0)', (user_id, corp))
            except Exception as ex:
                print(ex)


def remove_corpora(user_id, corpora):
    with plugins.runtime.AUTH as auth:
        cursor = auth.db.cursor()
        for corp in corpora:
            try:
                cursor.execute(
                    'DELETE FROM kontext_user_access '
                    'WHERE user_id = %s AND corpus_name %s', (user_id, corp))
            except Exception as ex:
                print(ex)


def remove_all_corpora(user_id):
    with plugins.runtime.AUTH as auth:
        cursor = auth.db.cursor()
        try:
            cursor.execute(
                'DELETE FROM kontext_user_access '
                'WHERE user_id = %s', (user_id,))
        except Exception as ex:
            print(ex)


def list_corpora(user_id, username):
    print()
    print(f'User {username} (ID={user_id}):')
    with plugins.runtime.AUTH as auth:
        cursor = auth.db.cursor()
        try:
            cursor.execute(
                'SELECT corpus_name FROM kontext_user_access WHERE user_id = %s', (user_id,))
            print('  individual access to:\n    {}'.format(', '.join(row['corpus_name'] for row in cursor.fetchall())))

            cursor.execute(
                'SELECT corpus_name FROM kontext_group_access kga '
                'JOIN kontext_user AS ku ON ku.group_access = kga.group_access '
                'WHERE ku.id = %s', (user_id,)
            )
            print('  group access to:\n    {}'.format(', '.join(row['corpus_name'] for row in cursor.fetchall())))
        except Exception as ex:
            print(ex)


def find_user(user_ident: Union[int, str]) -> Tuple[Union[int, None], Union[str, None]]:
    with plugins.runtime.AUTH as auth:
        cursor = auth.db.cursor()
        if type(user_ident) is int:
            cursor.execute('SELECT id, username FROM kontext_user WHERE id = %s', (user_ident,))
        else:
            cursor.execute('SELECT id, username FROM kontext_user WHERE username = %s', (user_ident,))
        row = cursor.fetchone()
        if row:
            return row['id'], row['username']
        return None, None


def import_corplist(s):
    return [x.strip() for x in re.split(r'\s*,\s*', s)]


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Add/remove/list access to corpora for a user')
    parser.add_argument('user_ident', metavar='USER_IDENT', type=str, help='User ID or username')
    parser.add_argument('action', metavar='ACTION', type=str,
                        help='Possible actions: add, remove, remove_all, list')
    parser.add_argument('corpora', metavar='CORPORA', type=str, nargs='?',
                        help='Comma-separated list of values (avoid spaces or use quotes)')
    args = parser.parse_args()

    user_id, username = find_user(args.user_ident)
    if user_id is None:
        print(('user [{0}] not found'.format(args.user_ident)))
        sys.exit(1)

    if args.action == 'add':
        add_corpora(user_id, import_corplist(args.corpora))
    elif args.action == 'remove':
        remove_corpora(user_id, import_corplist(args.corpora))
    elif args.action == 'remove_all':
        remove_all_corpora(user_id)
    elif args.action == 'list':
        list_corpora(user_id, username)
    else:
        print(('Unknown action {0}'.format(args.action)))
        sys.exit(1)
