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

from typing import Dict, Any, List

from action.plugin.ctx import PluginCtx
from action.argmapping.conc.base import ConcFormArgs
from .query import QueryFormArgs
from .filter import FilterFormArgs, SubHitsFilterFormArgs, FirstHitsFilterFormArgs
from .sort import SortFormArgs
from .other import SampleFormArgs, ShuffleFormArgs, KwicSwitchArgs, LgroupOpArgs, LockedOpFormsArgs


def build_conc_form_args(plugin_ctx: PluginCtx, corpora: List[str], data: Dict[str, Any], op_key: str) -> ConcFormArgs:
    """
    A factory method to create a conc form args
    instance based on deserialized data from
    query_persistence database.
    """
    tp = data['form_type']
    if tp == 'query':
        return QueryFormArgs(plugin_ctx=plugin_ctx, corpora=corpora, persist=False).updated(data, op_key)
    elif tp == 'filter':
        return FilterFormArgs(plugin_ctx=plugin_ctx, maincorp=data['maincorp'], persist=False).updated(data, op_key)
    elif tp == 'sort':
        return SortFormArgs(persist=False).updated(data, op_key)
    elif tp == 'sample':
        return SampleFormArgs(persist=False).updated(data, op_key)
    elif tp == 'shuffle':
        return ShuffleFormArgs(persist=False).updated(data, op_key)
    elif tp == 'switchmc':
        return KwicSwitchArgs(maincorp=data['maincorp'], persist=False).updated(data, op_key)
    elif tp == 'lgroup':
        return LgroupOpArgs(persist=False).updated(data, op_key)
    elif tp == 'locked':
        return LockedOpFormsArgs(persist=False).updated(data, op_key)
    elif tp == 'subhits':
        return SubHitsFilterFormArgs(persist=False).updated(data, op_key)
    elif tp == 'firsthits':
        return FirstHitsFilterFormArgs(persist=False, doc_struct=data['doc_struct']).updated(data, op_key)
    else:
        raise ValueError(f'Cannot determine stored conc args class from type {tp}')
