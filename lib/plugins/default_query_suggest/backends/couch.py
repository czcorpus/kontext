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
  emit(doc.lemma, 1);
  for (var i = 0; i < doc.forms.length; i++) {
    emit(doc.forms[i].word.toLowerCase(), 1);
  };
  for (var i = 0; i < doc.sublemmas.length; i++) {
    emit(doc.sublemmas[i].value.toLowerCase(), 1);
  };
}
"""


from plugins.abstract.query_suggest import AbstractBackend
import couchdb


def norm_str(s):
    return f'"{s.lower()}"'


class CouchDBBackend(AbstractBackend):

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
            query_type, p_attr, struct, s_attr):
        ans = self.db.view(self._conf['view'], start_key=norm_str(value), end_key=norm_str(value), include_docs=True)
        merged = {}
        for item in ans:
            merged[item['doc']['_id']] = item['doc']
        data = {}
        for k, v in merged.items():
            data[v['lemma']] = [s['value'] for s in v['sublemmas']]
        return dict(
            attrs=(self._conf['attr1'], self._conf['attr2']),
            data=data)
