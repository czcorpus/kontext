# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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
The module contains functions matching a signature required by the 'action_log_mapper' attribute in @exposed
methods. The functions map request arguments to a more compact/readable form as required by action logging.
"""

from werkzeug import Request


def query(request: Request):
    return dict(corpname=request.args.get('corpname'), align=request.args.getlist('align'))


def query_submit(request: Request):
    if request.json and len(request.json.get('queries', [])) > 0:
        queries = request.json.get('queries', [])
        corpora = []
        for q in queries:
            corpora.append(q.get('corpname'))
        q0 = queries[0]
        parsed = q0.get('queryParsed', [])
        return dict(
            corpora=corpora,
            qtype=q0.get('qtype'),
            use_regexp=q0.get('use_regexp'),
            qmcase=q0.get('qmcase'),
            extended_query=any(p for p in parsed if p[1] is True),
            uses_context=request.json.get('fc_lemword') or len(request.json.get('fc_pos', [])),
            uses_tt=len(request.json.get('text_types', {})) > 0)
    return {}


def view(request: Request):
    return dict(corpname=request.args.get('corpname'), maincorp=request.args.get('maincorp'),
                viewmode=request.args.get('viewmode'), pagesize=request.args.get('pagesize'),
                attrs=request.args.get('attrs'), attr_vmode=request.args.get('attrs_vmode'),
                q=request.args.get('q'))


def wordlist(request: Request):
    return dict(corpname=request.form.get('corpname'), wlsort=request.form.get('wlsort'),
                wlnums=request.form.get('wlnums'), wltype=request.form.get('wltype'))
