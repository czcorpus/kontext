# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

import os
from typing import Union, Dict, List, Tuple, Any, Callable
import jinja2
import re
import json
from urllib.parse import urlparse
from xml.sax.saxutils import escape
from dataclasses_json.api import DataClassJsonMixin
import werkzeug.http

from translation import ugettext
import l10n
import strings
import settings
from action.krequest import KRequest
from action.cookie import KonTextCookie
from action.errors import ForbiddenException


ResultType = Union[
    Callable[[], Union[str, bytes, DataClassJsonMixin, Dict[str, Any]]],
    Dict[str, Any],
    str,
    bytes,
    DataClassJsonMixin]


class CustomJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, DataClassJsonMixin):
            return o.to_dict()
        return super().default(o)


def val_to_js(obj):
    s = obj.to_json() if callable(getattr(obj, 'to_json', None)) else json.dumps(obj, cls=CustomJSONEncoder)
    return re.sub(
        r'<(/)?(script|iframe|frame|frameset|embed|img|object)>', r'<" + "\g<1>\g<2>>', s, flags=re.IGNORECASE)


@jinja2.pass_context
def translat_filter(_, s):
    return ugettext(s)


class KResponse:
    """
    KResponse provides a high level access to action responses. It is responsible
    for setting HTTP status code, headers, for rendering output from result data
    (templating engine, JSON encoding,...) etc.
    """

    def __init__(self, routing: KRequest):
        self._routing = routing
        self._template_dir: str = os.path.realpath(os.path.join(
            os.path.dirname(__file__), '..', '..', 'templates'))
        tpl_cache_path = settings.get('global', 'template_engine_cache_path', None)
        cache = jinja2.FileSystemBytecodeCache(tpl_cache_path) if tpl_cache_path else None
        self._template_env: jinja2.Environment = jinja2.Environment(
            loader=jinja2.FileSystemLoader(searchpath=self._template_dir),
            bytecode_cache=cache,
            trim_blocks=True,
            lstrip_blocks=True)
        self._template_env.filters.update(
            to_json=val_to_js,
            shorten=strings.shorten,
            camelize=l10n.camelize,
            _=translat_filter,
            xmle=escape)
        self._redirect_safe_domains: Tuple[str, ...] = (
            urlparse(self._routing.get_root_url()).netloc,
            *settings.get('global', 'redirect_safe_domains', ()))
        self._status: int = 200
        self._headers: Dict[str, str] = {'Content-Type': 'text/html'}
        self._new_cookies: KonTextCookie = KonTextCookie()

    def set_header(self, name: str, value: str):
        self._headers[name] = value

    def remove_header(self, name: str):
        try:
            del self._headers[name]
        except KeyError:
            pass

    def contains_header(self, name: str) -> bool:
        return name in self._headers

    def set_cookie(self, name, value, path, expires):
        self._new_cookies[name] = value
        self._new_cookies[name]['path'] = path
        self._new_cookies[name]['expires'] = expires

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
        s = werkzeug.http.HTTP_STATUS_CODES[self._status]
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
            url = self._routing.get_root_url() + url

        if any(urlparse(url).netloc.endswith(domain) for domain in self._redirect_safe_domains):
            self.set_header('Location', url)
        else:
            raise ForbiddenException('Not allowed redirection domain')

    def output_headers(self, return_type: str = 'template') -> List[Tuple[str, str]]:
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
        elif return_type == 'xml':
            self._headers['Content-Type'] = 'application/xml'
        elif return_type == 'plain':
            self._headers['Content-Type'] = 'text/plain'
        # Note: 'template' return type should never overwrite content type here as it is action-dependent
        ans = []
        for k, v in sorted([x for x in list(self._headers.items()) if bool(x[1])], key=lambda item: item[0]):
            ans.append((k, v))
        # Cookies
        cookies_same_site = settings.get('global', 'cookies_same_site', None)
        for cookie in self._new_cookies.values():
            if cookies_same_site is not None:
                cookie['Secure'] = True
                cookie['SameSite'] = cookies_same_site
            ans.append(('Set-Cookie', cookie.OutputString()))
        return ans

    def output_result(
            self,
            method_name: str,
            template: str,
            result: ResultType,
            action_metadata: Dict[str, Any],
            inject_page_globals: Callable[[str, Dict[str, Any], ResultType], None],
            return_type: str) -> Union[str, bytes]:
        """
        Renders a response body out of a provided data. The concrete form of data transformation
        depends on the combination of the 'return_type' argument and a type of the 'result'.
        Typical combinations are (ret. type, data type):
        'template' + dict
        'json' + dict (which may contain dataclass_json instances)
        'json' + dataclass_json
        'plain' + str
        A callable 'result' can be used for lazy result evaluation or for JSON encoding with a custom encoder
        """
        if 300 <= self._status < 400 or result is None:
            return ''
        if callable(result):
            result = result()
        if return_type == 'json':
            try:
                if type(result) in (str, bytes):
                    return result
                else:
                    return json.dumps(result, cls=CustomJSONEncoder)
            except Exception as e:
                self._status = 500
                return json.dumps(dict(messages=[('error', str(e))]))
        elif return_type == 'xml':
            from templating import Type2XML
            return Type2XML.to_xml(result)
        elif return_type == 'plain' and not isinstance(result, (dict, DataClassJsonMixin)):
            return result
        elif isinstance(result, dict):
            inject_page_globals(method_name, action_metadata, result)
            template_object = self._template_env.get_template(template)
            return template_object.render(result)
        raise RuntimeError(f'Unknown source ({result.__class__.__name__}) or return type ({return_type})')
