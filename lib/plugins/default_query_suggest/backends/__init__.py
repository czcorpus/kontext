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

from plugins.abstract.query_suggest import AbstractBackend, BackendException
import http
import logging
import urllib
from typing import List


class HTTPBackend(AbstractBackend):
    """
    TODO
    """

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
            return http.client.HTTPSConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)
        else:
            return http.client.HTTPConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)

    def process_response(self, connection):
        response = connection.getresponse()
        if self._is_valid_response(response):
            logging.getLogger(__name__).debug(
                'HTTP Backend response status: {0}'.format(response.status))
            return response.read().decode('utf-8'), self._is_found(response)
        else:
            raise Exception('Failed to load the data - error {0}'.format(response.status))

    @staticmethod
    def enc_val(s):
        if type(s) is str:
            return urllib.parse.quote(s.encode('utf-8'))
        return urllib.parse.quote(s)

    def get_required_attrs(self):
        if 'posAttrs' in self._conf:
            logging.getLogger(__name__).warning(
                'You are using a deprecated "conf.posAttr" value; please use "conf.attrs" instead.')
            return self._conf.get('posAttrs', [])
        else:
            return self._conf.get('attrs', [])

    def find_suggestion(self, ui_lang: str, corpora: List[str], subcorpus: str, query: str, p_attr: str, struct: str,
                        s_attr: str):
        connection = self.create_connection()
        try:
            args = dict(
                ui_lang=self.enc_val(ui_lang), corpora=[self.enc_val(c) for c in corpora])
            logging.getLogger(__name__).debug('HTTP Backend args: {0}'.format(args))

            try:
                query_string = self._conf['path'].format(**args)
            except KeyError as ex:
                raise BackendException('Failed to build query - value {0} not found'.format(ex))

            connection.request('GET', query_string)
            return self.process_response(connection)
        finally:
            connection.close()
