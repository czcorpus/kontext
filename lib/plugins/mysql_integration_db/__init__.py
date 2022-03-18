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

from dataclasses import dataclass, asdict, field
from plugin_types.integration_db import IntegrationDatabase
from typing import Generator, Optional
from contextlib import asynccontextmanager, contextmanager
import aiomysql
import pymysql
import pymysql.cursors


@dataclass
class ConnectionArgs:
    host: str
    db: str
    user: str
    password: str
    autocommit: bool
    port: int = field(default=3306)


@dataclass
class PoolArgs:
    minsize: int = field(default=1)
    maxsize: int = field(default=10)


class MySqlIntegrationDb(IntegrationDatabase[aiomysql.Connection, aiomysql.Cursor, pymysql.Connection, pymysql.cursors.Cursor]):
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

    _pool: Optional[aiomysql.Pool]

    _conn_args: ConnectionArgs

    _pool_args: PoolArgs

    _retry_delay: int

    _retry_attempts: int

    def __init__(self, host, database, user, password, pool_size, pool_name, autocommit, retry_delay, retry_attempts,
                 environment_wait_sec: int):
        self._conn_args = ConnectionArgs(
            host=host, db=database, user=user, password=password, autocommit=autocommit)
        self._pool_args = PoolArgs(maxsize=pool_size)
        self._retry_delay = retry_delay
        self._retry_attempts = retry_attempts
        self._environment_wait_sec = environment_wait_sec
        self._pool = None

    async def _init_pool(self):
        if self._pool is None:
            self._pool = await aiomysql.create_pool(**asdict(self._conn_args), **asdict(self._pool_args))

    @asynccontextmanager
    async def connection(self) -> Generator[aiomysql.Connection, None, None]:
        await self._init_pool()
        async with self._pool.acquire() as connection:
            yield connection

    @asynccontextmanager
    async def cursor(self, dictionary=True) -> Generator[aiomysql.Cursor, None, None]:
        async with self.connection() as connection:
            if dictionary:
                async with connection.cursor(aiomysql.DictCursor) as cursor:
                    yield cursor
            else:
                async with connection.cursor() as cursor:
                    yield cursor

    @contextmanager
    def connection_sync(self) -> Generator[pymysql.Connection, None, None]:
        connection = pymysql.connect(**asdict(self._conn_args))
        yield connection
        connection.close()

    @contextmanager
    def cursor_sync(self, dictionary=True) -> Generator[pymysql.cursors.Cursor, None, None]:
        with self.connection_sync() as connection:
            if dictionary:
                cursor = connection.cursor(pymysql.cursors.DictCursor)
            else:
                cursor = connection.cursor()
            yield cursor
            cursor.close()

    @property
    def is_active(self):
        return True

    @property
    def is_autocommit(self):
        return self._conn_args.get('autocommit', False)

    @property
    def info(self):
        return f'{self._conn_args.host}:{self._conn_args.port}/{self._conn_args.db}'

    def wait_for_environment(self):
        None


def create_instance(conf):
    pconf = conf.get('plugins', 'integration_db')
    return MySqlIntegrationDb(
        host=pconf['host'], database=pconf['db'], user=pconf['user'], password=pconf['passwd'],
        pool_size=int(pconf['pool_size']), pool_name='kontext_pool', autocommit=True,
        retry_delay=int(pconf['retry_delay']), retry_attempts=int(pconf['retry_attempts']),
        environment_wait_sec=int(pconf['environment_wait_sec']))
