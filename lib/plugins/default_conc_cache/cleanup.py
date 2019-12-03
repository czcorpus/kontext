# Copyright (c) 2016 Institute of the Czech National Corpus
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
This script performs a clean-up of KonText concordance cache with Redis-based
key->cache_file mapping. It always tries to clean all the files which are older
than defined TTL value. To decrease number of files processed at once, TTL can be
set smaller or the script can be run more often.

It is intended to be used along with 'redis_conc_cache' and 'redis_db'. If you have
alternative compatible modules you can modify imports 'from plugins import ...'
to your custom values and everything should work well.
"""

import sys
import os
import argparse
import time
import collections
import json
import logging


DEFAULT_TTL = 60  # in minutes


class CacheFiles(object):

    def __init__(self, root_path, subdir, corpus):
        self._root_path = root_path
        self._subdir = subdir
        self._corpus = corpus
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
        a dict [corpus_id] => [list of 3-tuples]
        where 3-tuple is
        (cache_file_abs_path, age_of_file_in_sec, size_of_file_in_Bytes)
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
                corpus_key = corpus_dir if not self._subdir else '%s/%s' % (
                    self._subdir, corpus_dir)
                ans[corpus_key].append(
                    (cache_full_path,
                     self._curr_time - os.path.getmtime(cache_full_path),
                     os.path.getsize(cache_full_path))
                )
        return ans


class CacheCleanup(CacheFiles):

    def __init__(self, db, root_path, corpus, ttl, subdir, entry_key_gen):
        super(CacheCleanup, self).__init__(root_path, subdir, corpus)
        self._db = db
        self._ttl = ttl
        self._entry_key_gen = entry_key_gen
        self._num_processed = 0
        self._num_removed = 0

    @staticmethod
    def _log_stats(files):
        for k, v in list(files.items()):
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
           2.1 find which files are old enough (see TTL) to be deleted
           2.2 find an cache map entry in Redis and iterate over records found there
             2.2.1 if a record matches a file which is waiting to be deleted, then both the
                    file and the record are removed
             2.2.2 if a record does not match any existing file than it is removed with
                   logged warning about a stale record
           2.3 if there are still some files to be deleted it means that they are 'unbound'
               (= there is no record in the respective cache map file);
                these files are also deleted with a warning

        Please note that this algorithm is unable to remove stale cache map entries as long
        as there is no existing file within a matching directory (e.g. there is a bunch
        of records for the "syn2010" corpus in Redis but the cache directory "/path/to/cache/syn2010"
        is empty). During normal operation, the system should be able to fix such consistency
        deviations. But it is a good idea to check the mapping from time to time whether there
        are no stale records (e.g. after a corpus was removed/blocked).

        arguments:
        dry_run -- if True then no actual writing/deleting is performed
        """
        num_deleted = 0
        num_processed = 0

        cache_files = self.list_dir()
        self._log_stats(cache_files)

        to_del = {}
        # processing corpus by corpus
        for corpus_id, corpus_cache_files in list(cache_files.items()):
            real_file_hashes = set()  # to be able to compare cache map with actual files
            for cache_entry in corpus_cache_files:
                num_processed += 1
                item_key = os.path.basename(cache_entry[0]).rsplit('.conc')[0]
                real_file_hashes.add(item_key)
                if self._ttl < cache_entry[1] / 60.:
                    to_del[item_key] = cache_entry[0]

            cache_key = self._entry_key_gen(corpus_id)
            cache_map = self._db.hash_get_all(cache_key)
            if cache_map:
                try:
                    for item_hash, _ in list(cache_map.items()):
                        if item_hash in to_del:
                            if not dry_run:
                                os.unlink(to_del[item_hash])
                                self._db.hash_del(cache_key, item_hash)
                            else:
                                del to_del[item_hash]
                            num_deleted += 1
                        elif item_hash not in real_file_hashes:
                            if not dry_run:
                                self._db.hash_del(cache_key, item_hash)
                            logging.getLogger().warn(
                                'deleted stale cache map entry [%s][%s]' % (cache_key, item_hash))
                except Exception as ex:
                    logging.getLogger().warn('Failed to process cache map file (will be deleted): %s' % (ex,))
                    self._db.remove(cache_key)
            else:
                logging.getLogger().error('Cache map [%s] not found' % cache_key)
                for item_hash, unbound_file in list(to_del.items()):
                    if not dry_run:
                        try:
                            os.unlink(unbound_file)
                        except OSError as ex:
                            logging.getLogger().warning('Failed to remove file %s: %s' % (unbound_file, ex))
                    logging.getLogger().warn('deleted unbound cache file: %s' % unbound_file)

        ans = {'type': 'summary', 'processed': num_processed, 'deleted': num_deleted}
        logging.getLogger(__name__).info(json.dumps(ans))
        return ans


def run(root_dir, corpus_id, ttl, subdir, dry_run, db_plugin, entry_key_gen):
    proc = CacheCleanup(db=db_plugin, root_path=root_dir, corpus=corpus_id, ttl=ttl, subdir=subdir,
                        entry_key_gen=entry_key_gen)
    return proc.run(dry_run=dry_run)
