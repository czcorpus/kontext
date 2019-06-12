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
import urllib
import logging
import sqlite3
from plugins.default_token_connect.backends.cache import cached

from plugins.abstract.token_connect import AbstractBackend, BackendException


class SQLite3Backend(AbstractBackend):
    def __init__(self, conf, ident):
        super(SQLite3Backend, self).__init__(ident)
        self._db = sqlite3.connect(conf['path'])
        self._query_tpl = conf['query']

    @cached
    def fetch(self, corpora, token_id, num_tokens, query_args, lang):
        cur = self._db.cursor()
        cur.execute(self._query_tpl, (query_args['word'], query_args['lemma']))
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

    def create_connection(self):
        if self._conf['ssl']:
            return httplib.HTTPSConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)
        else:
            return httplib.HTTPConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)

    def process_response(self, connection):
        response = connection.getresponse()
        if self._is_valid_response(response):
            logging.getLogger(__name__).debug(
                u'HTTP Backend response status: {0}'.format(response.status))
            return response.read().decode('utf-8'), self._is_found(response)
        else:
            raise Exception('Failed to load the data - error {0}'.format(response.status))

    @staticmethod
    def enc_val(s):
        if type(s) is unicode:
            return urllib.quote(s.encode('utf-8'))
        return urllib.quote(s)

    def get_required_posattrs(self):
        return self._conf.get('posAttrs', [])

    @cached
    def fetch(self, corpora, token_id, num_tokens, query_args, lang):
        connection = self.create_connection()
        try:
            args = dict(
                ui_lang=self.enc_val(lang), corpus=self.enc_val(corpora[0]),
                corpus2=self.enc_val(corpora[1] if len(corpora) > 1 else ''),
                token_id=token_id, num_tokens=num_tokens,
                **dict((k, self.enc_val(v)) for k, v in query_args.items()))
            logging.getLogger(__name__).debug('HTTP Backend args: {0}'.format(args))

            try:
                query_string = self._conf['path'].format(**args).encode('utf-8', 'replace')
            except KeyError as ex:
                raise BackendException(u'Failed to build query - value {0} not found'.format(ex))

            connection.request('GET', query_string)
            return self.process_response(connection)
        finally:
            connection.close()
