# Copyright (c) 2017 Charles University - Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import os
import os.path
import time
from datetime import datetime
from hashlib import sha1
import json
try:
    from elasticsearch import Elasticsearch
except ImportError:
    from .es_dummy import Elasticsearch


def get_disk_free_space(path):
    info = os.statvfs(path)
    return info.f_frsize * info.f_bavail


class Record(object):

    def __init__(self, path, age, size):
        self.path = path
        self.age = age
        self.size = size


class Monitor(object):

    def __init__(self, root_dir, db_plugin, entry_key_gen, min_file_age, free_capacity_goal, free_capacity_trigger,
                 elastic_conf):
        """
        arguments:
            root_dir -- cache root directory
            db_plugin -- KonText database plug-in
            entry_key_gen -- a function generating first level key for 
                             a specific corpus cache entries within key-value database 
            min_file_age -- a minimum age a cache file must be of to be deletable (in seconds) 
            free_capacity_goal -- a minimum capacity the task will try to free up in a single run (in bytes)
            free_capacity_trigger -- a maximum disk free capacity which triggers file removal process
            elastic_conf -- a tuple (URL, index, type) containing ElasticSearch server, index and document type
                            configuration for storing monitoring info; if None then the function is disabled
        """
        self._root_dir = root_dir
        self.db_plugin = db_plugin
        self.entry_key_gen = entry_key_gen
        self.min_file_age = min_file_age
        self.free_capacity_goal = free_capacity_goal
        self.free_capacity_trigger = free_capacity_trigger
        self.elastic_conf = elastic_conf
        self._data = []
        self._time = None

    def create_record(self, file_path):
        return Record(file_path, round(self._time - os.path.getctime(file_path)), os.path.getsize(file_path))

    def analyze_directory(self, path):
        for item in os.listdir(path):
            abs_path = os.path.join(path, item)
            if os.path.isdir(abs_path):
                self.analyze_directory(abs_path)
            else:
                self._data.append(self.create_record(abs_path))

    @staticmethod
    def create_doc_hash(doc):
        return sha1(json.dumps(doc).encode('utf-8')).hexdigest()

    def run(self):
        self._time = time.time()
        self._data = []
        self.analyze_directory(self._root_dir)
        free_sp = get_disk_free_space(self._root_dir)
        top_10 = self.get_10_largest_items_size()
        total_files = len(self._data)
        total_bytes = sum(v.size for v in self._data)

        ans = dict(datetime=self.export_timestamp(), top_10_sum_bytes=round(top_10 / 1e6), num_cache_files=total_files,
                   sum_cache_bytes=round(total_bytes / 1e6), disk_free_bytes=round(free_sp / 1e6))

        if free_sp < self.free_capacity_trigger:
            rm_ans = self.find_rm_candidates()
            ans.update(rm_ans)

        if self.elastic_conf:
            es = Elasticsearch([self.elastic_conf[0]])
            es.index(index=self.elastic_conf[1], doc_type=self.elastic_conf[2],
                     id=self.create_doc_hash(ans), body=ans)
        return ans

    def export_timestamp(self):
        return time.strftime('%Y-%m-%dT%H:%M:%S', datetime.fromtimestamp(self._time).timetuple())

    def get_10_largest_items_size(self):
        return sum(x.size for x in sorted(self._data, key=lambda x: x.size, reverse=True)[:10])

    def parse_conc_code(self, path):
        return self.entry_key_gen(os.path.basename(os.path.dirname(path))), os.path.basename(path)[:-len('.conc')]

    def find_rm_candidates(self):
        rmlist = sorted([v for v in self._data if v.age > self.min_file_age],
                        key=lambda v: v.size * v.age, reverse=True)
        total = 0
        i = 0
        errors = []
        while i < len(rmlist) and total < self.free_capacity_goal:
            try:
                key, key2 = self.parse_conc_code(rmlist[i].path)
                self.db_plugin.hash_del(key, key2)
                os.unlink(rmlist[i].path)
                total += rmlist[i].size
                i += 1
            except Exception as e:
                errors.append(e)
        return dict(num_removed=i, bytes_removed=total, num_errors=len(errors),
                    first_error=errors[0] if len(errors) > 0 else None)

    def remove_item(self):
        pass


def run(db_plugin, entry_key_gen, root_dir, min_file_age, free_capacity_goal, free_capacity_trigger,
        elastic_conf=None):
    """
    See Monitor.__init__() for arguments. 
    """
    monitor = Monitor(root_dir=root_dir, db_plugin=db_plugin, entry_key_gen=entry_key_gen,
                      min_file_age=min_file_age, free_capacity_goal=free_capacity_goal,
                      free_capacity_trigger=free_capacity_trigger, elastic_conf=elastic_conf)
    return monitor.run()
