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
used by some of 'default_' modules. It key->value storage only but it is possible
to search by a key prefix.

Please note that this solution is not suitable for environments with
high concurrency (hundreds or more simultaneous users).
"""

import threading
import json
import sqlite3

thread_local = threading.local()


class DefaultDb(object):

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
        cursor.execute('SELECT value FROM data WHERE key = ?', (path,))
        ans = cursor.fetchone()
        if ans:
            return ans[0]
        return None

    def _save_raw_data(self, data, path):
        cursor = self._conn().cursor()
        cursor.execute('INSERT OR REPLACE INTO data (key, value) VALUES (?, ?)', (path, data))
        self._conn().commit()

    def load(self, key, default=None):
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
            return json.loads(raw_data)
        return default

    def save(self, data, key):
        """
        Saves 'data' with 'key'.

        arguments:
        data -- a dictionary containing data to be saved
        key -- an access key
        """
        self._save_raw_data(json.dumps(data), key)

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

    def all_with_key_prefix(self, prefix):
        """
        Finds all the values with keys starting with 'prefix'
        """
        ans = []
        cursor = self._conn().cursor()
        cursor.execute('SELECT value FROM data WHERE key LIKE ?', (prefix + '%',))
        for item in cursor.fetchall():
            ans.append(json.loads(item[0]))
        return ans


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return DefaultDb(conf)
