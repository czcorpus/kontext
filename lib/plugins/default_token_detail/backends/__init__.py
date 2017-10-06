# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

from plugins.abstract.token_detail import AbstractBackend


class SQLite3Backend(AbstractBackend):

    def __init__(self, conf):
        self._db = sqlite3.connect(conf['path'])
        self._query_tpl = conf['query']

    def fetch_data(self, word, lemma, pos, lang):
        cur = self._db.cursor()
        cur.execute(self._query_tpl, (word, lemma, pos))
        ans = cur.fetchone()
        return ans[0] if ans else None


class HTTPBackend(AbstractBackend):

    def __init__(self, conf):
        self._conf = conf

    def fetch_data(self, word, lemma, pos, lang):
        if self._conf['ssl']:
            connection = httplib.HTTPSConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)
        else:
            connection = httplib.HTTPConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)
        try:
            connection.request('GET', self._conf['path'].encode('utf-8').format(word))
            response = connection.getresponse()
            if response and (response.status == 200 or 400 <= response.status < 500):
                return response.read().decode('utf-8'), response.status
            else:
                raise Exception('Failed to load the data - error {0}'.format(response.status))
        finally:
            connection.close()
