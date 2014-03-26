#!/usr/bin/env python
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

import sqlite3
import json
from functools import wraps
import threading

# thread local instance stores a database connection to
# allow operating in a multi-threaded environment
local_inst = threading.local()


def cached(f):
    """
    A decorator which tries to look for a key in cache before
    actual storage is invoked. If cache miss in encountered
    then the value is stored to the cache to be available next
    time.
    """
    @wraps(f)
    def wrapper(self, attr_map):
        if len(attr_map) < 2:
            ans = self.from_cache(attr_map)
            if ans:
                return json.loads(ans)
        ans = f(self, attr_map)
        if len(attr_map) < 2:
            self.to_cache(attr_map, ans)
        return ans
    return wrapper


class AttrArgs(object):
    """
    Stores a multi-value dictionary and allows an export
    to SQL WHERE expression as used by the plugin.
    E.g.: attributes = { 'key1' : ['value1_1', 'value1_2'], 'key2' : ['value2_1'] }
    leads to the following SQL "component": (key1 = ? OR key1 = ?) AND (key2 = ?)
    and attached values: ('value1_1', 'value1_2', 'value2_1') as used by cursor.execute()
    """
    def __init__(self, data):
        """
        arguments:
        data -- a dictionary where values are either lists or single values
        """
        self.data = data

    def __len__(self):
        return len(self.data)

    def export_sql(self):
        """
        Exports data into a SQL WHERE expression

        returns:
        a SQL WHERE expression in conjunctive normal form
        """
        ans = []
        sql_values = []
        for key, values in self.data.items():
            if key.startswith('div.'):
                key = key.replace('div.', '', 1)
            key = key.replace('.', '_')  # TODO does this work in general?
            cnf_item = []
            if type(values) is list or type(values) is tuple:
                for value in values:
                    cnf_item.append('%s = ?' % key)
                    sql_values.append(value)
            else:
                cnf_item.append('%s = ?' % key)
                sql_values.append(values)
            ans.append('(%s)' % ' OR '.join(cnf_item))
        return ' AND '.join(ans), tuple(sql_values)


class LiveAttributes(object):

    ATTRS = ('corpus_id', 'doc_id', 'doc_txtype', 'txtype', 'original', 'srclang', 'transsex', 'authsex', 'doc_pubyear', 'pubyear')

    def __init__(self, db_path):
        self.db_path = db_path

    def db(self):
        """
        Returns thread-local database connection to a sqlite3 database
        """
        if not hasattr(local_inst, 'db'):
            local_inst.db = sqlite3.connect(self.db_path)
        return local_inst.db

    def from_cache(self, attr_map):
        """
        Loads a value from cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        attr_map -- a dictionary of attributes and values

        returns:
        a stored value matching provided argument or None if nothing is found
        """
        key = json.dumps(attr_map)
        cursor = self.db().cursor()
        cursor.execute("SELECT value FROM cache WHERE key = ?", (key,))
        ans = cursor.fetchone()
        if ans:
            return ans[0]
        return None

    def to_cache(self, attr_map, values):
        """
        Stores a data object "values" into the cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        attr_map -- a dictionary of attributes and values
        values -- a dictionary with arbitrary nesting level
        """
        key = json.dumps(attr_map)
        value = json.dumps(values)
        cursor = self.db().cursor()
        cursor.execute("INSERT INTO cache (key, value) VALUES (?, ?)", (key, value))
        self.db().commit()

    @staticmethod
    def export_key(k):
        if k == 'corpus_id':
            return k
        elif k.startswith('doc'):
            return k.replace('_', '.')
        else:
            return 'div.%s' % k.replace('_', '.')

    @staticmethod
    def import_key(k):
        if k == 'corpus_id':
            return k
        else:
            ans = k.replace('div.', '', 1)
            ans.replace('_', '.')
            return ans

    @cached
    def get_attr_values(self, attr_map):
        """
        Finds all the available values of remaining attributes

        arguments:
        attr_map -- a dictionary of attributes and values as selected by a user

        returns:
        a dictionary containing matching attributes and values
        """
        cursor = self.db().cursor()
        srch_attrs = set(LiveAttributes.ATTRS) - set(attr_map.keys())
        srch_attr_map = dict([(x[1], x[0]) for x in enumerate(srch_attrs)])
        attr_items = AttrArgs(attr_map)
        where_sql, where_values = attr_items.export_sql()

        if len(attr_items) > 0:
            sql_template = "SELECT DISTINCT %s FROM div WHERE %s" % (', '.join(srch_attrs), where_sql)
        else:
            sql_template = "SELECT DISTINCT %s FROM div" % (', '.join(srch_attrs),)

        ans = {}
        ans.update(attr_map)
        cursor.execute(sql_template, where_values)

        for attr in srch_attrs:
            ans[attr] = set()

        for item in cursor.fetchall():
            for attr in srch_attrs:
                v = item[srch_attr_map[attr]]
                if v is not None and v != '':
                    ans[attr].add(item[srch_attr_map[attr]])

        exported = {}
        for k in ans.keys():
            exported[self.export_key(k)] = tuple(sorted(ans[k]))
        return exported

    def get_js_module(self):
        """
        Path must be relative to the files/js/plugins directory
        """
        return 'ucnkLiveAttributes'


def create_instance(settings):
    """
    creates an instance of the plugin
    """
    return LiveAttributes(settings.get('plugins', 'live_attributes')['ucnk:db_path'])
