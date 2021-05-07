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

import mysql.connector
import logging


class MySQLConf(object):

    def __init__(self, conf):
        self.pool_name = 'kontext_mysql_pool'
        self.autocommit = True
        self.host = conf['mysql_host']
        self.database = conf['mysql_db']
        self.user = conf['mysql_user']
        self.password = conf['mysql_passwd']
        self.pool_size = int(conf['mysql_pool_size'])
        self.conn_retry_delay = int(conf['mysql_retry_delay'])
        self.conn_retry_attempts = int(conf['mysql_retry_attempts'])

    @property
    def conn_dict(self):
        return dict(host=self.host, database=self.database, user=self.user,
                    password=self.password, pool_size=self.pool_size, pool_name=self.pool_name,
                    autocommit=self.autocommit)


class MySQLOps(object):
    """
    A simple wrapper for mysql.connector with ability
    to reconnect.
    """

    def __init__(self, mysql_conf):
        self._conn = mysql.connector.connect(**mysql_conf.conn_dict)
        self._conn_retry_delay = mysql_conf.conn_retry_delay
        self._conn_retry_attempts = mysql_conf.conn_retry_attempts

    def cursor(self, dictionary=True, buffered=False):
        try:
            return self._conn.cursor(dictionary=dictionary, buffered=buffered)
        except mysql.connector.errors.OperationalError as ex:
            if 'MySQL Connection not available' in ex.msg:
                logging.getLogger(__name__).warning(
                    'Lost connection to MySQL server - reconnecting')
                self._conn.reconnect(delay=self._conn_retry_delay,
                                     attempts=self._conn_retry_attempts)
                return self._conn.cursor(dictionary=dictionary, buffered=buffered)

    @property
    def connection(self):
        return self._conn

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
