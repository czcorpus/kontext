import sys
import os
import argparse
import logging
import time
import cPickle
import collections

sys.path.insert(0, '%s/../..' % os.path.realpath(os.path.dirname(__file__)))

import autoconf

from plugins import redis_locking
from plugins import redis_db
from plugins import default_conc_cache

DEFAULT_TTL = 60  # in minutes


def shorten_path(p):
    """
    For debugging/logging purposes shortens path to 'corpus_id/cache_entry'
    """
    return '/'.join(p.rsplit('/', 2)[-2:])


class CacheFiles(object):

    def __init__(self, root_path, corpus):
        self._root_path = root_path
        self._corpus = corpus
        self._curr_time = time.time()

    def list_dir(self, path):
        """
        Creates a generator producing cache files found at "path".
        The method expects a specific fixed directory structure:
        - [path]
          - [corpname_1]
            - file_1_1
            - file_1_2
            ...
          - [corpname_2]
          ...
          - [corpname_N]

        arguments:
        path -- path where to search
        """
        if self._corpus:
            corpora_dirs = [self._corpus]
        else:
            corpora_dirs = os.listdir(path)

        for corpus_dir in corpora_dirs:
            corp_full_path = '%s/%s' % (path, corpus_dir)
            if not os.path.isdir(corp_full_path):
                continue
            for cache_file in os.listdir(corp_full_path):
                cache_full_path = '%s/%s' % (corp_full_path, cache_file)
                if os.path.isdir(cache_full_path) \
                        or cache_file in ('run', default_conc_cache.CacheMapping.CACHE_FILENAME):
                    continue
                yield (cache_full_path,
                       self._curr_time - os.path.getmtime(cache_full_path),
                       os.path.getsize(cache_full_path))


class CacheCleanup(CacheFiles):

    def __init__(self, root_path, corpus, ttl, lock_fact):
        super(CacheCleanup, self).__init__(root_path, corpus)
        self._root_path = root_path
        self._ttl = ttl
        self._num_processed = 0
        self._num_removed = 0
        self._lock_factory = lock_fact

    def run(self, dry_run=False):
        ans = collections.defaultdict(list)
        num_deleted = 0
        num_processed = 0
        for item in self.list_dir(self._root_path):
            ans[os.path.dirname(item[0])].append(item)

        for base_path, corpus_cache_entries in ans.items():
            map_path = os.path.normpath('%s/%s' % (base_path,
                                                   default_conc_cache.CacheMapping.CACHE_FILENAME))
            if os.path.isfile(map_path):
                to_del = {}
                real_file_hashes = set()  # we have to check map entries against real files too
                for cache_entry in corpus_cache_entries:
                    num_processed += 1
                    item_key = os.path.basename(cache_entry[0]).rsplit('.conc')[0]
                    real_file_hashes.add(item_key)
                    if self._ttl < cache_entry[1] / 60.:
                        to_del[item_key] = cache_entry[0]
                if len(to_del) > 0:
                    with self._lock_factory.create(map_path):
                        cache_map = cPickle.load(open(map_path, 'rb'))
                        for k, v in cache_map.items():
                            item_hash = v[0]
                            if item_hash in to_del:
                                if not dry_run:
                                    os.unlink(to_del[item_hash])
                                    del cache_map[k]
                                else:
                                    autoconf.logger.info('delete: %s (key: %s)' %
                                                         (to_del[item_hash], k))
                                num_deleted += 1
                            elif item_hash not in real_file_hashes:
                                if not dry_run:
                                    del cache_map[k]
                                autoconf.logger.warn('Unbound cache file! Directory: %s, '
                                                     'hash: %s' % (base_path, item_hash))
                        if not dry_run:
                            cPickle.dump(cache_map, open(map_path, 'wb'))
            else:
                autoconf.logger.error('Cache map file %s not found' % map_path)
        autoconf.logger.info('Processed files: %d, deleted: %d' % (num_processed, num_deleted))


if __name__ == '__main__':
    autoconf.setup_logger(logger_name='conc_cache_cleanup', logging_level=logging.DEBUG)
    parser = argparse.ArgumentParser(description='A script to control UCNK metadata cache')
    parser.add_argument('--dry-run', '-d', action='store_true',
                        help='Just analyze, do not modify anything')
    parser.add_argument('--exclude', '-x', type=str, default=None,
                        help='Do not analyze/clean specified subdirectories')
    parser.add_argument('--corpus', '-c', type=str, help='A concrete corpus to be processed')
    parser.add_argument('--ttl', '-t', type=int, default=DEFAULT_TTL,
                        help='How old files (in minutes) will be preserved yet. Default is %s min.'
                             % DEFAULT_TTL)
    args = parser.parse_args()

    root_dir = autoconf.settings.get('plugins', 'conc_cache')['default:cache_dir']

    db = redis_db.create_instance(autoconf.settings.get('plugins', 'db'))
    lock_factory = redis_locking.create_instance(autoconf.settings, db)
    proc = CacheCleanup(root_dir, args.corpus, args.ttl, lock_factory)
    proc.run(dry_run=args.dry_run)

