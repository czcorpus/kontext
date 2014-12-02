"""
Note: this is UCNK specific functionality

A script to archive outdated concordance queries from Redis to a SQLite database.
"""

import os
import sys
import logging
import argparse
import time

import redis
from sqlalchemy import create_engine

SCRIPT_PATH = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
APP_PATH = os.path.realpath('%s/../../..' % SCRIPT_PATH)
sys.path.insert(0, '%s/lib' % APP_PATH)

KEY_SYMBOLS = [chr(x) for x in range(ord('a'), ord('z'))] + [chr(x) for x in range(ord('A'), ord('Z'))] \
              + ['%d' % i for i in range(10)]

import settings

logger = logging.getLogger('conc_archive')


def redis_connection(host, port, db_id):
    """
    """
    return redis.StrictRedis(host=host, port=port, db=db_id)


def sqlite_connection():
    return create_engine('sqlite:///%s' % settings.get('plugins')['conc_persistence']['ucnk:archive_db_path'])


def determine_prefix(interval):
    return KEY_SYMBOLS[int(time.time() / (interval * 60)) % len(KEY_SYMBOLS)]


class Archiver(object):

    def __init__(self, from_db, to_db, match, count, ttl_range, dry_run=False):
        self._from_db = from_db
        self._to_db = to_db
        self._match = match
        self._count = count
        self._ttl_range = ttl_range
        self._num_processed = 0
        self._num_archived = 0
        self._errors = []
        self._dry_run = dry_run

    def archive_item(self, key, data):
        #print('archiving %s => %s' % (key, data))
        if not self._dry_run:
            prefix = 'concordance:'
            if key.startswith(prefix):
                key = key[len(prefix):]
            self._to_db.execute('INSERT INTO archive (id, data, created, num_access) VALUES (?, ?, ?, ?)',
                                (key, data, int(time.time()), 0))
        self._num_archived += 1

    def process_chunk(self, data):
        for key in data:
            self._num_processed += 1
            ttl = self._from_db.ttl(key)
            #print('test: %s  <%s>  %s' % (self._ttl_range[0], ttl, self._ttl_range[1]))
            if self._ttl_range[0] <= ttl <= self._ttl_range[1]:
                data = self._from_db.get(key)
                try:
                    self.archive_item(key, data)
                    self._from_db.delete(key)
                except Exception as e:
                    self._errors.append(e)

    def scan_source_db(self):
        cursor, data = self._from_db.scan(match=self._match, count=self._count)
        self.process_chunk(data)
        while cursor > 0:
            cursor, data = self._from_db.scan(cursor=cursor, match=self._match, count=self._count)
            self.process_chunk(data)

    def get_stats(self):
        return {
            'num_processed': self._num_processed,
            'num_archived': self._num_archived,
            'num_errors': len(self._errors)
        }


if __name__ == '__main__':
    settings.load('%s/config.xml' % APP_PATH)

    parser = argparse.ArgumentParser(description='Archive old records from Synchronize data from mysql db to redis')
    parser.add_argument('-k', '--key-prefix', type=str, help='Processes just keys with defined prefix')
    parser.add_argument('-c', '--cron-interval', type=int, help='Non-empty values initializes partial processing with '
                                                                + 'defined interval between chunks')
    parser.add_argument('-d', '--dry-run', action='store_true', help='allows running without affecting storage data')
    args = parser.parse_args()

    from_db = redis_connection(settings.get('plugins', 'db')['default:host'],
                               settings.get('plugins', 'db')['default:port'],
                               settings.get('plugins', 'db')['default:id'])

    to_db = sqlite_connection()
    default_ttl = settings.get('plugins', 'conc_persistence')['default:ttl_days']
    try:
        default_ttl = int(int(default_ttl) * 24 * 3600 / 3.)
        min_ttl = 3600 * 24 * 7
    except Exception as e:
        print(e)
        default_ttl = int(3600 * 24 * 7 / 3.)
        min_ttl = 3600 * 24 * 1

    if args.key_prefix:
        match_prefix = 'concordance:%s*' % args.key_prefix
    elif args.cron_interval:
        match_prefix = 'concordance:%s*' % determine_prefix(args.cron_interval)
    else:
        match_prefix = 'concordance:*'


    archiver = Archiver(from_db=from_db, to_db=to_db, match=match_prefix, count=50, ttl_range=(min_ttl, default_ttl),
                        dry_run=args.dry_run)
    archiver.scan_source_db()
    print('stats:')
    print(archiver.get_stats())