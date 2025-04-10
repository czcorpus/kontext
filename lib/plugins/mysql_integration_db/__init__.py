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

import logging
import time
from contextlib import asynccontextmanager, contextmanager
from contextvars import ContextVar
from typing import Generator, Optional
from mysql.connector.aio import connect
from mysql.connector.aio.abstracts import MySQLConnectionAbstract, MySQLCursorAbstract
from mysql.connector.abstracts import MySQLConnectionAbstract as SyncMySQLConnectionAbstract, MySQLCursorAbstract as SyncMySQLCursorAbstract

from plugins.common.sqldb import AsyncDbContextManager, R, DbContextManager, SN, SR
from plugins.common.mysql import MySQLOps, MySQLConf
from plugin_types.integration_db import IntegrationDatabase


class MySqlIntegrationDb(
    IntegrationDatabase[
        MySQLConnectionAbstract,
        MySQLCursorAbstract,
        SyncMySQLConnectionAbstract,
        SyncMySQLCursorAbstract
    ]):
    """s
    MySqlIntegrationDb is a variant of integration_db plug-in providing access
    to MySQL/MariaDB instances. It is recommended for:
     1) integration with existing MySQL/MariaDB information systems,
     2) self-contained production installations for tens or more users

    Please make sure scripts/schema.sql is applied to your database. Otherwise,
    the plug-in fails to start. In case of a Dockerized installation, this
    is done automatically.

    The class keeps a single connection per request (via contextvars.ContextVar,
    as the class itself has a single instance per web worker) so methods like
    connection() which are context managers actually lie a bit as the connection
    """

    def __init__(
            self, conn_args: MySQLConf, environment_wait_sec: int
    ):
        self._ops = MySQLOps(conn_args)
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
        return f'{self._ops.conn_args.host}:{self._ops.conn_args.port}/{self._ops.conn_args.db}'

    def wait_for_environment(self):
        t0 = time.time()
        logging.getLogger(__name__).info(
            f'Going to wait {self._environment_wait_sec}s for integration environment')
        while (time.time() - t0) < self._environment_wait_sec:
            with self.cursor_sync() as cursor:
                try:
                    cursor.execute(
                        'SELECT COUNT(*) as env_count FROM kontext_integration_env LIMIT 1')
                    row = cursor.fetchone()
                    if row and row['env_count'] == 1:
                        return None
                except Exception as ex:
                    logging.getLogger(__name__).warning(
                        f'Integration environment still not available. Reason: {ex}')
            time.sleep(0.5)
        return Exception(
            f'Unable to confirm integration environment within defined interval {self._environment_wait_sec}s.',
            'Please check table kontext_integration_env')

    async def on_request(self):
        curr = self._db_conn.get()
        if not curr:
            self._db_conn.set(await self.create_connection())

    async def on_response(self):
        curr = self._db_conn.get()
        if curr:
            await curr.close()


    async def on_aio_task_enter(self):
        self._db_conn.set(await self.create_connection())

    async def on_aio_task_exit(self):
        curr = self._db_conn.get()
        if curr:
            await curr.close()

    async def create_connection(self) -> MySQLConnectionAbstract:
        return await connect(
            user=self._ops.conn_args.user, password=self._ops.conn_args.password, host=self._ops.conn_args.host,
            database=self._ops.conn_args.database, ssl_disabled=True, autocommit=True)

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


def create_instance(conf):
    pconf = conf.get('plugins', 'integration_db')
    return MySqlIntegrationDb(
        MySQLConf.from_conf(pconf),
        environment_wait_sec=int(pconf['environment_wait_sec']))
