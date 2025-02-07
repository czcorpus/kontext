# Copyright (c) 2025 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2025 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
This backend provides communication with CNC's own Frodo metadata and dictionary database.
"""


from typing import Dict

import ujson as json
from aiohttp import ClientSession
import urllib.parse

from plugin_types.query_suggest import AbstractBackend
from plugins.common.http import HTTPRequester
from plugins.default_query_suggest.formats.cnc_sublemma import (
    CncSublemmaSuggestion, SuggestionLemmaData)


def norm_str(s):
    return json.dumps(str(s).lower())


class FrodoBackend(AbstractBackend[Dict[str, CncSublemmaSuggestion]]):

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        self._requester = HTTPRequester(self._conf['server'])

    async def _make_request(self, client_session: ClientSession, corpname: str, phrase: str):
        headers = {}
        path = f"/dictionary/{urllib.parse.quote(corpname, safe='')}/querySuggestions/{urllib.parse.quote(phrase, safe='')}"
        data, valid = await self._requester.request(client_session, 'GET', path, {}, headers=headers)
        return json.loads(data)

    async def find_suggestion(
            self, plugin_ctx, ui_lang, user_id, maincorp, corpora, subcorpus, value, value_type, value_subformat,
            query_type, p_attr, struct, s_attr) -> CncSublemmaSuggestion:
        tmp = await self._make_request(plugin_ctx.http_client, corpora[0], value)
        merged = {}
        data = tmp['matches']
        for item in data:
            lemma = item['lemma']
            if lemma not in merged:
                merged[lemma] = ({}, set())
            for subl in item['sublemmas']:
                if subl['value'] not in merged[lemma][0]:
                    merged[lemma][0][subl['value']] = 0
                merged[lemma][0][subl['value']] += int(subl.get('count', 0))
            merged[lemma][1].add(lemma) # item['value']) TODO
        ans = CncSublemmaSuggestion(
            attrs=(self._conf['lemma'], self._conf['sublemma'], self._conf.get('word')),
            value=value.lower() if value else None,
            data={})
        for lemma, (sublemmas, found_in) in merged.items():
            ans.data[lemma] = SuggestionLemmaData(
                found_in=list(found_in),
                sublemmas=[s for s, _ in sorted(sublemmas.items(), key=lambda x: x[1], reverse=True)])
        return ans
