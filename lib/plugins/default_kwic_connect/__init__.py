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

from plugins.abstract.kwic_connect import AbstractKwicConnect
from plugins.default_token_connect import setup_providers, ProviderWrapper
import plugins
import logging
from actions import concordance
from controller import exposed
from multiprocessing.pool import ThreadPool


def merge_results(curr, new, word):
    for item in new:
        item['kwic'] = word
    if len(curr) == 0:
        return [[x] for x in new]
    else:
        for i in range(len(curr)):
            curr[i] += [new[i]]
        return curr


def handle_word_req(args):
    word, corpora, ui_lang, providers = args
    with plugins.runtime.KWIC_CONNECT as kc:
        return word, kc.fetch_data(providers, corpora, ui_lang, word)


@exposed(return_type='json')
def fetch_external_kwic_info(self, request):
    words = request.args.getlist('w')
    with plugins.runtime.CORPARCH as ca:
        corpus_info = ca.get_corpus_info(self.ui_lang, self.corp.corpname)
        args = [(w, [self.corp.corpname] + self.args.align, self.ui_lang, corpus_info.kwic_connect.providers)
                for w in words]
        results = ThreadPool(len(words)).imap_unordered(handle_word_req, args)
        provider_all = []
        for word, res in results:
            provider_all = merge_results(provider_all, res, word)
        ans = []
        for provider in provider_all:
            ans.append(dict(
                renderer=provider[0]['renderer'],
                heading=provider[0]['heading'],
                note=provider[0]['note'],
                data=[dict(kwic=item['kwic'], status=item['status'], contents=item['contents']) for item in provider]))
    return dict(data=ans)


@exposed(return_type='json')
def get_corpus_kc_providers(self, _):
    with plugins.runtime.CORPARCH as ca, plugins.runtime.KWIC_CONNECT as kc:
        corpus_info = ca.get_corpus_info(self.ui_lang, self.corp.corpname)
        mp = kc.map_providers(corpus_info.kwic_connect.providers)
        return dict(corpname=self.corp.corpname,
                    providers=[dict(id=b.provider_id, label=f.get_heading(self.ui_lang)) for b, f in mp])


class DefaultKwicConnect(ProviderWrapper, AbstractKwicConnect):

    def __init__(self, providers, corparch, max_kwic_words, load_chunk_size):
        super(DefaultKwicConnect, self).__init__(providers)
        self._corparch = corparch
        self._max_kwic_words = max_kwic_words
        self._load_chunk_size = load_chunk_size

    def is_enabled_for(self, plugin_api, corpname):
        corpus_info = self._corparch.get_corpus_info(plugin_api.user_lang, corpname)
        tst = [p.enabled_for_corpora([corpname] + plugin_api.aligned_corpora)
               for p, _ in self.map_providers(corpus_info.kwic_connect.providers)]
        return len(tst) > 0 and True in tst

    def export(self, plugin_api):
        return dict(max_kwic_words=self._max_kwic_words, load_chunk_size=self._load_chunk_size)

    def export_actions(self):
        return {concordance.Actions: [fetch_external_kwic_info, get_corpus_kc_providers]}

    def fetch_data(self, provider_ids, corpora, lang, lemma):
        ans = []
        for backend, frontend in self.map_providers(provider_ids):
            try:
                if backend.enabled_for_corpora(corpora):
                    data, status = backend.fetch_data(corpora, lang, dict(lemma=lemma))
                    ans.append(frontend.export_data(data, status, lang).to_dict())
            except EnvironmentError as ex:
                logging.getLogger(__name__).error(u'KwicConnect backend error: {0}'.format(ex))
                raise ex
        return ans


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch):
    providers, cache_path = setup_providers(settings.get('plugins', 'token_connect'))
    plg_conf = settings.get('plugins', 'kwic_connect')
    kwic_conn = DefaultKwicConnect(providers, corparch, max_kwic_words=plg_conf['default:max_kwic_words'],
                                   load_chunk_size=plg_conf['default:load_chunk_size'])
    if cache_path:
        kwic_conn.set_cache_path(cache_path)
    return kwic_conn
