# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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
Default token_connect plug-in allows attaching external services (dictionaries, encyclopediae)
to concordance tokens. A special JSON file (see token-detail-providers.sample.json) defines
a set of providers where a provider always contains a backend, frontend and identifier.

* **backend** specifies an adapter used to access a data source (e.g. a REST service),
* **frontend** specifies an object used to export fetched data (server part) and render them (client part),
* **identifier** is referred in corplist.xml by individual corpora to attach one or more providers per corpus.

The JSON config file defines a list of attributes (both structural and positional) we want to reveal for our
backends (see especially HTTP backend which uses these attributes to construct a service URL).

Required XML configuration: please see config.rng
"""

import logging
from typing import Any, Dict, Optional, Sequence, Tuple

import manatee
import plugins
from action.control import http_action
from action.krequest import KRequest
from action.model.concordance import ConcActionModel
from action.response import KResponse
from corplib.corpus import KCorpus
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.general_storage import KeyValueStorage
from plugin_types.providers import setup_providers
from plugin_types.token_connect import (
    AbstractBackend, AbstractFrontend, AbstractTokenConnect)
from plugins.default_token_connect.frontends import ErrorFrontend
from sanic.blueprints import Blueprint

bp = Blueprint('default_token_connect')


@bp.route('/fetch_token_detail')
@http_action(return_type='json', action_model=ConcActionModel)
async def fetch_token_detail(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    This is a controller action used by client to obtain
    data for a token. Token is identified by its position id
    (i.e. the one translated via attr.pos2str(...)).

    hint: to use PoS:
    try:
        ta = self.corp.get_attr('pos')
        pos = ta.pos2str(int(token_id))
    except manatee.AttrNotFound:
        pos = ''

    """
    token_id = int(req.args.get('token_id'))
    num_tokens = int(req.args.get('num_tokens'))
    context = (int(req.args.get('detail_left_ctx', 40)),
               int(req.args.get('detail_right_ctx', 40)))
    with plugins.runtime.TOKEN_CONNECT as td, plugins.runtime.CORPARCH as ca:
        corpus_info = await ca.get_corpus_info(amodel.plugin_ctx, amodel.corp.corpname)
        token, resp_data = await td.fetch_data(
            amodel.plugin_ctx,
            corpus_info.token_connect.providers,
            amodel.corp,
            [amodel.corp.corpname] + amodel.args.align,
            token_id, num_tokens, req.ui_lang, context)
    return dict(token=token, items=[item for item in resp_data])


def fetch_posattr(corp, attr, token_id, num_tokens):
    ans = []
    mattr = corp.get_attr(attr)
    for i in range(num_tokens):
        ans.append(mattr.pos2str(int(token_id) + i))
    return ' '.join(ans).strip()


def add_structattr_support(corp: KCorpus, attrs, token_id):
    """
    A decorator function which turns 'fetch_posattr' into
    a more general function which is able to load
    structural attributes too. The load is performed only
    once for all possible structural attributes.
    """

    data = {}
    refs = [x for x in attrs if '.' in x]
    refs_mapping = {}
    for n in refs:
        if n:
            lab = corp.get_conf(f'{n}.LABEL')
            refs_mapping[lab if lab else n] = n

    if len(refs) > 0:
        conc = manatee.Concordance(corp.unwrap(), '[#{}]'.format(int(token_id)), 1, -1)
        conc.sync()
        rs = conc.RS(True, 0, 0)
        kl = manatee.KWICLines(corp.unwrap(), rs, '-1', '1', 'word', '', '', ','.join(refs))
        if kl.nextline():
            refs_str = kl.get_refs()
            for kv in refs_str.split(','):
                if '=' in kv:
                    k, v = kv.split('=')
                    k = refs_mapping.get(k)
                    data[k] = v

    def decorator(fn):
        def wrapper(corp, attr, token_id, num_tokens):
            if '.' in attr:
                return data[attr]
            return fn(corp, attr, token_id, num_tokens)
        return wrapper
    return decorator


class DefaultTokenConnect(AbstractTokenConnect):

    def __init__(self, providers: Dict[str, Tuple[AbstractBackend, Optional[AbstractFrontend]]], corparch: AbstractCorporaArchive):
        self._corparch = corparch
        self._providers = providers

    def map_providers(self, providers: Sequence[Tuple[str, bool]]):
        return [self._providers[ident] + (is_kwic_view,) for ident, is_kwic_view in providers]

    async def fetch_data(
            self,
            plugin_ctx,
            providers,
            corpus,
            corpora,
            token_id,
            num_tokens,
            lang,
            context=None):
        ans = []
        # first, we preload all possible required (struct/pos) attributes all
        # the defined providers need
        all_attrs = set()
        for backend, _, _ in self.map_providers(providers):
            all_attrs.update(backend.get_required_attrs())

        @add_structattr_support(corpus, all_attrs, token_id)
        def fetch_any_attr(corp, att, t_id, num_t):
            return fetch_posattr(corp, att, t_id, num_t)

        for backend, frontend, is_kwic_view in self.map_providers(providers):
            try:
                args = {}
                for attr in backend.get_required_attrs():
                    v = fetch_any_attr(corpus, attr, token_id,
                                       num_tokens if backend.supports_multi_tokens() else 1)
                    if '.' in attr:
                        s, sa = attr.split('.')
                        if s not in args:
                            args[s] = {}
                        args[s][sa] = v
                    else:
                        args[attr] = v
                cookies = {}
                for cname in backend.get_required_cookies():
                    cookies[cname] = cookie = plugin_ctx.cookies.get(cname)
                    if cookie is None:
                        raise Exception(
                            f'Backend configuration problem: cookie {cname} not available')
                data, status = await backend.fetch(
                    plugin_ctx, corpora, corpus, token_id, num_tokens, args, lang, plugin_ctx.user_is_anonymous,
                    context, cookies)
                if frontend is not None:
                    ans.append(frontend.export_data(data, status, lang, is_kwic_view).to_dict())
                else:
                    ans.append(data)
            except TypeError as ex:
                logging.getLogger(__name__).error('TokenConnect backend error: {0}'.format(ex))
                err_frontend = ErrorFrontend(dict(heading=frontend.headings))
                ans.append(err_frontend.export_data(
                    dict(error='{0}'.format(ex)), False, lang, is_kwic_view).to_dict())

        word = fetch_posattr(corpus, 'word', token_id, num_tokens)
        return word, ans

    async def is_enabled_for(self, plugin_ctx, corpora):
        if len(corpora) == 0:
            return False
        corpus_info = await self._corparch.get_corpus_info(plugin_ctx, corpora[0])
        return len(corpus_info.token_connect.providers) > 0

    async def export(self, plugin_ctx):
        corpus_info = await self._corparch.get_corpus_info(
            plugin_ctx, plugin_ctx.current_corpus.corpname)
        return dict(providers=[dict(ident=k, is_kwic_view=bool(v)) for k, v in corpus_info.token_connect.providers])

    @staticmethod
    def export_actions():
        return bp


@plugins.inject(plugins.runtime.CORPARCH, plugins.runtime.DB)
def create_instance(settings, corparch: AbstractCorporaArchive, db: KeyValueStorage):
    providers = setup_providers(
        settings.get('plugins', 'token_connect'),
        db, be_type=AbstractBackend, fe_type=AbstractFrontend)
    tok_det = DefaultTokenConnect(providers, corparch)
    return tok_det
