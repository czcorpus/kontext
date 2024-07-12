# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

import ujson as json
from plugin_types.query_suggest import AbstractBackend
from plugins.common.http import HTTPRequester
from .couch import CouchDBBackend
from plugins.default_query_suggest.formats.cnc_sublemma import (
    CncSublemmaSuggestion, SuggestionLemmaData)


class WordSimilarityBackend(AbstractBackend):
    """
    WordSimilarityBackend works along with CNC's word-sim-service which is
    a wrapper around Wang2Vec model.
    """

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        port_str = '' if self._conf.get('port', 80) else ':{}'.format(self._conf.get('port'))
        if self._conf['ssl']:
            self._requester = HTTPRequester('https://{}{}'.format(self._conf['server'], port_str))
        else:
            self._requester = HTTPRequester('http://{}{}'.format(self._conf['server'], port_str))

    async def find_suggestion(
            self, plugin_ctx, user_id, ui_lang, maincorp, corpora, subcorpus, value, value_type, value_subformat,
            query_type, p_attr, struct, s_attr):
        if p_attr == 'lemma':
            path = '/'.join([self._conf['path'], 'corpora', self._conf['corpus'], 'similarWords',
                             self._conf['model'], self._requester.enc_val(value)])
            ans, is_found = await self._requester.request(
                plugin_ctx.http_client,'GET', path, {}, None)
            if is_found:
                return [v['word'] for v in json.loads(ans)]
        return []


class SublemmaSrchBackend(CouchDBBackend):

    async def find_suggestion(
            self, plugin_ctx, ui_lang, user_id, maincorp, corpora, subcorpus, value, value_type, value_subformat,
            query_type, p_attr, struct, s_attr) -> CncSublemmaSuggestion:
        if query_type == 'simple':
            return await super().find_suggestion(
                plugin_ctx, ui_lang, user_id, maincorp, corpora, subcorpus, value, value_type, value_subformat,
                query_type, p_attr, struct, s_attr)
        return CncSublemmaSuggestion(
            attrs=(self._conf['lemma'], self._conf['sublemma'], self._conf.get('word')),
            value=value.lower() if value else None,
            data={})