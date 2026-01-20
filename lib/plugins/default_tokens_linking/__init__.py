# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

from typing import Dict, List, Tuple

import plugins
from action.control import http_action
from action.krequest import KRequest
from action.model.concordance import ConcActionModel
from action.response import KResponse
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.tokens_linking import AbstractTokensLinking
from plugins.default_token_connect import setup_providers
from sanic.blueprints import Blueprint
from util import as_async

from .backends.abstract import AbstractBackend
from .frontends.null import NullFrontend

bp = Blueprint('default_tokens_linking')


@bp.route('/fetch_tokens_linking', methods=['POST'])
@http_action(return_type='json', action_model=ConcActionModel)
async def fetch_token_detail(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.TOKENS_LINKING as tl, plugins.runtime.CORPARCH as ca:
        corpus_info = await ca.get_corpus_info(amodel.plugin_ctx, amodel.corp.corpname)
        data = await tl.fetch_data(
            amodel.plugin_ctx,
            corpus_info.tokens_linking.providers,
            req.json['corpusId'],
            req.json['tokenId'],
            req.json['tokenLength'],
            req.json['tokenRanges'],
            req.ui_lang,
        )
    return dict(data=data)


class DefaultTokensLinking(AbstractTokensLinking):

    def __init__(self, providers: Dict[str, Tuple[AbstractBackend, None]], corparch: AbstractCorporaArchive):
        self._providers = providers
        self._corparch = corparch

    def map_providers(self, provider_ids):
        return [self._providers[ident] for ident in provider_ids]

    async def is_enabled_for(self, plugin_ctx, corpora):
        if len(corpora) < 2:
            return False
        corpus_info = await self._corparch.get_corpus_info(plugin_ctx, corpora[0])
        tst = [p.enabled_for_corpora([corpora[0]] + plugin_ctx.aligned_corpora)
               for p, _ in self.map_providers(corpus_info.tokens_linking.providers)]
        return len(tst) > 0 and True in tst

    @as_async
    def export(self, plugin_ctx):
        return {}

    @staticmethod
    def export_actions():
        return bp

    async def fetch_data(self, plugin_ctx, provider_ids, corpus_id, token_id, token_length, token_ranges, lang) -> List[Dict]:
        ans = {}
        for backend, _ in self.map_providers(provider_ids):
            cookies = {}
            for cname in backend.get_required_cookies():
                cookies[cname] = cookie = plugin_ctx.cookies.get(cname)
                if cookie is None:
                    raise Exception(
                        f'Backend configuration problem: cookie {cname} not available')

            data, status = await backend.fetch(
                plugin_ctx,
                corpus_id,
                token_id,
                token_length,
                token_ranges,
                lang,
                plugin_ctx.user_is_anonymous,
                cookies,
            )
            ans[backend.provider_id] = data
        return ans

    async def get_required_attrs(self, plugin_ctx, providers, corpora):
        return list(set(attr for backend, _ in self.map_providers(providers) for attr in backend.required_attrs()))


@plugins.inject(plugins.runtime.DB, plugins.runtime.CORPARCH)
def create_instance(settings, db, corparch):
    providers = setup_providers(settings.get(
        'plugins', 'tokens_linking'), db, be_type=AbstractBackend, fe_type=NullFrontend)
    return DefaultTokensLinking(providers, corparch)
