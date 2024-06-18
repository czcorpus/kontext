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

from contextlib import asynccontextmanager, contextmanager
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Generator
import logging

from mysql.connector.aio import connect
from mysql.connector import connect as connect_sync
from mysql.connector.aio.abstracts import MySQLConnectionAbstract, MySQLCursorAbstract


@dataclass
class MySQLConf:
    database: str
    user: str
    password: str
    retry_delay: int
    retry_attempts: int

    host: str = field(default='localhost')
    port: int = field(default=3306)
    autocommit: bool = field(default=True)

    @staticmethod
    def from_conf(conf: Dict[str, Any]) -> 'MySQLConf':
        pref = 'mysql_' if any(x.startswith('mysql_') for x in conf.keys()) else ''
        return MySQLConf(
            host=conf[f'{pref}host'],
            database=conf[f'{pref}db'],
            user=conf[f'{pref}user'],
            password=conf[f'{pref}passwd'],
            retry_delay=conf[f'{pref}retry_delay'],
            retry_attempts=conf[f'{pref}retry_attempts'],
        )

    @property
    def conn_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @property
    def db(self):
        return self.database


class MySQLOps:
    """
    A simple wrapper for mysql.connector.aio and mysql.connector (for sync variants).
    In KonText, the class is mostly used by the MySQLIntegrationDb plugin and mysql.AdhocDB.
    As a standalone type, it is mostly useful for running various scripts and automatic
    tasks on the worker server where we don't have to worry about effective
    connection usage (for example, if a task runs once every 5 minutes, this means
    no significant connection overhead to always connect and disconnect).
    """

    _conn_args: MySQLConf

    _retry_delay: int

    _retry_attempts: int

    def __init__(self, conn_args):
        self._conn_args = conn_args

    @asynccontextmanager
    async def connection(self) -> Generator[MySQLConnectionAbstract, None, None]:
        """
        Create a new connection with lifecycle limited by the created context.
        This is intended to be used in scripts and worker tasks as for the
        web actions, this would make a huge connection overhead.
        (MySQLIntegrationDb handles this for you).
        """
        logging.getLogger(__name__).info('opening a new ad-hoc mysql connection')
        async with await connect(
                user=self._conn_args.user,
                password=self._conn_args.password,
                host=self._conn_args.host,
                port=self._conn_args.port,
                database=self._conn_args.db,
                ssl_disabled=True,
                autocommit=True) as conn:
            yield conn

    @asynccontextmanager
    async def cursor(self, dictionary=True) -> Generator[MySQLCursorAbstract, None, None]:
        """
        Create a new connection and open a new cursor. Just like
        in case of the connection() method, this is suitable for
        scripts and worker tasks. For web actions/handlers, use
        integration db plug-in which handles connections more
        effectively.
        """
        async with self.connection() as conn:
            async with await conn.cursor(dictionary=dictionary) as cur:
                try:
                    yield cur
                finally:
                    cur.close()

    async def begin_tx(self, cursor):
        await cursor.execute('START TRANSACTION')

    def begin_tx_sync(self, cursor):
        cursor.execute('START TRANSACTION')

    @contextmanager
    def connection_sync(self) -> Generator[MySQLConnectionAbstract, None, None]:
        with connect_sync(
                user=self._conn_args.user, password=self._conn_args.password, host=self._conn_args.host,
                database=self._conn_args.db, ssl_disabled=True) as conn:
            yield conn

    @contextmanager
    def cursor_sync(self, dictionary=True) -> Generator[Any, None, None]:
        with connect_sync(
                user=self._conn_args.user, password=self._conn_args.password, host=self._conn_args.host,
                database=self._conn_args.db, ssl_disabled=True) as conn:
            with conn.cursor(dictionary=dictionary) as curr:
                yield curr

    @property
    def conn_args(self):
        return self._conn_args
