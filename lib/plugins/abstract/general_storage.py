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


class KeyValueStorage(object):
    """
    A general key-value storage as needed by default_* plugins
    """

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
        raise NotImplementedError()

    def list_append(self, key, value):
        """
        Add a value at the end of a list

        arguments:
        key -- data access key
        value -- value to be pushed
        """
        raise NotImplementedError()

    def list_pop(self, key):
        """
        Remove and return an element from the
        beginning of the list.

        """
        raise NotImplementedError()

    def list_len(self, key):
        """
        Returns length of a list. If there is a non-list value stored with the passed key
        then TypeError is raised.

        arguments:
        key -- data access key
        """
        raise NotImplementedError()

    def list_trim(self, key, keep_left, keep_right):
        """
        Trims the list from the beginning to keep_left - 1 and from keep_right to the end.
        The function does not return anything.

        arguments:
        key -- data access key
        keep_left -- the first value to be kept
        keep_right -- the last value to be kept
        """
        raise NotImplementedError()

    def hash_get(self, key, field):
        """
        Gets a value from a hash table stored under the passed key. If there is no
        such field then None is returned.

        arguments:
        key -- data access key
        field -- hash table entry key
        """
        raise NotImplementedError()

    def hash_set(self, key, field, value):
        """
        Puts a value into a hash table stored under the passed key

        arguments:
        key -- data access key
        field -- hash table entry key
        value -- a value to be stored
        """
        raise NotImplementedError()

    def hash_del(self, key, *fields):
        """
        Removes one or more fields from a hash item

        arguments:
        key -- hash item access key
        *fields -- one or more fields to be deleted
        """
        raise NotImplementedError()

    def hash_get_all(self, key):
        """
        Returns a complete hash object (= Python dict) stored under the passed
        key. If the provided key is not present then an empty dict should be
        returned.

        arguments:
        key -- data access key
        """
        raise NotImplementedError()

    def get(self, key, default=None):
        """
        Gets a value stored with passed key and returns its JSON decoded form.

        arguments:
        key -- data access key
        default -- a value to be returned in case there is no such key
        """
        raise NotImplementedError()

    def set(self, key, data):
        """
        Saves 'data' with 'key'.

        arguments:
        key -- an access key
        data -- a dictionary containing data to be saved
        """
        raise NotImplementedError()

    def remove(self, key):
        """
        Removes a value specified by a key

        arguments:
        key -- key of the data to be removed
        """
        raise NotImplementedError()

    def exists(self, key):
        """
        Tests whether there is a value with the specified key

        arguments:
        key -- the key to be tested

        returns:
        boolean value
        """
        raise NotImplementedError()

    def set_ttl(self, key, ttl):
        """
        Set auto expiration timeout in seconds.

        arguments:
        key -- data access key
        ttl -- number of seconds to wait before the value is removed
        (please note that update actions may reset the timer to zero)
        """
        pass

    def apply_on_entries(self, fn, match):
        """
        Iterates through keys matching provided argument "match" and
        applies function "fn" in a following manner: fn(self, key).

        It should not be expected from the implementations that they
        handle real-time changes of data in a 'transaction-like' way,
        i.e. elements may disappear, re-enter etc.
        """
        pass
