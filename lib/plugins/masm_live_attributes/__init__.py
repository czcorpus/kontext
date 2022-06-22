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

import aiohttp
import plugins
import ujson
from action.decorators import http_action
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.response import KResponse
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.live_attributes import (AbstractLiveAttributes,
                                          AttrValuesResponse)
from sanic.blueprints import Blueprint

bp = Blueprint('masm_live_attributes')


@bp.route('/filter_attributes', methods=['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def filter_attributes(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    attrs = ujson.loads(req.form.get('attrs', '{}'))
    aligned = ujson.loads(req.form.get('aligned', '[]'))
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return await lattr.get_attr_values(amodel.plugin_ctx, corpus=amodel.corp, attr_map=attrs,
                                           aligned_corpora=aligned)


@bp.route('/attr_val_autocomplete', methods=['POST'])
@http_action(return_type='json', action_model=CorpusActionModel)
async def attr_val_autocomplete(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    attrs = ujson.loads(req.form.get('attrs', '{}'))
    attrs[req.form.get('patternAttr')] = '%{}%'.format(req.form.get('pattern'))
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


class MasmLiveAttributes(AbstractLiveAttributes):

    corparch: AbstractCorporaArchive

    @staticmethod
    def export_actions():
        return bp

    def __init__(self, corparch: AbstractCorporaArchive, service_url: str):
        self.corparch = corparch
        self._service_url = service_url
        self._session = None

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

        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpus.corpname}/query', json=json_body) as resp:
            data = await resp.json()

        return AttrValuesResponse(**data)

    async def get_subc_size(self, plugin_ctx, corpora, attr_map):
        json_body = {'attrs': attr_map}
        if len(corpora) > 1:
            json_body['aligned'] = corpora[1:]

        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpora[0]}/selection-subc-size', json=json_body) as resp:
            data = await resp.json()

        return data['Total']

    async def get_supported_structures(self, plugin_ctx, corpname):
        corpus_info = await self.corparch.get_corpus_info(plugin_ctx, corpname)
        id_attr = corpus_info.metadata.id_attr
        return [id_attr.split('.')[0]] if id_attr else []

    async def get_bibliography(self, plugin_ctx, corpus, item_id):
        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpus.corpname}/get-bibliography', json={'itemId': item_id}) as resp:
            data = await resp.json()

        return list(data.items())

    async def find_bib_titles(self, plugin_ctx, corpus_id, id_list):
        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpus_id}/find-bib-titles', json={'itemIds': id_list}) as resp:
            data = await resp.json()

        return [data[item_id] for item_id in id_list]

    async def fill_attrs(self, corpus_id, search, values, fill):
        json_body = {'search': search, 'values': values, 'fill': fill}
        session = await self._get_session()
        async with session.post(f'/liveAttributes/{corpus_id}/fill-attrs', json=json_body) as resp:
            return await resp.json()


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch: AbstractCorporaArchive) -> MasmLiveAttributes:
    plg_conf = settings.get('plugins')['live_attributes']
    return MasmLiveAttributes(corparch, plg_conf['service_url'])
