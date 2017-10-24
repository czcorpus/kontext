# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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
The classes to mock the connection to a redis store directly as well as the connection to the redis_db plugin
So far, they are used in the ucnk_conc_persistence3 tests only, so they mock just the necessary methods
"""

import json


class MockRedisCommon:
    def __init__(self):
        self.concordances = []
        self.arch_queue = []


class MockRedisDirect(object):
    """
    mock the necessary methods of direct connection to redis, that are used
    in the Archiver class
    """
    conc_prefix = "concordance:"

    def __init__(self, concordances, arch_queue):
        self.concordances = concordances
        self.arch_queue = arch_queue

    def set(self, key, data):
        """
        Saves 'data' with 'key'.

        arguments:
        key -- an access key
        data -- a dictionary containing data to be saved
        """
        self.concordances.append([key, data])

    def set_ttl(self, key, ttl):
        pass

    def get(self, key, default=None):
        res = default
        for t in self.concordances:
            if t[0] == key:
                res = t[1]
                break
        return res

    def lpop(self, arch_key):
        # param arch_key is only used to simulate a redis call
        return self.arch_queue.pop(0)

    def llen(self, key):
        if key == "conc_arch_queue":
            return len(self.arch_queue)

    def rpush(self, archive_queue_key, value_dict):
        self.arch_queue.append(value_dict)

    def lpush(self, archive_queue_key, value_dict):
        self.arch_queue = [value_dict] + self.arch_queue

    # ----------------
    # extra methods:
    # ----------------
    def clear(self):
        del self.arch_queue[:]
        del self.concordances[:]

    def get_first_key(self):
        return self.concordances[0][0]

    def get_arch_queue(self):
        return self.arch_queue

    def get_concordances(self):
        return self.concordances

    def print_arch_queue(self):
        for i in self.arch_queue:
            print (i)

    def print_concordances(self):
        for i in self.concordances:
            print (i)

    def get_keys(self):
        keys = []
        for i in self.concordances:
            keys.append(i[0][len(self.conc_prefix):])
        return keys

    def fill_concordances(self, size):
        for i in range(0, size):
            self.concordances.append((self.conc_prefix + 'key' + str(i), json.dumps('value' + str(i))))

    def fill_arch_queue(self, size):
        for i in range(0, size):
            item = dict(key=json.dumps('key' + str(i)))
            self.arch_queue.append(item)


class MockRedisPlugin(MockRedisDirect):
    """
    mock the necessary methods of connection to the redis plugin, that are used
    in the ConcPersistence class
    """

    def __init__(self, *args, **kwargs):
        super(MockRedisPlugin, self).__init__(*args, **kwargs)

    def get(self, key, default=None):
        data = super(MockRedisPlugin, self).get(key)
        if data:
            return json.loads(data)
        return default

    def set(self, key, data):
        super(MockRedisPlugin, self).set(key, json.dumps(data))

    def list_append(self, archive_queue_key, value_dict):
        self.arch_queue.append(json.dumps(value_dict))
