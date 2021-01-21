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


class MySqlIntegrationDb(IntegrationDatabase[MySQLConnection, MySQLCursor]):

    _conn: MySQLConnection

    _retry_delay: int

    _retry_attempts: int

    def __init__(self, host, database, user, password, pool_size, pool_name, autocommit, retry_delay, retry_attempts):
        self._conn = connect(host=host, database=database, user=user, password=password, pool_size=pool_size,
                             pool_name=pool_name, autocommit=autocommit)
        self._retry_delay = retry_delay
        self._retry_attempts = retry_attempts

    @property
    def connection(self):
        return self._conn

    def cursor(self, dictionary=True, buffered=False):
        try:
            return self._conn.cursor(dictionary=dictionary, buffered=buffered)
        except OperationalError as ex:
            if 'MySQL Connection not available' in ex.msg:
                logging.getLogger(__name__).warning(
                    'Lost connection to MySQL server - reconnecting')
                self._conn.reconnect(delay=self._retry_delay,
                                     attempts=self._retry_attempts)
                return self._conn.cursor(dictionary=dictionary, buffered=buffered)

    @property
    def is_active(self):
        return True

    @property
    def info(self):
        return f'{self._conn.server_host}/{self._conn.database}'

    def execute(self, sql, args):
        cursor = self.cursor()
        cursor.execute(sql, args)
        return cursor

    def executemany(self, sql, args_rows):
        cursor = self.cursor()
        cursor.executemany(sql, args_rows)
        return cursor

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()


def create_instance(conf):
    pconf = conf.get('plugins', 'integration_db')
    return MySqlIntegrationDb(host=pconf['host'], database=pconf['db'], user=pconf['user'],
                              password=pconf['passwd'], pool_size=int(pconf['pool_size']),
                              pool_name='kontext_pool', autocommit=False,
                              retry_delay=int(pconf['retry_delay']), retry_attempts=int(pconf['retry_attempts']))
