# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
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

import logging
import urllib
from typing import Any, List, Tuple

import aiohttp
import ujson as json
from plugins.common.http import HTTPApiLogin, HTTPRequester, HTTPUnauthorized

import conclib
from action.plugin.ctx import AbstractCorpusPluginCtx
from .abstract import AbstractBackend

#
# Example provider conf:
# {
#     "lemmaAttr": "lemma",
#     "color": "rgba(255, 99, 71, 0.5)",
#     "server": "treq.korpus.cz",
#     "path": "/api/v1",
#     "ssl": true,
#     "port": 443,
#     "availGroups": {...},
#     "availTranslations": {...},
#     "apiLoginUrl": "https://korpus.cz/login",
#     "apiToken": "--SECRET-TOKEN--"
# }
#


class TreqV1Backend(AbstractBackend):

    DEFAULT_MAX_RESULT_LINES = 10

    DEFAULT_SID_COOKIE_NAME = 'cnc_toolbar_sid'

    AVAIL_GROUPS = None

    AVAIL_LANG_MAPPINGS = None

    ANONYMOUS_SESSION_ID = None

    def __init__(self, conf, ident, db, ttl):
        super(TreqV1Backend, self).__init__(conf, ident, db, ttl)
        self._conf = conf
        self.AVAIL_GROUPS = conf.get('availGroups', {})
        self.AVAIL_LANG_MAPPINGS = conf.get('availTranslations', {})

        port_str = '' if self._conf.get('port', 80) else ':{}'.format(self._conf.get('port'))
        if self._conf['ssl']:
            self._requester = HTTPRequester('https://{}{}'.format(self._conf['server'], port_str))
        else:
            self._requester = HTTPRequester('http://{}{}'.format(self._conf['server'], port_str))
        self._token_api_client = HTTPApiLogin(
            conf.get('apiLoginUrl'),
            conf.get('apiToken'),
            self.sid_cookie,
        )

    def required_attrs(self) -> List[str]:
        return [self._conf['lemmaAttr']]

    async def fetch(
            self,
            plugin_ctx,
            corpus_id,
            token_id,
            token_length,
            token_ranges,
            lang,
            is_anonymous,
            cookies,
    ) -> Tuple[Any, bool]:
        selected_token = {'link': []}
        tokens = {}
        clicked_word = None
        for corp_id, tok_range in token_ranges.items():
            corp = await plugin_ctx.corpus_factory.get_corpus(corp_id)
            data = conclib.get_detail_context(
                corp=corp, pos=tok_range[0], attrs=self.required_attrs(), structs='', hitlen=token_length,
                detail_left_ctx=0, detail_right_ctx=tok_range[1] - tok_range[0])
            tokens[corp_id] = data.get('content', [])
            if corp_id == corpus_id:
                for i, t in enumerate(tokens[corp_id]):
                    if tok_range[0] + i == token_id:
                        clicked_word = t['str']
                        break

        primary_lang = self._lang_from_corpname(corpus_id)
        translat_corpora = [x for x in token_ranges.keys() if x != corpus_id]
        if clicked_word:
            for translat_corp in translat_corpora:
                translat_lang = self._lang_from_corpname(translat_corp)
                if translat_corp and translat_lang:
                    data = await self._get_translations(
                        plugin_ctx, clicked_word, primary_lang, translat_lang, is_anonymous, cookies)
                    for tok_idx, token in enumerate(tokens[translat_corp]):
                        if any(token['str'] == line['righ'] for line in data['lines']):
                            selected_token['link'].append({
                                'corpusId': translat_corp,
                                'tokenId': token_ranges[translat_corp][0] + tok_idx,
                                'color': self._conf['colors'][0],
                                'altColors': self._conf['colors'][1:],
                                'comment': 'Treq translation',
                            })

            for tok_idx, token in enumerate(tokens[corpus_id]):
                if token['str'] == clicked_word:
                    selected_token['link'].append({
                        'corpusId': corpus_id,
                        'tokenId': token_ranges[corpus_id][0] + tok_idx,
                        'color': self._conf['colors'][0],
                        'altColors': self._conf['colors'][1:],
                        'comment': 'Clicked token (or equal to the clicked token)',
                    })
        if len(selected_token['link']) == 0:
            logging.getLogger(__name__).warning('no highlighted tokens - even the original token missing - correcting...')
            selected_token['link'].append({
                'corpusId': corpus_id,
                'tokenId': token_id,
                'color': self._conf['colors'][0],
                'altColors': self._conf['colors'][1:],
                'comment': 'Clicked token',
            })
        return [selected_token], True

    @property
    def sid_cookie(self):
        return self._conf.get('sidCookie', self.DEFAULT_SID_COOKIE_NAME)

    def get_required_cookies(self):
        return [self.sid_cookie]

    @staticmethod
    def _lang_from_corpname(corpname):
        return corpname.split('_')[-1]

    def _find_second_lang(self, corpora):
        """
        Find a first language+corpus with available translations
        for the primary language (= corpora[0]).
        """
        primary_lang = self._lang_from_corpname(corpora[0])
        translations = self.AVAIL_LANG_MAPPINGS.get(primary_lang, [])
        for cn in corpora[1:]:
            lang = self._lang_from_corpname(cn)
            if lang in translations:
                return cn, lang
        return None, None

    @staticmethod
    def mk_api_args(lang1, lang2, groups, lemma):
        multiw_flag = 'true' if ' ' in lemma else 'false'
        lemma_flag = 'false' if ' ' in lemma else 'true'
        return [('from', lang1), ('to', lang2), ('multiword', multiw_flag), ('regex', 'false'),
                ('lemma', lemma_flag), ('ci', 'true'), ('query', lemma),
                ('order', 'perc'), ('asc', 'false')] + [(f'pkgs[{i}]', group) for i, group in enumerate(groups)]

    def mk_api_path(self, args):
        args = ['{0}={1}'.format(k, urllib.parse.quote(v.encode('utf-8'))) for k, v in args]
        return self._conf['path'] + '?' + '&'.join(args)

    def find_lang_common_groups(self, lang1, lang2):
        g1 = set(self.AVAIL_GROUPS.get(lang1, []))
        g2 = set(self.AVAIL_GROUPS.get(lang2, []))
        return g1.intersection(g2)

    async def _make_request(self, client_session: aiohttp.ClientSession, path: str, session_id: str):
        headers = {'Cookie': f'{self.sid_cookie}={session_id}'}
        data, valid = await self._requester.request(client_session, 'GET', path, {}, headers=headers)
        return json.loads(data)

    async def _get_translations(
            self, plugin_ctx: AbstractCorpusPluginCtx, word: str, primary_lang: str, translat_lang: str,
            is_anonymous: bool, cookies):
        data = dict(sum=0, lines=[])
        common_groups = self.find_lang_common_groups(primary_lang, translat_lang)
        args = self.mk_api_args(
            lang1=self._requester.enc_val(primary_lang),
            lang2=self._requester.enc_val(translat_lang),
            groups=[self._requester.enc_val(s) for s in common_groups],
            lemma=word,
        )

        try:
            logging.getLogger(__name__).debug('Treq request args: {0}'.format(args))
            path = self.mk_api_path(args)
            if is_anonymous:
                try:
                    data = await self._make_request(plugin_ctx.http_client, path, self.ANONYMOUS_SESSION_ID)
                except HTTPUnauthorized:
                    self.ANONYMOUS_SESSION_ID = await self._token_api_client.login(plugin_ctx.http_client)
                    data = await self._make_request(plugin_ctx.http_client, path, self.ANONYMOUS_SESSION_ID)
            else:
                data = await self._make_request(plugin_ctx.http_client, path, cookies[self.sid_cookie])

            max_items = self._conf.get('maxResultItems', self.DEFAULT_MAX_RESULT_LINES)
            orig = data['lines'][:max_items]
            data['lines'] = []
            for item in orig:
                data['lines'].append(dict(
                    freq=item['freq'], perc=item['perc'], left=item['from'], righ=item['to']))
        except ValueError:
            logging.getLogger(__name__).error('Failed to parse response: {0}'.format(data))

        return data
