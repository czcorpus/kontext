# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

import logging

from plugins.mysql_query_persistence import MySqlQueryPersistence, mk_key
import plugins
from plugin_types.auth import AbstractAuth
from plugin_types.general_storage import KeyValueStorage
from plugins import inject
from plugins.common.mysql import MySQLConf
from plugins.common.mysql.adhocdb import AdhocDB
from plugins.common.sqldb import DatabaseAdapter
from plugins.mysql_integration_db import MySqlIntegrationDb

"""
How to create the required data table:

CREATE TABLE kontext_conc_persistence (
    id VARCHAR(191) PRIMARY KEY,
    data JSON NOT NULL,
    created TIMESTAMP NOT NULL,
    num_access INT NOT NULL DEFAULT 0,
    last_access TIMESTAMP,
    permanent tinyint(4) NOT NULL DEFAULT 0
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


class UCNKQueryPersistence(MySqlQueryPersistence):

    def __init__(
            self,
            settings,
            db: KeyValueStorage,
            sql_backend: DatabaseAdapter,
            auth: AbstractAuth):
        super().__init__(settings, db, sql_backend, auth)
        plugin_conf = settings.get('plugins', 'query_persistence')
        self._archive_queue_key = plugin_conf['archive_queue_key']

    async def archive(self, conc_id: str, explicit: bool):
        await self.db.list_append(self._archive_queue_key, dict(type="archive", key=conc_id, explicit=explicit))
        return await self.db.get(mk_key(conc_id))

    async def queue_history(self, conc_id: str, created: int, user_id: int, name: str = ""):
        await self.db.list_append(self._archive_queue_key, dict(type="history", key=conc_id, created=created, user_id=user_id, name=name))

    def export_tasks(self):
        return tuple()


@inject(plugins.runtime.DB, plugins.runtime.INTEGRATION_DB, plugins.runtime.AUTH)
def create_instance(settings, db: KeyValueStorage, integration_db: MySqlIntegrationDb, auth: AbstractAuth):
    """
    Creates a plugin instance.
    """
    plugin_conf = settings.get('plugins', 'query_persistence')
    if integration_db.is_active and 'mysql_host' not in plugin_conf:
        logging.getLogger(__name__).info(
            f'mysql_query_persistence uses integration_db[{integration_db.info}]')
        return UCNKQueryPersistence(settings, db, integration_db, auth)
    else:
        logging.getLogger(__name__).info(
            'mysql_query_persistence uses custom database configuration {}@{}'.format(
                plugin_conf['mysql_user'], plugin_conf['mysql_host']))
        return UCNKQueryPersistence(settings, db, AdhocDB(MySQLConf.from_conf(plugin_conf)), auth)