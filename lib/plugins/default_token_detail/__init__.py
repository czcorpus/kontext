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


import json
import importlib
import logging

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
    token_data = wa.pos2str(int(token_id))
    with plugins.runtime.TOKEN_DETAIL as td, plugins.runtime.CORPARCH as ca:
        corpus_info = ca.get_corpus_info(self.ui_lang, self.corp.corpname)
        resp_data = td.fetch_data(corpus_info.token_detail.providers,
                                  token_data, None, None, self.ui_lang)
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

    def __init__(self, providers):
        self._providers = providers

    def fetch_data(self, provider_ids, word, lemma, pos, lang):
        ans = []
        for backend, frontend in self._map_providers(provider_ids):
            try:
                data, status = backend.fetch_data(word, lemma, pos, lang)
                ans.append(frontend.export_data(data, status, lang).to_dict())
            except Exception as ex:
                logging.getLogger(__name__).error('TokenDetail backend error: {0}'.format(ex))
        return ans

    def _map_providers(self, provider_ids):
        return [self._providers[ident] for ident in provider_ids]

    def export_actions(self):
        return {concordance.Actions: [fetch_token_detail]}


def create_instance(settings):
    conf = settings.get('plugins', 'token_detail')
    with open(conf['backends'], 'rb') as fr:
        providers_conf = json.load(fr)
    return DefaultTokenDetail(dict((b['ident'], init_provider(b)) for b in providers_conf))
