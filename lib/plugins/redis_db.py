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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

"""
A simple implementation of a persistence mechanism applicable to default_* plugins
and based on Redis.

Please note that this concrete solution is not suitable for environments
with high concurrency (hundreds or more simultaneous users).
"""

import json

import redis

from abstract.general_storage import KeyValueStorage


class RedisDb(KeyValueStorage):

    def __init__(self, conf):
        """
        arguments:
        conf -- a dictionary containing 'settings' module compatible configuration of the plug-in
        """
        plugin_conf = conf.get('plugins', 'db')
        self.redis = redis.StrictRedis(
            host=plugin_conf['host'], port=int(plugin_conf['port'], db=int(plugin_conf['id'])))

    def list_get(self, key, from_idx=0, to_idx=-1):
        """
        Returns a stored list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        from_idx -- optional start index
        to_idx -- optional (default is -1) end index (excluded); negative values are supported just like in Python lists
        """
        return self.redis.lrange(key, from_idx, to_idx)

    def list_push(self, key, value):
        """
        Push a value at the end of a list

        arguments:
        key -- data access key
        value -- value to be pushed
        """
        self.redis.rpush(key, value)

    def list_len(self, key):
        """
        Returns length of a list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        """
        return self.redis.llen(key)

    def list_trim(self, key, keep_left, keep_right):
        """
        Trims the list from the beginning to keep_left - 1 and from keep_right to the end.
        The function does not return anything.

        arguments:
        key -- data access key
        keep_left -- the first value to be kept
        keep_right -- the last value to be kept
        """
        self.redis.ltrim(key, keep_left, keep_right)

    def get(self, key, default=None):
        """
        Gets a value stored with passed key and returns its JSON decoded form.

        arguments:
        key -- data access key
        default -- a value to be returned in case there is no such key
        """
        data = self.redis.get(key)
        if data:
            return json.loads(data)
        return default

    def set(self, key, data):
        """
        Saves 'data' with 'key'.

        arguments:
        key -- an access key
        data -- a dictionary containing data to be saved
        """
        self.redis.set(key, json.dumps(data))

    def set_ttl(self, key, ttl):
        """
        Set auto expiration timeout in seconds.

        arguments:
        key -- data access key
        ttl -- number of seconds to wait before the value is removed
        (please note that update actions reset the timer to zero)
        """
        self.redis.pexpire(key, ttl)

    def remove(self, key):
        """
        Removes a value specified by a key

        arguments:
        key -- key of the data to be removed
        """
        self.redis.delete(key)

    def exists(self, key):
        """
        Tests whether there is a value with the specified key

        arguments:
        key -- the key to be tested

        returns:
        boolean value
        """
        return self.redis.exists(key)


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return RedisDb(conf)
