# Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

"""
A script to archive outdated concordance queries from Redis to a MySQL database.
"""

import datetime
import json
import logging

import redis
import mysql.connector
from mysql.connector.cursor import MySQLCursor

from plugins.abstract.general_storage import KeyValueStorage


def redis_connection(host, port, db_id):
    """
    Creates a connection to a Redis instance
    """
    return redis.StrictRedis(host=host, port=port, db=db_id)


def get_iso_datetime():
    return datetime.datetime.now().isoformat()


def is_archived(cursor: MySQLCursor, conc_id):
    cursor.execute(
        'SELECT id FROM kontext_conc_persistence WHERE id = %s LIMIT 1',
        (conc_id,)
    )
    return cursor.fetchone() is not None


class MySQLConf(object):

    def __init__(self, conf):
        self.pool_name = 'kontext_mysql_pool'
        self.autocommit = True
        self.host = conf.get('plugins', 'conc_persistence')['mysql_host']
        self.database = conf.get('plugins', 'conc_persistence')['mysql_db']
        self.user = conf.get('plugins', 'conc_persistence')['mysql_user']
        self.password = conf.get('plugins', 'conc_persistence')['mysql_passwd']
        self.pool_size = int(conf.get('plugins', 'conc_persistence')['mysql_pool_size'])
        self.conn_retry_delay = int(conf.get('plugins', 'conc_persistence')['mysql_retry_delay'])
        self.conn_retry_attempts = int(conf.get('plugins', 'conc_persistence')['mysql_retry_attempts'])

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


class Archiver(object):
    """
    A class which actually performs the process of archiving records
    from fast database (Redis) to a slow one (SQLite3)
    """

    def __init__(self, from_db: KeyValueStorage, to_db: MySQLOps, archive_queue_key: str):
        """
        arguments:
        from_db -- a Redis connection
        to_db -- a SQLite3 connection
        archive_queue_key -- a Redis key used to access archive queue
        """
        self._from_db: KeyValueStorage = from_db
        self._to_db: MySQLOps = to_db
        self._archive_queue_key = archive_queue_key

    def _get_queue_size(self):
        return self._from_db.list_len(self._archive_queue_key)

    def run(self, num_proc, dry_run):
        """
        Performs actual archiving process according to the parameters passed
        in constructor.

        Please note that dry-run is not 100% error-prone as it also pops the items
        from the queue and then inserts them again.

        arguments:
        num_proc -- how many items per run should be processed
        dry_run -- if True then no writing operations are performed

        returns:
        a dict containing some information about processed data (num_processed,
        error, dry_run, queue_size)
        """
        curr_time = get_iso_datetime()
        conc_prefix = 'concordance:'
        inserts = []
        i = 0
        try:
            cursor = self._to_db.cursor()
            while i < num_proc:
                qitem = self._from_db.list_pop(self._archive_queue_key)
                if qitem is None:
                    break
                data = self._from_db.get(qitem['key'])
                if not is_archived(cursor, qitem['key']):
                    inserts.append((qitem['key'][len(conc_prefix):], json.dumps(data), curr_time, 0))
                    i += 1
            cursor.close()
            if not dry_run:
                self._to_db.executemany(
                    'INSERT IGNORE INTO kontext_conc_persistence (id, data, created, num_access) '
                    'VALUES (%s, %s, %s, %s)',
                    inserts
                )
                self._to_db.commit()
            else:
                for ins in reversed(inserts):
                    self._from_db.list_append(self._archive_queue_key, dict(key=conc_prefix + ins[0]))
        except Exception as ex:
            logging.getLogger(__name__).error('Failed to archive items: {}'.format(ex))
            for item in inserts:
                self._from_db.list_append(self._archive_queue_key, dict(key=conc_prefix + item[0]))
            return dict(
                num_processed=i,
                error=str(ex),
                dry_run=dry_run,
                queue_size=self._get_queue_size())
        return dict(
            num_processed=i,
            error=None,
            dry_run=dry_run,
            queue_size=self._get_queue_size())


def run(from_db, to_db, archive_queue_key: str, num_proc: int, dry_run: bool):
    archiver = Archiver(from_db=from_db, to_db=to_db, archive_queue_key=archive_queue_key)
    return archiver.run(num_proc, dry_run)
