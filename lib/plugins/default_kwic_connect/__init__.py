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


from plugins.abstract.kwic_connect import AbstractKwicConnect
from plugins.default_token_connect import setup_providers, ProviderWrapper
import plugins
import logging
from actions import concordance
from controller import exposed


def merge_results(curr, new, word):
    for item in new:
        item['kwic'] = word
    if len(curr) == 0:
        return [[x] for x in new]
    else:
        for i in range(len(curr)):
            curr[i] += [new[i]]
        return curr


@exposed(return_type='json')
def fetch_external_kwic_info(self, request):
    words = request.args.getlist('w')
    with plugins.runtime.KWIC_CONNECT as kc, plugins.runtime.CORPARCH as ca:
        corpus_info = ca.get_corpus_info(self.ui_lang, self.corp.corpname)
        provider_all = []
        for word in words:
            resp_data = kc.fetch_data(corpus_info.kwic_connect.providers,
                                      word, word, '', [self.corp.corpname] + self.args.align, self.ui_lang)
            provider_all = merge_results(provider_all, resp_data, word)
        ans = []
        for provider in provider_all:
            ans.append(dict(
                renderer=provider[0]['renderer'],
                heading=provider[0]['heading'],
                note=provider[0]['note'],
                data=[dict(kwic=item['kwic'], status=item['status'], contents=item['contents']) for item in provider]))
    return dict(data=ans)


class DefaultKwicConnect(ProviderWrapper, AbstractKwicConnect):

    def __init__(self, providers, corparch):
        super(DefaultKwicConnect, self).__init__(providers)
        self._corparch = corparch

    def is_enabled_for(self, plugin_api, corpname):
        corpus_info = self._corparch.get_corpus_info(plugin_api.user_lang, corpname)
        return len(corpus_info.kwic_connect.providers) > 0

    def export_actions(self):
        return {concordance.Actions: [fetch_external_kwic_info]}

    def fetch_data(self, provider_ids, word, lemma, pos, corpora, lang):
        ans = []
        for backend, frontend in self.map_providers(provider_ids):
            try:
                if backend.enabled_for_corpora(corpora):
                    data, status = backend.fetch_data(word, lemma, pos, corpora, lang)
                    ans.append(frontend.export_data(data, status, lang).to_dict())
            except Exception as ex:
                logging.getLogger(__name__).error(u'KwicConnect backend error: {0}'.format(ex))
                raise ex
        return ans


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch):
    providers, cache_path = setup_providers(settings.get('plugins', 'token_connect'))
    kwic_conn = DefaultKwicConnect(providers, corparch)
    if cache_path:
        kwic_conn.set_cache_path(cache_path)
    return kwic_conn
