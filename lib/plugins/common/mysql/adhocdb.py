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
import uuid

from plugins.common.sqldb import AsyncDbContextManager, R, DbContextManager, SN, SR, DatabaseAdapter
from plugins.common.mysql import MySQLOps, MySQLConf



class AdhocDB(DatabaseAdapter):
    """
    AdhocDB provides a database connection for plug-ins and scripts in case IntegrationDB
    is not a way to go (e.g. in systems relying on default and sqlite plugins with a single
    plugin using MySQL backend).

    !!! Important note: due to the nature of the async environment, it is super-essential
    that the close() method is called by a respective plug-in's on_response event handler.
    That is the only way how to ensure that each opened connection is also closed.
    """

    def __init__(self, conn_args: MySQLConf):
        self._ops = MySQLOps(conn_args)
        self._db_conn: ContextVar[Optional[MySQLConnectionAbstract]] = ContextVar(
            f'adhocdb_{uuid.uuid1().hex}', default=None)

    @property
    def is_active(self):
        return True

    @property
    def is_autocommit(self):
        return self._ops.conn_args.autocommit

    @property
    def info(self):
        return f'{self._ops.conn_args.host}:{self._ops.conn_args.port}/{self._ops.conn_args.db} (adhoc)'

    async def create_connection(self) -> MySQLConnectionAbstract:
        return await connect(
            user=self._ops.conn_args.user, password=self._ops.conn_args.password, host=self._ops.conn_args.host,
            database=self._ops.conn_args.database, ssl_disabled=True, autocommit=True)

    @asynccontextmanager
    async def connection(self) -> Generator[MySQLConnectionAbstract, None, None]:
        conn = self._db_conn.get()
        if not conn:
            conn = await self.create_connection()
            self._db_conn.set(conn)
        try:
            yield conn
        finally:
            pass  # No need to close the connection as it is done by close()

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

    async def commit_tx(self):
        async with self.connection() as conn:
            await conn.commit()

    async def rollback_tx(self):
        async with self.connection() as conn:
            await conn.rollback()

    def begin_tx_sync(self, cursor):
        self._ops.begin_tx_sync(cursor)

    def commit_tx_sync(self, conn):
        conn.commit()

    def rollback_tx_sync(self, conn):
        conn.rollback()

    async def close(self):
        conn = self._db_conn.get()
        if conn:
            await conn.close()
