# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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
A simple implementation of query_persistence plug-in based on KeyValueStorage
as a back-end.

required config.xml entries: please see config.rng
"""

import hashlib
import logging
import os
import re
import sqlite3
import time
import uuid
from typing import Union

import plugins
import ujson as json
from action.errors import ForbiddenException, UserReadableException
from plugin_types.auth import AbstractAuth
from plugin_types.general_storage import KeyValueStorage
from plugin_types.query_persistence import AbstractQueryPersistence
from plugin_types.query_persistence.common import (
    ID_KEY, PERSIST_LEVEL_KEY, QUERY_KEY, USER_ID_KEY, generate_idempotent_id)
from plugins import inject
from util import int2chash

DEFAULT_TTL_DAYS = 100

DEFAULT_ANONYMOUS_USER_TTL_DAYS = 7


def id_exists(id):
    """
    Tests whether passed id exists
    """
    # currently we assume that id (= prefix of md5 hash with 52^12 possible values)
    #  conflicts are very unlikely
    return False


def mk_short_id(s, min_length):
    """
    Generates a hash based on md5 but using [a-zA-Z0-9] characters and with
    limited length.

    arguments:ucnk_op_persistence
    s -- a string to be hashed
    min_length -- minimum length of the output hash
    """
    x = int(hashlib.md5(s).hexdigest(), 16)
    return int2chash(x, min_length)


class Sqlite3ArchBackend(object):
    """
    A recommended backend for storing persistent concordances.
    It is activated automatically once admin defines a path
    to a directory where the database should be stored.
    """

    def __init__(self, archive_dir):
        self._archive_path = os.path.join(archive_dir, 'conc_archive.db')
        self._db = None

    @property
    def archive_db(self):
        if self._db is None:
            self._db = self._init_archive()
        return self._db

    def _init_archive(self):
        if not os.path.exists(self._archive_path):
            logging.getLogger(__name__).warning(
                'Query persistence archive database does not exist - creating one at {0}'.format(self._archive_path))
            conn = sqlite3.connect(self._archive_path)
            c = conn.cursor()
            c.execute('CREATE TABLE conc_archive ('
                      'id text, '
                      'data text NOT NULL, '
                      'created integer NOT NULL, '
                      'num_access integer NOT NULL DEFAULT 0, '
                      'last_access integer, '
                      'PRIMARY KEY (id)'
                      ')')
            conn.commit()
        else:
            conn = sqlite3.connect(self._archive_path)
        return conn

    async def archive(self, data, db_key):
        save_time = int(round(time.time()))
        cursor = self.archive_db.cursor()
        cursor.execute('INSERT OR IGNORE INTO conc_archive (id, data, created, num_access) VALUES (?, ?, ?, ?)',
                       (db_key, json.dumps(data), save_time, 0))
        self.archive_db.commit()

    async def revoke(self, db_key):
        cursor = self.archive_db.cursor()
        cursor.execute('DELETE FROM conc_archive WHERE id = ?', (db_key,))
        self.archive_db.commit()

    async def load(self, db_key):
        cursor = self.archive_db.cursor()
        cursor.execute('SELECT data FROM conc_archive WHERE id = ?', (db_key,))
        raw_ans = cursor.fetchone()
        if raw_ans is not None:
            return json.loads(raw_ans[0])
        return None

    async def is_archived(self, db_key):
        cursor = self.archive_db.cursor()
        cursor.execute('SELECT id FROM conc_archive WHERE id = ?', (db_key,))
        return cursor.fetchone() is not None


class DbPluginArchBackend(object):
    """
    This is an alternative backend for storing persistent concordances.
    Because it uses DB plug-in which may run on Redis (= in RAM db), this
    is not recommended for long term installations with many users as
    the archive will slowly eat the RAM. But if you want to use sqlite3_db
    then this is not an issue.
    """

    def __init__(self, db: KeyValueStorage, ttl: int, anonymous_ttl: int):
        self._db = db
        self._ttl = ttl
        self._anonymous_ttl = anonymous_ttl

    async def archive(self, data, db_key):
        await self._db.clear_ttl(db_key)

    async def revoke(self, db_key):
        await self._db.set_ttl(db_key, self._ttl)

    async def load(self, db_key):
        return None  # can't help here as normal load searches in the very same db

    async def is_archived(self, db_key):
        return (await self._db.get_ttl(db_key)) == -1


class DefaultQueryPersistence(AbstractQueryPersistence):
    """
    This class stores user's queries in their internal form (see Kontext.q attribute).
    """

    def __init__(self, db: KeyValueStorage, auth: AbstractAuth, ttl_days: int, anonymous_ttl_days: int, archive_backend: Union[DbPluginArchBackend, Sqlite3ArchBackend]):
        self._db = db
        self._auth = auth
        self._ttl_days = ttl_days
        self._anonymous_user_ttl_days = anonymous_ttl_days
        self._archive_backend = archive_backend

    def _get_persist_level_for(self, user_id):
        if self._auth.is_anonymous(user_id):
            return 0
        else:
            return 1

    @property
    def ttl(self):
        return self._ttl_days * 24 * 3600

    @property
    def anonymous_user_ttl(self):
        return self._anonymous_user_ttl_days * 24 * 3600

    @staticmethod
    def _mk_key(code):
        return 'concordance:%s' % (code, )

    def _get_ttl_for(self, user_id):
        if self._auth.is_anonymous(user_id):
            return self.anonymous_user_ttl
        return self.ttl

    def is_valid_id(self, data_id):
        """
        Returns True if data_id is a valid data identifier else False is returned

        arguments:
        data_id -- identifier to be tested
        """
        return bool(re.match(r'~[0-9a-zA-Z]+', data_id))

    def get_conc_ttl_days(self, user_id):
        if self._auth.is_anonymous(user_id):
            return self._anonymous_user_ttl_days
        return self._ttl_days

    async def open(self, data_id):
        """
        Loads operation data according to the passed data_id argument.
        The data are assumed to be public (as are URL parameters of a query).

        arguments:
        data_id -- an unique ID of operation data

        returns:
        a dictionary containing operation data or None if nothing is found
        """
        key = self._mk_key(data_id)
        ans = await self._db.get(key)
        if ans is None:
            ans = await self._archive_backend.load(key)
        return ans

    async def store(self, user_id, curr_data, prev_data=None):
        """
        Stores current operation (defined in curr_data) into the database. If also prev_date argument is
        provided then a comparison is performed and based on the result, new record is created and new
        ID is returned on nothing is done and current ID is returned.

        arguments:
        user_id -- database ID of the current user
        curr_data -- a dictionary containing operation data to be stored; currently at least 'q' entry must be present
        prev_data -- optional dictionary with previous operation data; again, 'q' entry must be there

        returns:
        1) new operation ID if a new record is created,
        2) current ID if no new operation is defined but there is a previous operation defined
        3) None if neither previous nor new operation is defined
        """
        def records_differ(r1, r2):
            return r1[QUERY_KEY] != r2[QUERY_KEY] or r1.get('lines_groups') != r2.get('lines_groups')

        if prev_data is None or records_differ(curr_data, prev_data):
            if prev_data is not None:
                curr_data['prev_id'] = prev_data[ID_KEY]
            data_id = generate_idempotent_id(curr_data)
            curr_data[ID_KEY] = data_id
            curr_data[PERSIST_LEVEL_KEY] = self._get_persist_level_for(user_id)
            curr_data[USER_ID_KEY] = user_id
            data_key = self._mk_key(data_id)
            await self._db.set(data_key, curr_data)
            await self._db.set_ttl(data_key, self._get_ttl_for(user_id))
            latest_id = curr_data[ID_KEY]
        else:
            latest_id = prev_data[ID_KEY]
        return latest_id

    async def archive(self, user_id, conc_id, revoke=False):
        key = self._mk_key(conc_id)
        data = await self.open(conc_id)
        if data is None:
            raise UserReadableException('Concordance key \'%s\' not found.' % (conc_id,))
        stored_user_id = data.get('user_id', None)
        if user_id != stored_user_id:
            raise ForbiddenException(
                'Cannot change status of a concordance belonging to another user')

        if revoke:
            await self._db.set(key, data)
            await self._archive_backend.revoke(key)
        else:
            await self._archive_backend.archive(data, key)

        return 1, data

    async def is_archived(self, conc_id):
        return await self._archive_backend.is_archived(self._mk_key(conc_id))

    async def will_be_archived(self, plugin_ctx, conc_id: str):
        return not self.is_archived(conc_id)\
            and self._settings.get('plugins', 'query_persistence').get('implicit_archiving', None) in ('true', '1', 1)\
            and not self._auth.is_anonymous(plugin_ctx.user_id)


@inject(plugins.runtime.DB, plugins.runtime.AUTH)
def create_instance(settings, db, auth):
    """
    Creates a plugin instance.
    """
    plugin_conf = settings.get('plugins', 'query_persistence')
    archive_dir = plugin_conf.get('archive_dir', None)
    ttl_days = int(plugin_conf.get('ttl_days', DEFAULT_TTL_DAYS))
    anonymous_ttl_days = int(plugin_conf.get('ttl_days', DEFAULT_ANONYMOUS_USER_TTL_DAYS))

    if archive_dir:
        backend = Sqlite3ArchBackend(archive_dir=archive_dir)
    else:
        logging.getLogger(__name__).warning('Using DB plug-in as archiving storage for concordances. '
                                            'In case you use redis_db then please consider setting archive_dir '
                                            'for default_conc_persistence to prevent filling up RAM with archived '
                                            'concordances.')
        backend = DbPluginArchBackend(db=db, ttl=ttl_days * 24 * 3600,
                                      anonymous_ttl=anonymous_ttl_days * 24 * 3600)

    return DefaultQueryPersistence(db=db, auth=auth,
                                   ttl_days=ttl_days,
                                   anonymous_ttl_days=anonymous_ttl_days,
                                   archive_backend=backend)
