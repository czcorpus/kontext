# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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
The module contains action logging functions for miscellaneous @http_action functions.
"""

from action.krequest import KRequest


def query(request: KRequest):
    return dict(corpname=request.args.get('corpname'), align=request.args.getlist('align', []))


def mk_query_submit(log_queries: bool):
    def query_submit(request: KRequest):
        if request.json and len(request.json.get('queries', [])) > 0:
            queries = request.json.get('queries', [])
            corpora = []
            for q in queries:
                corpora.append(q.get('corpname'))
            q0 = queries[0]
            parsed = q0.get('queryParsed', [])
            tt_size = len(request.json.get('text_types', {}))
            ans = dict(
                corpora=corpora,
                qtype=q0.get('qtype'),
                use_regexp=q0.get('use_regexp'),
                qmcase=q0.get('qmcase'),
                extended_query=any(p for p in parsed if p[1] is True),
                uses_context=request.json.get('fc_lemword') or len(request.json.get('fc_pos', [])),
                uses_tt=tt_size > 0
            )
            if log_queries:
                ans['async_query'] = request.json.get('async', False)
                ans['queries'] = [dict(q=item.get('query'), qtype=item.get('qtype')) for item in queries]
                ans['tt_num_attrs'] = tt_size
                ans['tt_num_selections'] = 0
                for v in request.json.get('text_types', {}).values():
                    if type(v) is list:
                        ans['tt_num_selections'] += len(v)
            return ans
        return {}
    return query_submit


def view(request: KRequest):
    return dict(
        corpname=request.args.get('corpname'), maincorp=request.args.get('maincorp'),
        viewmode=request.args.get('viewmode'), pagesize=request.args.get('pagesize'),
        attrs=request.args.get('attrs'), attr_vmode=request.args.get('attrs_vmode'),
        q=request.args.get('q'))


def wordlist(request: KRequest):
    return dict(
        corpname=request.form.get('corpname'),
        wlsort=request.form.get('wlsort'),
        wlnums=request.form.get('wlnums'),
        wltype=request.form.get('wltype'))

def keywords(request: KRequest):
    # TODO !!!
    import logging
    logging.getLogger(__name__).warning('keywords log mapping not implemented yet')
    return {}

def pquery(request: KRequest):
    return dict(
        corpname=request.json.get('corpname'),
        pquery_type=request.json.get('pquery_type'),
        attr=request.json.get('attr'),
        num_conc=len(request.json.get('conc_ids', []))
    )

def widectx(request: KRequest):
    attrs = request.args.get('attrs', '').split(',')
    structs = list(set(x.split('.')[0] for x in request.args.get('structs', '').split(',')))
    expand_left = request.args.get('detail_left_ctx')
    expand_right = request.args.get('detail_right_ctx')
    expand = (
        None if expand_left is None else int(expand_left),
        None if expand_right is None else int(expand_right))
    return dict(corpname=request.args.get('corpname'), attrs=attrs, structs=structs, expand=expand)


def new_subcorpus(request: KRequest):
    return dict(
        corpname=request.json.get('corpname'), form_type=request.json.get('form_type'))


def ajax_query_hist(request: KRequest):
    ans = {}
    for k, v in request.args.items():
        if len(v) == 1:
            ans[k] = v[0]
        elif len(v) > 1:
            ans[k] = v
    return ans