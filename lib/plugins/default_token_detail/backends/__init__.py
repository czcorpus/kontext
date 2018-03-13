# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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

import httplib
import sqlite3
from plugins.default_token_detail.backends.cache import cached

from plugins.abstract.token_detail import AbstractBackend


class SQLite3Backend(AbstractBackend):
    def __init__(self, conf, ident):
        super(SQLite3Backend, self).__init__(ident)
        self._db = sqlite3.connect(conf['path'])
        self._query_tpl = conf['query']

    @cached
    def fetch_data(self, word, lemma, pos, corpora, lang):
        cur = self._db.cursor()
        cur.execute(self._query_tpl, (word, lemma, pos))
        ans = cur.fetchone()
        if ans:
            return ans[0], True
        else:
            return '', False


class HTTPBackend(AbstractBackend):
    def __init__(self, conf, ident):
        super(HTTPBackend, self).__init__(ident)
        self._conf = conf

    @staticmethod
    def _is_valid_response(response):
        return response and (200 <= response.status < 300 or 400 <= response.status < 500)

    @staticmethod
    def _is_found(response):
        return 200 <= response.status < 300

    @cached
    def fetch_data(self, word, lemma, pos, corpora, lang):
        if self._conf['ssl']:
            connection = httplib.HTTPSConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)
        else:
            connection = httplib.HTTPConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)
        try:
            args = dict(word=word, lemma=lemma, pos=pos, ui_lang=lang, corpus=corpora[0])
            connection.request('GET', self._conf['path'].encode('utf-8').format(**args))
            response = connection.getresponse()
            if self._is_valid_response(response):
                return response.read().decode('utf-8'), self._is_found(response)
            else:
                raise Exception('Failed to load the data - error {0}'.format(response.status))
        finally:
            connection.close()
