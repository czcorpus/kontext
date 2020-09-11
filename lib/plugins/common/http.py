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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import http.client
import logging
import urllib.parse
from typing import Dict, Any, List, Union, Tuple


class HTTPClientException(Exception):
    pass


class HTTPClient:

    def __init__(self, server: str, port: int = 80, ssl: bool = False):
        self._server = server
        self._port = port
        self._ssl = ssl

    @staticmethod
    def _is_valid_response(response):
        return response and (200 <= response.status < 300 or 400 <= response.status < 500)

    @staticmethod
    def _is_found(response):
        return 200 <= response.status < 300

    def create_connection(self):
        if self._ssl:
            return http.client.HTTPSConnection(
                self._server, port=self._port, timeout=15)
        else:
            return http.client.HTTPConnection(
                self._server, port=self._port, timeout=15)

    def process_response(self, connection):
        response = connection.getresponse()
        if self._is_valid_response(response):
            logging.getLogger(__name__).debug(
                'HTTP client response status: {0}'.format(response.status))
            return response.read().decode('utf-8'), self._is_found(response)
        else:
            raise HTTPClientException('HTTP client response error {0}'.format(response.status))

    @staticmethod
    def enc_val(s):
        if type(s) is str:
            return urllib.parse.quote(s.encode('utf-8'))
        return urllib.parse.quote(s)

    def _process_args(self, args: Union[Dict[str, Any], List[Tuple[str, Any]]]) -> str:
        ans = []
        items = args.items() if type(args) is dict else args
        for key, multival in items:
            vals = multival if type(multival) is list else [multival]
            for val in vals:
                ans.append(f'{key}={self.enc_val(val)}')
        return '&'.join(ans)

    def request(self, method: str, path: str, args: Union[Dict[str, Any], List[Tuple[str, Any]]], body: Any = None,
                headers=None):
        connection = self.create_connection()
        try:
            connection.request(method, path + '?' + self._process_args(args), body,
                               headers if headers is not None else {})
            return self.process_response(connection)
        finally:
            connection.close()
