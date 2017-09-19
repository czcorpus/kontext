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

"""
Contains unittests for the redis and sqlite3 database plugins.
Where possible, the results of identical operations on the two plugins are checked against each other.
With list operations, the results are verified against a control list created alongside the database lists.
Test parameters allow to turn on/off the verbose mode and the ttl methods testing.

The sqlite3 plugin stores data in a single table called "data" with the following structure:
CREATE TABLE data (key text PRIMARY KEY, value text, expires integer)
"""

import unittest
import redis
import sqlite3
import time
from plugins.redis_db import RedisDb
from plugins.sqlite3_db import DefaultDb

# set test parameters
test_ttl_methods = True  # set to False to speed up by skipping ttl testing which involves time.sleep()
verbose = False  # set to True to get some additional details, e.g. list contents etc.


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
        self.sd.execute("CREATE TABLE data (key text PRIMARY KEY, value text, expires integer)")
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
        value = ('bar', 1, 'cheese', 2.5)
        self.r.set(key, value)
        self.s.set(key, value)
        out_r = self.r.get(key)
        out_s = self.s.get(key)
        self.assertEqual(out_r, out_s)

    def test_list_get_and_list_append(self):
        """
        test the list_append and list_get methods
        in case of error: check whether the key column is declared as PRIMARY KEY
        """
        check_list = []
        key = 'list'
        length = 5
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
            check_list.append(i)
        out_r = self.r.list_get(key)
        out_s = self.s.list_get(key)
        self.assertTrue(out_r == out_s == check_list)

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
        checklist = []
        key = 'list'
        length = 10
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
            checklist.append(i)

        ranges = [
            [0, -1],
            [2, 5],
            [2, -3],
            [0, -10],
            [1, -20],
            [-1, 0],
            [7, 5]
        ]
        out_redis = []
        out_sqlite = []
        out_checklist = []

        for pair in ranges:
            from_idx = pair[0]
            to_idx = pair[1]
            out_r = self.r.list_get(key, from_idx, to_idx)
            out_s = self.s.list_get(key, from_idx, to_idx)
            if to_idx < 0:
                to_idx = (len(checklist) + 1 + to_idx)
                if to_idx < 0:
                    to_idx = -len(checklist) - 1
            else:
                to_idx += 1
            checklist_range = checklist[from_idx:to_idx]
            out_redis.append(out_r)
            out_sqlite.append(out_s)
            out_checklist.append(checklist_range)

            if verbose:
                print "\nTesting list_get with range specified: ", pair
                print "redis:  ", out_r
                print "sqlite: ", out_s
                print "check:  ", checklist_range

        self.assertTrue(out_redis == out_sqlite == out_checklist)

    def test_list_len(self):
        """
        test the list_len method
        """
        key = 'list'
        length = 5
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
        out_r = self.r.list_len(key)
        out_s = self.s.list_len(key)
        self.assertTrue(out_r == out_s == length)

    def test_list_pop(self):
        """
        test the list_pop method, which is supposed to pop the first (or leftmost) value in the list
        """
        checklist = []
        key = 'list'
        length = 5
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
            checklist.append(i)
        self.r.list_pop(key)
        self.s.list_pop(key)
        checklist.pop(0)
        out_r = self.r.list_get(key)
        out_s = self.s.list_get(key)
        self.assertTrue(out_r == out_s == checklist)

    def test_list_set(self):
        """
        test the list_set method
        TO-DO: test out of range index - redis throws error, while sqlite3 does not
        """
        checklist = []
        key = 'list'
        length = 5
        for i in range(0, length):
            self.r.list_append(key, i)
            self.s.list_append(key, i)
            checklist.append(i)

        set_position = 3
        set_value = 'check'
        self.r.list_set(key, set_position, set_value)
        self.s.list_set(key, set_position, set_value)
        checklist[set_position] = set_value
        out_r = self.r.list_get(key)
        out_s = self.s.list_get(key)
        self.assertTrue(out_r == out_s == checklist)

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
        out_redis = []
        out_sqlite = []
        out_checklist = []

        for pair in ranges:
            key = 'list'
            length = 10
            self.r.remove(key)
            self.s.remove(key)
            checklist = []

            for i in range(0, length):
                self.r.list_append(key, i)
                self.s.list_append(key, i)
                checklist.append(i)

            keep_left = pair[0]
            keep_right = pair[1]
            self.r.list_trim(key, keep_left, keep_right)
            self.s.list_trim(key, keep_left, keep_right)
            out_r = self.r.list_get(key)
            out_s = self.s.list_get(key)

            if keep_right < 0:
                keep_right = (len(checklist) + 1 + keep_right)
                if keep_right < 0:
                    keep_right = -len(checklist) - 1
            else:
                keep_right += 1
            checklist_range = checklist[keep_left:keep_right]
            out_redis.append(out_r)
            out_sqlite.append(out_s)
            out_checklist.append(checklist_range)

            if verbose:
                print "\nTesting list_trim with range specified: ", pair
                print "redis:  ", out_r
                print "sqlite: ", out_s
                print "check:  ", checklist_range

        self.assertTrue(out_redis == out_sqlite == out_checklist)

    def test_hash_set_and_hash_get(self):
        """
        test the hash_set & hash_get methods
        """
        key = 'foo'
        field = 'field'
        value = 'bar'
        self.r.hash_set(key, field, value)
        self.s.hash_set(key, field, value)
        out_r = self.r.hash_get(key, field)
        out_s = self.s.hash_get(key, field)
        self.assertEqual(out_r, out_s)

    def test_hash_del(self):
        """
        test the hash_del method
        """
        key = 'foo'
        field1 = 'f1'
        value1 = 'val1'
        field2 = 'f2'
        value2 = 'val21'
        field3 = 'f3'
        value3 = 'val3'
        # create hash records:
        self.r.hash_set(key, field1, value1)
        self.s.hash_set(key, field1, value1)
        self.r.hash_set(key, field2, value2)
        self.s.hash_set(key, field2, value2)
        self.r.hash_set(key, field3, value3)
        self.s.hash_set(key, field3, value3)
        # and delete them:
        self.r.hash_del(key, field1)
        self.s.hash_del(key, field1)
        out_r = self.r.hash_get_all(key)
        out_s = self.s.hash_get_all(key)
        if verbose:
            print "\nTesting hash_del:"
            print "redis: ", out_r, " sqlite: ", out_s
        self.assertEqual(out_r, out_s)

    def test_hash_get_all(self):
        """
        test the hash_del method
        """
        key = 'foo'
        field1 = 'f1'
        value1 = 'val1'
        field2 = 'f2'
        value2 = 'val21'
        field3 = 'f3'
        value3 = 'val3'
        # create hash records:
        self.r.hash_set(key, field1, value1)
        self.s.hash_set(key, field1, value1)
        self.r.hash_set(key, field2, value2)
        self.s.hash_set(key, field2, value2)
        self.r.hash_set(key, field3, value3)
        self.s.hash_set(key, field3, value3)
        out_r = self.r.hash_get_all(key)
        out_s = self.s.hash_get_all(key)
        if verbose:
            print "\nTesting hash_get_all:"
            print "redis: ", out_r, " sqlite: ", out_s
        self.assertEqual(out_r, out_s)

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
        old_key = 'old'
        new_key = 'new'
        value = 'val'
        self.r.set(old_key, value)
        self.s.set(old_key, value)
        self.r.rename(old_key, new_key)
        self.s.rename(old_key, new_key)
        out_r = self.r.get(new_key)
        out_s = self.s.get(new_key)
        self.assertEqual(out_r, out_s)

    def test_exists(self):
        """
        test the exists method
        """
        key = 'foo'
        value = 'bar'
        self.r.set(key, value)
        self.s.set(key, value)
        out_r = self.r.exists(key)
        out_s = self.s.exists(key)
        self.assertEqual(out_r, out_s)

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
        out_r = self.r.exists(key)
        out_s = self.s.exists(key)
        self.assertEqual(out_r, out_s)

    def test_set_ttl(self):
        """
        test the set_ttl method
        set ttl to 2 secs; after 1 sec the value should exist; after another second, it should not
        """
        if test_ttl_methods:
            key = 'foo'
            value = 'bar'
            self.r.set(key, value)
            self.s.set(key, value)
            self.r.set_ttl(key, 2)
            self.s.set_ttl(key, 2)
            time.sleep(1)
            out_r = [self.r.exists(key)]
            out_s = [self.s.exists(key)]
            time.sleep(1)
            out_r.append(self.r.exists(key))
            out_s.append(self.s.exists(key))
            if verbose:
                print "testing set_ttl:"
                print "redis: ", out_r, " sqlite: ", out_s
            self.assertTrue(out_r == out_s == [True, False])

    def test_clear_ttl(self):
        """
        test the clear_ttl method
        set ttl to 2 secs; after 1 sec, clear the ttl value; after another second, the value should still exist
        """
        if test_ttl_methods:
            key = 'foo'
            value = 'bar'
            self.r.set(key, value)
            self.s.set(key, value)
            self.r.set_ttl(key, 2)
            self.s.set_ttl(key, 2)
            time.sleep(1)
            out_r = [self.r.exists(key)]
            out_s = [self.s.exists(key)]
            self.r.clear_ttl(key)
            self.s.clear_ttl(key)
            time.sleep(1)
            out_r.append(self.r.exists(key))
            out_s.append(self.s.exists(key))
            if verbose:
                print "testing clear_ttl:"
                print "redis: ", out_r, " sqlite: ", out_s
            self.assertTrue(out_r == out_s == [True, True])

    def test_fork(self):
        """
        test the fork method:
        create forks in both plugins, set key-value pairs in the forks
        and check whether the same result gets returned
        """
        key = 'foo'
        value = 'bar'
        r1 = self.r.fork()
        s1 = self.s.fork()
        s1.set(key, value)
        r1.set(key, value)
        out_r = r1.get(key)
        out_s = s1.get(key)
        self.assertEqual(out_r, out_s)


if __name__ == '__main__':
    unittest.main()
