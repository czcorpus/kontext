# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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
Default token_detail plug-in allows attaching external services (dictionaries, encyclopediae)
to concordance tokens. A special JSON file (see token-detail-providers.sample.json) defines
a set of providers where a provider always contains a backend, frontend and identifier.

* **backend** specifies an adapter used to access a data source (e.g. a REST service),
* **frontend** specifies an object used to export fetched data (server part) and render them (client part),
* **identifier** is referred in corplist.xml by individual corpora to attach one or more providers per corpus.


The JSON config file defines a template of an abstract path identifying a resource. It can be a URL path, SQL
or a filesystem path. Such a template can use the following values: word, lemma, tag, ui_lang, other_lang.

Required XML configuration:

element token_detail {
  element module { "default_token_detail" }
  element js_module { "defaultTokenDetail" }
  element providers_conf {
    attribute extension-by { "default" }
    { text } # a path to a JSON configuration file containing all available backends and frontends
  }
}
"""

import json
import importlib
import logging

import manatee
import plugins
from plugins.abstract.token_detail import AbstractTokenDetail
from actions import concordance
from controller import exposed


@exposed(return_type='json')
def fetch_token_detail(self, request):
    """
    This is a controller action used by client to obtain
    data for a token. Token is identified by its position id
    (i.e. the one translated via attr.pos2str(...)).
    """
    token_id = request.args['token_id']

    wa = self.corp.get_attr('word')
    word = wa.pos2str(int(token_id))

    try:
        la = self.corp.get_attr('lemma')
        lemma = la.pos2str(int(token_id))
    except manatee.AttrNotFound:
        lemma = ''

    try:
        ta = self.corp.get_attr('tag')
        tag = ta.pos2str(int(token_id))
    except manatee.AttrNotFound:
        tag = ''

    with plugins.runtime.TOKEN_DETAIL as td, plugins.runtime.CORPARCH as ca:
        corpus_info = ca.get_corpus_info(self.ui_lang, self.corp.corpname)
        resp_data = td.fetch_data(corpus_info.token_detail.providers,
                                  word, lemma, tag, self.args.align, self.ui_lang)
    return dict(items=[item for item in resp_data])


def _find_implementation(path):
    """
    Find a class identified by a string.
    This is used to decode frontends and backends
    defined in a respective JSON configuration file.

    arguments:
    path -- a full identifier of a class, e.g. plugins.default_token_detail.backends.Foo

    returns:
    a class matching the path
    """
    try:
        md, cl = path.rsplit('.', 1)
    except ValueError:
        raise ValueError(
            'Frontend path must contain both package and class name. Found: {0}'.format(path))
    the_module = importlib.import_module(md)
    return getattr(the_module, cl)


def init_provider(conf):
    """
    Create and return both backend and frontend.

    arguments:
    conf -- a dict representing plug-in detailed configuration

    returns:
    a 2-tuple (backend instance, frontend instance)
    """
    backend_class = _find_implementation(conf['backend'])
    frontend_class = _find_implementation(conf['frontend'])
    return backend_class(conf['conf']), frontend_class(conf)


class DefaultTokenDetail(AbstractTokenDetail):

    def __init__(self, providers, corparch):
        self._providers = providers
        self._corparch = corparch

    def fetch_data(self, provider_ids, word, lemma, tag, aligned_corpora, lang):
        ans = []
        for backend, frontend in self._map_providers(provider_ids):
            try:
                data, status = backend.fetch_data(word, lemma, tag, aligned_corpora, lang)
                ans.append(frontend.export_data(data, status, lang).to_dict())
            except Exception as ex:
                logging.getLogger(__name__).error('TokenDetail backend error: {0}'.format(ex))
        return ans

    def _map_providers(self, provider_ids):
        return [self._providers[ident] for ident in provider_ids]

    def is_enabled_for(self, plugin_api, corpname):
        corpus_info = self._corparch.get_corpus_info(plugin_api.user_lang, corpname)
        return len(corpus_info.token_detail.providers) > 0

    def export_actions(self):
        return {concordance.Actions: [fetch_token_detail]}


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch):
    conf = settings.get('plugins', 'token_detail')
    with open(conf['default:providers_conf'], 'rb') as fr:
        providers_conf = json.load(fr)
    return DefaultTokenDetail(dict((b['ident'], init_provider(b)) for b in providers_conf), corparch)
