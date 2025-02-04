
# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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


import aiofiles
import plugins
import ujson as json
from sanic import Blueprint

from action.control import http_action
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.response import KResponse


bp = Blueprint('tt_select')


@bp.route('/filter_attributes', methods=['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def filter_attributes(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    attrs = json.loads(req.form.get('attrs', '{}'))
    aligned = json.loads(req.form.get('aligned', '[]'))
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return await lattr.get_attr_values(
            amodel.plugin_ctx, corpus=amodel.corp, attr_map=attrs,
            aligned_corpora=aligned)


@bp.route('/attr_val_autocomplete', methods=['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def attr_val_autocomplete(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    attrs = json.loads(req.form.get('attrs', '{}'))
    pattern_attr = req.form.get('patternAttr')
    with plugins.runtime.CORPARCH as ca:
        corpus_info = await ca.get_corpus_info(amodel.plugin_ctx, amodel.corp.corpname)
    attrs[pattern_attr] = '%{}%'.format(req.form.get('pattern'))
    if pattern_attr == corpus_info.metadata.label_attr:
        attrs[corpus_info.metadata.id_attr] = []
    aligned = json.loads(req.form.get('aligned', '[]'))
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return await lattr.get_attr_values(
            amodel.plugin_ctx,
            corpus=amodel.corp,
            attr_map=attrs,
            aligned_corpora=aligned,
            autocomplete_attr=req.form.get('patternAttr'),
            apply_cutoff=True)


@bp.route('/fill_attrs', methods=['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def fill_attrs(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    search = req.json['search']
    values = req.json['values']
    fill = req.json['fill']

    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return await lattr.fill_attrs(plugin_ctx=amodel.plugin_ctx, corpus_id=amodel.corp.corpname, search=search, values=values, fill=fill)


@bp.route('/num_matching_documents', methods=['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def num_matching_documents(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        nm = await lattr.num_matching_documents(
            amodel.plugin_ctx, amodel.args.corpname, req.json['lattrs'], req.json['laligned'])
        return dict(num_documents=nm)


@bp.route('/save_document_list', methods=['POST'])
@http_action(return_type='plain', action_model=CorpusActionModel)
async def save_document_list(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    attrs = req.json.get('lattrs', {})
    aligned = req.json.get('laligned', [])
    save_format = req.args.get('save_format')
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        nm, ttype = await lattr.document_list(
            amodel.plugin_ctx, amodel.args.corpname, req.args.getlist('lattr'), attrs, aligned, save_format)
        resp.set_header('Content-Type', ttype)
        file_size = await aiofiles.os.path.getsize(nm)
        resp.set_header('Content-Length', str(file_size))
        resp.set_header(
            'Content-Disposition', f'attachment; filename="document-list-{amodel.args.corpname}.{save_format}"')
        with open(nm, 'rb') as fr:
            return fr.read()

