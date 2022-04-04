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
import aioredis
from plugin_types.general_storage import KeyValueStorage


class RedisDb(KeyValueStorage):
    def __init__(self, conf):
        """
        arguments:
        conf -- a dictionary containing 'settings' module compatible configuration of the plug-in
        """
        self._host = conf['host']
        self._port = int(conf['port'])
        self._db = int(conf['id'])
        self._pool = aioredis.ConnectionPool(
            max_connections=10, host=self._host, port=self._port, db=self._db)
        self._scan_chunk_size = 50

    @property
    def redis(self):
        return aioredis.Redis(self._pool)

    async def rename(self, key, new_key):
        async with self.redis as conn:
            return await conn.rename(key, new_key)

    async def list_get(self, key, from_idx=0, to_idx=-1):
        """
        Returns a stored list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        from_idx -- optional start index
        to_idx -- optional (default is -1) end index (including, i.e. unlike Python);
        negative values are supported (-1 = last, -2 = penultimate,...)
        """
        async with self.redis as conn:
            return [json.loads(s) for s in (await conn.lrange(key, from_idx, to_idx))]

    async def list_append(self, key, value):
        """
        Add a value at the end of a list

        arguments:
        key -- data access key
        value -- value to be pushed
        """
        async with self.redis as conn:
            await conn.rpush(key, json.dumps(value))

    async def list_pop(self, key):
        """
        Removes and returns the first element of the list stored at key.

        arguments:
        key -- list access key
        """
        async with self.redis as conn:
            tmp = await conn.lpop(key)
        return json.loads(tmp) if tmp is not None else None

    async def list_len(self, key):
        """
        Returns length of a list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        """
        async with self.redis as conn:
            return await conn.llen(key)

    async def list_set(self, key, idx, value):
        """
        Sets the list element at index to value

        arguments:
        key -- list access key
        idx -- a zero based index where the set should be performed
        value -- a JSON-serializable value to be inserted
        """
        async with self.redis as conn:
            return await conn.lset(key, idx, json.dumps(value))

    async def list_trim(self, key, keep_left, keep_right):
        """
        Trims the list from the beginning to keep_left - 1 and from keep_right to the end.
        The function does not return anything.

        arguments:
        key -- data access key
        keep_left -- the first value to be kept
        keep_right -- the last value to be kept
        """
        async with self.redis as conn:
            await conn.ltrim(key, keep_left, keep_right)

    async def hash_get(self, key, field):
        """
        Gets a value from a hash table stored under the passed key

        arguments:
        key -- data access key
        field -- hash table entry key
        """
        async with self.redis as conn:
            v = await conn.hget(key, field)
        return json.loads(v) if v else None

    async def hash_set(self, key, field, value):
        """
        Puts a value into a hash table stored under the passed key

        arguments:
        key -- data access key
        field -- hash table entry key
        value -- a value to be stored
        """
        async with self.redis as conn:
            await conn.hset(key, field, json.dumps(value))

    async def hash_del(self, key, field):
        """
        Removes a field from a hash item

        arguments:
        key -- hash item access key
        field -- the field to be deleted
        """
        async with self.redis as conn:
            await conn.hdel(key, field)

    async def hash_get_all(self, key):
        """
        Returns a complete hash object (= Python dict) stored under the passed
        key. If the provided key is not present then an empty dict is returned.

        arguments:
        key -- data access key
        """
        async with self.redis as conn:
            return {
                k.decode('utf-8'): json.loads(v)
                for k, v in (await conn.hgetall(key)).items()
            }

    async def get(self, key, default=None):
        """
        Gets a value stored with passed key and returns its JSON decoded form.

        arguments:
        key -- data access key
        default -- a value to be returned in case there is no such key
        """
        async with self.redis as conn:
            data = await conn.get(key)
        if data:
            return json.loads(data)
        return default

    async def set(self, key, data):
        """
        Saves 'data' with 'key'.

        arguments:
        key -- an access key
        data -- a dictionary containing data to be saved
        """
        async with self.redis as conn:
            await conn.set(key, json.dumps(data))

    async def set_ttl(self, key, ttl):
        """
        Set auto expiration timeout in seconds.

        arguments:
        key -- data access key
        ttl -- number of seconds to wait before the value is removed
        (please note that update actions reset the timer to zero)
        """
        async with self.redis as conn:
            await conn.expire(key, ttl)

    async def get_ttl(self, key):
        async with self.redis as conn:
            return await conn.ttl(key)

    async def clear_ttl(self, key):
        async with self.redis as conn:
            return await conn.persist(key)

    async def remove(self, key):
        """
        Removes a value specified by a key

        arguments:
        key -- key of the data to be removed
        """
        async with self.redis as conn:
            await conn.delete(key)

    async def exists(self, key):
        """
        Tests whether there is a value with the specified key

        arguments:
        key -- the key to be tested

        returns:
        boolean value
        """
        async with self.redis as conn:
            return await conn.exists(key)

    async def setnx(self, key, value):
        """
        An atomic operation "set if not exists".

        returns:
        1 if the key was set
        0 if the key was not set
        """
        async with self.redis as conn:
            return await conn.setnx(key, value)

    async def getset(self, key, value):
        """
        An atomic operation which obtains current key first and then
        sets a new value under that key

        returns:
        previous key if any or None
        """
        async with self.redis as conn:
            return await conn.getset(key, value)

    async def incr(self, key, amount=1):
        """
        Increments the value of 'key' by 'amount'.  If no key exists,
        the value will be initialized as 'amount'
        """
        async with self.redis as conn:
            return await conn.incr(key, amount)

    async def hash_set_map(self, key, mapping):
        """
        Set key to value within hash 'name' for each corresponding
        key and value from the 'mapping' dict.
        Before setting, the values are json-serialized
        """
        new_mapping = {}
        for name in mapping:
            new_mapping[name] = json.dumps(mapping[name])
        async with self.redis as conn:
            return await conn.hmset(key, new_mapping)


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return RedisDb(conf.get('plugins', 'db'))
