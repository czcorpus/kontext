# Copyright (c) 2024 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2024 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2024 Martin Zimandl <martin.zimandl@gmail.com>
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
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import logging
from datetime import datetime

import plugins
from plugin_types.query_persistence import AbstractQueryPersistence
from plugin_types.subc_storage import AbstractSubcArchive
from plugin_types.auth import AbstractAuth
from plugin_types.general_storage import KeyValueStorage
from plugins import inject
from plugins.mysql_query_history import MySqlQueryHistory
from plugins.mysql_integration_db import MySqlIntegrationDb
from plugins.common.mysql.adhocdb import AdhocDB
from plugins.common.mysql import MySQLConf


class UcnkQueryHistory(MySqlQueryHistory):

    def __init__(
            self,
            conf,
            db: MySqlIntegrationDb,
            kvdb: KeyValueStorage,
            query_persistence: AbstractQueryPersistence,
            subc_archive: AbstractSubcArchive,
            auth: AbstractAuth):
        super().__init__(conf, db, query_persistence, subc_archive, auth)
        self._kvdb = kvdb
        self._del_queue_key = conf.get('plugins', 'query_history').get(
            'fulltext_deleting_queue', 'query_history_fulltext_del')

    def supports_fulltext_search(self):
        return True

    async def delete_old_records(self):
        """
        Deletes records older than ttl_days. Named records are
        kept intact.
        now - created > ttl
        now - ttl  > created
        """
        # TODO remove also named but unpaired history entries
        async with self._db.cursor() as cursor:
            logging.getLogger(__name__).warning(f'SELECT id FROM {self.TABLE_NAME} WHERE created < %s AND name IS NULL')
            await cursor.execute(
                #f'SELECT query_id, user_id, created FROM {self.TABLE_NAME} WHERE created < %s AND name IS NULL',
                f'SELECT query_id, user_id, created FROM {self.TABLE_NAME} WHERE name IS NULL',
                #   (int(datetime.utcnow().timestamp()) - self.ttl_days * 3600 * 24,)
            )
            for row in await cursor.fetchall():
                logging.getLogger(__name__).warning('>>>> row to del: {}'.format(row))
                await cursor.execute(
                    f'DELETE FROM {self.TABLE_NAME} WHERE id = %s',
                    (int(datetime.utcnow().timestamp()) - self.ttl_days * 3600 * 24,))
                await self._kvdb.list_append(self._del_queue_key, row)



@inject(
    plugins.runtime.INTEGRATION_DB,
    plugins.runtime.QUERY_PERSISTENCE,
    plugins.runtime.SUBC_STORAGE,
    plugins.runtime.AUTH,
    plugins.runtime.DB
)
def create_instance(
        conf,
        integ_db: MySqlIntegrationDb,
        query_persistence: AbstractQueryPersistence,
        subc_archive: AbstractSubcArchive,
        auth: AbstractAuth,
        kvdb: KeyValueStorage
):
    auth_plg_conf = conf.get('plugins', 'auth')
    if integ_db and integ_db.is_active and 'mysql_host' not in auth_plg_conf:
        db = integ_db
        logging.getLogger(__name__).info(f'ucnk_query_history uses integration_db[{integ_db.info}]')
    else:
        db = AdhocDB(MySQLConf.from_conf(auth_plg_conf))
    return UcnkQueryHistory(conf, db, kvdb, query_persistence, subc_archive, auth)
