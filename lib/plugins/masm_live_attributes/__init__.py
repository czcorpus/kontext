# Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

from typing import Any, List
import urllib.parse
import os

import aiohttp
import aiofiles
import plugins
import ujson
from sanic.blueprints import Blueprint
from action.control import http_action
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.response import KResponse
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.live_attributes import (
    AbstractLiveAttributes, AttrValuesResponse, BibTitle, LiveAttrsException)
from .doclist import mk_cache_key, DocListItem
from .doclist.writer import export_csv

bp = Blueprint('masm_live_attributes')


@bp.route('/filter_attributes', methods=['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def filter_attributes(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    attrs = ujson.loads(req.form.get('attrs', '{}'))
    aligned = ujson.loads(req.form.get('aligned', '[]'))
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return await lattr.get_attr_values(
            amodel.plugin_ctx, corpus=amodel.corp, attr_map=attrs,
            aligned_corpora=aligned)


@bp.route('/attr_val_autocomplete', methods=['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def attr_val_autocomplete(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    attrs = ujson.loads(req.form.get('attrs', '{}'))
    pattern_attr = req.form.get('patternAttr')
    with plugins.runtime.CORPARCH as ca:
        corpus_info = await ca.get_corpus_info(amodel.plugin_ctx, amodel.corp.corpname)
    attrs[pattern_attr] = '%{}%'.format(req.form.get('pattern'))
    if pattern_attr == corpus_info.metadata.label_attr:
        attrs[corpus_info.metadata.id_attr] = []
    aligned = ujson.loads(req.form.get('aligned', '[]'))
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return await lattr.get_attr_values(
            amodel.plugin_ctx, corpus=amodel.corp, attr_map=attrs,
            aligned_corpora=aligned, autocomplete_attr=req.form.get('patternAttr'))


@bp.route('/fill_attrs', methods=['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def fill_attrs(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    search = req.json['search']
    values = req.json['values']
    fill = req.json['fill']

    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return await lattr.fill_attrs(corpus_id=amodel.corp.corpname, search=search, values=values, fill=fill)

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
    attrs = ujson.loads(req.form.get('attrs', '{}'))
    aligned = ujson.loads(req.form.get('aligned', '[]'))
    save_format = req.args.get('save_format')
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        nm, ttype = await lattr.document_list(
            amodel.plugin_ctx, amodel.args.corpname, req.args.getlist('lattr'), attrs, aligned, save_format)
        resp.set_header('Content-Type', ttype)
        file_size = await aiofiles.os.path.getsize(nm)
        resp.set_header('Content-Length', str(file_size))
        resp.set_header(
            'Content-Disposition', f'attachment; filename="document-list-{amodel.args.corpname}.{save_format}"')
        with open(nm, 'r') as fr:
            return fr.read()


async def proc_masm_response(resp) -> Any:
    data = await resp.json()
    if 400 <= resp.status <= 500:
        raise LiveAttrsException(data.get('error', 'unspecified error'))
    return data


class MasmLiveAttributes(AbstractLiveAttributes):

    corparch: AbstractCorporaArchive

    @staticmethod
    def export_actions():
        return bp

    def __init__(
            self,
            corparch: AbstractCorporaArchive,
            service_url: str,
            doclist_cache_dir: str,
            max_attr_list_size: int
    ):
        self.corparch = corparch
        self._service_url = service_url
        self._doclist_cache_dir = doclist_cache_dir
        self._session = None
        self._max_attr_list_size = max_attr_list_size

    async def _get_session(self):
        if self._session is None:
            self._session = aiohttp.ClientSession(base_url=self._service_url)
        return self._session

    async def is_enabled_for(self, plugin_ctx, corpora):
        if len(corpora) == 0:
            return False
        # TODO now enabled if database path is defined
        return bool((await self.corparch.get_corpus_info(plugin_ctx, corpora[0])).metadata.database)

    async def get_attr_values(
            self, plugin_ctx, corpus, attr_map, aligned_corpora=None, autocomplete_attr=None, limit_lists=True):
        json_body = {'attrs': attr_map}
        if aligned_corpora:
            json_body['aligned'] = aligned_corpora
        if autocomplete_attr:
            json_body['autocompleteAttr'] = autocomplete_attr
        json_body['maxAttrListSize'] = self._max_attr_list_size

        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpus.corpname}/query', json=json_body) as resp:
            data = await proc_masm_response(resp)
        return AttrValuesResponse(**data)

    async def get_subc_size(self, plugin_ctx, corpora, attr_map):
        json_body = {'attrs': attr_map}
        if len(corpora) > 1:
            json_body['aligned'] = corpora[1:]

        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpora[0]}/selectionSubcSize', json=json_body) as resp:
            data = await proc_masm_response(resp)
        return data['total']

    async def get_supported_structures(self, plugin_ctx, corpname):
        corpus_info = await self.corparch.get_corpus_info(plugin_ctx, corpname)
        id_attr = corpus_info.metadata.id_attr
        return [id_attr.split('.')[0]] if id_attr else []

    async def get_bibliography(self, plugin_ctx, corpus, item_id):
        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpus.corpname}/getBibliography', json={'itemId': item_id}) as resp:
            data = await proc_masm_response(resp)
        return list(data.items())

    async def find_bib_titles(self, plugin_ctx, corpus_id, id_list) -> List[BibTitle]:
        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpus_id}/findBibTitles', json={'itemIds': id_list}) as resp:
            data = await proc_masm_response(resp)
        return [BibTitle(item_id, data[item_id]) for item_id in id_list]

    async def fill_attrs(self, corpus_id, search, values, fill):
        json_body = {'search': search, 'values': values, 'fill': fill}
        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpus_id}/fillAttrs', json=json_body) as resp:
            return await proc_masm_response(resp)

    async def document_list(self, plugin_ctx, corpus_id, view_attrs, attr_map, aligned_corpora, save_format):
        session = await self._get_session()
        args = dict(attrs=attr_map, aligned=aligned_corpora)
        attrs = urllib.parse.urlencode([('attr',  x) for x in view_attrs])
        async with session.post(f'/liveAttributes/{corpus_id}/documentList?{attrs}', json=args) as resp:
            data = await proc_masm_response(resp)
            for i, item in enumerate(data):
                data[i] = DocListItem.from_dict(item)
            if save_format == 'csv':
                file = os.path.join(self._doclist_cache_dir, mk_cache_key(attr_map, aligned_corpora, view_attrs))
                await export_csv(data, file)
                return file, 'text/csv'


    async def num_matching_documents(self, plugin_ctx, corpus_id, attr_map, aligned_corpora):
        session = await self._get_session()
        args = dict(attrs=attr_map, aligned=aligned_corpora)
        async with session.post(f'/liveAttributes/{corpus_id}/numMatchingDocuments', json=args) as resp:
            return await proc_masm_response(resp)

@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch: AbstractCorporaArchive) -> MasmLiveAttributes:
    plg_conf = settings.get('plugins')['live_attributes']
    return MasmLiveAttributes(
        corparch,
        plg_conf['service_url'],
        plg_conf['doclist_cache_dir'],
        max_attr_list_size=settings.get_int('global', 'max_attr_list_size')
    )
