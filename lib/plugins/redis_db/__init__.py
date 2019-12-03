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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

"""
A simple implementation of a persistence mechanism applicable to default_* plugins
and based on RedisDB in-memory database engine.

This plug-in should be able to handle high-load installations without any problems.

required XML: please see config.rng
"""

import json
import redis
from plugins.abstract.general_storage import KeyValueStorage


class RedisDb(KeyValueStorage):
    def __init__(self, conf):
        """
        arguments:
        conf -- a dictionary containing 'settings' module compatible configuration of the plug-in
        """
        self._host = conf['default:host']
        self._port = int(conf['default:port'])
        self._db = int(conf['default:id'])
        self.redis = redis.StrictRedis(host=self._host, port=self._port, db=self._db)
        self._scan_chunk_size = 50

    def fork(self):
        """
        Return a new instance of the plug-in with the same connection
        parameters.

        This method is used only in case multiprocessing is configured
        for asynchronous tasks (i.e. in case 'celery' or 'konserver' is used, it is
        never called).
        """
        return RedisDb({
            'default:host': self._host,
            'default:port': self._port,
            'default:id': self._db
        })

    def rename(self, key, new_key):
        return self.redis.rename(key, new_key)

    def list_get(self, key, from_idx=0, to_idx=-1):
        """
        Returns a stored list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        from_idx -- optional start index
        to_idx -- optional (default is -1) end index (including, i.e. unlike Python);
        negative values are supported (-1 = last, -2 = penultimate,...)
        """
        return [json.loads(s) for s in self.redis.lrange(key, from_idx, to_idx)]

    def list_append(self, key, value):
        """
        Add a value at the end of a list

        arguments:
        key -- data access key
        value -- value to be pushed
        """
        self.redis.rpush(key, json.dumps(value))

    def list_pop(self, key):
        """
        Removes and returns the first element of the list stored at key.

        arguments:
        key -- list access key
        """
        return json.loads(self.redis.lpop(key))

    def list_len(self, key):
        """
        Returns length of a list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        """
        return self.redis.llen(key)

    def list_set(self, key, idx, value):
        """
        Sets the list element at index to value

        arguments:
        key -- list access key
        idx -- a zero based index where the set should be performed
        value -- a JSON-serializable value to be inserted
        """
        return self.redis.lset(key, idx, json.dumps(value))

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

    def hash_get(self, key, field):
        """
        Gets a value from a hash table stored under the passed key

        arguments:
        key -- data access key
        field -- hash table entry key
        """
        v = self.redis.hget(key, field)
        return json.loads(v) if v else None

    def hash_set(self, key, field, value):
        """
        Puts a value into a hash table stored under the passed key

        arguments:
        key -- data access key
        field -- hash table entry key
        value -- a value to be stored
        """
        self.redis.hset(key, field, json.dumps(value))

    def hash_del(self, key, field):
        """
        Removes a field from a hash item

        arguments:
        key -- hash item access key
        field -- the field to be deleted
        """
        self.redis.hdel(key, field)

    def hash_get_all(self, key):
        """
        Returns a complete hash object (= Python dict) stored under the passed
        key. If the provided key is not present then an empty dict is returned.

        arguments:
        key -- data access key
        """
        return dict((k, json.loads(v)) for k, v in list(self.redis.hgetall(key).items()))

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
        self.redis.expire(key, ttl)

    def get_ttl(self, key):
        return self.redis.ttl(key)

    def clear_ttl(self, key):
        self.redis.persist(key)

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

    def setnx(self, key, value):
        """
        An atomic operation "set if not exists".

        returns:
        1 if the key was set
        0 if the key was not set
        """
        return self.redis.setnx(key, value)

    def getset(self, key, value):
        """
        An atomic operation which obtains current key first and then
        sets a new value under that key

        returns:
        previous key if any or None
        """
        return self.redis.getset(key, value)

    def incr(self, key, amount=1):
        """
        Increments the value of 'key' by 'amount'.  If no key exists,
        the value will be initialized as 'amount'
        """
        return self.redis.incr(key, amount)

    def hash_set_map(self, key, mapping):
        """
        Set key to value within hash 'name' for each corresponding
        key and value from the 'mapping' dict.
        Before setting, the values are json-serialized
        """
        new_mapping = {}
        for name in mapping:
            new_mapping[name] = json.dumps(mapping[name])
        return self.redis.hmset(key, new_mapping)


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return RedisDb(conf.get('plugins', 'db'))
