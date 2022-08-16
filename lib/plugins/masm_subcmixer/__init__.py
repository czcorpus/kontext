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

import logging
import aiohttp
import ujson
from sanic.blueprints import Blueprint
from plugin_types.subcmixer import AbstractSubcMixer
from plugin_types.subcmixer.error import (
    ResultNotFoundException,
    SubcMixerException
)
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.response import KResponse
from action.decorators import http_action
from plugin_types.corparch import AbstractCorporaArchive
import plugins

bp = Blueprint('masm_subcmixer', url_prefix='subcorpus')


@bp.route('/subcmixer_run_calc', methods=['POST'])
@http_action(return_type='json', access_level=1, action_model=CorpusActionModel)
def subcmixer_run_calc(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    try:
        with plugins.runtime.SUBCMIXER as sm:
            return sm.process(
                plugin_ctx=amodel.plugin_ctx, corpus=amodel.corp,
                corpname=req.form.get('corpname'),
                aligned_corpora=req.form_getlist('aligned_corpora'),
                args=ujson.loads(req.form.get('expression')))
    except ResultNotFoundException as err:
        resp.add_system_message('error', str(err))
        return {}


async def proc_masm_response(resp):
    data = await resp.json()
    if 400 <= resp.status <= 500:
        raise SubcMixerException(data.get('error', 'unspecified error'))
    return data


class MasmSubcmixer(AbstractSubcMixer):

    def __init__(self, corparch: AbstractCorporaArchive, service_url: str):
        self._service_url = service_url
        self._corparch = corparch
        self._session = None

    async def _get_session(self):
        if self._session is None:
            self._session = aiohttp.ClientSession(base_url=self._service_url)
        return self._session

    async def is_enabled_for(self, plugin_ctx, corpora):
        if len(corpora) == 0:
            return False
        info = await self._corparch.get_corpus_info(plugin_ctx, corpora[0])
        return bool(info.metadata.id_attr)

    async def process(self, plugin_ctx, corpus, corpname, aligned_corpora, args):
        used_structs = set(item['attrName'].split('.')[0] for item in args)
        if len(used_structs) > 1:
            raise SubcMixerException(
                'Subcorpora based on more than a single structure are not supported at the moment.')
        session = await self._get_session()
        async with session.post(
                f'/liveAttributes/{corpname}/mixSubcorpus',
                json={
                    'corpora': [corpname] + aligned_corpora,
                    'textTypes': args
                }) as resp:
            data = await proc_masm_response(resp)
            logging.getLogger(__name__).debug('data  >>>>> {}'.format(data))

    @staticmethod
    def export_actions():
        return bp


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch: AbstractCorporaArchive) -> MasmSubcmixer:
    plg_conf = settings.get('plugins')['subcmixer']
    return MasmSubcmixer(corparch, plg_conf['service_url'])
