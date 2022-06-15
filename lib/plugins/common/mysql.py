# Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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
import os
from contextlib import asynccontextmanager, contextmanager
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Generator, Optional
import logging

import aiomysql
import pymysql


@dataclass
class ConnectionArgs:
    db: str
    user: str
    password: str
    autocommit: bool = False
    host: str = field(default='localhost')
    port: int = field(default=3306)


@dataclass
class PoolArgs:
    minsize: int = field(default=1)
    maxsize: int = field(default=10)
    pool_recycle: float = field(default=-1.0)


@dataclass
class MySQLConf:
    database: str
    user: str
    password: str
    pool_size: int
    conn_retry_delay: int
    conn_retry_attempts: int

    host: str = field(default='localhost')
    port: int = field(default=3306)
    autocommit: bool = field(default=True)

    @staticmethod
    def from_conf(conf: Dict[str, Any]) -> 'MySQLConf':
        return MySQLConf(
            host=conf['mysql_host'],
            database=conf['mysql_db'],
            user=conf['mysql_user'],
            password=conf['mysql_passwd'],
            pool_size=conf['mysql_pool_size'],
            conn_retry_delay=conf['mysql_retry_delay'],
            conn_retry_attempts=conf['mysql_retry_attempts'],
        )

    @property
    def conn_dict(self) -> Dict[str, Any]:
        return asdict(self)


class MySQLOps:
    """
    A simple wrapper for pymysql/aiomysql
    """

    _pool: Optional[aiomysql.Pool]

    _conn_args: ConnectionArgs

    _pool_args: PoolArgs

    _retry_delay: int

    _retry_attempts: int

    def __init__(self, host, database, user, password, pool_size, autocommit, retry_delay, retry_attempts):
        self._conn_args = ConnectionArgs(
            host=host, db=database, user=user, password=password, autocommit=autocommit)
        self._pool_args = PoolArgs(maxsize=pool_size, pool_recycle=130)
        self._retry_delay = retry_delay  # TODO has no effect now
        self._retry_attempts = retry_attempts  # TODO has no effect now
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
