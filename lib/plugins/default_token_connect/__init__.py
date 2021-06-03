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

import json
import logging
import manatee

import plugins
from plugins.abstract.token_connect import AbstractTokenConnect, find_implementation
from actions import concordance
from controller import exposed
from corplib.corpus import KCorpus
from plugins.default_token_connect.cache_man import CacheMan
from plugins.default_token_connect.frontends import ErrorFrontend


@exposed(return_type='json')
def fetch_token_detail(self, request):
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
    token_id = int(request.args['token_id'])
    num_tokens = int(request.args['num_tokens'])
    context = (int(request.args.get('detail_left_ctx', 40)),
               int(request.args.get('detail_right_ctx', 40)))
    with plugins.runtime.TOKEN_CONNECT as td, plugins.runtime.CORPARCH as ca:
        corpus_info = ca.get_corpus_info(self._plugin_ctx, self.corp.corpname)
        token, resp_data = td.fetch_data(corpus_info.token_connect.providers, self.corp,
                                         [self.corp.corpname] +
                                         self.args.align, token_id, num_tokens, self.ui_lang,
                                         context)
    return dict(token=token, items=[item for item in resp_data])


def fetch_posattr(corp, attr, token_id, num_tokens):
    ans = []
    mattr = corp.get_attr(attr)
    for i in range(num_tokens):
        ans.append(mattr.pos2str(int(token_id) + i))
    return ' '.join(ans)


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

    def __init__(self, providers, corparch):
        self._corparch = corparch
        self._providers = providers
        self._cache_path = None

    def map_providers(self, providers):
        return [self._providers[ident] + (is_kwic_view,) for ident, is_kwic_view in providers]

    def set_cache_path(self, path):
        self._cache_path = path
        for backend, frontend in list(self._providers.values()):
            backend.set_cache_path(path)

    @property
    def cache_path(self):
        return self._cache_path

    def fetch_data(self, providers, corpus, corpora, token_id, num_tokens, lang, context=None):
        ans = []
        # first, we pre-load all possible required (struct/pos) attributes all
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
                    v = fetch_any_attr(corpus, attr, token_id, num_tokens)
                    if '.' in attr:
                        s, sa = attr.split('.')
                        if s not in args:
                            args[s] = {}
                        args[s][sa] = v
                    else:
                        args[attr] = v
                data, status = backend.fetch(
                    corpora, corpus, token_id, num_tokens, args, lang, context)
                ans.append(frontend.export_data(data, status, lang, is_kwic_view).to_dict())
            except TypeError as ex:
                logging.getLogger(__name__).error('TokenConnect backend error: {0}'.format(ex))
                err_frontend = ErrorFrontend(dict(heading=frontend.headings))
                ans.append(err_frontend.export_data(
                    dict(error='{0}'.format(ex)), False, lang, is_kwic_view).to_dict())

        word = fetch_posattr(corpus, 'word', token_id, num_tokens)
        return word, ans

    def is_enabled_for(self, plugin_ctx, corpname):
        corpus_info = self._corparch.get_corpus_info(plugin_ctx, corpname)
        return len(corpus_info.token_connect.providers) > 0

    def export(self, plugin_ctx):
        corpus_info = self._corparch.get_corpus_info(
            plugin_ctx, plugin_ctx.current_corpus.corpname)
        return dict(providers=[dict(ident=k, is_kwic_view=bool(v)) for k, v in corpus_info.token_connect.providers])

    def export_actions(self):
        return {concordance.Actions: [fetch_token_detail]}

    def export_tasks(self):
        """
        Export tasks for Celery worker(s)
        """
        def clean_cache(cache_size):
            CacheMan(self.cache_path).connect().clear_extra_rows(cache_size)
        return clean_cache,


def init_provider(conf, ident):
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


def setup_providers(plg_conf):
    with open(plg_conf['providers_conf'], 'rb') as fr:
        providers_conf = json.load(fr)
    cache_path = plg_conf.get('cache_db_path')
    providers = dict((b['ident'], init_provider(b, b['ident'])) for b in providers_conf)
    if cache_path:
        cache_manager = CacheMan(cache_path)
        cache_manager.test_cache()
    return providers, cache_path


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch):
    providers, cache_path = setup_providers(settings.get('plugins', 'token_connect'))
    tok_det = DefaultTokenConnect(providers, corparch)
    if cache_path:
        tok_det.set_cache_path(cache_path)
    return tok_det
