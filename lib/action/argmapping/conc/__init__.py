# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

from typing import Any, Dict, List, Tuple

from action.argmapping.conc.base import ConcFormArgs
from action.plugin.ctx import PluginCtx
from sanic.request import RequestParameters

from .filter import (
    FilterFormArgs, FirstHitsFilterFormArgs, SubHitsFilterFormArgs)
from .other import (
    KwicSwitchArgs, LgroupOpArgs, LockedOpFormsArgs, SampleFormArgs,
    ShuffleFormArgs)
from .query import QueryFormArgs
from .sort import SortFormArgs


async def build_conc_form_args(
        plugin_ctx: PluginCtx,
        corpora: List[str],
        data: Dict[str, Any],
        op_key: str,
        author_id: int
) -> ConcFormArgs:
    """
    A factory method to create a conc form args
    instance based on deserialized data from
    query_persistence database.
    """
    tp = data['form_type']
    if tp == 'query':
        return (await QueryFormArgs.create(
            plugin_ctx=plugin_ctx, corpora=corpora, persist=False)).updated(data, op_key, author_id)
    elif tp == 'filter':
        return (await FilterFormArgs.create(
            plugin_ctx=plugin_ctx, maincorp=data['maincorp'], persist=False)).updated(data, op_key, author_id)
    elif tp == 'sort':
        return SortFormArgs(persist=False).updated(data, op_key, author_id)
    elif tp == 'sample':
        return SampleFormArgs(persist=False).updated(data, op_key, author_id)
    elif tp == 'shuffle':
        return ShuffleFormArgs(persist=False).updated(data, op_key, author_id)
    elif tp == 'switchmc':
        return KwicSwitchArgs(maincorp=data['maincorp'], persist=False).updated(data, op_key, author_id)
    elif tp == 'lgroup':
        return LgroupOpArgs(persist=False).updated(data, op_key, author_id)
    elif tp == 'locked':
        return LockedOpFormsArgs(persist=False).updated(data, op_key, author_id)
    elif tp == 'subhits':
        return SubHitsFilterFormArgs(persist=False).updated(data, op_key, author_id)
    elif tp == 'firsthits':
        # doc_struct is a legacy key
        struct = data['doc_struct'] if 'doc_struct' in data else data['struct']
        return FirstHitsFilterFormArgs(persist=False, struct=struct).updated(data, op_key, author_id)
    else:
        raise ValueError(f'cannot determine stored conc args class from type {tp}')


async def decode_raw_query(
        plugin_ctx: PluginCtx,
        corpora: List[str],
        raw_ops: List[str],
) -> List[Tuple[str, ConcFormArgs]]:
    """
    Based on raw Manatee query parameters stored in 'args', create respective KonText forms.

    Returns pairs (raw_query, query form)
    """
    ans = []
    for raw_op in raw_ops:
        op = raw_op[0]
        if op in ('q', 'a'):
            ans.append((
                raw_op,
                (await QueryFormArgs.create(plugin_ctx=plugin_ctx, corpora=corpora, persist=True)
                 ).from_raw_query(raw_op, corpora[0])))
        elif op == 'r':
            ans.append((raw_op, SampleFormArgs(persist=True).from_raw_query(raw_op, corpora[0])))
        elif op == 's':
            ans.append((raw_op, SortFormArgs(persist=True).from_raw_query(raw_op, corpora[0])))
        elif op == 'f':
            ans.append((raw_op, ShuffleFormArgs(persist=True).from_raw_query(raw_op, corpora[0])))
        elif op == 'D':
            ans.append((raw_op, SubHitsFilterFormArgs(
                persist=True).from_raw_query(raw_op, corpora[0])))
        elif op == 'F':
            ans.append(
                (raw_op, FirstHitsFilterFormArgs(persist=True, struct='').from_raw_query(raw_op, corpora[0])))
        elif op in ('n', 'N', 'p', 'P'):
            ans.append((
                raw_op,
                (await FilterFormArgs.create(plugin_ctx=plugin_ctx, maincorp=raw_op, persist=True)
                 ).from_raw_query(raw_op, corpora[0])))
        elif op == 'x':
            ans.append((
                raw_op, KwicSwitchArgs(maincorp=raw_op, persist=True).from_raw_query(raw_op, corpora[0])))
        else:
            raise ValueError(f'failed to determine form for the encoded operation "{op}"')
    return ans
