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

from plugins.abstract.integration_db import IntegrationDatabase
from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursor
from mysql.connector.errors import OperationalError
from mysql.connector import connect
import logging
import time
from typing import Dict, Optional


class MySqlIntegrationDb(IntegrationDatabase[MySQLConnection, MySQLCursor]):
    """
    MySqlIntegrationDb is a variant of integration_db plug-in providing access
    to MySQL and MariaDB instances. In case you have an existing information system
    based on one of those databases and multiple KonText plug-ins you use
    require access to them, it is recommended to configure this plug-in.
    """

    _conn: Optional[MySQLConnection]

    _conn_args: Dict[str, str]

    _retry_delay: int

    _retry_attempts: int

    def __init__(self, host, database, user, password, pool_size, pool_name, autocommit, retry_delay, retry_attempts):
        self._conn_args = dict(
            host=host, database=database, user=user, password=password, pool_size=pool_size,
            pool_name=pool_name, autocommit=autocommit)
        self._retry_delay = retry_delay
        self._retry_attempts = retry_attempts
        self._conn = None

    @property
    def connection(self):
        if self._conn is None:
            self._conn = connect(**self._conn_args)
        return self._conn

    def cursor(self, dictionary=True, buffered=False):
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
    def info(self):
        return f'{self.connection.server_host}/{self.connection.database}'

    def wait_for_environment(self, timeout_ms):
        t = time.time()
        while (time.time() - t) * 1000 < timeout_ms:
            try:
                cursor = self.connection.cursor(dictionary=False, buffered=False)
                cursor.execute('SELECT COUNT(*) FROM kontext_integration_env LIMIT 1')
                row = cursor.fetchone()
                if row and row[0] == 1:
                    return None
            except Exception:
                pass
            time.sleep(0.5)
        return Exception('No confirmed environment installation. Please check table kontext_integration_env')

    def execute(self, sql, args):
        cursor = self.cursor()
        cursor.execute(sql, args)
        return cursor

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
    return MySqlIntegrationDb(host=pconf['host'], database=pconf['db'], user=pconf['user'],
                              password=pconf['passwd'], pool_size=int(pconf['pool_size']),
                              pool_name='kontext_pool', autocommit=True,
                              retry_delay=int(pconf['retry_delay']),
                              retry_attempts=int(pconf['retry_attempts']))
