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

"""
This backend provides communication with CouchDB based unigram database (compatible with the one used by WaG, only
it needs also "sublemmas" attached).

A respective CouchDB database must define the following view:

function (doc) {
  emit(doc.lemma, 'lemma');
  for (var i = 0; i < doc.forms.length; i++) {
    emit(doc.forms[i].word.toLowerCase(), 'word');
  };
  for (var i = 0; i < doc.sublemmas.length; i++) {
    emit(doc.sublemmas[i].value.toLowerCase(), 'sublemma');
  };
}
"""


from plugins.abstract.query_suggest import AbstractBackend
import couchdb
from plugins.default_query_suggest.formats.cnc_sublemma import CncSublemmaSuggestion, SuggestionLemmaData
from typing import Dict


def norm_str(s):
    return f'"{s.lower()}"'


class CouchDBBackend(AbstractBackend[Dict[str, CncSublemmaSuggestion]]):

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        self._db = None

    @property
    def db(self):
        if self._db is None:
            client = couchdb.Server(self._conf['server'])
            self._db = client[self._conf['database']]
        return self._db

    def find_suggestion(
            self, ui_lang, user_id, maincorp, corpora, subcorpus, value, value_type, value_subformat,
            query_type, p_attr, struct, s_attr) -> CncSublemmaSuggestion:
        tmp = self.db.view(self._conf['view'], start_key=norm_str(value), end_key=norm_str(value), include_docs=True)
        merged = {}
        for item in tmp:
            lemma = item['doc']['lemma']
            if lemma not in merged:
                merged[lemma] = ({}, set())
            for subl in item['doc']['sublemmas']:
                if subl['value'] not in merged[lemma][0]:
                    merged[lemma][0][subl['value']] = 0
                merged[lemma][0][subl['value']] += int(subl.get('count', 0))
            merged[lemma][1].add(item['value'])
        ans = CncSublemmaSuggestion(
            attrs=(self._conf['lemma'], self._conf['sublemma'], self._conf.get('word')),
            value=value.lower() if value else None,
            data={})
        for lemma, (sublemmas, found_in) in merged.items():
            ans.data[lemma] = SuggestionLemmaData(
                found_in=list(found_in),
                sublemmas=[s for s, _ in sorted(sublemmas.items(), key=lambda x: x[1], reverse=True)])
        return ans
