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
Note: this is UCNK specific functionality

A script to archive outdated concordance queries from Redis to a SQLite3 database.
"""

import os
import sys
import logging
import logging.handlers
import argparse
import time
import json

import redis
from sqlalchemy import create_engine

sys.path.insert(0, os.path.realpath('%s/../..' % os.path.dirname(__file__)))
import autoconf
settings = autoconf.settings
logger = autoconf.logger


MAX_NUM_SHOW_ERRORS = 10
MAX_INTERVAL_BETWEEN_ITEM_VISITS = 3600 * 24 * 3   # empirical value

import plugins

from plugins import redis_db
plugins.install_plugin('db', redis_db, autoconf.settings)

from plugins.ucnk_conc_persistence2 import KEY_ALPHABET, PERSIST_LEVEL_KEY


def redis_connection(host, port, db_id):
    """
    Creates a connection to a Redis instance
    """
    return redis.StrictRedis(host=host, port=port, db=db_id)


def sqlite_connection(db_path):
    """
    Opens an SQLite3 database file and returns an instance of Sqlalchemy engine
    """
    return create_engine('sqlite:///%s' % db_path)


def time_based_prefix(interval):
    """
    Generates a single character key prefix for chunked key processing.
    The calculation is based on expected execution interval (typically controlled
    by crond) and on the size of an alphabet used for keys.

    For example (a simplified one - as the script itself operates with UNIX timestamps)
    if the alphabet is {A,B,C,D,E} and the interval is 10 minutes then:
        at 00:00 hours, A is returned
        at 00:10 hours, B is returned
        ...
        at 00:40 hours, E is returned
        at 00:50 hours, A (again) is returned
        ...

    arguments:
    interval -- interval in MINUTES

    returns:
    a character from alphabet (here a,...,z,A,...,Z,0,...,9) used for keys
    """
    return KEY_ALPHABET[int(time.time() / (interval * 60)) % len(KEY_ALPHABET)]


class Archiver(object):
    """
    A class which actually performs the process of archiving records
    from fast database (Redis) to a slow one (SQLite3)
    """

    def __init__(self, from_db, to_db, match, count, ttl_range, dry_run=False):
        """
        arguments:
        from_db -- a Redis connection
        to_db -- a SQLite3 connection
        match -- a pattern (for syntax, see Redis documentation) to be used for key selection
        ttl_range -- a tuple (min_accepted_ttl, max_accepted_ttl)
        dry_run -- if True then on writing operations are performed
        """
        self._from_db = from_db
        self._to_db = to_db
        self._match = match
        self._count = count
        self._ttl_range = ttl_range
        self._num_processed = 0
        self._num_new_type = 0  # just to check old type records ratio
        self._num_archived = 0
        self._errors = []
        self._dry_run = dry_run

    def _archive_item(self, key, data):
        prefix = 'concordance:'
        if key.startswith(prefix):
            key = key[len(prefix):]
        self._to_db.execute('INSERT INTO archive (id, data, created, num_access) VALUES (?, ?, ?, ?)',
                            (key, data, int(time.time()), 0))
        logger.debug('archived %s => %s' % (key, data))

    @staticmethod
    def _is_new_type(data):
        return PERSIST_LEVEL_KEY in data

    def _is_archivable(self, data, item_ttl):
        if self._is_new_type(data):
            # current calc. method
            return data[PERSIST_LEVEL_KEY] == 1 and item_ttl < MAX_INTERVAL_BETWEEN_ITEM_VISITS
        else:
            # legacy calc. method
            return self._ttl_range[0] <= item_ttl <= self._ttl_range[1]

    def _process_chunk(self, data_keys):
        for key in data_keys:
            self._num_processed += 1
            ttl = self._from_db.ttl(key)
            data = json.loads(self._from_db.get(key))
            if self._is_new_type(data):
                self._num_new_type += 1
            if self._is_archivable(data, item_ttl=ttl):
                try:
                    if not self._dry_run:
                        self._archive_item(key, json.dumps(data))
                        self._from_db.delete(key)
                    self._num_archived += 1
                except Exception as e:
                    self._errors.append(e)

    def run(self):
        """
        Performs actual archiving process according to the parameters passed
        in constructor.

        returns:
        a dict containing some information about processed data (num_processed,
         num_archived, num_errors, match)
        """
        cursor, data = self._from_db.scan(match=self._match, count=self._count)
        self._process_chunk(data)
        while cursor > 0:
            cursor, data = self._from_db.scan(cursor=cursor, match=self._match, count=self._count)
            self._process_chunk(data)

        return {
            'num_processed': self._num_processed,
            'num_archived': self._num_archived,
            'num_new_type': self._num_new_type,
            'num_errors': len(self._errors),
            'match': self._match,
            'dry_run': self._dry_run
        }

    def get_errors(self):
        return self._errors


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Archive old records from Synchronize data from mysql db to redis')
    parser.add_argument('-k', '--key-prefix', type=str,
                        help='Processes just keys with defined prefix')
    parser.add_argument('-c', '--cron-interval', type=int,
                        help='Non-empty values initializes partial processing with '
                        'defined interval between chunks')
    parser.add_argument('-d', '--dry-run', action='store_true',
                        help='allows running without affecting storage data')
    parser.add_argument('-l', '--log-file', type=str,
                        help='A file used for logging. If omitted then stdout is used')
    args = parser.parse_args()

    autoconf.setup_logger(log_path=args.log_file, logger_name='conc_archive')

    from_db = redis_connection(settings.get('plugins', 'db')['default:host'],
                               settings.get('plugins', 'db')['default:port'],
                               settings.get('plugins', 'db')['default:id'])

    to_db = sqlite_connection(settings.get('plugins')['conc_persistence']['ucnk:archive_db_path'])
    default_ttl = settings.get('plugins', 'conc_persistence')['default:ttl_days']
    try:
        # if 1/3 of TTL is reached then archiving is possible
        default_ttl = int(int(default_ttl) * 24 * 3600 / 3.)
        min_ttl = 3600 * 24 * 7  # smaller TTL then this is understood as non-preserved; TODO: this is a weak concept
    except Exception as e:
        print(e)
        default_ttl = int(3600 * 24 * 7 / 3.)
        min_ttl = 3600 * 24 * 1

    if args.key_prefix:
        match_prefix = 'concordance:%s*' % args.key_prefix
    elif args.cron_interval:
        match_prefix = 'concordance:%s*' % time_based_prefix(args.cron_interval)
    else:
        match_prefix = 'concordance:*'


    archiver = Archiver(from_db=from_db, to_db=to_db, match=match_prefix, count=50, ttl_range=(min_ttl, default_ttl),
                        dry_run=args.dry_run)
    info = archiver.run()
    logger.info(json.dumps(info))
    errors = archiver.get_errors()
    for err in errors[:MAX_NUM_SHOW_ERRORS]:
        logger.error(err)
    if len(errors) > MAX_NUM_SHOW_ERRORS:
        logger.warn('More than %d errors occured.' % MAX_NUM_SHOW_ERRORS)