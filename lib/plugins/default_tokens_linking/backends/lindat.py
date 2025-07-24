# Copyright (c) 2024 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2024 Martin Zimandl <martin.zimandl@gmail.com>
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
import posixpath
from hashlib import md5
from typing import Any, List, Tuple

import aiohttp
import conclib
import ujson as json
from action.plugin.ctx import AbstractCorpusPluginCtx
from plugin_types.general_storage import KeyValueStorage
from plugins.common.http import HTTPRequester

from .abstract import AbstractBackend

#
# Example provider conf:
# {
#     "tokenAttr": "word",
#     "color": "rgba(255, 99, 71, 0.5)",
#     "server": "treq.korpus.cz",
#     "path": "/api/v1",
#     "ssl": true,
#     "port": 443,
#     "supportedLangs": [...]
# }
#


class InvalidLanguagePairException(Exception):
    pass


class AwesomeAlignerBackend(AbstractBackend):

    def __init__(self, conf, ident, db, ttl):
        super(AwesomeAlignerBackend, self).__init__(conf, ident, db, ttl)
        self._conf = conf
        port_str = '' if self._conf.get('port', 80) else ':{}'.format(self._conf.get('port'))
        if self._conf['ssl']:
            self._requester = HTTPRequester('https://{}{}'.format(self._conf['server'], port_str))
        else:
            self._requester = HTTPRequester('http://{}{}'.format(self._conf['server'], port_str))

    def required_attrs(self) -> List[str]:
        return [self._conf['tokenAttr']]

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
        clicked_word_idx = None
        for corp_id, tok_range in token_ranges.items():
            corp = await plugin_ctx.corpus_factory.get_corpus(corp_id)
            data = conclib.get_detail_context(
                corp=corp, pos=tok_range[0], attrs=self.required_attrs(), structs='', hitlen=token_length,
                detail_left_ctx=0, detail_right_ctx=tok_range[1] - tok_range[0])
            tokens[corp_id] = data.get('content', [])
            if corp_id == corpus_id:
                for i, t in enumerate(tokens[corp_id]):
                    if tok_range[0] + i == token_id:
                        clicked_word_idx = i
                        break

        primary_lang = self._lang_from_corpname(corpus_id)
        translat_corpora = [x for x in token_ranges.keys() if x != corpus_id]
        if clicked_word_idx is not None:
            for translat_corp in translat_corpora:
                translat_lang = self._lang_from_corpname(translat_corp)
                if translat_corp and translat_lang:
                    data = await self._get_translations(
                        plugin_ctx,
                        [t['str'] for t in tokens[corpus_id]],
                        [t['str'] for t in tokens[translat_corp]],
                        primary_lang,
                        translat_lang,
                    )
                    for src, trg in data['alignment']:
                        if src == clicked_word_idx:
                            selected_token['link'].append({
                                'corpusId': translat_corp,
                                'tokenId': token_ranges[translat_corp][0] + trg,
                                'color': self._conf['colors'][0],
                                'altColors': self._conf['colors'][1:],
                                'comment': 'Lindat Awesome Aligner link',
                            })

                selected_token['link'].append({
                    'corpusId': corpus_id,
                    'tokenId': token_ranges[corpus_id][0] + clicked_word_idx,
                    'color': self._conf['colors'][0],
                    'altColors': self._conf['colors'][1:],
                    'comment': 'Clicked token (or equal to the clicked token)',
                })

        if len(selected_token['link']) == 0:
            logging.getLogger(__name__).warning(
                'no highlighted tokens - even the original token missing - correcting...')
            selected_token['link'].append({
                'corpusId': corpus_id,
                'tokenId': token_id,
                'color': self._conf['colors'][0],
                'altColors': self._conf['colors'][1:],
                'comment': 'Clicked token',
            })
        return [selected_token], True

    @staticmethod
    def _lang_from_corpname(corpname):
        return corpname.split('_')[-1]

    def mk_api_path(self, lang1, lang2):
        return posixpath.join(self._conf['path'], f'{lang1}-{lang2}')

    def is_align_available(self, lang1: str, lang2: str) -> bool:
        return lang1 in self.AVAIL_LANG_MAPPINGS.get(lang2, []) or lang2 in self.AVAIL_LANG_MAPPINGS.get(lang1, [])

    async def _make_request(self, client_session: aiohttp.ClientSession, path: str, src_tokens: List[str], trg_tokens: List[str]) -> Any:
        cache_db: KeyValueStorage = self.get_cache_db()
        cache_key = f'awesome_aligner_cache:{md5(f"{src_tokens}{trg_tokens}{path}".encode()).hexdigest()}'
        result = await cache_db.get(cache_key)

        if result is None:
            data, valid = await self._requester.json_request(
                client_session, 'POST', path,
                args={},
                data={'src_tokens': src_tokens, 'trg_tokens': trg_tokens},
            )
            if valid:
                result = json.loads(data)
                await cache_db.set(cache_key, result)

            elif data == "Invalid language pair":
                raise InvalidLanguagePairException

            else:
                raise Exception(data)

        await cache_db.set_ttl(cache_key, self.cache_ttl)
        return result

    async def _get_translations(self, plugin_ctx: AbstractCorpusPluginCtx, src_tokens: List[str], trg_tokens: List[str], primary_lang: str, translat_lang: str):
        try:
            return await self._make_request(plugin_ctx.http_client, self.mk_api_path(primary_lang, translat_lang), src_tokens, trg_tokens)
        except InvalidLanguagePairException:
            logging.getLogger(__name__).warning(
                "Invalid language pair `%s-%s` encountered, using `en-en`", primary_lang, translat_lang)
            return await self._make_request(plugin_ctx.http_client, self.mk_api_path("en", "en"), src_tokens, trg_tokens)
