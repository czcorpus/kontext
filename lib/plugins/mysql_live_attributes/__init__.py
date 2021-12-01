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

from .common import AttrValueKey, StructAttr
import re
import json
from itertools import chain
from functools import partial
from collections import defaultdict, OrderedDict
from dataclasses import astuple
import logging
from typing import Any, Dict, List, Optional, Set, Union
from corplib.corpus import KCorpus
from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursor

import l10n
from plugins import inject
import plugins
from plugins.abstract.corparch import AbstractCorporaArchive
from plugins.abstract.corparch.corpus import CorpusInfo
from plugins.abstract.general_storage import KeyValueStorage
from plugins.abstract.integration_db import IntegrationDatabase
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


@exposed(return_type='json', http_method='POST')
def fill_attrs(self, request):
    search = request.json['search']
    values = request.json['values']
    fill = request.json['fill']

    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return lattr.fill_attrs(corpus_id=self.corp.corpname, search=search, values=values, fill=fill)


class MysqlLiveAttributes(CachedLiveAttributes):

    def __init__(
            self, corparch: AbstractCorporaArchive,
            db: KeyValueStorage,
            integ_db: IntegrationDatabase[MySQLConnection, MySQLCursor],
            max_attr_list_size,
            empty_val_placeholder,
            max_attr_visible_chars):
        super().__init__(db)
        self.corparch = corparch
        self.integ_db = integ_db
        self.max_attr_list_size = max_attr_list_size
        self.empty_val_placeholder = empty_val_placeholder
        self.shorten_value = partial(strings.shorten, nice=True)
        self._max_attr_visible_chars = max_attr_visible_chars

    def export_actions(self):
        return {concordance.Actions: [filter_attributes, attr_val_autocomplete, fill_attrs]}

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

    def on_soft_reset(self):
        logging.getLogger(__name__).warning('soft reset, cleaning all liveattrs caches')
        self.clear_cache()

    @staticmethod
    def import_key(k: Optional[str]) -> Optional[StructAttr]:
        return StructAttr.get(k) if k is not None else k

    @staticmethod
    def _get_subcorp_attrs(corpus: KCorpus) -> Set[StructAttr]:
        sca = corpus.get_conf('SUBCORPATTRS')
        if sca:
            return set(StructAttr.get(x) for x in re.split(r'\s*[,|]\s*', sca))
        return set(StructAttr.get(x) for x in corpus.get_structattrs())

    @staticmethod
    def _group_bib_items(data: Dict[str, Set[AttrValue]], bib_label: StructAttr):
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
            label = item.full_name
            if label not in ans:
                ans[label] = list(item)
            else:
                ans[label][3] += 1
                ans[label][4] += item.poscount
            if ans[label][3] > 1:
                # use label with special prefix '@' as ID for grouped items
                # (to be able to distinguish between individual ID-identified and
                # grouped label-identified items)
                ans[label][1] = '@' + ans[label][2]
        data[bib_label.key()] = set(AttrValue(*v) for v in ans.values())

    def get_supported_structures(self, plugin_ctx: PluginCtx, corpname: str) -> List[str]:
        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpname)
        id_attr = corpus_info.metadata.id_attr
        return [id_attr.split('.')[0]] if id_attr else []

    def get_subc_size(self, plugin_ctx: PluginCtx, corpora: List[str], attr_map: Dict[str, List[str]]) -> int:
        args = []
        tmp = []
        for key, values in attr_map.items():
            tmp.append(f'''
                SELECT t2.value_tuple_id
                FROM corpus_structattr_value as t1
                JOIN corpus_structattr_value_mapping as t2 ON t1.id = t2.value_id
                WHERE t1.corpus_name = %s AND t1.structure_name = %s AND t1.structattr_name = %s AND value = IN ({",".join("%s" for _ in values)})
            ''')
            struct_attr = self.import_key(key)
            args.extend([corpora[0], struct_attr.struct, struct_attr.attr])
            args.extend(values)

        if tmp:
            sql_sub = ' INTERSECT '.join(tmp)
        else:
            sql_sub = '''
                SELECT t2.value_tuple_id
                FROM corpus_structattr_value as t1
                JOIN corpus_structattr_value_mapping as t2 ON t1.id = t2.value_id
                WHERE t1.corpus_name = %s
            '''
            args.append(corpora[0])

        if len(corpora) > 1:
            aligned_corpus_select = 'SELECT item_id FROM corpus_structattr_value_tuple WHERE corpus_name = %s'
            sql = f'''
                SELECT sum(tuple.poscount)
                FROM (
                    SELECT tuple.item_id
                    FROM ({sql_sub}) t
                    JOIN corpus_structattr_value_tuple AS tuple ON tuple.id = t.value_tuple_id
                    INTERSECT
                    {" INTERSECT ".join(aligned_corpus_select for _ in corpora[1:])}
                ) t
                JOIN corpus_structattr_value_tuple AS tuple ON tuple.item_id = t.item_id
                WHERE tuple.corpus_name = %s
            '''
            args.extend(corpora[1:])
            args.append(corpora[0])
        else:
            sql = f'''
                SELECT SUM(tuple.poscount)
                FROM ({sql_sub}) t
                JOIN corpus_structattr_value_tuple AS tuple ON tuple.id = t.value_tuple_id
            '''

        cursor = self.integ_db.cursor()
        cursor.execute(sql, args)
        return cursor.fetchone()[0]

    @cached
    def get_attr_values(
            self, plugin_ctx: PluginCtx, corpus: KCorpus, attr_map: Dict[str, Union[str, List[str], Dict[str, Any]]],
            aligned_corpora: Optional[List[str]] = None, autocomplete_attr: Optional[str] = None,
            limit_lists: bool = True) -> AttrValuesResponse:
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
        for attr_value, attr_value_poscount in attr_map.items():
            if query.is_range_argument(attr_value_poscount):
                expand_attrs.add(self.import_key(attr_value))

        # 1) values collected one by one are collected in tmp_ans and then moved to 'ans' with some exporting tweaks
        # 2) in case of values exceeding max. allowed list size we just accumulate their size directly to ans[attr]
        # {attr_id: {attr_val: num_positions,...},...}
        total_poscount = 0
        poscounts: Dict[StructAttr, Dict[AttrValue, int]
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
            data = dict(tuple(pair.split('=', 1)) for pair in row['data'].split('\n'))
            for col_key in query_components.selected_attrs:
                data_key = col_key if isinstance(col_key, str) else col_key.key()
                if col_key not in query_components.hidden_attrs and data_key in data:
                    attr_val_key = AttrValueKey(
                        full_name=data[data_key],
                        short_name=shorten_val(data[data_key]),
                        ident=data[bib_id.key()] if col_key == bib_label else data[data_key]
                    )
                    poscounts[col_key][attr_val_key] += row['poscount']
            total_poscount += row['poscount']

        # here we append position count information to the respective items
        ans: Dict[StructAttr, Set[AttrValue]] = {attr: set() for attr in srch_attrs}
        for struct_attr, attr_value_poscount in poscounts.items():
            for attr_value, poscount in attr_value_poscount.items():
                ans[struct_attr].add(AttrValue(*astuple(attr_value), 1, poscount))
        # now each line contains: (shortened_label, identifier, label, num_grouped_items, num_positions)
        # where num_grouped_items is initialized to 1
        if corpus_info.metadata.group_duplicates:
            self._group_bib_items(ans, bib_label)
        return self._export_attr_values(data=ans, total_poscount=total_poscount, aligned_corpora=aligned_corpora,
                                        expand_attrs=expand_attrs,
                                        collator_locale=corpus_info.collator_locale,
                                        max_attr_list_size=self.max_attr_list_size if limit_lists else None)

    def _export_attr_values(self, data: Dict[StructAttr, Set[AttrValue]], total_poscount: int, aligned_corpora: List[str], expand_attrs: List[StructAttr], collator_locale: str, max_attr_list_size: Optional[int]) -> AttrValuesResponse:
        exported = AttrValuesResponse(
            attr_values={}, aligned=aligned_corpora, poscount=total_poscount)
        for struct_attr, attr_values in data.items():
            if max_attr_list_size is None or len(attr_values) <= max_attr_list_size or struct_attr in expand_attrs:
                out_data = l10n.sort(attr_values, collator_locale, key=lambda t: t[0])
                exported.attr_values[struct_attr.key()] = out_data
            else:
                exported.attr_values[struct_attr.key()] = {'length': len(attr_values)}
        return exported

    def get_bibliography(self, plugin_ctx: PluginCtx, corpus: KCorpus, item_id: str) -> List[StructAttrValuePair]:
        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpus.corpname)
        bib_id = self.import_key(corpus_info.metadata.id_attr)

        cursor = self.integ_db.cursor()
        cursor.execute(
            '''
            SELECT GROUP_CONCAT(CONCAT(t_value.structure_name, '.', t_value.structattr_name, '=', t_value.value) SEPARATOR '\n') as data
            FROM (
                SELECT value_tuple_id as id
                FROM corpus_structattr_value AS t_value
                JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value.id = t_value_mapping.value_id
                WHERE corpus_name = %s AND structure_name = %s AND structattr_name = %s AND value = %s
                LIMIT 1
            ) as t
            JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value_mapping.value_tuple_id = t.id
            JOIN corpus_structattr_value AS t_value ON t_value_mapping.value_id = t_value.id
            GROUP BY t.id
            ''',
            (corpus.corpname, bib_id.struct, bib_id.attr, item_id))
        return [StructAttrValuePair(*pair.split('=', 1)) for pair in cursor.fetchone()['data'].split('\n')]

    def _find_attrs(self, corpus_id: str, search: StructAttr, values: List[str], fill: List[StructAttr]):
        cursor = self.integ_db.cursor()
        if len(values) == 0:
            cursor.execute('SELECT 1 FROM dual WHERE false')
        else:
            cursor.execute(
                f'''
                SELECT
                    t.id,
                    GROUP_CONCAT(CONCAT(t_value.structure_name, '.', t_value.structattr_name, '=', t_value.value)
                        SEPARATOR '\n') as data
                FROM (
                    SELECT DISTINCT value_tuple_id as id
                    FROM corpus_structattr_value AS t_value
                    JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value.id = t_value_mapping.value_id
                    WHERE corpus_name = %s AND structure_name = %s AND structattr_name = %s
                      AND value IN ({', '.join('%s' * len(values))})
                ) AS t
                JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value_mapping.value_tuple_id = t.id
                JOIN corpus_structattr_value AS t_value ON t_value_mapping.value_id = t_value.id
                WHERE {' OR '.join('(t_value.structure_name = %s AND t_value.structattr_name = %s)' * len(fill))}
                GROUP BY t.id
                ''',
                (corpus_id, search.struct, search.attr, *values, *list(chain(*[[f.struct, f.attr] for f in fill]))))
        return cursor

    def find_bib_titles(self, plugin_ctx: PluginCtx, corpus_id: str, id_list: List[str]) -> List[BibTitle]:
        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpus_id)
        bib_id = self.import_key(corpus_info.metadata.id_attr)
        bib_label = self.import_key(corpus_info.metadata.label_attr)

        cursor = self._find_attrs(corpus_id, bib_id, id_list, [bib_id, bib_label])

        ans = []
        for row in cursor:
            data = dict(tuple(pair.split('=', 1)) for pair in row['data'].split('\n'))
            ans.append(BibTitle(data[bib_id.key()], data[bib_label.key()]))
        return ans

    def fill_attrs(self, corpus_id: str, search: str, values: List[str], fill: List[str]) -> Dict[str, Dict[str, str]]:
        search_structattr = self.import_key(search)
        fill_structattrs = [self.import_key(f) for f in fill]

        cursor = self._find_attrs(corpus_id, search_structattr, values, [
                                  search_structattr, *fill_structattrs])

        ans = {}
        for row in cursor:
            data = dict(tuple(pair.split('=', 1)) for pair in row['data'].split('\n'))
            ans[data[search]] = {k: v for k, v in data.items() if not (k == search)}
        return {'data': ans}


@inject(plugins.runtime.CORPARCH, plugins.runtime.DB, plugins.runtime.INTEGRATION_DB)
def create_instance(
        settings, corparch: AbstractCorporaArchive, db: KeyValueStorage,
        integ_db: IntegrationDatabase) -> MysqlLiveAttributes:
    """
    creates an instance of the plugin

    arguments:
    corparch -- corparch plugin
    """

    la_settings = settings.get('plugins', 'live_attributes')
    if integ_db.is_active:
        logging.getLogger(__name__).info(
            f'mysql_live_attributes uses integration_db[{integ_db.info}]')
        return MysqlLiveAttributes(
            corparch=corparch,
            db=db,
            integ_db=integ_db,
            max_attr_list_size=settings.get_int(
                'global', 'max_attr_list_size'),
            empty_val_placeholder=settings.get(
                'corpora', 'empty_attr_value_placeholder'),
            max_attr_visible_chars=int(la_settings.get('max_attr_visible_chars', 20)))
    else:
        logging.getLogger(__name__).error('mysql_live_attributes integration db not provided')
