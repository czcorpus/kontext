import sys
import os
import argparse
import hashlib
import math

sys.path.insert(0, '%s/../..' % os.path.realpath(os.path.dirname(__file__)))

import autoconf
from plugins import default_conc_cache
from plugins import redis_db


def strhash(s):
    return hashlib.sha1(s).hexdigest()


def calc_health(filesize, num_used):
    math.log(filesize, 10) / float(num_used)


class FSCache(object):

    def __init__(self, root_path, partition_prefix, cache_metadata, ttl):
        self._root_path = root_path
        self._partition_prefix = partition_prefix
        self._db = cache_metadata
        self._ttl = ttl

    def list_dir(self, path):
        for corpus_dir in os.listdir(path):
            corp_full_path = '%s/%s' % (path, corpus_dir)
            if not os.path.isdir(corp_full_path):
                continue
            for cache_file in os.listdir(corp_full_path):
                cache_full_path = '%s/%s' % (corp_full_path, cache_file)
                if os.path.isdir(cache_full_path) or cache_file in ('run', '00CONCS.map'):  # TODO check
                    continue
                h = strhash(cache_full_path)
                if not self._partition_prefix or h.find(self._partition_prefix) == 0:
                    yield cache_full_path, h, os.path.getsize(cache_full_path)

    def analyze_item(self, item):
        path, path_hash, filesize = item
        data = self._db.load_item(path_hash)
        if len(data) > 0:
            data['health'] -= calc_health(filesize, data['counter'])
            if data['health'] <= 0:
                self._db.remove_item(path_hash)
                os.unlink(path)
            else:
                self._db.save_item(path_hash, data)

    def run(self):
        map(self.analyze_item, self.list_dir(self._root_path))


if __name__ == '__main__':
    autoconf.setup_logger(logger_name='conc_cache_cleanup')

    parser = argparse.ArgumentParser(description='A script to control UCNK metadata cache')
    parser.add_argument('action', metavar='ACTION', help='one of {status, process}')
    parser.add_argument('--partition-prefix', '-p', type=str, default=None,
                        help='Process only items with specific first character (when hashed)')
    parser.add_argument('--subdir', '-s', type=str, default='',
                        help='Process a specified subdirectory of configured cache directory')
    args = parser.parse_args()

    root_dir = autoconf.settings.get('corpora', 'cache_dir')
    if args.subdir:
        root_dir = '%s/%s' % (root_dir, args.subdir)
    factory = default_conc_cache.create_instance(autoconf.settings,
                                                 redis_db.create_instance(autoconf.settings.get('plugins', 'db')))
    metadb = factory.get_metadb()
    if isinstance(metadb, default_conc_cache.DummyMetadata):
        raise Exception('The script cannot work with %s. Please set other metadata db in config.xml.'
                        % (default_conc_cache.DummyMetadata.__name__,))
    fscache = FSCache(root_dir, partition_prefix=args.partition_prefix, cache_metadata=metadb,
                      ttl=3600 * 24)
    fscache.run()
