# Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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


How to create the required data table:

CREATE TABLE kontext_conc_persistence (
    id VARCHAR(191) PRIMARY KEY,
    data JSON NOT NULL,
    created TIMESTAMP NOT NULL,
    num_access INT NOT NULL DEFAULT 0,
    last_access TIMESTAMP
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

Possible modifications in case the number of records is large:

ALTER TABLE `kontext_conc_persistence`
ENGINE='Aria';

ALTER TABLE `kontext_conc_persistence`
ADD PRIMARY KEY `id_created` (`id`, `created`),
DROP INDEX `PRIMARY`;

ALTER TABLE kontext_conc_persistence
PARTITION BY RANGE (UNIX_TIMESTAMP(created)) (
    PARTITION `to_2016` VALUES LESS THAN (UNIX_TIMESTAMP('2016-12-31 23:59:59')),
    PARTITION `to_2019` VALUES LESS THAN (UNIX_TIMESTAMP('2019-12-31 23:59:59')),
    PARTITION `to_2022` VALUES LESS THAN (UNIX_TIMESTAMP('2022-12-31 23:59:59')),
    PARTITION `to_2025` VALUES LESS THAN (UNIX_TIMESTAMP('2025-12-31 23:59:59')),
    PARTITION `to_2028` VALUES LESS THAN (UNIX_TIMESTAMP('2028-12-31 23:59:59')),
    PARTITION `to_2031` VALUES LESS THAN (UNIX_TIMESTAMP('2031-12-31 23:59:59')),
    PARTITION `to_2034` VALUES LESS THAN (UNIX_TIMESTAMP('2034-12-31 23:59:59')),
    PARTITION `to_2037` VALUES LESS THAN (UNIX_TIMESTAMP('2037-12-31 23:59:59')),
    PARTITION `the_rest` VALUES LESS THAN MAXVALUE
)

"""

import logging
import re

import plugins
import ujson as json
from action.errors import ForbiddenException, NotFoundException
from plugin_types.auth import AbstractAuth
from plugin_types.general_storage import KeyValueStorage
from plugin_types.query_persistence import AbstractQueryPersistence
from plugin_types.query_persistence.common import (
    ID_KEY, PERSIST_LEVEL_KEY, QUERY_KEY, USER_ID_KEY, generate_idempotent_id)
from plugins import inject
from plugins.common.mysql import MySQLConf, MySQLOps
from plugins.mysql_integration_db import MySqlIntegrationDb

from .archive import get_iso_datetime, is_archived


def mk_key(code):
    return 'concordance:%s' % (code, )


class MySqlQueryPersistence(AbstractQueryPersistence):
    """
    This class stores user's queries in their internal form (see Kontext.q attribute).
    """

    DEFAULT_TTL_DAYS = 100

    DEFAULT_ANONYMOUS_USER_TTL_DAYS = 7

    def __init__(
            self,
            settings,
            db: KeyValueStorage,
            sql_backend: MySQLOps,
            auth: AbstractAuth):
        super().__init__(settings)
        plugin_conf = settings.get('plugins', 'query_persistence')
        ttl_days = int(plugin_conf.get('ttl_days', MySqlQueryPersistence.DEFAULT_TTL_DAYS))
        self._ttl_days = ttl_days
        self._anonymous_user_ttl_days = int(plugin_conf.get(
            'anonymous_user_ttl_days', MySqlQueryPersistence.DEFAULT_ANONYMOUS_USER_TTL_DAYS))
        self._archive_queue_key = plugin_conf['archive_queue_key']
        self.db = db
        self._auth = auth
        self._archive = sql_backend
        self._settings = settings

    def _get_ttl_for(self, user_id):
        if self._auth.is_anonymous(user_id):
            return self.anonymous_user_ttl
        return self.ttl

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

    def is_valid_id(self, data_id):
        """
        Returns True if data_id is a valid data identifier else False is returned

        arguments:
        data_id -- identifier to be tested
        """
        return bool(re.match(r'~[0-9a-zA-Z]+', data_id))

    def get_conc_ttl_days(self, user_id):
        if self._auth.is_anonymous(user_id):
            return self.anonymous_user_ttl
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
        data_id -- an unique ID of operation data

        returns:
        a dictionary containing operation data or None if nothing is found
        """
        try:
            data = await self.db.get(mk_key(data_id))
            if data is None:
                async with self._archive.cursor() as cursor:
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
                                (get_iso_datetime(), data_id, tmp['created'].isoformat())
                            )
                            await cursor.connection.commit()
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
            await self.db.set_ttl(data_key, self._get_ttl_for(user_id))
            if not self._auth.is_anonymous(user_id):
                await self.db.list_append(self._archive_queue_key, dict(key=data_key))
            latest_id = curr_data[ID_KEY]
        else:
            latest_id = prev_data[ID_KEY]

        return latest_id

    async def archive(self, user_id, conc_id, revoke=False):
        async with self._archive.cursor() as cursor:
            await cursor.execute(
                'SELECT id, data, created, num_access, last_access FROM kontext_conc_persistence WHERE id = %s LIMIT 1',
                (conc_id,)
            )
            row = await cursor.fetchone()
            archived_rec = json.loads(row['data']) if row is not None else None

            if revoke:
                if archived_rec:
                    await cursor.execute('DELETE FROM kontext_conc_persistence WHERE id = %s', (conc_id,))
                    ans = 1
                if await self.will_be_archived(None, conc_id):
                    data_key = mk_key(conc_id)
                    await self.db.list_append(self._archive_queue_key, dict(key=data_key, revoke=True))
                    ans = 1
                if ans == 0:
                    raise NotFoundException(
                        'Archive revoke error - concordance {0} not archived'.format(conc_id))
            else:
                data = await self.db.get(mk_key(conc_id))
                if data is None and archived_rec is None:
                    raise NotFoundException(
                        'Archive store error - concordance {0} not found'.format(conc_id))
                elif archived_rec:
                    ans = 0
                else:
                    will_be_archived = await self.will_be_archived(None, conc_id)
                    archived_rec = data
                    if will_be_archived is not None:
                        data_key = mk_key(conc_id)
                        await self.db.list_append(self._archive_queue_key, dict(key=data_key, revoke=will_be_archived))
                        ans = 1
                    else:
                        stored_user_id = data.get('user_id', None)
                        if user_id != stored_user_id:
                            raise ForbiddenException(
                                'Cannot change status of a concordance belonging to another user')
                        await cursor.execute(
                            'INSERT IGNORE INTO kontext_conc_persistence (id, data, created, num_access) '
                            'VALUES (%s, %s, %s, %s)',
                            (conc_id, json.dumps(data), get_iso_datetime(), 0))
                        ans = 1
            await cursor.connection.commit()
        return ans, archived_rec

    async def is_archived(self, conc_id):
        async with self._archive.cursor() as cursor:
            return await is_archived(cursor, conc_id)

    async def will_be_archived(self, plugin_ctx, conc_id: str):
        """
        Please note that this operation is a bit costly (O(n)) due to need for
        sequential searching in items to be archived
        """
        waiting_items = await self.db.list_get(self._archive_queue_key)
        ident_prefix = 'concordance:'
        for rec in reversed(waiting_items):
            ident = rec.get('key')
            if ident and ident.startswith(ident_prefix):
                id = ident[len(ident_prefix):]
                if id == conc_id:
                    return not rec.get('revoke')
        return None

    async def update_preflight_stats(
            self,
            plugin_ctx,
            preflight_id,
            corpus,
            subc_id,
            query_cql,
            has_checked_tt,
            estimated_size,
            actual_size):
        async with self._archive.cursor() as cursor:
            await cursor.execute(
                'INSERT INTO kontext_preflight_stats '
                '(id, corpus_name, subc_id, query_cql, has_checked_tt, estimated_size, actual_size) '
                'VALUES (%s, %s, %s, %s, %s, %s, %s) '
                'ON DUPLICATE KEY UPDATE '
                'estimated_size = IFNULL(%s, estimated_size), '
                'actual_size = IFNULL(%s, actual_size) ',
                (preflight_id, corpus, subc_id, query_cql, 1 if has_checked_tt else 0,
                 estimated_size, actual_size, estimated_size, actual_size))

    def export_tasks(self):
        """
        Export tasks for async queue worker(s)
        """
        async def archive_concordance(num_proc: int, dry_run: bool):
            from . import archive
            return await archive.run(from_db=self.db, to_db=self._archive, archive_queue_key=self._archive_queue_key,
                                     dry_run=dry_run, num_proc=num_proc)
        return archive_concordance,

    async def update(self, data, arch_enqueue=False):
        """
        Update stored data by data['id'].
        """
        data_id = data[ID_KEY]
        data_key = mk_key(data_id)
        if await self.db.exists(data_key):
            await self.db.set(data_key, data)
            if arch_enqueue:
                await self.db.list_append(self._archive_queue_key, dict(key=data_key))

        async with self._archive.cursor() as cursor:
            await cursor.execute(
                'UPDATE kontext_conc_persistence '
                'SET data = %s WHERE id = %s',
                (json.dumps(data), data_id)
            )
            await cursor.connection.commit()

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
        return MySqlQueryPersistence(settings, db, MySQLOps(**MySQLConf(plugin_conf).conn_dict), auth)
