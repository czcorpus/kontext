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
A simple implementation of a persistence mechanism
used by the 'default_*' plug-ins. It offers key->value
storage only but it is possible to search by a key prefix too.

This specific version uses sqlite3 as a database backend but
it should be fairly easy to rewritten it to work with real
NoSQL engines like MongoDB, CouchDB, Redis etc.

Please note that this concrete solution is not suitable for environments
with high concurrency (hundreds or more simultaneous users).
"""

import threading
import json
import time

import sqlite3

from abstract.general_storage import KeyValueStorage

thread_local = threading.local()


class DefaultDb(KeyValueStorage):

    def __init__(self, conf):
        """
        arguments:
        conf -- a dictionary containing 'settings' module compatible configuration of the plug-in
        """
        self.conf = conf

    def _conn(self):
        """
        Returns thread-local connection
        """
        if not hasattr(thread_local, 'conn'):
            thread_local.conn = sqlite3.connect(self.conf.get('default:db_path'))
        return thread_local.conn

    def _load_raw_data(self, path):
        cursor = self._conn().cursor()
        cursor.execute('SELECT value, updated FROM data WHERE key = ?', (path,))
        ans = cursor.fetchone()
        if ans:
            return ans
        return None

    def _save_raw_data(self, path, data):
        cursor = self._conn().cursor()
        cursor.execute('INSERT OR REPLACE INTO data (key, value, updated) VALUES (?, ?, ?)',
                       (path, data, int(time.time())))
        self._conn().commit()

    def list_get(self, key, from_idx=0, to_idx=-1):
        data = []
        raw_data = self._load_raw_data(key)
        if raw_data is not None:
            data = json.loads(raw_data[0])
            if type(data) is not list:
                raise TypeError('There is no list with key %s' % key)
            data = data[from_idx:(len(data) + 1 + to_idx)]
        return data

    def list_push(self, key, value):
        data = self.list_get(key)
        data.append(value)
        self.set(key, data)

    def list_len(self, key):
        return len(self.list_get(key))

    def list_trim(self, key, keep_left, keep_right):
        data = self.list_get(key, keep_left, keep_right)
        self.set(key, data)

    def hash_get(self, key, field):
        data = self.get(key)
        if type(data) is not dict:
            raise TypeError('hash_get - required value "%s" is not a dict' % key)
        return data.get(field, None)

    def hash_set(self, key, field, value):
        """
        Puts a value into a hash table stored under the passed key

        arguments:
        key -- data access key
        field -- hash table entry key
        value -- a value to be stored
        """
        data = self.get(key)
        if type(data) is not dict:
            data = {}
        data[field] = value
        self.set(key, data)

    def hash_get_all(self, key):
        """
        Returns a complete hash object (= Python dict) stored under the passed
        key. If the provided key is not present then an empty dict is returned.

        arguments:
        key -- data access key
        """
        data = self.get(key)
        if type(data) is not dict:
            raise TypeError('hash_get_all - required value "%s" is not a dict' % key)
        return data if data is not None else {}

    def get(self, key, default=None):
        """
        Loads data from key->value storage

        arguments:
        key -- an access key
        default -- optional value to be returned in case no data is found under the 'key'

        returns:
        a dictionary containing respective data
        """
        raw_data = self._load_raw_data(key)
        if raw_data is not None:
            data = json.loads(raw_data[0])
            if type(data) is dict:
                data['__timestamp__'] = raw_data[1]
                data['__key__'] = key
            return data
        return default

    def set(self, key, data):
        """
        Saves 'data' with 'key'.

        arguments:
        key -- an access key
        data -- a dictionary containing data to be saved
        """
        self._save_raw_data(key, json.dumps(data))

    def remove(self, key):
        """
        Deletes data with passed access key

        arguments:
        key -- an access key
        """
        conn = self._conn()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM data WHERE key = ?', (key,))
        conn.commit()

    def exists(self, key):
        """
        Tests whether the 'key' exists in the storage

        arguments:
        key -- an access key

        returns:
        boolean answer
        """
        cursor = self._conn().cursor()
        cursor.execute('SELECT COUNT(*) FROM data WHERE key = ?', (key,))
        return cursor.fetchone()[0] > 0

    def all_with_key_prefix(self, prefix, oldest_first=False, limit=None):
        """
        Finds all the values with keys starting with 'prefix'
        """
        ans = []
        cursor = self._conn().cursor()
        params = [prefix + '%']

        sql = 'SELECT value, key, updated FROM data WHERE key LIKE ?'
        if oldest_first:
            sql += ' ORDER by updated'
        else:
            sql += ' ORDER by key'
        if limit is not None:
            sql += ' LIMIT ?'
            params.append(limit)
        cursor.execute(sql, tuple(params))
        for item in cursor.fetchall():
            data = json.loads(item[0])
            data['__timestamp__'] = item[2]
            data['__key__'] = item[1]
            ans.append(data)
        return ans


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return DefaultDb(conf.get('plugins', 'db'))
