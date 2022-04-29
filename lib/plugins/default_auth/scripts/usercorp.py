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

import argparse
import asyncio
import os
import re
import sys

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../..')))
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../../scripts')))
import autoconf
import plugins
from action.plugin import initializer
from plugins.default_auth import (DefaultAuthHandler, get_user_id_from_key,
                                  mk_list_key, mk_user_key)

initializer.init_plugin('db')


async def get_user_key(user_id):
    with plugins.runtime.DB as db:
        try:
            user_id = int(user_id)
            return mk_user_key(user_id)
        except ValueError:
            user_key = await db.hash_get(DefaultAuthHandler.USER_INDEX_KEY, user_id)
            if user_key is None:
                return None
            return user_key if await db.get(user_key) is not None else None


async def add_corpora(user_id, corpora):
    with plugins.runtime.DB as db:
        curr_list = await db.get(mk_list_key(user_id))
        for corp in corpora:
            if corp not in curr_list:
                curr_list.append(corp)
            else:
                print(('Corpus {0} already present, skipping.'.format(corp)))
        await db.set(mk_list_key(user_id), curr_list)


async def remove_corpora(user_id, corpora):
    with plugins.runtime.DB as db:
        curr_list = await db.get(mk_list_key(user_id))
        print(('Current corpora for the user:\n\t{0}'.format(', '.join(curr_list))))
        new_list = []
        for corp in curr_list:
            if corp not in corpora:
                new_list.append(corp)
        await db.set(mk_list_key(user_id), new_list)
        print(('New corpora for the user:\n\t{0}'.format(', '.join(new_list))))


async def remove_all_corpora(user_id):
    with plugins.runtime.DB as db:
        curr_items = await db.get(mk_list_key(user_id))
        await db.set(mk_list_key(user_id), [])
        print('Removed access to any corpus for the user.')
        print(('Removed values:\n\t{0}'.format(', '.join(curr_items))))


async def list_corpora(user_id):
    with plugins.runtime.DB as db:
        items = await db.get(mk_list_key(user_id))
        print(('Current corpora for the user:\n\t{0}'.format(', '.join(items))))


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

    user_key = asyncio.run(get_user_key(args.user_ident))
    if user_key is None:
        print(('user [{0}] not found'.format(args.user_ident)))
        sys.exit(1)

    user_id = get_user_id_from_key(user_key)
    if args.action == 'add':
        asyncio.run(add_corpora(user_id, import_corplist(args.corpora)))
    elif args.action == 'remove':
        asyncio.run(remove_corpora(user_id, import_corplist(args.corpora)))
    elif args.action == 'remove_all':
        asyncio.run(remove_all_corpora(user_id))
    elif args.action == 'list':
        asyncio.run(list_corpora(user_id))
    else:
        print(('Unknown action {0}'.format(args.action)))
        sys.exit(1)
