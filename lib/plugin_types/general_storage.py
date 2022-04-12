# Copyright (c) 2017 Charles University, Faculty of Arts,
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import abc
from typing import Dict, List

from plugin_types.common import Serializable


class KeyValueStorage(abc.ABC):
    """
    A general key-value storage is a core data storage for KonText and its default
    plug-ins. The interface was written with [Redis](https://redis.io/) in mind
    but it should be easy to implement a solution with other back-ends too
    (including relational databases).

    Please note that the values passed to the storage are expected to be
    JSON-serializable (= int, float, bool, str, list, dict and no circular references).
    This applies not just for 'get', 'set' but also for 'hash_*', 'list_*'. I.e. calls
    like 'hash_set('foo', 'bar', {'x': 100}) must be accepted and the value must be
    properly serialized.
    """

    @abc.abstractmethod
    async def rename(self, key: str, new_key: str) -> None:
        """
        Rename an existing key to a new one. If the new value already
        exists then the record is overwritten.
        """

    @abc.abstractmethod
    async def list_get(self, key: str, from_idx: int = 0, to_idx: int = -1) -> List[Serializable]:
        """
        Return a stored list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        from_idx -- optional start index
        to_idx -- optional (default is -1) end index (including, i.e. unlike Python);
        negative values are supported (-1 = last, -2 = penultimate,...)
        """

    @abc.abstractmethod
    async def list_append(self, key: str, value: Serializable):
        """
        Add a value at the end of a list

        arguments:
        key -- data access key
        value -- value to be pushed
        """

    @abc.abstractmethod
    async def list_pop(self, key: str) -> Serializable:
        """
        Remove and return an element from the
        beginning of the list.

        """

    @abc.abstractmethod
    async def list_len(self, key: str) -> int:
        """
        Return length of a list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        """

    @abc.abstractmethod
    async def list_set(self, key: str, idx: int, value: Serializable):
        """
        Sets the list element at index to value

        arguments:
        key -- list access key
        idx -- a zero based index where the set should be performed
        value -- a value to be inserted
        """

    @abc.abstractmethod
    async def list_trim(self, key: str, keep_left: int, keep_right: int):
        """
        Trim the list from the beginning to keep_left - 1 and from keep_right to the end.
        The function does not return anything.

        arguments:
        key -- data access key
        keep_left -- the first value to be kept
        keep_right -- the last value to be kept
        """

    @abc.abstractmethod
    async def hash_get(self, key: str, field: str) -> Serializable:
        """
        Get a value from a hash table stored under the passed key. If there is no
        such field then None is returned.

        arguments:
        key -- data access key
        field -- hash table entry key
        """

    @abc.abstractmethod
    async def hash_set(self, key: str, field: str, value: Serializable):
        """
        Put a value into a hash table stored under the passed key

        arguments:
        key -- data access key
        field -- hash table entry key
        value -- a value to be stored
        """

    @abc.abstractmethod
    async def hash_del(self, key: str, field: str):
        """
        Removes a field from a hash item

        arguments:
        key -- hash item access key
        field -- the field to be deleted
        """

    @abc.abstractmethod
    async def hash_get_all(self, key: str) -> Dict[str, Serializable]:
        """
        Return a complete hash object (= Python dict) stored under the passed
        key. If the provided key is not present then an empty dict should be
        returned.

        arguments:
        key -- data access key
        """

    @abc.abstractmethod
    async def get(self, key: str, default: Serializable = None) -> Serializable:
        """
        Get a value stored with passed key
        and return its JSON decoded form.

        arguments:
        key -- data access key
        default -- a value to be returned in case there is no such key
        """

    @abc.abstractmethod
    async def set(self, key: str, data: Serializable):
        """
        Save 'data' with 'key'.

        arguments:
        key -- an access key
        data -- a dictionary containing data to be saved
        """

    @abc.abstractmethod
    async def remove(self, key: str):
        """
        Remove a value specified by a key

        arguments:
        key -- key of the data to be removed
        """

    @abc.abstractmethod
    async def exists(self, key: str) -> bool:
        """
        Test whether there is a value with the specified key

        arguments:
        key -- the key to be tested

        returns:
        boolean value
        """

    @abc.abstractmethod
    async def set_ttl(self, key: str, ttl: int):
        """
        Set auto expiration timeout in seconds.

        arguments:
        key -- data access key
        ttl -- number of seconds to wait before the value is removed
               (please note that update actions may reset the timer to zero
               which means you have to set_ttl again)
        """

    @abc.abstractmethod
    async def get_ttl(self, key: str) -> int:
        """
        Return number of seconds of item's TTL or -1 if it's not set

        arguments:
        key -- data access key
        """

    @abc.abstractmethod
    async def clear_ttl(self, key: str):
        """
        Make the record persistent again.

        key -- data access key
        """

    @abc.abstractmethod
    async def setnx(self, key: str, value):
        """
        An atomic operation "set if not exists".

        returns:
        1 if the key was set
        0 if the key was not set
        """

    @abc.abstractmethod
    async def getset(self, key, value):
        """
        An atomic operation which obtains current key first and then
        sets a new value under that key

        returns:
        previous key if any or None
        """

    @abc.abstractmethod
    async def incr(self, key, amount=1):
        """
        Increments the value of 'key' by 'amount'.  If no key exists,
        the value will be initialized as 'amount'
        """

    @abc.abstractmethod
    async def hash_set_map(self, key, mapping: Serializable):
        """
        Set key to value within hash 'name' for each corresponding
        key and value from the 'mapping' dict.
        Before setting, the values are json-serialized
        """

    @abc.abstractmethod
    async def keys(self, pattern: str = '*') -> List[str]:
        """
        Lists available keys by pattern
        """

    async def get_instance(self, plugin_id):
        """
        Return the current instance of the plug-in
        """
        return self
