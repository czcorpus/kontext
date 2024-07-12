# Copyright (c) 2024 Tomas Machalek <tomas.machalek@gmail.com>
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
import plugins
from corplib import KCorpus

DEFAULT_LARGE_CORPUS_THRESHOLD = 500_000_000

class CQLizerBackend(AbstractBackend):

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        port_str = ':{}'.format(self._conf.get('port')) if self._conf.get('port') else ''
        if self._conf.get('ssl', False):
            self._requester = HTTPRequester('https://{}{}'.format(self._conf['server'], port_str))
        else:
            self._requester = HTTPRequester('http://{}{}'.format(self._conf['server'], port_str))

    def is_large_corpus(self, corp:KCorpus):
        return corp.size >= self._conf.get('largeCorpusThreshold', DEFAULT_LARGE_CORPUS_THRESHOLD)

    async def find_suggestion(
            self, plugin_ctx, ui_lang, user_id, maincorp, corpora, subcorpus, value, value_type, value_subformat,
            query_type, p_attr, struct, s_attr):
        if not self.is_large_corpus(maincorp):
            return None
        if query_type == 'simple' and value_subformat != 'regexp':
            return None
        if query_type == 'simple' and value_subformat == 'regexp':
            value = f'"{value}"'
        resp, is_found = await self._requester.request(
            plugin_ctx.http_client,
            'GET',
            '/analyze',
            dict(q=value)
        )
        if not is_found:
            return None
        data = json.loads(resp)
        if data['yes'] > data['no']:
            with plugins.runtime.INTEGRATION_DB as db:
                async with db.connection() as conn:
                    async with await conn.cursor() as cursor:
                        await cursor.execute(
                            'SELECT alt_corpus_name FROM kontext_alt_corpus WHERE corpus_name = %s',
                            (maincorp.corpname,))
                        row = await cursor.fetchone()
                        data['alt_corpus'] = None if row is None else row[0]
            return data
