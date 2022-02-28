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

from plugin_types.query_suggest import AbstractBackend
from typing import List
from plugins.common.http import HTTPClient
import json
import manatee


class WordSimilarityBackend(AbstractBackend):
    """
    WordSimilarityBackend works along with CNC's word-sim-service which is
    a wrapper around Wang2Vec model.
    """

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        self._client = HTTPClient(server=conf['server'], port=conf['port'], ssl=conf['ssl'])

    def find_suggestion(self, user_id, ui_lang, maincorp, corpora, subcorpus, value, value_type, value_subformat,
                        query_type, p_attr, struct, s_attr):
        if p_attr == 'lemma':
            path = '/'.join([self._conf['path'], 'corpora', self._conf['corpus'], 'similarWords',
                             self._conf['model'], self._client.enc_val(value)])
            ans, is_found = self._client.request('GET', path, {}, None)
            if is_found:
                return [v['word'] for v in json.loads(ans)]
        return []
