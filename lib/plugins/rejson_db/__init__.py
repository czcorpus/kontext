# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandlk@gmail.com>
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

import aioredis
import json
from util import as_sync
from plugin_types.general_storage import KeyValueStorage
import logging


class RejsonDb(KeyValueStorage):

    def __init__(self, conf, encoder=None, decoder=None):
        """
        arguments:
        conf -- a dictionary containing 'settings' module compatible configuration of the plug-in
        """

        self._pool = aioredis.ConnectionPool(
            max_connections=int(conf.get('max_connections', 10)),
            host=conf['host'],
            port=int(conf['port']),
            db=int(conf['id']),
        )

        as_sync(self._check_rejson_db())

    async def _check_rejson_db(self):
        try:
            async with self.redis as conn:
                await conn.execute_command('JSON.GET', '-')
        except aioredis.ResponseError as e:
            if 'unknown command' in str(e):
                logging.fatal("Rejson DB Plug-in requires Redis with RedisJSON module enabled")
            else:
                raise e

    @property
    def redis(self):
        return aioredis.Redis(connection_pool=self._pool)

    async def rename(self, key, new_key):
        async with self.redis as conn:
            await conn.rename(key, new_key)

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
        data = await self.get(key, [])
        if isinstance(data, list):
            if to_idx == -1:
                return data[from_idx:]
            return data[from_idx:to_idx + 1]
        raise TypeError('Object is not a list')

    async def list_append(self, key, value):
        """
        Add a value at the end of a list

        arguments:
        key -- data access key
        value -- value to be pushed
        """
        async with self.redis as conn:
            if not await conn.exists(key):
                await conn.execute_command('JSON.SET', key, '.', json.dumps([]))
            await conn.execute_command('JSON.ARRAPPEND', key, '.', json.dumps(value))

    async def list_pop(self, key):
        """
        Removes and returns the first element of the list stored at key.

        arguments:
        key -- list access key
        """
        async with self.redis as conn:
            return json.loads(await conn.execute_command('JSON.ARRPOP', key, '.', -1))

    async def list_len(self, key):
        """
        Returns length of a list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        """
        async with self.redis as conn:
            if not await conn.exists(key):
                return 0
            return await conn.execute_command('JSON.ARRLEN', key, '.')

    async def list_set(self, key, idx, value):
        """
        Sets the list element at index to value

        arguments:
        key -- list access key
        idx -- a zero based index where the set should be performed
        value -- a JSON-serializable value to be inserted
        """
        # TODO the operation pair should be atomic to avoid possible race conditions
        async with self.redis as conn:
            await conn.execute_command('JSON.ARRPOP', key, '.', idx)
            await conn.execute_command('JSON.INSERT', key, '.', idx, json.dumps(value))

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
            await conn.execute_command('JSON.ARRTRIM', key, '.', keep_left, keep_right)

    async def hash_get(self, key, field):
        """
        Gets a value from a hash table stored under the passed key

        arguments:
        key -- data access key
        field -- hash table entry key
        """
        async with self.redis as conn:
            if await conn.execute_command('JSON.TYPE', key, f'["{field}"]') is None:
                return None
            return json.loads(await conn.execute_command('JSON.GET', key, f'["{field}"]'))

    async def hash_set(self, key, field, value):
        """
        Puts a value into a hash table stored under the passed key

        arguments:
        key -- data access key
        field -- hash table entry key
        value -- a value to be stored
        """
        async with self.redis as conn:
            if not await conn.exists(key):
                await conn.execute_command('JSON.SET', key, '.', json.dumps({}))
            await conn.execute_command('JSON.SET', key, f'["{field}"]', json.dumps(value))

    async def hash_del(self, key, field):
        """
        Removes a field from a hash item

        arguments:
        key -- hash item access key
        field -- the field to be deleted
        """
        async with self.redis as conn:
            await conn.execute_command('JSON.DEL', key, f'["{field}"]')

    async def hash_get_all(self, key):
        """
        Returns a complete hash object (= Python dict) stored under the passed
        key. If the provided key is not present then an empty dict is returned.

        arguments:
        key -- data access key
        """
        return await self.get(key)

    async def get(self, key, default=None):
        """
        Gets a value stored with passed key and returns its JSON decoded form.

        arguments:
        key -- data access key
        default -- a value to be returned in case there is no such key
        """
        async with self.redis as conn:
            data = await conn.execute_command('JSON.GET', key, '.')

        if data is None:
            return default
        return json.loads(data)

    async def set(self, key, data):
        """
        Saves 'data' with 'key'.

        arguments:
        key -- an access key
        data -- a dictionary containing data to be saved
        """
        async with self.redis as conn:
            await conn.execute_command('JSON.SET', key, '.', json.dumps(data))

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
            await conn.persist(key)

    async def remove(self, key):
        """
        Removes a value specified by a key

        arguments:
        key -- key of the data to be removed
        """
        async with self.redis as conn:
            await conn.execute_command('JSON.DEL', key, '.')

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
            await conn.execute_command('JSON.SET', key, '.', json.dumps(value), 'NX')

    async def getset(self, key, value):
        """
        An atomic operation which obtains current key first and then
        sets a new value under that key

        returns:
        previous key if any or None
        """
        async with self.redis as conn:
            data = await conn.execute_command('JSON.GET', key, '.')
            await conn.execute_command('JSON.SET', key, '.', json.dumps(value))
        return json.loads(data)

    async def incr(self, key, amount=1):
        """
        Increments the value of 'key' by 'amount'.  If no key exists,
        the value will be initialized as 'amount'
        """
        async with self.redis as conn:
            if not await conn.exists(key):
                await conn.execute_command('JSON.SET', key, '.', 0)
            await conn.execute_command('JSON.NUMINCRBY', key, '.', amount)

    async def hash_set_map(self, key, mapping):
        """
        Set key to value within hash 'name' for each corresponding
        key and value from the 'mapping' dict.
        Before setting, the values are json-serialized
        """
        async with self.redis as conn:
            await conn.execute_command('JSON.SET', key, '.', json.dumps(mapping))


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return RejsonDb(conf.get('plugins', 'db'))
