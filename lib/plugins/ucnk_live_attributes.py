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

import re
import sqlite3
import json
from functools import wraps
import threading

import strings

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
    def wrapper(self, corpus, attr_map):
        db = self.db(corpus.get_conf('NAME'))
        if len(attr_map) < 2:
            ans = self.from_cache(db, attr_map)
            if ans:
                return ans
        ans = f(self, corpus, attr_map)
        if len(attr_map) < 2:
            self.to_cache(db, attr_map, ans)
        return self.format_data_types(ans)
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
            key = key.replace('.', '_')
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

    def __init__(self, corptree):
        self.corptree = corptree

    def db(self, corpname):
        """
        Returns thread-local database connection to a sqlite3 database
        """
        if not hasattr(local_inst, 'db'):
            local_inst.db = {}
        if not corpname in local_inst.db:
            db_path = self.corptree.get_corpus_info(corpname).get('metadata', None)
            if db_path:
                local_inst.db[corpname] = sqlite3.connect(db_path)
            else:
                local_inst.db[corpname] = None
        return local_inst.db[corpname]

    def is_enabled_for(self, corpname):
        """
        Returns True if live attributes are enabled for selected corpus else returns False
        """
        return self.db(corpname) is not None

    @staticmethod
    def format_data_types(data):
        for k in data.keys():
            if type(data[k]) is int or type(data[k]) is float or (type(data[k]) is str and data[k].isdigit()):
                data[k] = strings.format_number(data[k])
        return data

    @staticmethod
    def from_cache(db, attr_map):
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
        cursor = db.cursor()
        cursor.execute("SELECT value FROM cache WHERE key = ?", (key,))
        ans = cursor.fetchone()
        if ans:
            return LiveAttributes.format_data_types(json.loads(ans[0]))
        return None

    @staticmethod
    def to_cache(db, attr_map, values):
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
        cursor = db.cursor()
        cursor.execute("INSERT INTO cache (key, value) VALUES (?, ?)", (key, value))
        db.commit()

    @staticmethod
    def export_key(k):
        if k == 'corpus_id':
            return k
        return k.replace('_', '.', 1)

    @staticmethod
    def _get_subcorp_attrs(corpus):
        return [x.replace('.', '_', 1) for x in re.split(r'\s*[,|]\s*', corpus.get_conf('SUBCORPATTRS'))]

    @cached
    def get_attr_values(self, corpus, attr_map, raw_input_attr_map):
        """
        Finds all the available values of remaining attributes

        arguments:
        corpus -- manatee.corpus object
        attr_map -- a dictionary of attributes and values as selected by a user
        raw_input_attr_map -- a list of attributes with simple raw input

        returns:
        a dictionary containing matching attributes and values
        """
        attrs = self._get_subcorp_attrs(corpus)
        cursor = self.db(corpus.get_conf('NAME')).cursor()
        srch_attrs = set(attrs) - set(attr_map.keys())
        srch_attrs.add('poscount')
        srch_attr_map = dict([(x[1], x[0]) for x in enumerate(srch_attrs)])
        attr_items = AttrArgs(attr_map)
        where_sql, where_values = attr_items.export_sql()

        if len(attr_items) > 0:
            sql_template = "SELECT %s FROM item WHERE %s" % (', '.join(srch_attrs), where_sql)
        else:
            sql_template = "SELECT %s FROM item" % (', '.join(srch_attrs),)

        ans = {}
        ans.update(attr_map)
        cursor.execute(sql_template, where_values)

        for attr in srch_attrs:
            if attr in ('poscount',):
                ans[attr] = 0
            else:
                ans[attr] = set()

        for item in cursor.fetchall():
            for attr in srch_attrs:
                v = item[srch_attr_map[attr]]
                if v is not None and v != '':
                    if type(ans[attr]) is set:
                        ans[attr].add(item[srch_attr_map[attr]])
                    elif type(ans[attr]) is int:
                        ans[attr] += int(item[srch_attr_map[attr]])

        exported = {}
        for k in ans.keys():
            if type(ans[k]) is set:
                exported[self.export_key(k)] = tuple(sorted(ans[k]))
            else:
                exported[self.export_key(k)] = ans[k]
        return exported

    def get_js_module(self):
        """
        Path must be relative to the files/js/plugins directory
        """
        return 'ucnkLiveAttributes'


def create_instance(corptree):
    """
    creates an instance of the plugin

    arguments:
    corptree -- corptree plugin
    """
    return LiveAttributes(corptree)
