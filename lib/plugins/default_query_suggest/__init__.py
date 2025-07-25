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

from typing import Dict, List, Tuple

import plugin_types.corparch
import plugins
from action.control import http_action
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.plugin.ctx import PluginCtx
from action.response import KResponse
from plugin_types.providers import find_implementation
from plugin_types.query_suggest import (
    AbstractBackend, AbstractFrontend, AbstractQuerySuggest)
from sanic.blueprints import Blueprint

bp = Blueprint('default_query_suggest')


@bp.route('/fetch_query_suggestions')
@http_action(return_type='json', action_model=CorpusActionModel)
async def fetch_query_suggestions(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    """
    """
    with plugins.runtime.QUERY_SUGGEST as plg:
        ans = await plg.find_suggestions(
            plugin_ctx=amodel.plugin_ctx,
            corpora=req.args_getlist('corpname'),
            subcorpus=req.args.get('subcorpus'),
            value=req.args.get('value'),
            value_type=req.args.get('value_type'),
            value_subformat=req.args.get('value_subformat'),
            query_type=req.args.get('query_type'),
            p_attr=req.args.get('p_attr'), struct=req.args.get('struct'),
            s_attr=req.args.get('s_attr'))
    return dict(items=ans)


class DefaultQuerySuggest(AbstractQuerySuggest):

    def __init__(self, providers: Dict[str, Tuple[AbstractBackend, AbstractFrontend]], corparch: plugin_types.corparch.AbstractCorporaArchive):
        self._providers = providers
        self._corparch = corparch

    async def find_suggestions(
            self, plugin_ctx: PluginCtx, corpora: List[str], subcorpus: str, value: str, value_type: str,
            value_subformat: str, query_type: str, p_attr: str, struct: str, s_attr: str):
        corpus_info = await self._corparch.get_corpus_info(plugin_ctx, plugin_ctx.current_corpus.corpname)
        ans = []
        for ident, provider in self._providers.items():
            if ident not in corpus_info.query_suggest.providers:
                continue
            backend, frontend = provider
            resp = await backend.find_suggestion(
                plugin_ctx=plugin_ctx,
                user_id=plugin_ctx.user_id, ui_lang=plugin_ctx.user_lang,
                maincorp=plugin_ctx.current_corpus, corpora=corpora,
                subcorpus=subcorpus, value=value, value_type=value_type,
                value_subformat=value_subformat, query_type=query_type,
                p_attr=p_attr, struct=struct, s_attr=s_attr)
            ans.append(frontend.export_data(resp, value, plugin_ctx.user_lang).to_dict())
        return ans

    async def is_enabled_for(self, plugin_ctx: 'PluginCtx', corpora: List[str]) -> bool:
        if len(corpora) > 0:
            corpus_info = await self._corparch.get_corpus_info(plugin_ctx, corpora[0])
            for prov in self._providers:
                if prov in corpus_info.query_suggest.providers:
                    return True
        return False

    async def export(self, plugin_ctx):
        corpus_info = await self._corparch.get_corpus_info(plugin_ctx, plugin_ctx.current_corpus.corpname)
        active_providers = []
        for ident, fb in self._providers.items():
            _, frontend = fb
            if ident in corpus_info.query_suggest.providers:
                active_providers.append({
                    'ident': ident,
                    'rendererId': frontend.renderer,
                    'heading': frontend.headings.get(plugin_ctx.user_lang.replace('_', '-'), '--'),
                    'queryTypes': frontend.query_types,
                    'onItemClick': frontend.on_item_click,
                    'conf': frontend.custom_conf
                })
        return dict(providers=active_providers)

    @staticmethod
    def export_actions():
        return bp


def init_provider(conf, ident) -> Tuple[AbstractBackend, AbstractFrontend]:
    """
    Create and return both backend and frontend.

    arguments:
    conf -- a dict representing plug-in detailed configuration

    returns:
    a 2-tuple (backend instance, frontend instance)
    """
    backend_class = find_implementation(conf['backend'])
    frontend_class = find_implementation(conf['frontend'])
    return backend_class(conf['conf'], ident), frontend_class(conf)


def setup_providers(plg_conf) -> Dict[str, Tuple[AbstractBackend, AbstractFrontend]]:
    return dict((prov['ident'], init_provider(prov, prov['ident'])) for prov in plg_conf.get('providers', []))


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch):
    """
    arguments:
    settings -- the settings.py module
    db -- a 'db' plugin implementation
    """
    conf = setup_providers(settings.get_plugin_custom_conf(plugins.runtime.QUERY_SUGGEST.name))
    return DefaultQuerySuggest(conf, corparch)
