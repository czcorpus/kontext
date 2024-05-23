# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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


import asyncio
import json
from json.decoder import JSONDecodeError
import os
import os.path
import shutil
import sys
from collections import defaultdict
from typing import Tuple

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../lib')))

import argparse
import datetime

import aiofiles
import plugins
import settings
from action.plugin import initializer
from corplib.abstract import SubcorpusIdent
from pymysql.err import IntegrityError
from util import int2chash
import hashlib

UNIQ_K = '6dec36fa-ae04-11ed-bc95-07f4e403ca31'
"""
we will add this value to import paths so we decrease a chance of collision 
between imported values (based on this const and orig. path) and the 
new ones (based on uuid)
"""

async def ensure_subc_dir(subc_root: str, subc_ident: SubcorpusIdent):
    full_dir_path = os.path.join(subc_root, subc_ident.data_dir)
    if not await aiofiles.os.path.isdir(full_dir_path):
        await aiofiles.os.makedirs(full_dir_path)


async def user_exists(user_id: int, users_table: str) -> bool:
    with plugins.runtime.INTEGRATION_DB as mysql_db:
        async with mysql_db.cursor() as cursor:
            await cursor.execute(f'SELECT COUNT(*) AS cnt FROM {users_table} WHERE id = %s', (user_id,))
            row = await cursor.fetchone()
            return row['cnt'] == 1

async def create_permanent_subc_id(subc_root: str, subc_path: str, corpus_name: str) -> SubcorpusIdent:
    ans = SubcorpusIdent(
        id=int2chash(int(hashlib.sha1(f'{UNIQ_K}#{subc_path}'.encode()).hexdigest(), 16), 8),
        corpus_name=corpus_name)
    full_dir_path = os.path.join(subc_root, ans.data_dir)
    if not await aiofiles.os.path.isdir(full_dir_path):
        await aiofiles.os.makedirs(full_dir_path)
    return ans

async def migrate_subcorpora(
        users_subcpath: str, subcorpora_dir: str, default_user_id: int, is_ucnk: bool) -> Tuple[int, int]:
    user_table = 'user' if is_ucnk else 'kontext_user'
    total_count, published_count = 0, 0
    published_hashes = []
    with plugins.runtime.INTEGRATION_DB as mysql_db:
        async with mysql_db.cursor() as cursor:
            for user_id in os.listdir(users_subcpath):
                if user_id == 'published':
                    continue

                user_path = os.path.join(users_subcpath, user_id)
                if not os.path.isdir(user_path):
                    print(f'Skipping non-directory entry: {user_path}')
                    continue
                for corpname in os.listdir(user_path):
                    corp_path = os.path.join(user_path, corpname)
                    subcorpora = [file.rsplit('.', 1)[0]
                                  for file in os.listdir(corp_path) if file.endswith('.subc')]
                    for subcname in subcorpora:
                        subc_path = os.path.join(corp_path, f'{subcname}.subc')
                        author_id = user_id
                        created = datetime.datetime.fromtimestamp(os.path.getctime(subc_path))
                        published = None
                        public_description = None

                        pubfile_path = os.path.join(corp_path, f'{subcname}.pub')
                        if os.path.islink(pubfile_path):
                            link = os.path.join(corp_path, os.path.relpath(
                                os.readlink(pubfile_path)))
                            if not os.path.exists(link):
                                print(f'linked file {link} does not exist - skipping')
                                continue
                            published = datetime.datetime.fromtimestamp(os.path.getctime(link))
                            p_hash = os.path.basename(link).split('.')[0]
                            metainfo_path = link.replace('.subc', '.name')

                            # for public corpora determine author_id, default set to 1
                            if os.path.isfile(metainfo_path):
                                with open(metainfo_path) as f:
                                    try:
                                        metadata = json.loads(f.readline())
                                        f.readline()
                                    except JSONDecodeError:
                                        print('failed to find and decode JSON metadata')
                                        metadata = {'author_id': default_user_id}

                                    public_description = f.read()
                                author_id = metadata['author_id']
                                if author_id is None:
                                    author_id = default_user_id
                            else:
                                author_id = default_user_id
                            published_count += 1
                            published_hashes.append(p_hash)
                            subc_id = SubcorpusIdent(p_hash, corpname)
                        else:
                            published = datetime.datetime.fromtimestamp(os.path.getctime(subc_path))
                            subc_id = await create_permanent_subc_id(subcorpora_dir, subc_path, corpname)

                        try:
                            await cursor.execute(
                                'INSERT INTO kontext_subcorpus (id, name, user_id, author_id, corpus_name, size, cql, '
                                'within_cond, text_types, created, archived, published, public_description) '
                                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                                (subc_id.id, subcname, int(user_id), int(author_id), corpname,
                                 0, None, None, None, created, None, published, public_description)
                            )
                        except IntegrityError as ex:
                            print(f'failed to insert subcorpus [{subcname}] for user {user_id}, author: {author_id}: {ex}')
                            if not await user_exists(int(user_id), user_table):
                                print(
                                    f'no such user ... going to insert using a backup user ID {default_user_id}')
                                await cursor.execute(
                                    'INSERT INTO kontext_subcorpus (id, name, user_id, author_id, corpus_name, size, cql, '
                                    'within_cond, text_types, created, archived, published, public_description) '
                                    'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                                    (subc_id.id, subcname, int(default_user_id), int(default_user_id), corpname,
                                     0, None, None, None, created, None, published, public_description)
                                )

                        await ensure_subc_dir(subcorpora_dir, subc_id)
                        shutil.copy2(subc_path, os.path.join(subcorpora_dir, subc_id.data_path))
                        total_count += 1

            published_dir = os.path.join(users_subcpath, 'published')
            if os.path.isdir(published_dir):
                for corpname in os.listdir(published_dir):
                    p_hashes = [h.split('.')[0] for h in os.listdir(
                        os.path.join(published_dir, corpname)) if h.endswith('name')]
                    for p_hash in p_hashes:
                        if p_hash in published_hashes:
                            continue

                        with open(os.path.join(published_dir, corpname, f'{p_hash}.name')) as f:
                            line = f.readline()
                            if not line:
                                continue
                            try:
                                metadata = json.loads(line)
                            except:
                                print('failed to decode JSON subc. metadata - will use default values')
                                metadata = {'author_id': default_user_id, 'author_name': 'unknown'}
                            f.readline()
                            public_description = f.read()

                        subc_path = os.path.join(published_dir, corpname, f'{p_hash}.subc')
                        if not os.path.isfile(subc_path):
                            continue

                        subc_id = SubcorpusIdent(p_hash, corpname)
                        published = datetime.datetime.fromtimestamp(os.path.getctime(subc_path))
                        created = published
                        user_id = default_user_id
                        author_id = metadata['author_id']
                        if author_id is None:
                            author_id = default_user_id

                        try:
                            await cursor.execute(
                                'INSERT INTO kontext_subcorpus (id, name, user_id, author_id, corpus_name, size, cql, '
                                'within_cond, text_types, created, archived, published, public_description) '
                                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                                (subc_id.id, subcname, int(user_id), int(author_id), corpname,
                                 0, None, None, None, created, None, published, public_description)
                            )
                        except IntegrityError as ex:
                            print(
                                f'failed to insert published-only subcorpus [{subcname}] for user {user_id}, author: {author_id}: {ex}')

                        await ensure_subc_dir(subcorpora_dir, subc_id)
                        shutil.copy2(subc_path, os.path.join(subcorpora_dir, subc_id.data_path))
                        total_count += 1
                        published_count += 1

            await cursor.connection.commit()
    return total_count, published_count


if __name__ == "__main__":
    conf_path = os.path.realpath(os.path.join(os.path.dirname(
        __file__), '..', '..', '..', 'conf', 'config.xml'))

    parser = argparse.ArgumentParser(description='Migrate subcorpora')
    parser.add_argument('--config-path', type=str, help='Path to config file', default=conf_path)
    parser.add_argument(
        '--users-subcpath', type=str,
        help='Path to old subcorpora dir', default=None)
    parser.add_argument(
        '--subcorpora-dir', type=str,
        help='Path to new subcorpora dir', default=None)
    parser.add_argument(
        '--backup-user-id', type=str,
        help='ID used for unknown user/author', default='1')
    parser.add_argument(
        '--env-ucnk', action='store_true',
        help='Set environment to UCNK (likely suitable only for the Institute of the Czech National Corpus)')
    args = parser.parse_args()

    initializer.init_plugin('integration_db')

    users_subcpath = settings.get(
        'corpora', 'users_subcpath') if args.users_subcpath is None else args.users_subcpath
    if users_subcpath is None:
        raise Exception(
            '`users_subcpath` not provided. Please provide it with parameter or config file.')

    subcorpora_dir = settings.get(
        'corpora', 'subcorpora_dir') if args.subcorpora_dir is None else args.subcorpora_dir
    if subcorpora_dir is None:
        raise Exception(
            '`subcorpora_dir` not provided. Please provide it with parameter or config file.')

    try:
        loop = asyncio.new_event_loop()
        total, published = loop.run_until_complete(
            migrate_subcorpora(users_subcpath, subcorpora_dir, args.backup_user_id, args.env_ucnk))
        print(f'Imported {total} entries, {published} were published')
    except TypeError as ex:
        print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
        sys.exit(1)
