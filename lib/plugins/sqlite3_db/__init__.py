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
A simple implementation of a persistence mechanism
used by the 'default_*' plug-ins. It offers key->value
storage only but it is possible to search by a key prefix too.

This specific version uses sqlite3 as a database backend but
it should be fairly easy to rewrite it to work with real
NoSQL engines like MongoDB, CouchDB, Redis etc.

Please note that this concrete solution is not suitable for environments
with high concurrency (hundreds or more simultaneous users).

The sqlite3 plugin stores data in a single table called "data" with the following structure:
CREATE TABLE data (key text PRIMARY KEY, value text, expires integer)
"""

import threading
import json
import time

import sqlite3

from plugins.abstract.general_storage import KeyValueStorage

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
            thread_local.conn = sqlite3.connect(self.conf.get('db_path'))
        return thread_local.conn

    def _delete_expired(self, key):
        cursor = self._conn().cursor()
        cursor.execute('SELECT expires FROM data WHERE key = ?', (key,))
        ans = cursor.fetchone()
        if ans and -1 < ans[0] < time.time():
            cursor.execute('DELETE FROM data WHERE key = ?', (key,))
            self._conn().commit()
        return None

    def _load_raw_data(self, key):
        self._delete_expired(key)
        cursor = self._conn().cursor()
        cursor.execute('SELECT value, expires FROM data WHERE key = ?', (key,))
        ans = cursor.fetchone()
        if ans:
            return ans
        return None

    def _save_raw_data(self, path, data):
        cursor = self._conn().cursor()
        cursor.execute('INSERT OR REPLACE INTO data (key, value, expires) VALUES (?, ?, ?)',
                       (path, data, -1))
        self._conn().commit()

    def rename(self, key, new_key):
        self._delete_expired(key)
        cursor = self._conn().cursor()
        cursor.execute('UPDATE data SET key = ? WHERE key = ?', (new_key, key))
        self._conn().commit()

    def list_get(self, key, from_idx=0, to_idx=-1):
        data = []
        raw_data = self._load_raw_data(key)
        if raw_data is not None:
            data = json.loads(raw_data[0])
            if type(data) is not list:
                raise TypeError('There is no list with key %s' % key)
            # simulate redis behavior - return values including the one at the end index:
            if to_idx < 0:
                to_idx = (len(data) + 1 + to_idx)
                if to_idx < 0:
                    to_idx = -len(data) - 1
            else:
                to_idx += 1
            data = data[from_idx:to_idx]
        return data

    def list_append(self, key, value):
        data = self.list_get(key)
        data.append(value)
        self.set(key, data)

    def list_pop(self, key):
        data = self.list_get(key)
        ans = data.pop(0)
        self.set(key, data)
        return ans

    def list_len(self, key):
        return len(self.list_get(key))

    def list_set(self, key, idx, value):
        data = self.list_get(key)
        data[idx] = value
        self.set(key, data)

    def list_trim(self, key, keep_left, keep_right):
        data = self.list_get(key, keep_left, keep_right)
        self.set(key, data)

    def hash_get(self, key, field):
        data = self.get(key)
        if type(data) is not dict:
            return {}
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

    def hash_del(self, key, field):
        sdata = self._load_raw_data(key)
        data = json.loads(sdata[0])
        if field in data:
            del data[field]
        if len(data):
            self._save_raw_data(key, json.dumps(data))
        else:
            self.remove(key)

    def hash_get_all(self, key):
        """
        Returns a complete hash object (= Python dict) stored under the passed
        key. If the provided key is not present then an empty dict is returned.

        arguments:
        key -- data access key
        """
        sdata = self._load_raw_data(key)
        return json.loads(sdata[0]) if sdata is not None else {}

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
        if type(data) is dict:
            d2 = dict((k, v)
                      for k, v in list(data.items()) if not k.startswith('__') and not k.endswith('__'))
        else:
            d2 = data
        self._save_raw_data(key, json.dumps(d2))

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
        self._delete_expired(key)
        cursor = self._conn().cursor()
        cursor.execute('SELECT COUNT(*) FROM data WHERE key = ?', (key,))
        return cursor.fetchone()[0] > 0

    def set_ttl(self, key, ttl):
        """
        Set auto expiration timeout in seconds.

        arguments:
        key -- data access key
        ttl -- number of seconds to wait before the value is removed
        (please note that set/update actions reset the timer to zero)
        """
        self._delete_expired(key)
        if self.exists(key):
            cursor = self._conn().cursor()
            cursor.execute('UPDATE data SET expires = ? WHERE key = ?', (time.time() + ttl, key))
            self._conn().commit()
        return None

    def get_ttl(self, key):
        cursor = self._conn().cursor()
        cursor.execute('SELECT expires FROM data WHERE key = ?', (key,))
        return cursor.fetchone()[0]

    def clear_ttl(self, key):
        self._delete_expired(key)
        if self.exists(key):
            cursor = self._conn().cursor()
            cursor.execute('UPDATE data SET expires = -1 WHERE key = ?', (key,))
            self._conn().commit()
        return None

    def incr(self, key, amount=1):
        """
        Increments the value of 'key' by 'amount'.  If no key exists,
        the value will be initialized as 'amount'
        """
        val = self.get(key)
        if val is None:
            val = 0
        val += amount
        self.set(key, val)
        return val

    def hash_set_map(self, key, mapping):
        """
        Set key to value within hash 'name' for each corresponding
        key and value from the 'mapping' dict.
        """
        self.set(key, mapping)
        return True


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return DefaultDb(conf.get('plugins', 'db'))
