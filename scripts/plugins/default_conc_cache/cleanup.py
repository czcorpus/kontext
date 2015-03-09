import sys
import os
import argparse
import math
import logging
import time

sys.path.insert(0, '%s/../..' % os.path.realpath(os.path.dirname(__file__)))

import autoconf
from plugins import default_conc_cache
from plugins import redis_db


def shorten_path(p):
    """
    For debugging/logging purposes shortens path to 'corpus_id/cache_entry'
    """
    return '/'.join(p.rsplit('/', 2)[-2:])


def calc_health_decrement(filesize, num_used):
    """
    Determines about how much an item's health should be decreased.
    In general this depends on item's size and how often it was used.

    arguments:
    filesize -- size of a respective file in bytes
    num_used -- a number how many times the item was used (= read)
    """
    return math.log(filesize, 10) / float(num_used)


class CacheFiles(object):

    def __init__(self, db, root_path, partition_prefix, corpus):
        self._db = db
        self._root_path = root_path
        self._partition_prefix = partition_prefix
        self._corpus = corpus

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
                if os.path.isdir(cache_full_path) or cache_file in ('run', '00CONCS.map'):  # TODO check
                    continue
                h = default_conc_cache.fspath_hash(cache_full_path)
                if not self._partition_prefix or h.find(self._partition_prefix) == 0:
                    yield cache_full_path, h, os.path.getsize(cache_full_path)

    def load_item(self, path_hash):
        return self._db.load_item(path_hash)


class CacheCleanup(CacheFiles):

    def __init__(self, root_path, partition_prefix, corpus, cache_metadata, ttl):
        super(CacheCleanup, self).__init__(cache_metadata, root_path, partition_prefix, corpus)
        self._root_path = root_path
        self._partition_prefix = partition_prefix
        self._ttl = ttl
        self._num_processed = 0
        self._num_removed = 0

    def analyze_item(self, item):
        self._num_processed += 1
        path, path_hash, filesize = item
        data = self.load_item(path_hash)
        if len(data) > 0:
            if 'health' not in data or data['health'] is None:
                autoconf.logger.warn('Property "health" initialized incorrectly')
            old_health = data['health']
            data['health'] -= calc_health_decrement(filesize, data['counter'])
            autoconf.logger.debug('%s: health %01.2f -> %01.2f' % (shorten_path(item[0]), old_health, data['health']))
            if data['health'] <= 0:
                self._db.remove_item(path_hash)
                os.unlink(path)
                self._num_removed += 1
            else:
                self._db.save_item(path_hash, data)
        else:
            autoconf.logger.debug('no metadata for %s' % (shorten_path(item[0]),))

    def run(self):
        """
        Runs an analysis
        """
        map(self.analyze_item, self.list_dir(self._root_path))
        return self._num_processed, self._num_removed


class CacheInfo(CacheFiles):

    def __init__(self, db, root_path, partition_prefix, corpus):
        super(CacheInfo, self).__init__(db, root_path, partition_prefix, corpus)

    @staticmethod
    def _sec_to_hms(s):
        h = s / 3600
        tmp = s % 3600
        m = tmp / 60
        s = tmp % 60
        return '%02d:%02d:%02d' % (h, m, s)

    def run(self):
        total_bytes = 0
        total_items = 0
        avg_used = 0
        avg_health = 0
        avg_age = 0
        total_unregistered = 0
        t = time.time()
        for entry in self.list_dir(self._root_path):
            db_item = self.load_item(entry[1])
            if len(db_item) > 0:
                avg_used += db_item['counter']
                avg_health += db_item['health']
                avg_age += (t - db_item['created'])
            else:
                total_unregistered += 1
            total_bytes += entry[2]
            total_items += 1

        if total_items > 0:
            ans = [
                '',
                'global info',
                '-----------',
                '    number of files: %s' % total_items,
                '    number of unregistered files: %s (%01.1f%%)' % (total_unregistered,
                                                                     100 * total_unregistered / float(total_items)),
                '    total data size: %s MB' % (total_bytes / 1000,),
                '',
                'registered files',
                '----------------'
            ]
            registered_num = float(total_items - total_unregistered)
            if registered_num > 0:
                avg_used /= registered_num
                avg_health /= registered_num
                avg_age /= registered_num
                ans += [
                    '    average use: %01.1f' % avg_used,
                    '    average health: %01.1f' % avg_health,
                    '    average age: %s' % self._sec_to_hms(avg_age),
                    ''
                ]
            else:
                ans += ['    no registered files']
            print('\n'.join(ans))
        else:
            print('no cached data found in %s' % self._root_path)


class MetadataCleanup(object):

    def __init__(self, metadata):
        self._metadata = metadata

    def run(self):
        self._metadata.apply_on_entries(lambda db, key: db.set_ttl(key, 0))

if __name__ == '__main__':
    ACTIONS = ('status', 'process', 'clean_cache')
    autoconf.setup_logger(logger_name='conc_cache_cleanup', logging_level=logging.DEBUG)

    parser = argparse.ArgumentParser(description='A script to control UCNK metadata cache')
    parser.add_argument('action', metavar='ACTION', help='one of {%s}' % ', '.join(ACTIONS))
    parser.add_argument('--partition-prefix', '-p', type=str, default=None,
                        help='Process only items with specific first character (when hashed)')
    parser.add_argument('--corpus', '-c', type=str, help='A concrete corpus to be processed '
                        '(this can be combined with --partition-prefix)')
    parser.add_argument('--subdir', '-s', type=str, default='',
                        help='Process a specified subdirectory of configured cache directory')
    args = parser.parse_args()

    root_dir = autoconf.settings.get('corpora', 'cache_dir')
    if args.subdir:
        root_dir = '%s/%s' % (root_dir, args.subdir)
    factory = default_conc_cache.create_instance(autoconf.settings,
                                                 redis_db.create_instance(autoconf.settings.get('plugins', 'db')))

    if isinstance(factory.metadb, default_conc_cache.DummyMetadata):
        raise Exception('The script cannot work with %s. Please set other metadata db in config.xml.'
                        % (default_conc_cache.DummyMetadata.__name__,))

    if args.action == 'status':
        status = CacheInfo(db=factory.metadb, root_path=root_dir, partition_prefix=args.partition_prefix,
                           corpus=args.corpus)
        status.run()
    elif args.action == 'process':
        cleanup = CacheCleanup(root_dir, partition_prefix=args.partition_prefix, corpus=args.corpus,
                               cache_metadata=factory.metadb, ttl=3600 * 24)
        num_proc, num_removed = cleanup.run()
        autoconf.logger.info('processed: %d, removed: %d' % (num_proc, num_removed))
    elif args.action == 'clean_cache':
        mc = MetadataCleanup(factory.metadb)
        mc.run()
    else:
        print('Unknown action %s, one of {%s} is expected.' % (args.action, ', '.join(ACTIONS)))
        sys.exit(1)
