# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

from dataclasses import dataclass, asdict
from plugin_types.integration_db import IntegrationDatabase
from typing import Dict, Optional
import aiomysql


@dataclass
class ConnectionArgs:
    host: str
    db: str
    user: str
    password: str
    autocommit: bool


class MySqlIntegrationDb(IntegrationDatabase[aiomysql.Connection, aiomysql.Cursor]):
    """
    MySqlIntegrationDb is a variant of integration_db plug-in providing access
    to MySQL/MariaDB instances. It is recommended for:
     1) integration with existing MySQL/MariaDB information systems,
     2) self-contained production installations with many registered users and
        thousands or more search requests per day where most of the search
        requests are archived

    Please make sure scripts/schema.sql is applied to your database. Otherwise
    the plug-in fails to start. In case of a Dockerized installation, this
    is done automatically.
    """

    _conn: Optional[aiomysql.Connection]

    _conn_args: ConnectionArgs

    _retry_delay: int

    _retry_attempts: int

    def __init__(self, host, database, user, password, pool_size, pool_name, autocommit, retry_delay, retry_attempts,
                 environment_wait_sec: int):
        self._conn_args = ConnectionArgs(
            host=host, db=database, user=user, password=password, autocommit=autocommit)
        self._retry_delay = retry_delay
        self._retry_attempts = retry_attempts
        self._environment_wait_sec = environment_wait_sec
        self._conn = None

    async def connection(self) -> aiomysql.Connection:
        if self._conn is None:
            self._conn = aiomysql.connect(**asdict(self._conn_args))
        return self._conn

    async def cursor(self, dictionary=True, buffered=False) -> aiomysql.Cursor:
        if dictionary:
            return await self._conn.cursor(aiomysql.DictCursor)
        else:
            return await self._conn.cursor()

    @property
    def is_active(self):
        return True

    @property
    def is_autocommit(self):
        return self._conn_args.get('autocommit', False)

    @property
    def info(self):
        return f'{self._conn_args.server_host}/{self._conn_args.db}'

    def wait_for_environment(self):
        None

    async def execute(self, sql, args) -> aiomysql.Cursor:
        cursor = await self.cursor(buffered=True)
        await cursor.execute(sql, args)
        print('##### CURSOR: {}'.format(cursor))
        return cursor

    async def executemany(self, sql, args_rows) -> aiomysql.Cursor:
        cursor = await self.cursor()
        await cursor.executemany(sql, args_rows)
        return cursor

    async def start_transaction(self, isolation_level=None):
        await (await self.connection()).begin()

    async def commit(self):
        await (await self.connection()).commit()

    async def rollback(self):
        await (await self.connection()).rollback()


def create_instance(conf):
    pconf = conf.get('plugins', 'integration_db')
    return MySqlIntegrationDb(
        host=pconf['host'], database=pconf['db'], user=pconf['user'], password=pconf['passwd'],
        pool_size=int(pconf['pool_size']), pool_name='kontext_pool', autocommit=True,
        retry_delay=int(pconf['retry_delay']), retry_attempts=int(pconf['retry_attempts']),
        environment_wait_sec=int(pconf['environment_wait_sec']))
