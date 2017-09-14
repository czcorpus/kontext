# Copyright (c) 2017 Institute of the Czech National Corpus
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
unittests for the redis and sqlite3 database plugins
where possible, the result of identical operations on the two plugins is checked against each other
with list operations, the result is verified against a control list created alongside the database lists
setting test parameters allows turning on/of verbose mode and test of ttl methods

The sqlite3 plugin stores data in a single table called "data" with the following columns and datatypes:
CREATE TABLE data (key text PRIMARY KEY, value text, updated integer, expires integer)

TO-DO:
Check whether the original "updated" column is really necessary.
Perhaps it was only used in the "all_with_key_prefix" method, which is planned to be omitted.
Or is the "data" table used by any classes outside of the plugin?
"""

import unittest
import redis
import sqlite3
import time

from redis_db import RedisDb
from sqlite3_db import DefaultDb

# set test parameters
test_ttl_methods = True  # set to False to speed up by skipping ttl testing which involves time.sleep()
verbose = True  # set to True to get some additional details, e.g. list contents etc.


class DbTest(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(DbTest, self).__init__(*args, **kwargs)
        # establish connections
        # redis direct connection:
        self.rd = redis.StrictRedis('localhost', 6379, 0)
        # redis plugin connection:
        conf = {'default:host': 'localhost', 'default:port': 6379, 'default:id': 0}
        self.r = RedisDb(conf)
        # sqlite3 direct connection:
        self.sd = sqlite3.connect('test.db')
        # sqlite3 plugin connection:
        conf = {'default:db_path': 'test.db'}
        self.s = DefaultDb(conf)
        # drop and re-create the sqlite3 table called "data" with the correct structure
        self.sd.execute("DROP TABLE IF EXISTS data")
        self.sd.execute("CREATE TABLE data (key text PRIMARY KEY, value text, updated integer, expires integer)")
        self.sd.commit()

    def setUp(self):
        # delete data before each test
        self.rd.flushdb()
        self.sd.execute('delete from data')
        self.sd.commit()

    def test_set_and_get(self):
        """
        test the set & get methods
        """
        key = 'foo'
        value = 'bar'
        self.r.set(key, value)
        self.s.set(key, value)
        outR = self.r.get(key)
        outS = self.s.get(key)
        if verbose:
            print "\nTesting set & get"
            print "redis type: ", type(outR)
            print "sqlite type: ", type(outS)
        self.assertEqual(outR, outS)

    def test_list_get_and_list_append(self):
        """
        test the list_append and list_get methods
        in case of error: check whether the key column is declared as PRIMARY KEY
        """
        checkList = []
        key = 'list'
        length = 5
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
            checkList.append(i)
        outR = self.r.list_get(key)
        outS = self.s.list_get(key)
        if verbose:
            print "\nTesting list_get & list_append"
            print "redis type: ", type(outR)
            print "sqlite type: ", type(outS)
        self.assertTrue(outR == outS == checkList)

    def test_list_get_with_range(self):
        """
        test the list_append and list_get methods
        in case of error: check whether the key column is declared as PRIMARY KEY
        note that redis returns the range including the value at the end index (unlike python),
        thus the sqlite3 plugin should behave in the same way

        the test allows specifying multiple value combinations
        for the from_idx & to_idx parameters (in the "ranges" list)
        to test various scenarios
        """
        checkList = []
        key = 'list'
        length = 10
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
            checkList.append(i)

        ranges = [
            [0, -1],
            [2, 5],
            [2, -3],
            [0, -10],
            [1, -20],
            [-1, 0],
            [7, 5]
        ]
        outRedis = []
        outSQLite = []
        outCheckList = []

        for pair in ranges:
            from_idx = pair[0]
            to_idx = pair[1]
            outR = self.r.list_get(key, from_idx, to_idx)
            outS = self.s.list_get(key, from_idx, to_idx)
            if (to_idx < 0):
                to_idx = (len(checkList) + 1 + to_idx)
                if (to_idx < 0):
                    to_idx = -len(checkList) - 1
            else:
                to_idx += 1
            checkListRange = checkList[from_idx:to_idx]
            outRedis.append(outR)
            outSQLite.append(outS)
            outCheckList.append(checkListRange)

            if verbose:
                print "\nTesting list_get with range specified: ", pair
                print "redis:  ", outR
                print "sqlite: ", outS
                print "check:  ", checkListRange

        self.assertTrue(outRedis == outSQLite == outCheckList)

    def test_list_len(self):
        """
        test the list_len method
        """
        key = 'list'
        length = 5
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
        outR = self.r.list_len(key)
        outS = self.s.list_len(key)
        self.assertTrue(outR == outS == length)

    def test_list_pop(self):
        """
        test the list_pop method, which is supposed to pop the first (or leftmost) value in the list
        """
        checkList = []
        key = 'list'
        length = 5
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
            checkList.append(i)
        self.r.list_pop(key)
        self.s.list_pop(key)
        checkList.pop(0)
        outR = self.r.list_get(key)
        outS = self.s.list_get(key)
        self.assertTrue(outR == outS == checkList)

    def test_list_set(self):
        """
        test the list_set method
        TO-DO: test out of range index - redis throws error, while sqlite3 does not
        """
        checkList = []
        key = 'list'
        length = 5
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
            checkList.append(i)

        setPosition = 3
        setValue = 'check'
        self.r.list_set(key, setPosition, setValue)
        self.s.list_set(key, setPosition, setValue)
        checkList[setPosition] = setValue
        outR = self.r.list_get(key)
        outS = self.s.list_get(key)
        self.assertTrue(outR == outS == checkList)

    def test_list_trim_with_range(self):
        """
        test the list_trim method
        the test allows specifying multiple value combinations
        for the keep_left & keep_right parameters (in the "ranges" list)
        to test various scenarios
        """
        ranges = [
            [0, -1],
            [2, 5],
            [2, -3],
            [0, -10],
            [1, -20],
            [-1, 0],
            [7, 5]
        ]
        outRedis = []
        outSQLite = []
        outCheckList = []

        for pair in ranges:
            key = 'list'
            length = 10
            self.r.remove(key)
            self.s.remove(key)
            checkList = []

            for i in range(0, length):
                self.r.list_append(key, i)
                self.s.list_append(key, i)
                checkList.append(i)

            keep_left = pair[0]
            keep_right = pair[1]
            self.r.list_trim(key, keep_left, keep_right)
            self.s.list_trim(key, keep_left, keep_right)
            outR = self.r.list_get(key)
            outS = self.s.list_get(key)

            if (keep_right < 0):
                keep_right = (len(checkList) + 1 + keep_right)
                if (keep_right < 0):
                    keep_right = -len(checkList) - 1
            else:
                keep_right += 1
            checkListRange = checkList[keep_left:keep_right]
            outRedis.append(outR)
            outSQLite.append(outS)
            outCheckList.append(checkListRange)

            if verbose:
                print "\nTesting list_trim with range specified: ", pair
                print "redis:  ", outR
                print "sqlite: ", outS
                print "check:  ", checkListRange

        self.assertTrue(outRedis == outSQLite == outCheckList)

    def test_hash_set_and_hash_get(self):
        """
        test the set & get methods
        """
        key = 'foo'
        field = 'field'
        value = 'bar'
        self.r.hash_set(key, field, value)
        self.s.hash_set(key, field, value)
        outR = self.r.hash_get(key, field)
        outS = self.s.hash_get(key, field)
        if verbose:
            print "\nTesting hash_set & hash_get"
            print "redis type: ", type(outR)
            print "sqlite type: ", type(outS)
        self.assertEqual(outR, outS)

    def test_rename(self):
        """
        test the rename method - a clear error here in sqlite rename logic, see:
        cursor.execute('UPDATE data SET key = ? WHERE key = ?', (key, new_key))
        should be the other way round:
        cursor.execute('UPDATE data SET key = ? WHERE key = ?', (new_key, key))

        furthermore, there is a difference in behavior in case the old key does not exist anymore:
        redis throws an error, while sqlite does not
        (because the where condition in the sql UPDATE statement is just not met)
        should we throw an error here?
        """
        oldKey = 'old'
        newKey = 'new'
        value = 'val'
        self.r.set(oldKey, value)
        self.s.set(oldKey, value)
        self.r.rename(oldKey, newKey)
        self.s.rename(oldKey, newKey)
        outR = self.r.get(newKey)
        outS = self.s.get(newKey)
        self.assertEqual(outR, outS)

    def test_exists(self):
        """
        test the exists method
        """
        key = 'foo'
        value = 'bar'
        self.r.set(key, value)
        self.s.set(key, value)
        outR = self.r.exists(key)
        outS = self.s.exists(key)
        self.assertTrue(outR == outS == True)

    def test_remove(self):
        """
        test the remove method
        """
        key = 'foo'
        value = 'bar'
        self.r.set(key, value)
        self.s.set(key, value)
        self.r.remove(key)
        self.s.remove(key)
        outR = self.r.exists(key)
        outS = self.s.exists(key)
        self.assertTrue(outR == outS == False)

    def test_set_ttl(self):
        """
        test the set_ttl method
        set ttl to 2 secs; after 1 sec the value should exist; after another second, it should not
        """
        if test_ttl_methods:
            print "testing set_ttl:"
            key = 'foo'
            value = 'bar'
            self.r.set(key, value)
            self.s.set(key, value)
            self.r.set_ttl(key, 2)
            self.s.set_ttl(key, 2)
            time.sleep(1)
            outR = [self.r.exists(key)]
            outS = [self.s.exists(key)]
            time.sleep(1)
            outR.append(self.r.exists(key))
            outS.append(self.s.exists(key))
            if verbose:
                print "redis: ", outR, " sqlite: ", outS
            self.assertTrue(outR == outS == [True, False])

    def test_clear_ttl(self):
        """
        test the clear_ttl method
        set ttl to 2 secs; after 1 sec, clear the ttl value; after another second, the value should still exist
        """
        if test_ttl_methods:
            print "testing clear_ttl:"
            key = 'foo'
            value = 'bar'
            self.r.set(key, value)
            self.s.set(key, value)
            self.r.set_ttl(key, 2)
            self.s.set_ttl(key, 2)
            time.sleep(1)
            outR = [self.r.exists(key)]
            outS = [self.s.exists(key)]
            self.r.clear_ttl(key)
            self.s.clear_ttl(key)
            time.sleep(1)
            outR.append(self.r.exists(key))
            outS.append(self.s.exists(key))
            if verbose:
                print "redis: ", outR, " sqlite: ", outS
            self.assertTrue(outR == outS == [True, True])

    def test_set_ttl(self):
        """
        test the set_ttl method
        set ttl to 2 secs; after 1 sec the value should exist; after another second, it should not
        """
        if test_ttl_methods:
            print "testing set_ttl:"
            key = 'foo'
            value = 'bar'
            self.r.set(key, value)
            self.s.set(key, value)
            self.r.set_ttl(key, 2)
            self.s.set_ttl(key, 2)
            time.sleep(1)
            outR = [self.r.exists(key)]
            outS = [self.s.exists(key)]
            time.sleep(1)
            outR.append(self.r.exists(key))
            outS.append(self.s.exists(key))
            if verbose:
                print "redis: ", outR, " sqlite: ", outS
            self.assertTrue(outR == outS == [True, False])


if __name__ == '__main__':
    unittest.main()
