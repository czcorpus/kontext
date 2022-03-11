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

from plugin_types.integration_db import IntegrationDatabase
from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursor
from mysql.connector.errors import OperationalError
from mysql.connector import connect
import logging
import time
from util import as_async
from typing import Dict, Optional


class MySQLAsyncCursor:

    def __init__(self, cur: MySQLCursor):
        self._cur = cur

    def next(self):
        return self._cur.next()

    def __next__(self):
        return self._cur.__next__()

    def __iter__(self):
        return self._cur.__iter__()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self._cur.close()

    def close(self):
        return self._cur.close()

    @as_async
    def execute(self, operation, params=None, multi=False):
        return self._cur.execute(operation, params, multi)

    @as_async
    def executemany(self, operation, seq_params):
        return self._cur.executemany(operation, seq_params)

    def stored_results(self):
        return self._cur.stored_results()

    @as_async
    def callproc(self, procname, args=()):
        return self._cur.callproc(procname, args)

    def getlastrowid(self):
        return self._cur.getlastrowid()

    def fetchone(self):
        return self._cur.fetchone()

    def fetchmany(self, size=None):
        return self._cur.fetchmany(size)

    def fetchall(self):
        return self._cur.fetchall()

    @property
    def column_names(self):
        return self._cur.column_names

    @property
    def statement(self):
        return self._cur.statement

    @property
    def with_rows(self):
        return self._cur.with_rows


class MySqlIntegrationDb(IntegrationDatabase[MySQLConnection, MySQLCursor]):
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

    _conn: Optional[MySQLConnection]

    _conn_args: Dict[str, str]

    _retry_delay: int

    _retry_attempts: int

    def __init__(self, host, database, user, password, pool_size, pool_name, autocommit, retry_delay, retry_attempts,
                 environment_wait_sec: int):
        self._conn_args = dict(
            host=host, database=database, user=user, password=password, pool_size=pool_size,
            pool_name=pool_name, autocommit=autocommit)
        self._retry_delay = retry_delay
        self._retry_attempts = retry_attempts
        self._environment_wait_sec = environment_wait_sec
        self._conn = None

    @property
    def connection(self):
        if self._conn is None:
            self._conn = connect(**self._conn_args)
        return self._conn

    def cursor(self, dictionary=True, buffered=False):
        try:
            # TODO buffered overwritten hiere
            return MySQLAsyncCursor(self.cursor_sync(dictionary, buffered=True))
        except OperationalError as ex:
            if 'MySQL Connection not available' in ex.msg:
                logging.getLogger(__name__).warning(
                    'Lost connection to MySQL server - reconnecting')
                self.connection.reconnect(delay=self._retry_delay, attempts=self._retry_attempts)
                return self.connection.cursor(dictionary=dictionary, buffered=buffered)

    def cursor_sync(self, dictionary=True, buffered=False):
        try:
            return self.connection.cursor(dictionary=dictionary, buffered=buffered)
        except OperationalError as ex:
            if 'MySQL Connection not available' in ex.msg:
                logging.getLogger(__name__).warning(
                    'Lost connection to MySQL server - reconnecting')
                self.connection.reconnect(delay=self._retry_delay, attempts=self._retry_attempts)
                return self.connection.cursor(dictionary=dictionary, buffered=buffered)

    @property
    def is_active(self):
        return True

    @property
    def is_autocommit(self):
        return self._conn_args.get('autocommit', False)

    @property
    def info(self):
        return f'{self.connection.server_host}/{self.connection.database}'

    def wait_for_environment(self):
        t0 = time.time()
        logging.getLogger(__name__).info(
            'Going to wait {}s for integration environment'.format(self._environment_wait_sec))
        while (time.time() - t0) < self._environment_wait_sec:
            try:
                cursor = self.connection.cursor(dictionary=False, buffered=False)
                cursor.execute('SELECT COUNT(*) FROM kontext_integration_env LIMIT 1')
                row = cursor.fetchone()
                if row and row[0] == 1:
                    return None
            except Exception as ex:
                logging.getLogger(__name__).warning(f'Integration environment still not available. Reason: {ex}')
            time.sleep(0.5)
        return Exception(
            'Unable to confirm integration environment within defined interval {}s.'.format(self._environment_wait_sec),
            'Please check table kontext_integration_env')

    @as_async
    def execute(self, sql, args):
        cursor = self.cursor(buffered=True)
        cursor.execute(sql, args)
        print('##### CURSOR: {}'.format(cursor))
        return cursor

    @as_async
    def executemany(self, sql, args_rows):
        cursor = self.cursor()
        cursor.executemany(sql, args_rows)
        return cursor

    def start_transaction(self, isolation_level=None):
        return self.connection.start_transaction()

    def commit(self):
        self.connection.commit()

    def rollback(self):
        self.connection.rollback()


def create_instance(conf):
    pconf = conf.get('plugins', 'integration_db')
    return MySqlIntegrationDb(
        host=pconf['host'], database=pconf['db'], user=pconf['user'], password=pconf['passwd'],
        pool_size=int(pconf['pool_size']), pool_name='kontext_pool', autocommit=True,
        retry_delay=int(pconf['retry_delay']), retry_attempts=int(pconf['retry_attempts']),
        environment_wait_sec=int(pconf['environment_wait_sec']))
