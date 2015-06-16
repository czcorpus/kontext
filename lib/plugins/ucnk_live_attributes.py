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
"""
Interactive (ad hoc) subcorpus selection.

Required XML configuration:

<kontext>
  <plugins>
    ...
    <live_attributes>
      <module>ucnk_live_attributes</module>
      <js_module>ucnkLiveAttributes</js_module>
      <max_attr_visible_chars extension-by="ucnk">30</max_attr_visible_chars>
    </live_attributes>
    ...
  </plugins>
</kontext>
"""

import re
from sqlalchemy import create_engine
import json
from functools import wraps
from hashlib import md5

import l10n
from abstract.live_attributes import AbstractLiveAttributes


def create_cache_key(attr_map, max_attr_list_size, corpus, aligned_corpora):
    """
    Generates a cache key based on the relevant parameters.
    Returned value is hashed.
    """
    return md5('%r %r %r %r' % (attr_map, max_attr_list_size, corpus, aligned_corpora)).hexdigest()


def vanilla_corpname(corpname):
    """
    Removes all additional information from corpus name (in UCNK case this means removing path-like prefixes)
    """
    return corpname.rsplit('/', 1)[-1]


def cached(f):
    """
    A decorator which tries to look for a key in cache before
    actual storage is invoked. If cache miss in encountered
    then the value is stored to the cache to be available next
    time.
    """
    @wraps(f)
    def wrapper(self, corpus, attr_map, aligned_corpora=None):
        db = self.db(vanilla_corpname(corpus.corpname))
        if len(attr_map) < 2:
            key = create_cache_key(attr_map, self.max_attr_list_size, corpus, aligned_corpora)
            ans = self.from_cache(db, key)
            if ans:
                return ans
        ans = f(self, corpus, attr_map, aligned_corpora)
        if len(attr_map) < 2:
            key = create_cache_key(attr_map, self.max_attr_list_size, corpus, aligned_corpora)
            self.to_cache(db, key, ans)
        return self.format_data_types(ans)
    return wrapper


class AttrArgs(object):
    """
    Stores a multi-value dictionary and allows an export
    to SQL WHERE expression as used by the plugin.
    E.g.: attributes = { 'key1' : ['value1_1', 'value1_2'], 'key2' : ['value2_1'] }
    leads to the following SQL "component": (key1 = ? OR key1 = ?) AND (key2 = ?)
    and attached values: ('value1_1', 'value1_2', 'value2_1')
    """
    def __init__(self, data, empty_val_placeholder):
        """
        arguments:
        data -- a dictionary where values are either lists or single values
        empty_val_placeholder -- value used instead of an empty value
        """
        self.data = data
        self.empty_val_placeholder = empty_val_placeholder

    def __len__(self):
        return len(self.data)

    def import_value(self, value):
        if value == self.empty_val_placeholder:
            return ''  # important! - cannot use None here as it is converted to NULL within database
        return value

    def export_sql(self, item_prefix, corpus_id):
        """
        Exports data into a SQL WHERE expression

        arguments:
        item_prefix -- prefix used to identify attach columns properly in case multiple tables (e.g. via JOIN) is used
        corpus_name -- identifer of the corpus

        returns:
        a SQL WHERE expression in conjunctive normal form
        """
        where = []
        sql_values = []
        for key, values in self.data.items():
            key = key.replace('.', '_')
            cnf_item = []
            if type(values) is list or type(values) is tuple:
                for value in values:
                    cnf_item.append('%s.%s = ?' % (item_prefix, key))
                    sql_values.append(self.import_value(value))
            else:
                cnf_item.append('%s.%s = ?' % (item_prefix, key))
                sql_values.append(self.import_value(values))
            where.append('(%s)' % ' OR '.join(cnf_item))

        where.append('%s.corpus_id = ?' % item_prefix)
        sql_values.append(corpus_id)

        return ' AND '.join(where), sql_values


class LiveAttributes(AbstractLiveAttributes):

    def __init__(self, corptree, max_attr_list_size, empty_val_placeholder):
        self.corptree = corptree
        self.max_attr_list_size = max_attr_list_size
        self.empty_val_placeholder = empty_val_placeholder
        self.databases = {}

    def db(self, corpname):
        """
        Returns thread-local database connection to a sqlite3 database

        arguments:
        corpname -- vanilla corpus name (i.e. without any path-like prefixes)
        """
        if not corpname in self.databases:
            db_path = self.corptree.get_corpus_info(corpname).get('metadata', {}).get('database')
            if db_path:
                self.databases[corpname] = create_engine('sqlite:///%s' % db_path)
            else:
                self.databases[corpname] = None
        return self.databases[corpname]

    def is_enabled_for(self, corpname):
        """
        Returns True if live attributes are enabled for selected corpus else returns False
        """
        return self.db(corpname) is not None

    @staticmethod
    def apply_prefix(values, prefix):
        return ['%s.%s' % (prefix, v) for v in values]

    @staticmethod
    def format_data_types(data):
        if type(data) is dict:
            for k in data.keys():
                if type(data[k]) is int or type(data[k]) is float or (type(data[k]) is str and data[k].isdigit()):
                    data[k] = l10n.format_number(data[k])
        return data

    @staticmethod
    def from_cache(db, key):
        """
        Loads a value from cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        key -- a cache key

        returns:
        a stored value matching provided argument or None if nothing is found
        """
        ans = db.execute("SELECT value FROM cache WHERE key = ?", (key,)).fetchone()
        if ans:
            return LiveAttributes.format_data_types(json.loads(str(ans[0])))
        return None

    @staticmethod
    def to_cache(db, key, values):
        """
        Stores a data object "values" into the cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        key -- a cache key
        values -- a dictionary with arbitrary nesting level
        """
        value = json.dumps(values)
        db.execute("INSERT INTO cache (key, value) VALUES (?, ?)", key, value)

    @staticmethod
    def export_key(k):
        if k == 'corpus_id':
            return k
        return k.replace('_', '.', 1)

    @staticmethod
    def import_key(k):
        return k.replace('.', '_', 1)

    @staticmethod
    def _get_subcorp_attrs(corpus):
        return [x.replace('.', '_', 1) for x in re.split(r'\s*[,|]\s*', corpus.get_conf('SUBCORPATTRS'))]

    @cached
    def get_attr_values(self, corpus, attr_map, aligned_corpora=None):
        """
        Finds all the available values of remaining attributes according to the
        provided attr_map and aligned_corpora

        arguments:
        corpus -- manatee.corpus object
        attr_map -- a dictionary of attributes and values as selected by a user
        aligned_corpora - a list/tuple of corpora names aligned to base one (the 'corpus' argument)

        returns:
        a dictionary containing matching attributes and values
        """
        corpname = vanilla_corpname(corpus.corpname)
        attrs = self._get_subcorp_attrs(corpus)
        db = self.db(corpname)
        srch_attrs = set(attrs) - set(attr_map.keys())
        srch_attrs.add('poscount')
        bib_label = LiveAttributes.import_key(self.corptree.get_corpus_info(corpname)['metadata']['label_attr'])
        bib_id = LiveAttributes.import_key(self.corptree.get_corpus_info(corpname)['metadata']['id_attr'])
        hidden_attrs = set()

        if bib_id not in srch_attrs:
            hidden_attrs.add(bib_id)

        selected_attrs = tuple(srch_attrs.union(hidden_attrs))
        srch_attr_map = dict([(x[1], x[0]) for x in enumerate(selected_attrs)])
        attr_items = AttrArgs(attr_map, self.empty_val_placeholder)
        where_sql, where_values = attr_items.export_sql('t1', corpname)

        join_sql = []
        i = 2
        for item in aligned_corpora:
            join_sql.append('JOIN item AS t%d ON t1.item_id = t%d.item_id' % (i, i))
            where_sql += ' AND t%d.corpus_id = ?' % i
            where_values.append(item)
            i += 1

        if len(where_sql) > 0:
            sql_template = "SELECT DISTINCT %s FROM item AS t1 %s WHERE %s" \
                           % (', '.join(self.apply_prefix(selected_attrs, 't1')), ' '.join(join_sql), where_sql)
        else:
            sql_template = "SELECT DISTINCT %s FROM item AS t1 %s " \
                           % (', '.join(self.apply_prefix(selected_attrs, 't1')), ' '.join(join_sql))

        ans = {}
        ans.update(attr_map)

        for attr in srch_attrs:
            if attr in ('poscount',):
                ans[attr] = 0
            else:
                ans[attr] = set()

        for item in db.execute(sql_template, *where_values).fetchall():
            for attr in selected_attrs:
                v = item[srch_attr_map[attr]]
                if v is not None and attr not in hidden_attrs:
                    if attr == bib_label:
                        ans[attr].add((unicode(v), item[srch_attr_map[bib_id]]))
                    elif type(ans[attr]) is set:
                        ans[attr].add(v)
                    elif type(ans[attr]) is int:
                        ans[attr] += int(v)

        exported = {}
        collator_locale = self.corptree.get_corpus_info(corpname)['collator_locale']
        for k in ans.keys():
            if type(ans[k]) is set:
                if len(ans[k]) <= self.max_attr_list_size:
                    if k == bib_label:
                        out_data = l10n.sort(ans[k], collator_locale, key=lambda t: t[0])
                    else:
                        out_data = tuple(l10n.sort(ans[k], collator_locale))
                    exported[self.export_key(k)] = out_data
                else:
                    exported[self.export_key(k)] = {'length': len(ans[k])}

            else:
                exported[self.export_key(k)] = ans[k]
        exported['aligned'] = aligned_corpora
        return exported

    def get_bibliography(self, corpus, item_id):
        db = self.db(vanilla_corpname(corpus.corpname))
        col_map = db.execute('PRAGMA table_info(\'bibliography\')').fetchall()
        col_map = dict([(x[1], x[0]) for x in col_map])
        ans = db.execute('SELECT * FROM bibliography WHERE id = ?', item_id).fetchone()
        return dict([(k, ans[i]) for k, i in col_map.items()])

    def get_bib_size(self, corpus):
        """
        Returns total number of items in bibliography
        """
        db = self.db(vanilla_corpname(corpus.corpname))
        size = self.from_cache(db, 'bib_size')
        if size is None:
            ans = db.execute('SELECT COUNT(*) FROM bibliography').fetchone()
            size = ans[0]
            self.to_cache(db, 'bib_size', size)
        return size


def create_instance(corptree, settings):
    """
    creates an instance of the plugin

    arguments:
    corptree -- corptree plugin
    """
    return LiveAttributes(corptree,
                          settings.get_int('global', 'max_attr_list_size'),
                          settings.get('corpora', 'empty_attr_value_placeholder'))
