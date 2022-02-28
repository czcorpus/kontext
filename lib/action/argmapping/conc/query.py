# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Dict, Any, List, Tuple
from dataclasses import dataclass, field
from dataclasses_json import dataclass_json

import plugins
from action.plugin.ctx import PluginCtx
from action.argmapping.error import ArgumentMappingError
from action.argmapping.conc.base import ConcFormArgs


@dataclass_json
@dataclass
class _QueryFormArgs:
    form_type: str = 'query'
    curr_query_types: Dict[str, str] = field(default_factory=dict)
    curr_queries: Dict[str, str] = field(default_factory=dict)
    curr_parsed_queries: Dict[str, str] = field(default_factory=dict)
    curr_pcq_pos_neg_values: Dict[str, str] = field(default_factory=dict)
    curr_include_empty_values: Dict[str, bool] = field(default_factory=dict)
    curr_lpos_values: Dict[str, str] = field(default_factory=dict)
    curr_qmcase_values: Dict[str, bool] = field(default_factory=dict)
    curr_default_attr_values: Dict[str, bool] = field(default_factory=dict)
    curr_use_regexp_values: Dict[str, bool] = field(default_factory=dict)
    tagsets: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    has_lemma: Dict[str, bool] = field(default_factory=dict)
    asnc: bool = False
    no_query_history: bool = False

    # context filter
    fc_lemword_type: str = 'all'
    fc_lemword_wsize: Tuple[int, int] = (-5, 5)
    fc_lemword: str = ''
    fc_pos_type: str = 'all'
    fc_pos_wsize: Tuple[int, int] = (-5, 5)
    fc_pos: List[str] = field(default_factory=list)   # TODO is the type correct ??

    selected_text_types: Dict[str, List[str]] = field(default_factory=dict)
    # for bibliography structattr - maps from hidden ids to visible titles (this is optional)
    bib_mapping: Dict[str, str] = field(default_factory=dict)


def _corp_mapping(corpora: List[str], v: Any = None) -> Dict[str, Any]:
    return {c: v for c in corpora}


class QueryFormArgs(ConcFormArgs[_QueryFormArgs]):
    """
    QueryFormArgs provides methods to handle concordance
    query form arguments represented by the _QueryFormArgs data class.
    """

    def __init__(self, plugin_ctx: PluginCtx, corpora: List[str], persist: bool) -> None:
        super().__init__(persist)
        self._plugin_ctx = plugin_ctx
        self.data = _QueryFormArgs(
            form_type='query',
            curr_query_types=_corp_mapping(corpora, 'simple'),
            curr_queries=_corp_mapping(corpora),
            curr_parsed_queries=_corp_mapping(corpora),
            curr_pcq_pos_neg_values=_corp_mapping(corpora),
            curr_include_empty_values=_corp_mapping(corpora),
            curr_lpos_values=_corp_mapping(corpora),
            curr_qmcase_values=_corp_mapping(corpora),
            curr_default_attr_values=_corp_mapping(corpora),
            curr_use_regexp_values=_corp_mapping(corpora, False),
            tagsets=_corp_mapping(corpora),
            has_lemma=_corp_mapping(corpora))
        for corp in corpora:
            self._add_corpus_metadata(corp)

    def apply_last_used_opts(
            self, data: Dict[str, Any], prev_corpora: List[str], curr_corpora: List[str], curr_posattrs: List[str]):
        self._test_data_type(data, 'form_type', 'query')
        prev_maincorp = prev_corpora[0]
        curr_maincorp = curr_corpora[0]
        self.data.curr_query_types[curr_maincorp] = data['curr_query_types'][prev_maincorp]
        self.data.curr_qmcase_values[curr_maincorp] = data['curr_qmcase_values'][prev_maincorp]
        self.data.curr_use_regexp_values[curr_maincorp] = data['curr_use_regexp_values'][prev_maincorp]
        prev_default_attr = data['curr_default_attr_values'][prev_maincorp]
        if prev_default_attr in curr_posattrs:
            self.data.curr_default_attr_values[curr_maincorp] = prev_default_attr
        else:
            self.data.curr_default_attr_values[curr_maincorp] = None

    @staticmethod
    def _test_data_type(data, type_key, type_id):
        data_type = data.get(type_key)
        if data_type != type_id:
            raise ArgumentMappingError(
                f'Invalid form data type "{data_type}" for a query form mapping.')

    def update_by_user_query(self, data, bib_mapping):
        self._test_data_type(data, 'type', 'concQueryArgs')
        self.data.asnc = data.get('async', False)
        self.data.no_query_history = data.get('no_query_history', False)
        for query in data['queries']:
            corp = query['corpname']
            self.data.curr_query_types[corp] = query['qtype']
            self.data.curr_queries[corp] = query.get('query')
            self.data.curr_parsed_queries[corp] = query.get('queryParsed', [])
            self.data.curr_pcq_pos_neg_values[corp] = query['pcq_pos_neg']
            self.data.curr_include_empty_values[corp] = query['include_empty']
            self.data.curr_qmcase_values[corp] = query.get('qmcase', False)
            self.data.curr_default_attr_values[corp] = query.get('default_attr')
            self.data.curr_use_regexp_values[corp] = query.get('use_regexp', False)
        self.data.bib_mapping = bib_mapping

        ctx = data['context']
        self.data.fc_lemword_type = ctx.get('fc_lemword_type', self.data.fc_lemword_type)
        self.data.fc_lemword_wsize = ctx.get('fc_lemword_wsize', self.data.fc_lemword_wsize)
        self.data.fc_lemword = ctx.get('fc_lemword', self.data.fc_lemword)
        self.data.fc_pos_type = ctx.get('fc_pos_type', self.data.fc_pos_type)
        self.data.fc_pos_wsize = ctx.get('fc_pos_wsize', self.data.fc_pos_wsize)
        self.data.fc_pos = ctx.get('fc_pos', self.data.fc_pos)
        self.data.selected_text_types = data['text_types']

    def _add_corpus_metadata(self, corpus_id: str):
        with plugins.runtime.CORPARCH as ca, plugins.runtime.TAGHELPER as th:
            corp_info = ca.get_corpus_info(self._plugin_ctx, corpus_id)
            self.data.has_lemma[corpus_id] = corp_info.manatee.has_lemma
            self.data.tagsets[corpus_id] = [d.to_dict() for d in corp_info.tagsets]
            for ts in self.data.tagsets[corpus_id]:
                ts['widgetEnabled'] = ts['widgetEnabled'] and th.tags_available_for(
                    self._plugin_ctx, corpus_id, ts['ident'])

    def serialize(self) -> Dict[str, Any]:
        ans = super().to_dict()
        del ans['has_lemma']
        del ans['tagsets']
        return ans
