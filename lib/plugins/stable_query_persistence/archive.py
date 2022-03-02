# Copyright (c) 2014 Institute of the Czech National Corpus
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

"""
A script to archive outdated concordance queries from Redis to a SQLite3 database. Archived items
are still transparently available to end-users.
"""

import os
import sys
import argparse
import time
import json
from datetime import datetime

import redis
import sqlite3


def redis_connection(host, port, db_id):
    """
    Creates a connection to a Redis instance
    """
    return redis.StrictRedis(host=host, port=port, db=db_id)


class SQLite3Ops(object):
    def __init__(self, db_path):
        self._db = sqlite3.connect(db_path)
        self._db.row_factory = sqlite3.Row

    def execute(self, sql, args):
        cursor = self._db.cursor()
        cursor.execute(sql, args)
        return cursor

    def executemany(self, sql, args_rows):
        cursor = self._db.cursor()
        cursor.executemany(sql, args_rows)
        return cursor

    def commit(self):
        self._db.commit()


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
                    'INSERT OR IGNORE INTO archive (id, data, created, num_access) VALUES (?, ?, ?, ?)', inserts)
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
    from_db = redis_connection(conf.get('plugins', 'db')['host'],
                               conf.get('plugins', 'db')['port'],
                               conf.get('plugins', 'db')['id'])
    to_db = SQLite3Ops(conf.get('plugins')['query_persistence']['archive_db_path'])

    archive_queue_key = conf.get('plugins')['query_persistence']['archive_queue_key']
    archiver = Archiver(from_db=from_db, to_db=to_db, archive_queue_key=archive_queue_key)
    return archiver.run(num_proc, dry_run)


def _create_archive(conf, dry_run):
    arch_db_path = conf.get('plugins')['query_persistence']['archive_db_path']
    if os.path.exists(arch_db_path):
        arch_filename = os.path.splitext(os.path.basename(arch_db_path))[0]
        dt = time.strftime('%Y-%m-%d', datetime.now().timetuple())
        backed_up_arch_path = os.path.join(os.path.dirname(
            arch_db_path), arch_filename + '.' + dt + '.db')
        print(('Archive {0} already exists'.format(arch_db_path)))
        print(('Please rename the current file to {0} and the run the action again'.format(
            backed_up_arch_path)))
        sys.exit(1)
    sql = ('CREATE TABLE archive (id text, data text NOT NULL, created integer NOT NULL, num_access integer '
           'NOT NULL DEFAULT 0, last_access integer, PRIMARY KEY (id))')
    if dry_run:
        print(sql)
    else:
        to_db = SQLite3Ops(arch_db_path)
        to_db.execute(sql, ())
        to_db.commit()
        print(('Created a new concordance archive file {0}.'.format(arch_db_path)))
        print('Please do not forget to set proper ownership and read+write permissions')
        print('for web server user (www-data on Ubuntu)')
        print('When done, please restart KonText Gunicorn server and also worker server (Celery)')
        print('')


if __name__ == '__main__':
    sys.path.insert(0, os.path.realpath('%s/../..' % os.path.dirname(os.path.realpath(__file__))))
    sys.path.insert(0, os.path.realpath('%s/../../../scripts/' %
                                        os.path.dirname(os.path.realpath(__file__))))
    import autoconf
    from action.plugin import initializer
    settings = autoconf.settings
    logger = autoconf.logger

    initializer.init_plugin('db')
    initializer.init_plugin('sessions')
    initializer.init_plugin('auth')

    parser = argparse.ArgumentParser(
        description='Archive old records from Redis to a SQLite3 database')
    parser.add_argument('action', metavar='ACTION', type=str, help='One of {new_archive, backup}')
    parser.add_argument('-n', '--num_proc', type=int, default=1000,
                        help='For backup, how many items to process. Default is 1000')
    parser.add_argument('-d', '--dry-run', action='store_true', default=False,
                        help=('allows running without affecting storage data '
                              '(not 100%% error prone as it reads/writes to Redis)'))
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
    else:
        print(('Unknown action "{0}"'.format(args.action)))
        sys.exit(1)
