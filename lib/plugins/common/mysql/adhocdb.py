# Copyright (c) 2024 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2024 Tomas Machalek <tomas.machalek@gmail.com>
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

from contextlib import asynccontextmanager, contextmanager
from contextvars import ContextVar
from typing import Generator, Optional
from mysql.connector.aio import connect
from mysql.connector.aio.abstracts import MySQLConnectionAbstract

from plugin_types.integration_db import AsyncDbContextManager, R, DbContextManager, SN, SR, DatabaseAdapter
from plugins.common.mysql import MySQLOps



class AdhocDB(DatabaseAdapter):

    def __init__(
            self, host, database, user, password, pool_size, autocommit, retry_delay,
            retry_attempts, environment_wait_sec: int
    ):
        self._ops = MySQLOps(
            host, database, user, password, pool_size, autocommit, retry_delay,
            retry_attempts
        )
        self._environment_wait_sec = environment_wait_sec
        self._db_conn: ContextVar[Optional[MySQLConnectionAbstract]] = ContextVar('database_connection', default=None)

    @property
    def is_active(self):
        return True

    @property
    def is_autocommit(self):
        return self._ops.conn_args.autocommit

    @property
    def info(self):
        return f'{self._ops.conn_args.host}:{self._ops.conn_args.port}/{self._ops.conn_args.db} (adhoc)'

    async def on_request(self):
        curr = self._db_conn.get()
        if not curr:
            self._db_conn.set(await self.create_connection())

    async def on_response(self):
        curr = self._db_conn.get()
        if curr:
            await curr.close()

    async def create_connection(self) -> MySQLConnectionAbstract:
        return await connect(
            user=self._ops.conn_args.user, password=self._ops.conn_args.password, host=self._ops.conn_args.host,
            database=self._ops.conn_args.db, ssl_disabled=True, autocommit=True)

    @asynccontextmanager
    async def connection(self) -> Generator[MySQLConnectionAbstract, None, None]:
        curr = self._db_conn.get()
        if not curr:
            raise RuntimeError('No database connection')
        try:
            yield curr
        finally:
            pass  # No need to close the connection as it is done by Sanic middleware

    @contextmanager
    def connection_sync(self) -> DbContextManager[SN]:
        with self._ops.connection_sync() as conn:
            yield conn

    @asynccontextmanager
    async def cursor(self, dictionary=True) -> AsyncDbContextManager[R]:
        async with self.connection() as conn:
            async with await conn.cursor(dictionary=dictionary) as cursor:
                try:
                    yield cursor
                finally:
                    await cursor.close()

    @contextmanager
    def cursor_sync(self, dictionary=True) -> DbContextManager[SR]:
        with self._ops.cursor_sync(dictionary=dictionary) as curr:
            yield curr

    async def begin_tx(self, cursor):
        await self._ops.begin_tx(cursor)

    def begin_tx_sync(self, cursor):
        self._ops.begin_tx_sync(cursor)

    async def commit_tx(self):
        async with self.connection() as conn:
            await conn.commit()

    async def rollback_tx(self):
        async with self.connection() as conn:
            await conn.rollback()
