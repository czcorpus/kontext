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
import argparse
import time
import json
import logging

import redis
import sqlite3

MAX_NUM_SHOW_ERRORS = 10
MAX_INTERVAL_BETWEEN_ITEM_VISITS = 3600 * 24 * 3   # empirical value


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

    def __init__(self, from_db, to_db, count, ttl_range, persist_level_key,
                 key_alphabet):
        """
        arguments:
        from_db -- a Redis connection
        to_db -- a SQLite3 connection
        count -- ???
        ttl_range -- a tuple (min_accepted_ttl, max_accepted_ttl)
        persist_level_key -- ???
        key_alphabet -- ???
        """
        self._from_db = from_db
        self._to_db = to_db
        self._count = count
        self._ttl_range = ttl_range
        self._num_processed = 0
        self._num_new_type = 0  # just to check old type records ratio
        self._num_archived = 0
        self._errors = []
        self._persist_level_key = persist_level_key
        self._key_alphabet = key_alphabet

    def time_based_prefix(self, interval):
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
        return self._key_alphabet[int(time.time() / (interval * 60)) % len(self._key_alphabet)]

    def _is_new_type(self, data):
        return self._persist_level_key in data

    def _is_archivable(self, data, item_ttl):
        if self._is_new_type(data):
            # current calc. method
            return data[self._persist_level_key] == 1 and item_ttl < MAX_INTERVAL_BETWEEN_ITEM_VISITS
        else:
            # legacy calc. method
            return self._ttl_range[0] <= item_ttl <= self._ttl_range[1]

    def _process_chunk(self, data_keys, dry_run):
        rows = []
        del_keys = []
        curr_time = time.time()
        prefix = 'concordance:'

        for key in data_keys:
            self._num_processed += 1
            ttl = self._from_db.ttl(key)
            data = json.loads(self._from_db.get(key))
            if self._is_new_type(data):
                self._num_new_type += 1
            if self._is_archivable(data, item_ttl=ttl):
                if key.startswith(prefix):
                    del_keys.append(key)
                rows.append((key[len(prefix):], json.dumps(data), curr_time, 0))
                self._num_archived += 1
        if len(rows) > 0:
            try:
                if not dry_run:
                    self._to_db.executemany(
                        'INSERT OR IGNORE INTO archive (id, data, created, num_access) VALUES (?, ?, ?, ?)', rows)
                    for k in del_keys:
                        self._from_db.delete(k)
                logging.getLogger(__name__).debug('archived block of %s items' % (len(rows),))
            except Exception as e:
                self._errors.append(e)

    def run(self, key_prefix, cron_interval, dry_run):
        """
        Performs actual archiving process according to the parameters passed
        in constructor.

        arguments:
        dry_run -- if True then on writing operations are performed

        returns:
        a dict containing some information about processed data (num_processed,
         num_archived, num_errors, match)
        """
        if key_prefix:
            match_prefix = 'concordance:%s*' % key_prefix
        elif cron_interval:
            match_prefix = 'concordance:%s*' % self.time_based_prefix(cron_interval)
        else:
            match_prefix = 'concordance:*'

        cursor, data = self._from_db.scan(match=match_prefix, count=self._count)
        self._process_chunk(data, dry_run)
        while cursor > 0:
            cursor, data = self._from_db.scan(cursor=cursor, match=match_prefix, count=self._count)
            self._process_chunk(data, dry_run)
        if not dry_run:
            self._to_db.commit()

        return {
            'num_processed': self._num_processed,
            'num_archived': self._num_archived,
            'num_new_type': self._num_new_type,
            'num_errors': len(self._errors),
            'match': match_prefix,
            'dry_run': dry_run
        }

    def get_errors(self):
        return self._errors


def run(conf, key_prefix, cron_interval, dry_run, persist_level_key, key_alphabet):
    from_db = redis_connection(conf.get('plugins', 'db')['default:host'],
                               conf.get('plugins', 'db')['default:port'],
                               conf.get('plugins', 'db')['default:id'])

    to_db = SQLite3Ops(conf.get('plugins')['conc_persistence']['ucnk:archive_db_path'])
    default_ttl = conf.get('plugins', 'conc_persistence')['default:ttl_days']
    try:
        # if 1/3 of TTL is reached then archiving is possible
        default_ttl = int(int(default_ttl) * 24 * 3600 / 3.)
        min_ttl = 3600 * 24 * 7  # smaller TTL then this is understood as non-preserved; TODO: this is a weak concept
    except Exception as e:
        print(e)
        default_ttl = int(3600 * 24 * 7 / 3.)
        min_ttl = 3600 * 24 * 1

    archiver = Archiver(from_db=from_db, to_db=to_db, count=50, ttl_range=(min_ttl, default_ttl),
                        persist_level_key=persist_level_key, key_alphabet=key_alphabet)
    info = archiver.run(key_prefix, cron_interval, dry_run)
    logging.getLogger(__name__).info(json.dumps(info))
    errors = archiver.get_errors()
    for err in errors[:MAX_NUM_SHOW_ERRORS]:
        logging.getLogger(__name__).error(err)
    if len(errors) > MAX_NUM_SHOW_ERRORS:
        logging.getLogger(__name__).warn('More than %d errors occured.' % MAX_NUM_SHOW_ERRORS)
    if len(errors) == 0:
        return info
    else:
        return errors


if __name__ == '__main__':
    sys.path.insert(0, os.path.realpath('%s/../..' % os.path.dirname(os.path.realpath(__file__))))
    sys.path.insert(0, os.path.realpath('%s/../../../scripts/' % os.path.dirname(os.path.realpath(__file__))))
    import autoconf
    import initializer
    settings = autoconf.settings
    logger = autoconf.logger

    initializer.init_plugin('db')
    initializer.init_plugin('sessions')
    initializer.init_plugin('auth')

    from plugins.ucnk_conc_persistence2 import KEY_ALPHABET, PERSIST_LEVEL_KEY

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
    run(conf=settings, key_prefix=args.key_prefix, cron_interval=args.cron_interval, dry_run=args.dry_run,
        persist_level_key=PERSIST_LEVEL_KEY, key_alphabet=KEY_ALPHABET)
