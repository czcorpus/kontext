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

import os
import sys
import argparse
import time
import json
from datetime import datetime
import logging

import redis
import mysql.connector


def redis_connection(host, port, db_id):
    """
    Creates a connection to a Redis instance
    """
    return redis.StrictRedis(host=host, port=port, db=db_id)


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
        self.conn_retry_attempts = int(conf.get('plugins', 'conc_persistence')[
                                       'mysql_retry_attempts'])

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

    def __init__(self, from_db, to_db, archive_queue_key):
        """
        arguments:
        from_db -- a Redis connection
        to_db -- a SQLite3 connection
        archive_queue_key -- a Redis key used to access archive queue
        """
        self._from_db = from_db
        self._to_db = to_db
        self._archive_queue_key = archive_queue_key

    def _get_queue_size(self):
        return self._from_db.llen(self._archive_queue_key)

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
        curr_time = time.time()
        conc_prefix = 'concordance:'
        inserts = []
        i = 0
        try:
            while i < num_proc:
                qitem = self._from_db.lpop(self._archive_queue_key)
                if qitem is None:
                    break
                qitem = json.loads(qitem)
                data = self._from_db.get(qitem['key'])
                inserts.append((qitem['key'][len(conc_prefix):], data, curr_time, 0))
                i += 1

            if not dry_run:
                self._to_db.executemany(
                    'INSERT IGNORE INTO archive (id, data, created, num_access) VALUES (%s, %s, %s, %s)',
                    inserts
                )
                self._to_db.commit()
            else:
                for ins in reversed(inserts):
                    self._from_db.lpush(self._archive_queue_key,
                                        json.dumps(dict(key=conc_prefix + ins[0])))
        except Exception as ex:
            for item in inserts:
                self._from_db.rpush(self._archive_queue_key, json.dumps(
                    dict(key=conc_prefix + item[0])))
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


def run(conf, num_proc, dry_run):
    from_db = redis_connection(conf.get('plugins', 'db')['default:host'],
                               conf.get('plugins', 'db')['default:port'],
                               conf.get('plugins', 'db')['default:id'])
    to_db = MySQLOps(MySQLConf(conf))

    archive_queue_key = conf.get('plugins')['conc_persistence']['mysql:archive_queue_key']
    archiver = Archiver(from_db=from_db, to_db=to_db, archive_queue_key=archive_queue_key)
    return archiver.run(num_proc, dry_run)


def _create_archive(conf, dry_run):
    sql = '''
        CREATE TABLE archive (
            id VARCHAR(191) PRIMARY KEY,
            data TEXT NOT NULL,
            created INT NOT NULL,
            num_access INT NOT NULL DEFAULT 0,
            last_access INT
        )
    '''
    if dry_run:
        print(sql)
    else:
        to_db = MySQLOps(MySQLConf(conf))
        to_db.execute(sql, ())
        to_db.commit()
        print('Created a new archive table.')


def _import_sqlite_db(conf, db_path, chunk_size):
    import sqlite3

    ucnk_db = sqlite3.connect(db_path)
    cursor = ucnk_db.cursor()
    mysql_db = MySQLOps(MySQLConf(conf))

    cursor.execute('SELECT id, data, created, num_access, last_access FROM archive')
    while True:
        data = cursor.fetchmany(chunk_size)
        if len(data):
            mysql_db.executemany(
                'INSERT IGNORE INTO archive (id, data, created, num_access, last_access) VALUES (%s, %s, %s, %s, %s)',
                data
            )
            mysql_db.commit()
        else:
            break

    cursor.close()
    ucnk_db.close()


if __name__ == '__main__':
    sys.path.insert(0, os.path.realpath('%s/../..' % os.path.dirname(os.path.realpath(__file__))))
    sys.path.insert(0, os.path.realpath('%s/../../../scripts/' %
                                        os.path.dirname(os.path.realpath(__file__))))
    import autoconf
    import initializer
    settings = autoconf.settings
    logger = autoconf.logger

    initializer.init_plugin('db')
    initializer.init_plugin('sessions')
    initializer.init_plugin('auth')

    parser = argparse.ArgumentParser(
        description='Archive old records from Redis to a MySQL database')
    parser.add_argument('action', metavar='ACTION', type=str,
                        help='One of {new_archive, backup, import_sqlite}')
    parser.add_argument('-n', '--num_proc', type=int, default=1000,
                        help='For backup, how many items to process. Also import chunk size. Default is 1000')
    parser.add_argument('-d', '--dry-run', action='store_true', default=False,
                        help=('allows running without affecting storage data '
                              '(not 100%% error prone as it reads/writes to Redis)'))
    parser.add_argument('-p', '--path', type=str,
                        help=('path to sqlite3 db used in import'))

    args = parser.parse_args()
    if args.action == 'backup':
        ans = run(conf=settings, num_proc=args.num_proc, dry_run=args.dry_run)
        print(ans)
    elif args.action == 'new_archive':
        try:
            _create_archive(conf=settings, dry_run=args.dry_run)
        except Exception as ex:
            print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
            sys.exit(1)
    elif args.action == 'import_sqlite':
        if not args.path:
            print('You have to specify path to sqlite3 db for import using --path parameter')
            sys.exit(1)
        try:
            _import_sqlite_db(conf=settings, db_path=args.path, chunk_size=args.num_proc)
            print('Data imported')
        except Exception as ex:
            print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
            sys.exit(1)
    else:
        print(('Unknown action "{0}"'.format(args.action)))
        sys.exit(1)
