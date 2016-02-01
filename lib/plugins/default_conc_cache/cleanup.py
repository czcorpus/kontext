# Copyright (c) 2015 Institute of the Czech National Corpus
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

"""
This script performs a clean-up of KonText concordance cache. It always
tries to clean all the files which are older than defined TTL value.
To decrease number of files processed at once, TTL can be set smaller or
the script can be run more often.

It is intended to be used along with 'default_conc_cache', 'redis_locking'
and 'redis_db'. If you have alternative (and compatible) modules you can
modify imports 'from plugins import ...' to your custom values and everything
should work well.
"""

import sys
import os
import argparse
import time
import cPickle
import collections
import json
import logging


DEFAULT_TTL = 60  # in minutes


def shorten_path(p):
    """
    For debugging/logging purposes shortens path to 'corpus_id/cache_entry'
    """
    return '/'.join(p.rsplit('/', 2)[-2:])


class CacheFiles(object):

    def __init__(self, root_path, subdir, corpus, cache_map_filename):
        self._root_path = root_path
        self._subdir = subdir
        self._corpus = corpus
        self._cache_map_filename = cache_map_filename
        self._curr_time = time.time()

    def list_dir(self):
        """
        Searches for cache files in a directory specified by the 'path'
        argument. The method expects a specific fixed directory structure:
        [path]
          [corpname_1]
            cache_file_1_1
            cache_file_1_2
            ...
          [corpname_2]
          ...
          [corpname_N]

        It means it does not search recursively.

        returns:
        a dict [path to corpus cache dir] => [list of 3-tuples]
        where 3-tuple is [cache file abs. path], [age of file in sec.], [size of file in Bytes]
        """
        path = self._root_path if not self._subdir else os.path.normpath('%s/%s' % (self._root_path,
                                                                                    self._subdir))
        if self._corpus:
            corpora_dirs = [self._corpus]
        elif os.path.isdir(path):
            corpora_dirs = os.listdir(path)
        else:
            corpora_dirs = []

        ans = collections.defaultdict(list)
        for corpus_dir in corpora_dirs:
            corp_full_path = '%s/%s' % (path, corpus_dir)
            if not os.path.isdir(corp_full_path):
                continue
            for cache_file in os.listdir(corp_full_path):
                cache_full_path = '%s/%s' % (corp_full_path, cache_file)
                if os.path.isdir(cache_full_path) \
                        or cache_file in ('run', self._cache_map_filename):
                    continue
                ans[os.path.dirname(cache_full_path)].append(
                    (cache_full_path,
                     self._curr_time - os.path.getmtime(cache_full_path),
                     os.path.getsize(cache_full_path))
                )
        return ans


class CacheCleanup(CacheFiles):

    def __init__(self, root_path, corpus, ttl, subdir, lock_fact, cache_map_filename):
        super(CacheCleanup, self).__init__(root_path, subdir, corpus, cache_map_filename)
        self._root_path = root_path
        self._ttl = ttl
        self._subdir = subdir
        self._num_processed = 0
        self._num_removed = 0
        self._lock_factory = lock_fact

    @staticmethod
    def _log_stats(files):
        for k, v in files.items():
            logging.getLogger(__name__).info(json.dumps({
                'type': 'file_count',
                'directory': k,
                'count': len(v)
            }))

    def run(self, dry_run=False):
        """
        Performs the clean-up operation by taking the following sequence of steps:
         1. lists all cache files in individual corpora cache dirs
         2. for all the corpora
           2.1 finds which files are old enough (see TTL) to be deleted
           2.2 finds a corpus cache map file and iterates over records found there
             2.2.1 if a record matches a file which is waiting to be deleted, then both the
                    file and the record are removed
             2.2.2 if a record does not match even any existing file than it is removed with
                   logged warning about stale record
           2.3 if there are still some files to be deleted it means that they are 'unbound'
               (= there is no record in the respective cache map file) and are deleted with
               a warning too

        arguments:
        dry_run -- if True then no actual writing/deleting is performed
        """
        num_deleted = 0
        num_processed = 0

        cache_files = self.list_dir()
        self._log_stats(cache_files)
        for base_path, corpus_cache_files in cache_files.items():  # processing corpus by corpus
            to_del = {}
            real_file_hashes = set()  # to be able to compare cache map with actual files
            for cache_entry in corpus_cache_files:
                num_processed += 1
                item_key = os.path.basename(cache_entry[0]).rsplit('.conc')[0]
                real_file_hashes.add(item_key)
                if self._ttl < cache_entry[1] / 60.:
                    to_del[item_key] = cache_entry[0]

            map_path = os.path.normpath('%s/%s' % (base_path, self._cache_map_filename))
            if os.path.isfile(map_path):
                with self._lock_factory.create(map_path):
                    try:
                        cache_map = cPickle.load(open(map_path, 'rb'))
                        for k, v in cache_map.items():
                            item_hash = v[0]
                            if item_hash in to_del:
                                if not dry_run:
                                    os.unlink(to_del[item_hash])
                                    del cache_map[k]
                                else:
                                    autoconf.logger.debug('deleted: %s (key: %s)' %
                                                         (to_del[item_hash], k))
                                del to_del[item_hash]
                                num_deleted += 1
                            elif item_hash not in real_file_hashes:
                                if not dry_run:
                                    del cache_map[k]
                                autoconf.logger.warn('deleted stale cache map entry: %s '
                                                     '(hash: %s)' % (map_path, item_hash))
                        if not dry_run:
                            cPickle.dump(cache_map, open(map_path, 'wb'))
                    except Exception as ex:
                        autoconf.logger.warn('Failed to process cache map file (will be deleted): %s' % (ex,))
                        os.unlink(map_path)

            else:
                autoconf.logger.error('Cache map file %s not found' % map_path)

            for item_hash, unbound_file in to_del.items():
                if not dry_run:
                    os.unlink(unbound_file)
                autoconf.logger.warn('deleted unbound cache file: %s' % unbound_file)
        ans = {'type': 'summary', 'processed': num_processed, 'deleted': num_deleted}
        logging.getLogger(__name__).info(json.dumps(ans))
        return ans


def run(root_dir, corpus_id, ttl, subdir, dry_run, cache_map_filename, locking_plugin):
    proc = CacheCleanup(root_dir, corpus_id, ttl, subdir, locking_plugin, cache_map_filename)
    return proc.run(dry_run=dry_run)


if __name__ == '__main__':
    sys.path.insert(0, '%s/../../../scripts' % os.path.realpath(os.path.dirname(__file__)))
    import autoconf
    import plugins
    from plugins import redis_db
    plugins.install_plugin('db', redis_db, autoconf.settings)
    from plugins import redis_locking
    plugins.install_plugin('locking', redis_locking, autoconf.settings)
    from plugins import default_conc_cache

    parser = argparse.ArgumentParser(description='A script to control UCNK metadata cache')
    parser.add_argument('--dry-run', '-d', action='store_true',
                        help='Just analyze, do not modify anything')
    parser.add_argument('--exclude', '-x', type=str, default=None,
                        help='Do not analyze/clean specified subdirectories')
    parser.add_argument('--corpus', '-c', type=str, help='A concrete corpus to be processed')
    parser.add_argument('--ttl', '-t', type=int, default=DEFAULT_TTL,
                        help='How old files (in minutes) will be preserved yet. Default is %s min.'
                             % DEFAULT_TTL)
    parser.add_argument('--subdir', '-s', type=str, default=None,
                        help='Search will be performed in [default:cache_dir]/[subdir]')
    parser.add_argument('--log-level', '-l', type=str, default='info',
                        help='Logging level (%s)' % ', '.join(autoconf.LOG_LEVELS.keys()))
    parser.add_argument('--log-path', '-p', type=str, default=None,
                        help='Where to write the log. If omitted then %s is used' %
                             autoconf.DEFAULT_LOG_OUT)
    args = parser.parse_args()

    autoconf.setup_logger(log_path=args.log_path,
                          logger_name='conc_cache_cleanup',
                          logging_level=autoconf.LOG_LEVELS[args.log_level])
    root_dir = autoconf.settings.get('plugins', 'conc_cache')['default:cache_dir']

    run(root_dir=root_dir, corpus_id=args.corpus, ttl=args.ttl, subdir=args.subdir,
        dry_run=args.dry_run, cache_map_filename=default_conc_cache.CacheMapping.CACHE_FILENAME,
        locking_plugin=plugins.get('locking'))


