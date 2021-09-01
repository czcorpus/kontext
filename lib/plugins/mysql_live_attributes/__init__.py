# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
"""

from .common import AttrValue, StructAttr
import re
import json
from functools import wraps
from hashlib import md5
from functools import partial
from collections import defaultdict, OrderedDict, Iterable
from dataclasses import astuple
import logging
from typing import Any, Dict, List, Optional, Set, Tuple, Union
from corplib.corpus import KCorpus

import l10n
from plugins import inject
import plugins
from plugins.abstract.corparch import AbstractCorporaArchive
from plugins.abstract.corparch.corpus import CorpusInfo
from plugins.abstract.general_storage import KeyValueStorage
from plugins.abstract.integration_db import IntegrationDatabase
from plugins.abstract.live_attributes import AbstractLiveAttributes
import strings
from controller import exposed
from controller.plg import PluginCtx
from actions import concordance
from . import query


CACHE_MAIN_KEY = 'liveattrs_cache:%s'


def create_cache_key(attr_map, max_attr_list_size, aligned_corpora, autocomplete_attr, limit_lists):
    """
    Generates a cache key based on the relevant parameters.
    Returned value is hashed.
    """
    return md5(f'{attr_map}{max_attr_list_size}{aligned_corpora}{autocomplete_attr}{limit_lists}'.encode('utf-8')).hexdigest()


def cached(f):
    """
    A decorator which tries to look for a key in cache before
    actual storage is invoked. If cache miss in encountered
    then the value is stored to the cache to be available next
    time.
    """
    @wraps(f)
    def wrapper(self, plugin_ctx, corpus, attr_map, aligned_corpora=None, autocomplete_attr=None, limit_lists=True):
        if len(attr_map) < 2:
            key = create_cache_key(attr_map, self.max_attr_list_size, aligned_corpora,
                                   autocomplete_attr, limit_lists)
            ans = self.from_cache(corpus.corpname, key)
            if ans:
                return ans
        ans = f(self, plugin_ctx, corpus, attr_map, aligned_corpora, autocomplete_attr, limit_lists)
        if len(attr_map) < 2:
            key = create_cache_key(attr_map, self.max_attr_list_size,
                                   aligned_corpora, autocomplete_attr, limit_lists)
            self.to_cache(corpus.corpname, key, ans)
        return self.export_num_strings(ans)
    return wrapper


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


class MysqlLiveAttributes(AbstractLiveAttributes):

    def __init__(self, corparch: AbstractCorporaArchive, db: KeyValueStorage, integ_db: IntegrationDatabase, max_attr_list_size, empty_val_placeholder,
                 max_attr_visible_chars):
        self.corparch = corparch
        self.kvdb = db
        self.integ_db = integ_db
        self.max_attr_list_size = max_attr_list_size
        self.empty_val_placeholder = empty_val_placeholder
        self.shorten_value = partial(strings.shorten, nice=True)
        self._max_attr_visible_chars = max_attr_visible_chars

    def export_actions(self):
        return {concordance.Actions: [filter_attributes, attr_val_autocomplete]}

    def is_enabled_for(self, plugin_ctx: PluginCtx, corpname: str) -> bool:
        """
        Returns True if live attributes are enabled for selected corpus else returns False
        """
        # TODO now enabled if database path is defined
        return bool(self.corparch.get_corpus_info(plugin_ctx, corpname).metadata.database)

    def calc_max_attr_val_visible_chars(self, corpus_info: CorpusInfo) -> int:
        if corpus_info.metadata.avg_label_attr_len:
            return corpus_info.metadata.avg_label_attr_len
        else:
            return self._max_attr_visible_chars

    @staticmethod
    def export_num_strings(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform strings representing integer numbers to ints
        """
        if type(data) is dict:
            for k in list(data.keys()):
                if type(data[k]) is str and data[k].isdigit():
                    data[k] = int(data[k])
        return data

    def from_cache(self, corpname: str, key: str) -> Optional[Dict[str, Any]]:
        """
        Loads a value from cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        key -- a cache key

        returns:
        a stored value matching provided argument or None if nothing is found
        """
        v = self.kvdb.hash_get(CACHE_MAIN_KEY % (corpname,), key)
        return MysqlLiveAttributes.export_num_strings(v) if v else None

    def to_cache(self, corpname: str, key: str, values: str):
        """
        Stores a data object "values" into the cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        key -- a cache key
        values -- a dictionary with arbitrary nesting level
        """
        self.kvdb.hash_set(CACHE_MAIN_KEY % (corpname,), key, values)

    @staticmethod
    def import_key(k: Optional[str]) -> Optional[StructAttr]:
        return StructAttr.get(k) if k is not None else k

    @staticmethod
    def _get_subcorp_attrs(corpus: str) -> List[StructAttr]:
        return set(StructAttr.get(x) for x in re.split(r'\s*[,|]\s*', corpus.get_conf('SUBCORPATTRS')))

    @staticmethod
    def _group_bib_items(data: Dict[str, Any], bib_label: StructAttr):
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
        for item in data[bib_label.key()]:
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
        data[bib_label.key()] = list(ans.values())

    def get_supported_structures(self, plugin_ctx: PluginCtx, corpname: str) -> List[str]:
        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpname)
        id_attr = corpus_info.metadata.id_attr
        return [id_attr.split('.')[0]] if id_attr else []

    def get_subc_size(self, plugin_ctx: PluginCtx, corpus: str, attr_map: Dict[str, List[str]]) -> int:
        attr_where = [corpus.corpname]
        attr_where_tmpl = ['corpus_name = %s']
        for k, vlist in attr_map.items():
            struct_attr = self.import_key(k)
            attr_where_tmpl.append(
                f'structure_name = %s AND structattr_name = %s AND value IN ({",".join("%s" for _ in vlist)})')
            attr_where.extend([struct_attr.struct, struct_attr.attr])
            attr_where.extend(vlist)
        cursor = self.integ_db.cursor()
        cursor.execute(
            f'''
                SELECT SUM(poscount)
                FROM corpus_structattr_value_tuple
                JOIN corpus_structattr_value_mapping ON corpus_structattr_value_tuple.id = value_tuple_id
                JOIN corpus_structattr_value_mapping ON corpus_structattr_value.id = value_id
                WHERE {' AND '.join(attr_where_tmpl)}
            ''',
            attr_where
        )
        return cursor.fetchone()[0]

    @cached
    def get_attr_values(self, plugin_ctx: PluginCtx, corpus: KCorpus, attr_map: Dict[str, Union[str, List[str], Dict[str, Any]]], aligned_corpora: Optional[List[str]]=None, autocomplete_attr: Optional[str]=None,
                        limit_lists: bool=True) -> Dict[str, Any]:
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

        srch_attrs = self._get_subcorp_attrs(corpus)
        expand_attrs = set()  # attributes we want to be full lists even if their size exceeds configured max. value

        # add bibliography column if required
        bib_label = self.import_key(corpus_info.metadata.label_attr)
        if bib_label:
            srch_attrs.add(bib_label)
        # if in autocomplete mode then always expand list of the target column
        if autocomplete_attr:
            a = self.import_key(autocomplete_attr)
            srch_attrs.add(a)
            expand_attrs.add(a)
        # also make sure that range attributes are expanded to full lists
        for k, v in attr_map.items():
            if query.is_range_argument(v):
                expand_attrs.add(self.import_key(k))

        # initialize result dictionary
        ans: Dict[Union[str, StructAttr], Union[int, Set[Tuple[str, str, str, int, int]]]] = {
            attr: set() for attr in srch_attrs}
        ans['poscount'] = 0

        # 1) values collected one by one are collected in tmp_ans and then moved to 'ans' with some exporting tweaks
        # 2) in case of values exceeding max. allowed list size we just accumulate their size directly to ans[attr]
        # {attr_id: {attr_val: num_positions,...},...}
        tmp_ans: Dict[StructAttr, Dict[AttrValue, int]
                      ] = defaultdict(lambda: defaultdict(lambda: 0))
        shorten_val = partial(self.shorten_value,
                              length=self.calc_max_attr_val_visible_chars(corpus_info))
        bib_id = self.import_key(corpus_info.metadata.id_attr)

        query_builder = query.QueryBuilder(corpus_name=corpus.corpname,
                                           aligned_corpora=aligned_corpora,
                                           attr_map={self.import_key(
                                               k): v for k, v in attr_map.items()},
                                           srch_attrs=srch_attrs,
                                           bib_id=bib_id,
                                           bib_label=bib_label,
                                           autocomplete_attr=self.import_key(autocomplete_attr),
                                           empty_val_placeholder=self.empty_val_placeholder)
        query_components = query_builder.create_sql()
        cursor = self.integ_db.cursor()
        cursor.execute(query_components.sql_template, query_components.where_values)
        for row in cursor:
            # TODO where are those excessive closing }}}}... coming from ?
            data = json.loads(re.sub(r'\}+', '}', row['data']))
            for col_key in query_components.selected_attrs:
                data_key = col_key if isinstance(col_key, str) else col_key.key()
                if col_key not in query_components.hidden_attrs and data_key in data and data[data_key] is not None:
                    attr_val = AttrValue(
                        full=data[data_key],
                        short=shorten_val(str(data[data_key])),
                        ident=data[bib_id.key()] if col_key == bib_label else data[data_key],
                        group=1
                    )
                    tmp_ans[col_key][attr_val] += row['poscount']
            ans['poscount'] += row['poscount']

        # here we append position count information to the respective items
        for attr, v in tmp_ans.items():
            for k, c in v.items():
                ans[attr].add(astuple(k) + (c,))
        # now each line contains: (shortened_label, identifier, label, num_grouped_items, num_positions)
        # where num_grouped_items is initialized to 1
        if corpus_info.metadata.group_duplicates:
            self._group_bib_items(ans, bib_label)
        tmp_ans.clear()
        return self._export_attr_values(data=ans, aligned_corpora=aligned_corpora,
                                        expand_attrs=expand_attrs,
                                        collator_locale=corpus_info.collator_locale,
                                        max_attr_list_size=self.max_attr_list_size if limit_lists else None)

    def _export_attr_values(self, data: Dict[Union[str, StructAttr], Union[int, Set[Tuple[str, str, str, int, int]]]], aligned_corpora: List[str], expand_attrs: List[StructAttr], collator_locale: str, max_attr_list_size: Optional[int]) -> Dict[str, Any]:
        values = {}
        exported = dict(attr_values=values, aligned=aligned_corpora)
        for k, v in data.items():
            export_key = k if isinstance(k, str) else k.key()
            if isinstance(v, Iterable):
                if max_attr_list_size is None or len(v) <= max_attr_list_size or k in expand_attrs:
                    out_data = l10n.sort(v, collator_locale, key=lambda t: t[0])
                    values[export_key] = out_data
                else:
                    values[export_key] = {'length': len(v)}
            else:
                values[export_key] = v
        exported['poscount'] = values['poscount']
        return exported

    def get_bibliography(self, plugin_ctx: PluginCtx, corpus: KCorpus, item_id: str) -> List[Tuple[str, str]]:
        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpus.corpname)
        bib_id = self.import_key(corpus_info.metadata.id_attr)

        cursor = self.integ_db.cursor()
        cursor.execute(
            '''
            SELECT JSON_OBJECTAGG(CONCAT(t_value.structure_name, '.', t_value.structattr_name), t_value.value) as data
            FROM (
                SELECT DISTINCT value_tuple_id as id
                FROM corpus_structattr_value AS t_value
                JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value.id = t_value_mapping.value_id
                WHERE corpus_name = %s AND structure_name = %s AND structattr_name = %s AND value = %s
                LIMIT 1
            ) as t
            JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value_mapping.value_tuple_id = t.id
            JOIN corpus_structattr_value AS t_value ON t_value_mapping.value_id = t_value.id
            WHERE structure_name = %s
            GROUP BY t.id
            ''',
            (corpus, bib_id.struct, bib_id.attr, bib_id.struct, item_id))

        data = json.loads(cursor.fetchone()['data'])
        return list(data.items())

    def find_bib_titles(self, plugin_ctx: PluginCtx, corpus_id: str, id_list: List[Tuple[str, str]]):
        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpus_id)
        bib_id = self.import_key(corpus_info.metadata.id_attr)
        bib_label = self.import_key(corpus_info.metadata.label_attr)

        cursor = self.integ_db.cursor()
        cursor.execute(
            f'''
            SELECT t.id, JSON_OBJECTAGG(CONCAT(t_value.structure_name, '.', t_value.structattr_name), t_value.value) as data
            FROM (
                SELECT DISTINCT value_tuple_id as id
                FROM corpus_structattr_value AS t_value
                JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value.id = t_value_mapping.value_id
                WHERE corpus_name = %s AND structure_name = %s AND structattr_name = %s AND value IN ({', '.join('%s' for _ in id_list)})
            ) as t
            JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value_mapping.value_tuple_id = t.id
            JOIN corpus_structattr_value AS t_value ON t_value_mapping.value_id = t_value.id
            WHERE (
                t_value.structure_name = %s AND t_value.structattr_name = %s
            ) OR (
                t_value.structure_name = %s AND t_value.structattr_name = %s
            )
            GROUP BY t.id
            ''',
            (corpus_id, bib_id.struct, bib_id.attr, *id_list, bib_id.struct, bib_id.attr, bib_label.struct, bib_label.attr))

        ans = []
        for row in cursor:
            data = json.loads(row['data'])
            ans.append(data['doc.id'], data[bib_label.key()])
        return ans


@inject(plugins.runtime.CORPARCH, plugins.runtime.DB, plugins.runtime.INTEGRATION_DB)
def create_instance(settings, corparch: AbstractCorporaArchive, db: KeyValueStorage, integ_db: IntegrationDatabase) -> MysqlLiveAttributes:
    """
    creates an instance of the plugin

    arguments:
    corparch -- corparch plugin
    """

    la_settings = settings.get('plugins', 'live_attributes')
    if integ_db.is_active:
        logging.getLogger(__name__).info(
            f'mysql_live_attributes uses integration_db[{integ_db.info}]')
        return MysqlLiveAttributes(corparch=corparch,
                                   db=db,
                                   integ_db=integ_db,
                                   max_attr_list_size=settings.get_int(
                                       'global', 'max_attr_list_size'),
                                   empty_val_placeholder=settings.get(
                                       'corpora', 'empty_attr_value_placeholder'),
                                   max_attr_visible_chars=int(la_settings.get('max_attr_visible_chars', 20)))
    else:
        logging.getLogger(__name__).error('mysql_live_attributes integration db not provided')
