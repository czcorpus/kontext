# Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
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
A custom implementation of conc_persistence where:

1) primary storage is in Redis with different TTL for public and registered users
2) secondary storage is a MySQL/MariaDB database.

The concordance keys are generated as idempotent (i.e. the same user with same conc arguments
produces the same conc ID).

The plug-in is able to connect either via its own configuration (see config.rng) or via
an integration_db plugin.
"""

import logging
import re
import datetime
import ujson as json
from mysql.connector.errors import IntegrityError

import plugins
from plugin_types.auth import AbstractAuth
from plugin_types.general_storage import KeyValueStorage
from plugin_types.query_persistence import AbstractQueryPersistence
from plugin_types.query_persistence.common import (
    ID_KEY, PERSIST_LEVEL_KEY, QUERY_KEY, USER_ID_KEY, generate_idempotent_id)
from plugins import inject
from plugins.common.mysql import MySQLConf
from plugins.common.mysql.adhocdb import AdhocDB
from plugins.common.sqldb import DatabaseAdapter
from plugins.mysql_integration_db import MySqlIntegrationDb
from plugin_types.query_persistence.error import QueryPersistenceRecNotFound


def mk_key(code):
    return 'concordance:%s' % (code, )


class MySqlQueryPersistence(AbstractQueryPersistence):
    """
    This class stores user's queries in their internal form (see Kontext.q attribute).
    """

    DEFAULT_TTL_DAYS = 14

    DEFAULT_ARCH_NON_PERMANENT_MAX_AGE_DAYS = 720

    def __init__(
            self,
            settings,
            db: KeyValueStorage,
            sql_backend: DatabaseAdapter,
            auth: AbstractAuth):
        super().__init__(settings)
        plugin_conf = settings.get('plugins', 'query_persistence')
        self._ttl_days = int(plugin_conf.get('ttl_days', self.DEFAULT_TTL_DAYS))
        self.db = db
        self._auth = auth
        self._archive = sql_backend
        self._settings = settings
        self._archive_non_permanent_max_age_days = plugin_conf.get(
            'archive_non_permanent_max_age_days', self.DEFAULT_ARCH_NON_PERMANENT_MAX_AGE_DAYS)

    def _get_persist_level_for(self, user_id):
        if self._auth.is_anonymous(user_id):
            return 0
        else:
            return 1

    @property
    def ttl(self):
        return self._ttl_days * 24 * 3600

    def is_valid_id(self, data_id):
        """
        Returns True if data_id is a valid data identifier else False is returned

        arguments:
        data_id -- identifier to be tested
        """
        return bool(re.match(r'~[0-9a-zA-Z]+', data_id))

    def get_conc_ttl_days(self, user_id):
        return self._ttl_days

    async def _find_used_corpora(self, query_id):
        """
        Because the operations are chained via 'prev_id' and the corpname
        information is not stored for all the steps, for any n-th step > 1
        we have to go backwards and find an actual corpname stored in the
        1st operation.
        """
        data = await self._load_query(query_id, save_access=False)
        while data is not None and 'corpname' not in data:
            data = await self._load_query(data.get('prev_id', ''), save_access=False)
        return data.get('corpora', []) if data is not None else []

    async def open(self, data_id):
        ans = await self._load_query(data_id, save_access=True)
        if ans is not None and 'corpora' not in ans:
            ans['corpora'] = await self._find_used_corpora(ans.get('prev_id'))
        return ans

    async def _load_query(self, data_id: str, save_access: bool):
        """
        Loads operation data according to the passed data_id argument.
        The data are assumed to be public (as are URL parameters of a query).

        arguments:
        data_id -- a unique ID of operation data

        returns:
        a dictionary containing operation data or None if nothing is found
        """
        try:
            data = await self.db.get(mk_key(data_id))
            if data is None:
                async with self._archive.connection() as conn:
                    async with await conn.cursor(dictionary=True) as cursor:
                        await self._archive.begin_tx(cursor)
                        await cursor.execute(
                            'SELECT data, created, num_access FROM kontext_conc_persistence WHERE id = %s LIMIT 1', (data_id,))
                        tmp = await cursor.fetchone()
                        if tmp:
                            data = json.loads(tmp['data'])
                            if save_access:
                                await cursor.execute(
                                    'UPDATE kontext_conc_persistence '
                                    'SET last_access = %s, num_access = num_access + 1 '
                                    'WHERE id = %s AND created = %s',
                                    (datetime.datetime.now().isoformat(), data_id, tmp['created'].isoformat())
                                )
                                await conn.commit()
            return data
        except Exception as ex:
            logging.getLogger(__name__).error(
                f'Failed to restore archived concordance {data_id}: {ex}')
            raise ex

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
        new operation ID if a new record is created or current ID if no new operation is defined
        """
        def records_differ(r1, r2):
            return (r1[QUERY_KEY] != r2[QUERY_KEY] or
                    r1.get('lines_groups') != r2.get('lines_groups'))

        if prev_data is None or records_differ(curr_data, prev_data):
            if prev_data is not None:
                curr_data['prev_id'] = prev_data[ID_KEY]
            data_id = generate_idempotent_id(curr_data)
            curr_data[ID_KEY] = data_id
            curr_data[PERSIST_LEVEL_KEY] = self._get_persist_level_for(user_id)
            curr_data[USER_ID_KEY] = user_id
            data_key = mk_key(data_id)
            await self.db.set(data_key, curr_data)
            await self.db.set_ttl(data_key, self.ttl)
            await self.archive(data_id, False)
            latest_id = curr_data[ID_KEY]
        else:
            latest_id = prev_data[ID_KEY]

        return latest_id

    async def archive(self, conc_id, explicit):
        data_key = conc_id
        hard_limit = 100
        async with self._archive.connection() as conn:
            while data_key is not None and hard_limit > 0:  # hard_limit prevents ending up in infinite loops of 'prev_id'
                data = await self.db.get(mk_key(conc_id))
                if data:
                    async with await conn.cursor() as cursor:
                        try:
                            await cursor.execute(
                                "INSERT INTO kontext_conc_persistence (id, data, created) VALUES (%s, %s, NOW())",
                                (data_key, json.dumps(data)))
                        except IntegrityError as err:
                            logging.getLogger(__name__).warning(f'failed to archive {data_key}: {err} (ignored)')
                            pass  # key already in db
                else:
                    async with await conn.cursor() as cursor:
                        await cursor.execute('SELECT id FROM kontext_conc_persistence WHERE id = %s LIMIT 1', (data_key,))
                        r = await cursor.fetchone()
                        if r is None:
                            raise QueryPersistenceRecNotFound(f'record {data_key} not found neither in cache nor in archive')
                data_key = data.get('prev_id', None)
                hard_limit -= 1


    async def clear_old_archive_records(self):
        now = datetime.datetime.now()
        min_age = now - datetime.timedelta(days=self._archive_non_permanent_max_age_days)
        min_age_sql = min_age.strftime('%Y-%m-%dT%H:%M:%S.%f')
        async with self._archive.connection() as conn:
            async with await conn.cursor() as cursor:
                await cursor.execute(
                    "DELETE FROM kontext_query_persistence WHERE permanent = 0 AND created < %s", min_age_sql)

    def export_tasks(self):
        return (self.clear_old_archive_records,)

    async def update(self, data):
        """
        Update stored data by data['id'].
        """
        data_id = data[ID_KEY]
        data_key = mk_key(data_id)
        if await self.db.exists(data_key):
            await self.db.set(data_key, data)
        async with self._archive.connection() as conn:
            async with await conn.cursor() as cursor:
                await cursor.execute(
                    'UPDATE kontext_conc_persistence '
                    'SET data = %s WHERE id = %s',
                    (json.dumps(data), data_id)
                )

    async def clone_with_id(self, old_id: str, new_id: str):
        """
        Duplicate entry with new id
        """
        # check if new id is available
        if await self.id_exists(new_id):
            raise ValueError(f'ID {new_id} already exists')

        # get original data
        original_data = await self.db.get(mk_key(old_id))
        if original_data is None:
            async with self._archive.cursor() as cursor:
                await cursor.execute(
                    'SELECT data '
                    'FROM kontext_conc_persistence '
                    'WHERE id = %s '
                    'LIMIT 1',
                    (old_id,)
                )
                row = await cursor.fetchone()
            if row is None:
                raise ValueError(f'Data for {old_id} not found')
            original_data = json.loads(row['data'])

        # set new values
        original_data[ID_KEY] = new_id
        await self.db.set(mk_key(new_id), original_data)

    async def id_exists(self, id: str) -> bool:
        """
        Check if ID already exists
        """
        async with self._archive.cursor() as cursor:
            await cursor.execute(
                'SELECT * '
                'FROM kontext_conc_persistence '
                'WHERE id = %s '
                'LIMIT 1',
                (id,)
            )
            row = await cursor.fetchone()
        return row is not None or await self.db.exists(mk_key(id))

    async def on_response(self):
        if isinstance(self._archive, AdhocDB):
            await self._archive.close()


@inject(plugins.runtime.DB, plugins.runtime.INTEGRATION_DB, plugins.runtime.AUTH)
def create_instance(settings, db: KeyValueStorage, integration_db: MySqlIntegrationDb, auth: AbstractAuth):
    """
    Creates a plugin instance.
    """
    plugin_conf = settings.get('plugins', 'query_persistence')
    if integration_db.is_active and 'mysql_host' not in plugin_conf:
        logging.getLogger(__name__).info(
            f'mysql_query_persistence uses integration_db[{integration_db.info}]')
        return MySqlQueryPersistence(settings, db, integration_db, auth)
    else:
        logging.getLogger(__name__).info(
            'mysql_query_persistence uses custom database configuration {}@{}'.format(
                plugin_conf['mysql_user'], plugin_conf['mysql_host']))
        return MySqlQueryPersistence(settings, db, AdhocDB(MySQLConf.from_conf(plugin_conf)), auth)
