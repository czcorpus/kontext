# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
Required XML configuration: please see ./config.rng
"""

import asyncio
import logging
from typing import Dict, List, Optional, Tuple

import plugins
from action.control import http_action
from action.krequest import KRequest
from action.model.concordance import ConcActionModel
from action.response import KResponse
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.kwic_connect import AbstractKwicConnect
from plugin_types.token_connect import AbstractBackend, AbstractFrontend
from plugins.default_token_connect import setup_providers
from sanic.blueprints import Blueprint
from util import as_async

bp = Blueprint('default_kwic_connect')


def merge_results(curr, new, word: str):
    for item in new:
        item['kwic'] = word
    if len(curr) == 0:
        return [[x] for x in new]
    else:
        for i in range(len(curr)):
            curr[i] += [new[i]]
        return curr


async def handle_word_req(plugin_ctx, word, corpora, providers, ui_lang):
    with plugins.runtime.KWIC_CONNECT as kc:
        return word, await kc.fetch_data(plugin_ctx, providers, corpora, word, ui_lang)


@bp.route('/fetch_external_kwic_info')
@http_action(return_type='json', action_model=ConcActionModel)
async def fetch_external_kwic_info(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    words = req.args_getlist('w')
    with plugins.runtime.CORPARCH as ca:
        corpus_info = await ca.get_corpus_info(amodel.plugin_ctx, amodel.corp.corpname)
        args = [(
            amodel.plugin_ctx,
            w,
            [amodel.corp.corpname] + amodel.args.align,
            corpus_info.kwic_connect.providers,
            req.ui_lang)
            for w in words]
        provider_all = []
        for f in asyncio.as_completed([handle_word_req(*arg) for arg in args]):
            word, res = await f
            provider_all = merge_results(provider_all, res, word)
        ans = []
        for provider in provider_all:
            ans.append(dict(
                renderer=provider[0]['renderer'],
                heading=provider[0]['heading'],
                note=provider[0]['note'],
                data=[
                    dict(kwic=item['kwic'], status=item['status'], contents=item['contents'])
                    for item in provider]))
    return dict(data=ans)


@bp.route('/get_corpus_kc_providers')
@http_action(return_type='json', action_model=ConcActionModel)
async def get_corpus_kc_providers(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.CORPARCH as ca, plugins.runtime.KWIC_CONNECT as kc:
        corpus_info = await ca.get_corpus_info(amodel.plugin_ctx, amodel.corp.corpname)
        mp = kc.map_providers(corpus_info.kwic_connect.providers)
        return dict(corpname=amodel.corp.corpname,
                    providers=[dict(id=b.provider_id, label=f.get_heading(req.ui_lang)) for b, f in mp])


class DefaultKwicConnect(AbstractKwicConnect):

    def __init__(
            self,
            providers: Dict[str, Tuple[AbstractBackend, Optional[AbstractFrontend]]],
            corparch: AbstractCorporaArchive,
            max_kwic_words: int,
            load_chunk_size: int):
        self._corparch = corparch
        self._max_kwic_words = max_kwic_words
        self._load_chunk_size = load_chunk_size
        self._providers = providers

    def map_providers(self, provider_ids):
        return [self._providers[ident] for ident in provider_ids]

    async def is_enabled_for(self, plugin_ctx, corpora):
        if len(corpora) == 0:
            return False
        corpus_info = await self._corparch.get_corpus_info(plugin_ctx, corpora[0])
        tst = [p.enabled_for_corpora([corpora[0]] + plugin_ctx.aligned_corpora)
               for p, _ in self.map_providers(corpus_info.kwic_connect.providers)]
        return len(tst) > 0 and True in tst

    @as_async
    def export(self, plugin_ctx):
        return dict(max_kwic_words=self._max_kwic_words, load_chunk_size=self._load_chunk_size)

    @staticmethod
    def export_actions():
        return bp

    async def fetch_data(
            self,
            plugin_ctx,
            provider_ids,
            corpora,
            lemma,
            lang) -> List[Dict]:
        ans = []
        for backend, frontend in self.map_providers(provider_ids):
            try:
                if backend.enabled_for_corpora(corpora):
                    cookies = {}
                    for cname in backend.get_required_cookies():
                        cookies[cname] = cookie = plugin_ctx.cookies.get(cname)
                        if cookie is None:
                            raise Exception(
                                f'Backend configuration problem: cookie {cname} not available')
                    data, status = await backend.fetch(
                        plugin_ctx, corpora, None, None, 1, dict(lemma=lemma), lang,
                        plugin_ctx.user_is_anonymous, (-1, 1), cookies)
                    if frontend is not None:
                        ans.append(frontend.export_data(
                            data, status, lang, is_kwic_view=False).to_dict())
                    else:
                        ans.append(data)
            except EnvironmentError as ex:
                logging.getLogger(__name__).error('KwicConnect backend error: {0}'.format(ex))
                raise ex
        return ans


@plugins.inject(plugins.runtime.DB, plugins.runtime.CORPARCH)
def create_instance(settings, db, corparch):
    providers = setup_providers(settings.get('plugins', 'kwic_connect'),
                                db, be_type=AbstractBackend, fe_type=AbstractFrontend)
    plg_conf = settings.get('plugins', 'kwic_connect')
    kwic_conn = DefaultKwicConnect(
        providers, corparch, max_kwic_words=plg_conf['max_kwic_words'],
        load_chunk_size=plg_conf['load_chunk_size'])
    return kwic_conn
