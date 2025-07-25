# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

import logging
from typing import Dict, Iterable, List, Tuple, TypeVar, Generic, Optional, Union
from urllib.parse import urlparse
from sanic.helpers import STATUS_CODES
from dataclasses import dataclass
from datetime import datetime
from sanic.response import ResponseStream
from mimetypes import guess_type
from io import BytesIO

from action.errors import ForbiddenException
from action.templating import ResultType

T = TypeVar('T', bound=ResultType)


@dataclass
class CookieDraft:
    name: str
    value: str
    path: str
    expires: datetime
    same_site: Optional[str] = None
    secure: bool = None


class KResponse(Generic[T]):
    """
    KResponse provides high level access to action responses including handling of response data.
    It is responsible for setting HTTP status code, headers, for rendering output from result data
    (templating engine, JSON encoding,...) etc.

    Response data are separated into two blocks:
    - API response (type T)
    - template data
    """

    def __init__(self, root_url: str, redirect_safe_domains: Iterable[str], cookies_same_site: str, result: T):

        self._root_url = root_url

        self._redirect_safe_domains: Tuple[str, ...] = (
            urlparse(self._root_url).netloc, *redirect_safe_domains)

        self._status: int = 200

        self._headers: Dict[str, str] = {}
        """
        HTTP headers. Please note that in KonText, headers are case sensitive
        and we expect the words in keys to start with upper-case letters
        (e.g. Content-Type, Cache-Control etc.)
        """

        self._new_cookies: Dict[str, CookieDraft] = {}

        self._cookies_same_site = cookies_same_site

        self._system_messages: List[Tuple[str, str]] = []

        self._tpl_data: ResultType = {}

        self._result: T = result

    def set_result(self, result: T):
        """
        Set action result. The preferable type is BaseResult as
        it provides typed values and also information about JS/TS
        module for result handling.
        """
        self._result = result

    @property
    def result(self):
        return self._result
    @property
    def tpl_data(self):
        return self._tpl_data

    def add_system_message(self, msg_type: str, text: str) -> None:
        """
        Adds a system message which will be displayed
        to a user. It is possible to add multiple messages
        by repeatedly call this method.

        arguments:
        msg_type -- one of 'message', 'info', 'warning', 'error'
        text -- text of the message
        """
        self._system_messages.append((msg_type, text))

    @property
    def system_messages(self) -> List[Tuple[str, str]]:
        return self._system_messages

    def set_header(self, name: str, value: str):
        """
        Set HTTP header.
        Please note that in KonText the headers are case-sensitive and
        the expected format is with each word starting with an upper
        case letter (e.g. 'Content-Type' and not 'content-type')
        """
        self._headers[name] = value

    def remove_header(self, name: str):
        try:
            del self._headers[name]
        except KeyError:
            pass

    def contains_header(self, name: str) -> bool:
        return name in self._headers

    def set_cookie(self, name, value, path, expires: datetime):
        new_cookie = CookieDraft(name=name, value=value, path=path, expires=expires)
        if self._cookies_same_site is not None:
            new_cookie.secure = True
            new_cookie.same_site = self._cookies_same_site
        self._new_cookies[name] = new_cookie

    def get_cookies(self) -> List[CookieDraft]:
        return list(self._new_cookies.values())

    def set_not_found(self) -> None:
        """
        Sets Controller to output HTTP 404 Not Found response
        """
        if 'Location' in self._headers:
            del self._headers['Location']
        self._status = 404

    def set_forbidden(self):
        if 'Location' in self._headers:
            del self._headers['Location']
        self._status = 403

    def set_http_status(self, status: int):
        self._status = status

    @property
    def http_status_code(self) -> int:
        return self._status

    @property
    def http_status(self) -> str:
        """
        Exports numerical HTTP status into a HTTP header format
        (e.g. 200 -> '200 OK')
        In case of an unknown code, KeyError is raised
        """
        s = STATUS_CODES[self._status]
        return f'{self._status} {s}'

    def redirect(self, url: str, code: int = 303) -> None:
        """
        Sets Controller to output HTTP redirection headers.
        Please note that the method does not interrupt request
        processing, i.e. the redirect is not immediate. In case
        immediate redirect is needed raise ImmediateRedirectException.

        arguments:
        url -- a target URL
        code -- an optional integer HTTP response code (default is 303)
        """
        self._status = code
        if not url.startswith('http://') and not url.startswith('https://') and not url.startswith('/'):
            url = self._root_url + url

        if any(urlparse(url).netloc.endswith(domain) for domain in self._redirect_safe_domains):
            self.set_header('Location', url)
        else:
            raise ForbiddenException('Not allowed redirection domain')

    def output_headers(self, return_type: str = 'template') -> Dict[str, str]:
        """
        Generates proper content-type signature and
        creates a cookie to store user's settings

        arguments:
        return_type -- action return type (json, html, xml,...)

        returns:
        bool -- True if content should follow else False
        """
        if return_type == 'json':
            self._headers['Content-Type'] = 'application/json'
        elif return_type == 'xml' or return_type == 'template_xml':
            self._headers['Content-Type'] = 'application/xml'
        elif return_type == 'plain':
            if 'Content-Type' not in self._headers:
                self._headers['Content-Type'] = 'text/plain'
        elif return_type == 'template':
            self._headers['Content-Type'] = 'text/html'
        elif return_type == 'template_xml':
            self._headers['Content-Type'] = 'application/xml'
        else:
            logging.getLogger(__name__).error('unknown action return type "{}"'.format(return_type))
        # Note: 'template' return type should never overwrite content type here as it is action-dependent
        ans = {}
        for k, v in sorted([x for x in list(self._headers.items()) if bool(x[1])], key=lambda item: item[0]):
            ans[k] = v
        return ans


async def bytes_stream(
        data: Union[bytes, str],
        status: int = 200,
        chunk_size: int = 4096,
        mime_type: Optional[str] = None,
        headers: Optional[dict[str, str]] = None,
        filename: Optional[str] = None,
) -> ResponseStream:
    """
    Return a streaming response object with bytes data.
    """
    headers = headers or {}
    if filename:
        headers.setdefault(
            "Content-Disposition", f'attachment; filename="{filename}"'
        )
        mime_type = mime_type or guess_type(filename)[0] or "application/octet-stream"
    else:
        mime_type = mime_type or "application/octet-stream"

    async def _streaming_fn(response):
        # Create a BytesIO object from the bytes data
        if isinstance(data, str):
            bytes_data = data.encode('utf-8')
        else:
            bytes_data = data
        bytes_io = BytesIO(bytes_data)
        while True:
            content = bytes_io.read(chunk_size)
            if len(content) < 1:
                break
            await response.write(content)

    return ResponseStream(
        streaming_fn=_streaming_fn,
        status=status,
        headers=headers,
        content_type=mime_type,
    )