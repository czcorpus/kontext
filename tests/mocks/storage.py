# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

import json

from plugin_types.general_storage import KeyValueStorage


class TestingKeyValueStorage(KeyValueStorage):
    """
    A simple non-persistent storage for unit testing
    """

    def __init__(self, data=None):
        self._data = data if data is not None else {}

    def reset(self):
        self._data.clear()

    async def list_get(self, key, from_idx=0, to_idx=-1):
        return self._data[key][from_idx:to_idx]

    async def list_set(self, key, idx, value):
        self._data[key][idx] = value

    async def list_append(self, key, value):
        if key not in self._data:
            self._data[key] = []
        self._data[key].append(value)

    async def list_pop(self, key):
        return self._data[key].pop(0)

    async def list_len(self, key):
        if key not in self._data:
            return 0
        return len(self._data[key])

    async def list_trim(self, key, keep_left, keep_right):
        """
        Trims the list from the beginning to keep_left - 1 and from keep_right to the end.
        The function does not return anything.

        arguments:
        key -- data access key
        keep_left -- the first value to be kept
        keep_right -- the last value to be kept
        """
        raise NotImplementedError()

    def _check_valid_hash(self, key):
        if key in self._data and type(self._data[key]) is not dict:
            raise Exception('Not a hash type')  # TODO exception type

    def _check_valid_str(self, key):
        if key in self._data and type(self._data[key]) not in (str, str):
            raise Exception('Not a simple type')  # TODO exception type

    async def hash_get(self, key, field):
        self._check_valid_hash(key)
        return json.loads(self._data[key].get(field, '{}'))

    async def hash_set(self, key, field, value):
        if key not in self._data:
            self._data[key] = {}
        self._data[key][field] = json.dumps(value)

    async def hash_del(self, key, *fields):
        self._check_valid_hash(key)
        for item in fields:
            del self._data[key][item]

    async def hash_get_all(self, key):
        self._check_valid_hash(key)
        return dict((k, json.loads(v)) for k, v in list(self._data[key].items()))

    async def get(self, key, default=None):
        self._check_valid_str(key)
        return self._data.get(key, default)

    async def set(self, key, data):
        self._data[key] = data

    async def remove(self, key):
        if key in self._data:
            del self._data[key]

    async def exists(self, key):
        return key in self._data

    async def set_ttl(self, key, ttl):
        pass

    async def clear_ttl(self, key):
        pass

    async def get_ttl(self, key):
        pass

    async def rename(self, key, new_key):
        pass

    async def setnx(self, key, value):
        pass

    async def getset(self, key, value):
        pass

    async def incr(self, key, amount=1):
        pass

    async def hash_set_map(self, key, mapping):
        pass

    async def keys(self, pattern):
        pass
