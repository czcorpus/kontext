# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2026 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
SQLite variant of the subcorpora migration script.
This version is compatible with the default_subc_storage plugin which uses SQLite.
"""

import json
from json.decoder import JSONDecodeError
import os
import os.path
import shutil
import sqlite3
import sys
from typing import Tuple

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../lib')))

import argparse
import datetime

import settings
from corplib.abstract import SubcorpusIdent
from util import int2chash
import hashlib

UNIQ_K = '805a02b7-1676-4a79-9da7-73b293763a2a-clarin-si'
"""
we will add this value to import paths so we decrease a chance of collision
between imported values (based on this const and orig. path) and the
new ones (based on uuid)
"""

def ensure_subc_dir(subc_root: str, subc_ident: SubcorpusIdent):
    full_dir_path = os.path.join(subc_root, subc_ident.data_dir)
    if not os.path.isdir(full_dir_path):
        os.makedirs(full_dir_path)


def get_user_fullname(user_id: int, db_conn: sqlite3.Connection) -> str:
    """
    Attempt to get user fullname from the database.
    Returns a default value if user not found.
    """
    try:
        cursor = db_conn.cursor()
        # Try to get fullname from user table if it exists
        cursor.execute('SELECT firstname, lastname FROM kontext_user WHERE id = ?', (user_id,))
        row = cursor.fetchone()
        cursor.close()
        if row and row[0] and row[1]:
            return f'{row[0]} {row[1]}'
        elif row and row[0]:
            return row[0]
    except sqlite3.OperationalError:
        # Table might not exist or have different schema
        pass
    return f'User {user_id}'


def create_permanent_subc_id(subc_root: str, subc_path: str, corpus_name: str) -> SubcorpusIdent:
    ans = SubcorpusIdent(
        id=int2chash(int(hashlib.sha1(f'{UNIQ_K}#{subc_path}'.encode()).hexdigest(), 16), 8),
        corpus_name=corpus_name)
    full_dir_path = os.path.join(subc_root, ans.data_dir)
    if not os.path.isdir(full_dir_path):
        os.makedirs(full_dir_path)
    return ans


def migrate_subcorpora(
        users_subcpath: str, subcorpora_dir: str, db_path: str, default_user_id: int) -> Tuple[int, int]:
    """
    Migrate subcorpora to SQLite database format compatible with default_subc_storage plugin.

    Args:
        users_subcpath: Path to old subcorpora directory
        subcorpora_dir: Path to new subcorpora directory
        db_path: Path to SQLite database file
        default_user_id: ID used for unknown user/author

    Returns:
        Tuple of (total_count, published_count)
    """
    total_count, published_count = 0, 0
    published_hashes = []

    # Create/open SQLite database
    db_exists = os.path.isfile(db_path)
    db_conn = sqlite3.connect(db_path)
    db_conn.row_factory = sqlite3.Row

    # Create table if it doesn't exist (matching default_subc_storage schema)
    if not db_exists:
        db_conn.execute('''
            CREATE TABLE subcorpora (
                id VARCHAR(32) PRIMARY KEY,
                name VARCHAR(127) NOT NULL,
                is_draft INTEGER NOT NULL DEFAULT 0,
                user_id INTEGER,
                author_id INTEGER NOT NULL,
                author_fullname VARCHAR(127) NOT NULL,
                corpus_name VARCHAR(63) NOT NULL,
                aligned TEXT,
                size INTEGER NOT NULL,
                cql TEXT,
                within_cond TEXT,
                text_types TEXT,
                created REAL NOT NULL DEFAULT CURRENT_TIMESTAMP,
                archived REAL NULL,
                public_description TEXT,
                version INTEGER NOT NULL DEFAULT 3
            )
        ''')
        db_conn.commit()
        print('Created new subcorpora table in SQLite database')

    cursor = db_conn.cursor()

    try:
        # Process user subcorpora
        for user_id in os.listdir(users_subcpath):
            if user_id == 'published':
                continue

            user_path = os.path.join(users_subcpath, user_id)
            if not os.path.isdir(user_path):
                print(f'Skipping non-directory entry: {user_path}')
                continue

            for corpname in os.listdir(user_path):
                corp_path = os.path.join(user_path, corpname)
                if not os.path.isdir(corp_path):
                    continue

                subcorpora = [file.rsplit('.', 1)[0]
                              for file in os.listdir(corp_path) if file.endswith('.subc')]

                for subcname in subcorpora:
                    subc_path = os.path.join(corp_path, f'{subcname}.subc')
                    author_id = user_id
                    created = datetime.datetime.fromtimestamp(os.path.getctime(subc_path))
                    public_description = None
                    author_fullname = get_user_fullname(int(author_id), db_conn)

                    # Check if this is a published subcorpus
                    pubfile_path = os.path.join(corp_path, f'{subcname}.pub')
                    if os.path.islink(pubfile_path):
                        link = os.path.join(corp_path, os.path.relpath(
                            os.readlink(pubfile_path)))
                        if not os.path.exists(link):
                            print(f'linked file {link} does not exist - skipping')
                            continue

                        p_hash = os.path.basename(link).split('.')[0]
                        metainfo_path = link.replace('.subc', '.name')

                        # for public corpora determine author_id, default set to default_user_id
                        if os.path.isfile(metainfo_path):
                            with open(metainfo_path) as f:
                                try:
                                    metadata = json.loads(f.readline())
                                    f.readline()
                                except JSONDecodeError:
                                    print('failed to find and decode JSON metadata')
                                    metadata = {'author_id': default_user_id}

                                public_description = f.read()

                            author_id = metadata.get('author_id', default_user_id)
                            if author_id is None:
                                author_id = default_user_id
                            author_fullname = metadata.get('author_name', get_user_fullname(int(author_id), db_conn))
                        else:
                            author_id = default_user_id
                            author_fullname = get_user_fullname(int(author_id), db_conn)

                        published_count += 1
                        published_hashes.append(p_hash)
                        subc_id = SubcorpusIdent(p_hash, corpname)
                    else:
                        subc_id = create_permanent_subc_id(subcorpora_dir, subc_path, corpname)

                    try:
                        cursor.execute(
                            'INSERT INTO subcorpora (id, name, user_id, author_id, author_fullname, corpus_name, '
                            'size, cql, within_cond, text_types, created, archived, public_description, is_draft, aligned, version) '
                            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            (subc_id.id, subcname, int(user_id), int(author_id), author_fullname, corpname,
                             0, None, None, None, created.timestamp(), None, public_description, 0, '', 3)
                        )
                    except sqlite3.IntegrityError as ex:
                        print(f'failed to insert subcorpus [{subcname}] for user {user_id}, author: {author_id}: {ex}')
                        # Try to check if user exists by looking for other subcorpora
                        cursor.execute('SELECT COUNT(*) as cnt FROM subcorpora WHERE user_id = ?', (int(user_id),))
                        row = cursor.fetchone()
                        if row['cnt'] == 0:
                            print(f'no other subcorpora for user {user_id} ... going to insert using backup user ID {default_user_id}')
                            default_fullname = get_user_fullname(default_user_id, db_conn)
                            cursor.execute(
                                'INSERT INTO subcorpora (id, name, user_id, author_id, author_fullname, corpus_name, '
                                'size, cql, within_cond, text_types, created, archived, public_description, is_draft, aligned, version) '
                                'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                                (subc_id.id, subcname, int(default_user_id), int(default_user_id), default_fullname, corpname,
                                 0, None, None, None, created.timestamp(), None, public_description, 0, '', 3)
                            )
                        else:
                            # Duplicate ID, skip this entry
                            print(f'Skipping duplicate subcorpus ID: {subc_id.id}')
                            continue

                    ensure_subc_dir(subcorpora_dir, subc_id)
                    shutil.copy2(subc_path, os.path.join(subcorpora_dir, subc_id.data_path))
                    total_count += 1

        # Process published-only subcorpora
        published_dir = os.path.join(users_subcpath, 'published')
        if os.path.isdir(published_dir):
            for corpname in os.listdir(published_dir):
                corp_pub_path = os.path.join(published_dir, corpname)
                if not os.path.isdir(corp_pub_path):
                    continue

                p_hashes = [h.split('.')[0] for h in os.listdir(corp_pub_path) if h.endswith('.name')]

                for p_hash in p_hashes:
                    if p_hash in published_hashes:
                        continue

                    metadata_path = os.path.join(corp_pub_path, f'{p_hash}.name')
                    with open(metadata_path) as f:
                        line = f.readline()
                        if not line:
                            continue
                        try:
                            metadata = json.loads(line)
                        except JSONDecodeError:
                            print('failed to decode JSON subc. metadata - will use default values')
                            metadata = {'author_id': default_user_id, 'author_name': 'unknown'}
                        f.readline()
                        public_description = f.read()

                    subc_path = os.path.join(corp_pub_path, f'{p_hash}.subc')
                    if not os.path.isfile(subc_path):
                        print(f'Subcorpus file not found: {subc_path}, skipping')
                        continue

                    subc_id = SubcorpusIdent(p_hash, corpname)
                    created = datetime.datetime.fromtimestamp(os.path.getctime(subc_path))
                    user_id = default_user_id
                    author_id = metadata.get('author_id', default_user_id)
                    if author_id is None:
                        author_id = default_user_id

                    # Extract subcorpus name from metadata or use hash as fallback
                    subcname = metadata.get('name', p_hash)
                    author_fullname = metadata.get('author_name', get_user_fullname(int(author_id), db_conn))

                    try:
                        cursor.execute(
                            'INSERT INTO subcorpora (id, name, user_id, author_id, author_fullname, corpus_name, '
                            'size, cql, within_cond, text_types, created, archived, public_description, is_draft, aligned, version) '
                            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            (subc_id.id, subcname, int(user_id), int(author_id), author_fullname, corpname,
                             0, None, None, None, created.timestamp(), None, public_description, 0, '', 3)
                        )
                    except sqlite3.IntegrityError as ex:
                        print(f'failed to insert published-only subcorpus [{subcname}] for user {user_id}, author: {author_id}: {ex}')
                        continue

                    ensure_subc_dir(subcorpora_dir, subc_id)
                    shutil.copy2(subc_path, os.path.join(subcorpora_dir, subc_id.data_path))
                    total_count += 1
                    published_count += 1

        db_conn.commit()

    finally:
        cursor.close()
        db_conn.close()

    return total_count, published_count


if __name__ == "__main__":
    conf_path = os.path.realpath(os.path.join(os.path.dirname(
        __file__), '..', '..', '..', 'conf', 'config.xml'))

    parser = argparse.ArgumentParser(description='Migrate subcorpora to SQLite (default_subc_storage plugin)')
    parser.add_argument('--config-path', type=str, help='Path to config file', default=conf_path)
    parser.add_argument(
        '--users-subcpath', type=str,
        help='Path to old subcorpora dir', default=None)
    parser.add_argument(
        '--subcorpora-dir', type=str,
        help='Path to new subcorpora dir', default=None)
    parser.add_argument(
        '--db-path', type=str,
        help='Path to SQLite database file', required=True)
    parser.add_argument(
        '--backup-user-id', type=int,
        help='ID used for unknown user/author', default=1)
    args = parser.parse_args()

    # Note: We don't initialize integration_db plugin since we're using SQLite directly
    # This makes the script independent of the integration_db configuration

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

    if not os.path.exists(users_subcpath):
        print(f'Error: users_subcpath does not exist: {users_subcpath}')
        sys.exit(1)

    if not os.path.exists(subcorpora_dir):
        print(f'Creating subcorpora directory: {subcorpora_dir}')
        os.makedirs(subcorpora_dir, exist_ok=True)

    # Validate db_path directory exists
    db_dir = os.path.dirname(args.db_path)
    if db_dir and not os.path.exists(db_dir):
        print(f'Creating database directory: {db_dir}')
        os.makedirs(db_dir, exist_ok=True)

    try:
        total, published = migrate_subcorpora(
            users_subcpath, subcorpora_dir, args.db_path, args.backup_user_id)
        print(f'Imported {total} entries, {published} were published')
    except Exception as ex:
        print(f'{ex.__class__.__name__}: {ex}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
