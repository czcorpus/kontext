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


The JSON config file defines a template of an abstract path identifying a resource. It can be a URL path, SQL
or a filesystem path. Such a template can use the following values: word, lemma, pos, ui_lang, other_lang.

Required XML configuration: please see config.rng
"""

import json
import logging
import os

import manatee
import plugins
from plugins.abstract.token_connect import AbstractTokenConnect, find_implementation
from l10n import import_string
from actions import concordance
from controller import exposed
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
    token_id = request.args['token_id']
    num_tokens = int(request.args['num_tokens'])
    with plugins.runtime.TOKEN_CONNECT as td, plugins.runtime.CORPARCH as ca:
        corpus_info = ca.get_corpus_info(self.ui_lang, self.corp.corpname)
        token, resp_data = td.fetch_data(corpus_info.token_connect.providers, self.corp,
                                         [self.corp.corpname] + self.args.align, token_id, num_tokens, self.ui_lang)
    return dict(token=token, items=[item for item in resp_data])


class DefaultTokenConnect(AbstractTokenConnect):

    def __init__(self, providers, corparch):
        self._corparch = corparch
        self._providers = providers
        self._cache_path = None

    def map_providers(self, provider_ids):
        return [self._providers[ident] for ident in provider_ids]

    def set_cache_path(self, path):
        self._cache_path = path
        for backend, frontend in self.map_providers(self._providers):
            backend.set_cache_path(path)

    @property
    def cache_path(self):
        return self._cache_path

    @staticmethod
    def fetch_attr(corp, attr, token_id, num_tokens):
        mattr = corp.get_attr(attr)
        ans = []
        for i in range(num_tokens):
            ans.append(import_string(mattr.pos2str(int(token_id) + i), corp.get_conf('ENCODING')))
        return ' '.join(ans)

    def fetch_data(self, provider_ids, maincorp_obj, corpora, token_id, num_tokens, lang):
        ans = []
        for backend, frontend in self.map_providers(provider_ids):
            try:
                args = dict((attr, self.fetch_attr(maincorp_obj, attr, token_id, num_tokens))
                            for attr in backend.get_required_posattrs())
                data, status = backend.fetch(corpora, token_id, num_tokens, args, lang)
                ans.append(frontend.export_data(data, status, lang).to_dict())
            except Exception as ex:
                logging.getLogger(__name__).error('TokenConnect backend error: {0}'.format(ex))
                err_frontend = ErrorFrontend(dict(heading=frontend.headings))
                ans.append(err_frontend.export_data(
                    dict(error=u'{0}'.format(ex)), False, lang).to_dict())

        word = self.fetch_attr(maincorp_obj, 'word', token_id, num_tokens)
        return word, ans

    def is_enabled_for(self, plugin_api, corpname):
        corpus_info = self._corparch.get_corpus_info(plugin_api.user_lang, corpname)
        return len(corpus_info.token_connect.providers) > 0

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

    with open(plg_conf['default:providers_conf'], 'rb') as fr:
        providers_conf = json.load(fr)
    cache_path = plg_conf.get('default:cache_db_path')
    providers = dict((b['ident'], init_provider(b, b['ident'])) for b in providers_conf)

    if cache_path and not os.path.isfile(cache_path):
        cache_manager = CacheMan(cache_path)
        cache_manager.prepare_cache()
    return providers, cache_path


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch):
    providers, cache_path = setup_providers(settings.get('plugins', 'token_connect'))
    tok_det = DefaultTokenConnect(providers, corparch)
    if cache_path:
        tok_det.set_cache_path(cache_path)
    return tok_det
