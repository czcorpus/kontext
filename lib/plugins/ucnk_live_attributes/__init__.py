#!/usr/bin/env python3
# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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
Interactive (ad hoc) subcorpus selection.

Required XML configuration: please see config.rng

It is recommended to install Unidecode package (pip install Unidecode)
"""

import re
import json
from functools import partial
from collections import defaultdict, OrderedDict, Iterable
import sqlite3
import logging
try:
    from unidecode import unidecode
except ImportError:
    logging.getLogger(__name__).warning(
        'Package unidecode not found - you can improve ucnk_live_attributes search abilities by installing it.')

    def unidecode(v): return v

import l10n
from plugins import inject
import plugins
from plugins.abstract.live_attributes import (
    CachedLiveAttributes, AttrValue, AttrValuesResponse, BibTitle, StructAttrValuePair, cached)
import strings
from controller import exposed
from controller.plg import PluginCtx
from actions import concordance
from . import query


@exposed(return_type='json', http_method='POST')
def filter_attributes(self, request):
    attrs = json.loads(request.form.get('attrs', '{}'))
    aligned = json.loads(request.form.get('aligned', '[]'))
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return lattr.get_attr_values(self._plugin_ctx, corpus=self.corp, attr_map=attrs,
                                     aligned_corpora=aligned)


@exposed(return_type='json', http_method='POST')
def attr_val_autocomplete(self, request):
    attrs = json.loads(request.form.get('attrs', '{}'))
    attrs[request.form['patternAttr']] = '%{}%'.format(request.form['pattern'])
    aligned = json.loads(request.form.get('aligned', '[]'))
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return lattr.get_attr_values(self._plugin_ctx, corpus=self.corp, attr_map=attrs,
                                     aligned_corpora=aligned,
                                     autocomplete_attr=request.form['patternAttr'])


class LiveAttributes(CachedLiveAttributes):

    def __init__(self, corparch, db, max_attr_list_size, empty_val_placeholder,
                 max_attr_visible_chars):
        super().__init__(db)
        self.corparch = corparch
        self.kvdb = db
        self.max_attr_list_size = max_attr_list_size
        self.empty_val_placeholder = empty_val_placeholder
        self.databases = {}
        self.shorten_value = partial(strings.shorten, nice=True)
        self._max_attr_visible_chars = max_attr_visible_chars

    def export_actions(self):
        return {
            concordance.Actions: [filter_attributes, attr_val_autocomplete]}

    def db(self, plugin_ctx: PluginCtx, corpname):
        """
        Returns thread-local database connection to a sqlite3 database

        arguments:
        plugin_ctx -- plugin context instance
        corpname -- corpus id
        """

        if corpname not in self.databases:
            db_path = self.corparch.get_corpus_info(plugin_ctx, corpname).metadata.database
            if db_path:
                self.databases[corpname] = sqlite3.connect(db_path)
                self.databases[corpname].row_factory = sqlite3.Row
                self.databases[corpname].create_function(
                    'ktx_lower', 1, lambda x: unidecode(x.lower()))
            else:
                self.databases[corpname] = None
        return self.databases[corpname]

    def is_enabled_for(self, plugin_ctx, corpname):
        """
        Returns True if live attributes are enabled for selected corpus else returns False
        """
        return self.db(plugin_ctx, corpname) is not None

    def execute_sql(self, db, sql, args=()):
        cursor = db.cursor()
        cursor.execute(sql, args)
        return cursor

    def calc_max_attr_val_visible_chars(self, corpus_info):
        if corpus_info.metadata.avg_label_attr_len:
            return corpus_info.metadata.avg_label_attr_len
        else:
            return self._max_attr_visible_chars

    @staticmethod
    def export_num_strings(data):
        """
        Transform strings representing integer numbers to ints
        """
        if type(data) is dict:
            for k in list(data.keys()):
                if type(data[k]) is str and data[k].isdigit():
                    data[k] = int(data[k])
        return data

    @staticmethod
    def export_key(k):
        if k == 'corpus_id':
            return k
        return k.replace('_', '.', 1)

    @staticmethod
    def import_key(k):
        return k.replace('.', '_', 1) if k is not None else k

    @staticmethod
    def _get_subcorp_attrs(corpus):
        return [x.replace('.', '_', 1) for x in re.split(r'\s*[,|]\s*', corpus.get_conf('SUBCORPATTRS'))]

    @staticmethod
    def _group_bib_items(data, bib_label):
        """
        In bibliography column, items with the same title (column number 2)
        can be set to be grouped together (corpus/metadata/group_duplicates tag).

        Note.: please note that this cannot be done within the database
        as we have to treat data columns as independent which is not the
        case in the database (e.g. GROUP BY ... publish_date,... may
        produce multiple items with the same title - just from different
        years/months/...).
        """
        ans = OrderedDict()
        for item in data[bib_label]:
            label = item[2]
            if label not in ans:
                ans[label] = list(item)
            else:
                ans[label][3] += 1
                ans[label][4] += item[4]
            if ans[label][3] > 1:
                # use label with special prefix '@' as ID for grouped items
                # (to be able to distinguish between individual ID-identified and
                # grouped label-identified items)
                ans[label][1] = '@' + ans[label][2]
        data[bib_label] = list(ans.values())

    def get_supported_structures(self, plugin_ctx, corpname):
        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpname)
        id_attr = corpus_info.metadata.id_attr
        return [id_attr.split('.')[0]] if id_attr else []

    def get_subc_size(self, plugin_ctx, corpora, attr_map):
        db = self.db(plugin_ctx, corpora[0])
        join_sql = []
        where_sql = ['t1.corpus_id = ?']
        where_values = [corpora[0]]
        i = 2
        for item in corpora[1:]:
            join_sql.append(f'JOIN item AS t{i} ON t1.item_id = t{i}.item_id')
            where_sql.append(f't{i}.corpus_id = ?')
            where_values.append(item)
        for k, vlist in list(attr_map.items()):
            tmp = []
            for v in vlist:
                where_values.append(v)
                tmp.append(f't1.{self.import_key(k)} = ?')  # TODO escape the 'k'
            where_sql.append('({})'.format(' OR '.join(tmp)))
        cur = self.execute_sql(
            db,
            'SELECT SUM(t1.poscount) FROM item AS t1 {} WHERE {}'.format(
                ' '.join(join_sql), ' AND '.join(where_sql)), where_values)
        return cur.fetchone()[0]

    @cached
    def get_attr_values(self, plugin_ctx, corpus, attr_map, aligned_corpora=None, autocomplete_attr=None,
                        limit_lists=True):
        """
        Finds all the available values of remaining attributes according to the
        provided attr_map and aligned_corpora

        arguments:
        corpus --
        attr_map -- a dictionary of attributes and values as selected by a user
        aligned_corpora -- a list/tuple of corpora names aligned to base one (the 'corpus' argument)
        autocomplete_attr -- such attribute will be also part of selection even if it is a part 'WHERE ...' condition

        returns:
        a dictionary containing matching attributes and values
        """
        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpus.corpname)

        srch_attrs = set(self._get_subcorp_attrs(corpus))
        expand_attrs = set()  # attributes we want to be full lists even if their size exceeds configured max. value

        # add bibliography column if required
        bib_label = self.import_key(corpus_info.metadata.label_attr)
        if bib_label:
            srch_attrs.add(bib_label)
        # always include number of positions column
        srch_attrs.add('poscount')
        # if in autocomplete mode then always expand list of the target column
        if autocomplete_attr:
            a = self.import_key(autocomplete_attr)
            srch_attrs.add(a)
            expand_attrs.add(a)
        # also make sure that range attributes are expanded to full lists
        for k, v in list(attr_map.items()):
            if query.is_range_argument(v):
                expand_attrs.add(self.import_key(k))

        query_builder = query.QueryBuilder(corpus_info=corpus_info,
                                           attr_map=attr_map,
                                           srch_attrs=srch_attrs,
                                           aligned_corpora=aligned_corpora,
                                           autocomplete_attr=self.import_key(autocomplete_attr),
                                           empty_val_placeholder=self.empty_val_placeholder)
        data_iterator = query.DataIterator(
            self.db(plugin_ctx, corpus.corpname), query_builder)

        # initialize result dictionary
        ans = dict((attr, set()) for attr in srch_attrs)
        ans['poscount'] = 0

        # 1) values collected one by one are collected in tmp_ans and then moved to 'ans' with some exporting tweaks
        # 2) in case of values exceeding max. allowed list size we just accumulate their size directly to ans[attr]
        # {attr_id: {attr_val: num_positions,...},...}
        tmp_ans = defaultdict(lambda: defaultdict(lambda: 0))
        shorten_val = partial(self.shorten_value,
                              length=self.calc_max_attr_val_visible_chars(corpus_info))
        bib_id = self.import_key(corpus_info.metadata.id_attr)

        # here we iterate through [(row1, key1), (row1, key2),..., (row1, keyM), (row2, key1), (row2, key2),...]
        for row, col_key in data_iterator:
            if type(ans[col_key]) is set:
                val_ident = row[bib_id] if col_key == bib_label else row[col_key]
                attr_val = (shorten_val(str(row[col_key])),
                            val_ident, row[col_key], 1)  # 1 = grouping
                tmp_ans[col_key][attr_val] += row['poscount']
            elif type(ans[col_key]) is int:
                # we rely on proper 'ans' initialization here (in terms of types)
                ans[col_key] += int(row[col_key])
        # here we append position count information to the respective items
        for attr, v in tmp_ans.items():
            for k, c in v.items():
                ans[attr].add(k + (c,))
        # now each line contains: (shortened_label, identifier, label, num_grouped_items, num_positions)
        # where num_grouped_items is initialized to 1
        if corpus_info.metadata.group_duplicates:
            self._group_bib_items(ans, bib_label)
        return self._export_attr_values(data=ans, aligned_corpora=aligned_corpora,
                                        expand_attrs=expand_attrs,
                                        collator_locale=corpus_info.collator_locale,
                                        max_attr_list_size=self.max_attr_list_size if limit_lists else None)

    def _export_attr_values(self, data, aligned_corpora, expand_attrs, collator_locale, max_attr_list_size):
        values = {}
        for k, v in data.items():
            if isinstance(v, Iterable):
                if max_attr_list_size is None or len(v) <= max_attr_list_size or k in expand_attrs:
                    out_data = l10n.sort(v, collator_locale, key=lambda t: t[0])
                    values[self.export_key(k)] = [AttrValue(*av) for av in out_data]
                else:
                    values[self.export_key(k)] = {'length': len(v)}
            else:
                values[self.export_key(k)] = v
        return AttrValuesResponse(attr_values=values, aligned=aligned_corpora, poscount=values['poscount'])

    def get_bibliography(self, plugin_ctx, corpus, item_id):
        db = self.db(plugin_ctx, corpus.corpname)
        col_rows = self.execute_sql(db, 'PRAGMA table_info(\'bibliography\')').fetchall()

        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpus.corpname)
        if corpus_info.metadata.sort_attrs:
            # here we accept default collator as attr IDs are ASCII
            col_rows = sorted(col_rows, key=lambda v: v[1])
        col_map = OrderedDict([(x[1], x[0]) for x in col_rows])
        if 'corpus_id' in col_map:
            ans = self.execute_sql(db, 'SELECT * FROM bibliography WHERE id = ? AND corpus_id = ? LIMIT 1',
                                   (item_id, corpus.corpname)).fetchone()
        else:
            ans = self.execute_sql(
                db, 'SELECT * FROM bibliography WHERE id = ? LIMIT 1', (item_id,)).fetchone()
        return [StructAttrValuePair(k, ans[i]) for k, i in list(col_map.items()) if k != 'id']

    def find_bib_titles(self, plugin_ctx, corpus_id, id_list):
        with plugins.runtime.CORPARCH as ca:
            corpus_info = ca.get_corpus_info(plugin_ctx.user_lang, corpus_id)
        label_attr = self.import_key(corpus_info.metadata.label_attr)
        db = self.db(plugin_ctx, corpus_id)
        pch = ', '.join(['?'] * len(id_list))
        ans = self.execute_sql(
            db, 'SELECT id, %s FROM bibliography WHERE id IN (%s)' % (label_attr, pch), id_list)
        return [BibTitle(r[0], r[1]) for r in ans]


@inject(plugins.runtime.CORPARCH, plugins.runtime.DB)
def create_instance(settings, corparch, db):
    """
    creates an instance of the plugin

    arguments:
    corparch -- corparch plugin
    """
    la_settings = settings.get('plugins', 'live_attributes')
    return LiveAttributes(
        corparch=corparch,
        db=db,
        max_attr_list_size=settings.get_int('global', 'max_attr_list_size'),
        empty_val_placeholder=settings.get(
            'corpora', 'empty_attr_value_placeholder'),
        max_attr_visible_chars=int(la_settings.get('max_attr_visible_chars', 20)))
