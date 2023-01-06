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

import logging
import ssl
import urllib.parse
from typing import Any, Dict, List, Tuple, Union

import aiohttp
from sanic import Sanic


class HTTPClientException(Exception):
    pass


class HTTPClient:

    def __init__(self, server: str, enable_ssl: bool = False):
        self._server = server
        self._ssl_context = ssl.create_default_context() if enable_ssl else None
        self._client_timeout = None

    @staticmethod
    def _is_valid_response(response: aiohttp.ClientResponse) -> bool:
        return response and (200 <= response.status < 300 or 400 <= response.status < 500)

    @staticmethod
    def _is_found(response: aiohttp.ClientResponse) -> bool:
        return 200 <= response.status < 300

    @property
    def _app_client_session(self) -> aiohttp.ClientSession:
        return Sanic.get_app('kontext').ctx.client_session

    @property
    def client_timeout(self) -> int:
        if not self._client_timeout:
            self._client_timeout = Sanic.get_app('kontext').ctx.kontext_conf.get('http_client_timeout_secs')
        return self._client_timeout

    async def process_response(self, response: aiohttp.ClientResponse):
        if self._is_valid_response(response):
            logging.getLogger(__name__).debug(f'HTTP client response status: {response.status}')
            return (await response.read()).decode('utf-8'), self._is_found(response)
        else:
            raise HTTPClientException(f'HTTP client response error {response.status}')

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

    async def request(
            self, method: str, path: str, args: Union[Dict[str, Any], List[Tuple[str, Any]]], data: Any = None,
            headers=None):
        url = self._server + (path + '?' + self._process_args(args) if args else path)
        async with self._app_client_session.request(
                method,
                url,
                data=data,
                headers=headers if headers is not None else {},
                timeout=self.client_timeout,
                ssl=self._ssl_context) as response:
            return await self.process_response(response)

    async def json_request(
            self, method: str, path: str, args: Union[Dict[str, Any], List[Tuple[str, Any]]], data: Any = None,
            headers=None):
        url = self._server + (path + '?' + self._process_args(args) if args else path)
        async with self._app_client_session.request(
                method,
                url,
                json=data,
                headers=headers if headers is not None else {},
                timeout=self.client_timeout,
                ssl=self._ssl_context) as response:
            return await self.process_response(response)
