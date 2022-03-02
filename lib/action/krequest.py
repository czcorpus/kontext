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

from typing import Dict, Any, Tuple, Union, List
from sanic.request import Request
from urllib.parse import quote
from plugin_types.auth import UserInfo
from action.cookie import KonTextCookie
import plugins
from werkzeug.http import parse_accept_header

from action import ActionProps


def _get_lang(request: Request, installed_langs):
    """
    Detects user's preferred language (either via the 'getlang' plugin or from HTTP_ACCEPT_LANGUAGE env value)

    arguments:
    environ -- WSGI environment variable

    returns:
    underscore-separated ISO 639 language code and ISO 3166 country code
    """
    cookies = KonTextCookie(request.cookies.get('HTTP_COOKIE', ''))

    if plugins.runtime.GETLANG.exists:
        lgs_string = plugins.runtime.GETLANG.instance.fetch_current_language(cookies)
    else:
        lang_cookie = cookies.get('kontext_ui_lang')
        if not lang_cookie:
            lgs_string = parse_accept_header(request.headers.get('HTTP_ACCEPT_LANGUAGE')).best
        else:
            lgs_string = lang_cookie.value
        if lgs_string is None:
            lgs_string = 'en_US'
        if len(lgs_string) == 2:  # in case we obtain just an ISO 639 language code
            lgs_string = installed_langs.get(lgs_string)
        else:
            lgs_string = lgs_string.replace('-', '_')
    if lgs_string is None:
        lgs_string = 'en_US'
    return lgs_string


class KRequest:
    """
    Routing provides some basic routing functionality like generating action URLs,
    getting correct root URL, obtaining required action name etc.
    """

    def __init__(self, request: Request, action_props: ActionProps):
        self._request = request
        self._action_props = action_props
        self._ui_lang = _get_lang(request, action_props.installed_langs)

    @property
    def unwrapped(self):
        return self._request

    @property
    def cookies(self):
        return self._request.cookies

    @property
    def ctx(self):
        return self._request.ctx

    @property
    def args(self):
        return self._request.args

    @property
    def form(self):
        return self._request.form

    @property
    def json(self):
        return self._request.json

    @property
    def method(self):
        return self._request.method

    @property
    def headers(self):
        return self._request.headers

    @property
    def ui_lang(self):
        return self._ui_lang

    @property
    def session(self):
        return self._request.ctx.session

    def session_get_user(self) -> UserInfo:
        """
        This is a convenience method for obtaining typed user info from HTTP session
        """
        return self._request.ctx.session['user']

    def session_get(self, *nested_keys: str) -> Any:
        """
        Retrieve any HTTP session value. The method supports nested
        keys - e.g. to get self._session['user']['car']['name'] we
        can just call self.session_get('user', 'car', 'name').
        If no matching keys are found then None is returned.

        Arguments:
        *nested_keys -- keys to access required value
        """
        curr = dict(self._request.ctx.session)
        for k in nested_keys:
            if k in curr:
                curr = curr[k]
            else:
                return None
        return curr

    @property
    def remote_addr(self):
        return self._request.remote_addr

    def get_current_url(self) -> str:
        """
        Returns an URL representing current application state
        """
        action_str = '/'.join([x for x in self.get_current_action() if x])
        qs = self._request.query_string
        return self.get_root_url() + action_str + (f'?{qs}' if qs else '')

    def get_current_action(self) -> Tuple[str, str]:
        """
        Returns a 2-tuple where:
        1st item = module name (or an empty string if an implicit one is in use)
        2nd item = action method name
        """
        prefix, action = self._request.server_path.rsplit('/', 1)
        return prefix.rsplit('/', 1)[-1], action

    def get_root_url(self) -> str:
        """
        Returns the root URL of the application (based on environmental variables). All the action module
        path elements and action names are removed. E.g.:
            The app is installed in http://127.0.0.1/app/ and it is currently processing
            http://127.0.0.1/app/user/login then root URL is still http://127.0.0.1/app/

        Please note that KonText always normalizes PATH_INFO environment
        variable to '/' (see public/app.py).
        """
        host_items = self._request.host.split(':')
        port_str = f':{host_items[1]}' if len(host_items) > 1 else ''
        return f'{self._request.scheme}://{host_items[0]}{port_str}/{self._action_props.action_prefix}'

    def updated_current_url(self, params: Dict[str, Any]) -> str:
        """
        Modifies current URL using passed parameters.

        Devel. note: the method must preserve existing non-unique 'keys'
        (because of current app's architecture derived from Bonito2).
        This means parameter list [(k1, v1), (k2, v2),...] cannot be
        converted into a dictionary and then worked on because some
        data would be lost in such case.

        arguments:
        params -- a dictionary containing parameter names and values

        returns:
        updated URL
        """
        import urllib.parse
        import urllib.error

        parsed_url = list(urllib.parse.urlparse(self.get_current_url()))
        old_params = dict(urllib.parse.parse_qsl(parsed_url[4]))
        new_params = []
        for k, v in old_params.items():
            if k in params:
                new_params.append((k, params[k]))
            else:
                new_params.append((k, v))

        for k, v in list(params.items()):
            if k not in old_params:
                new_params.append((k, v))

        parsed_url[4] = urllib.parse.urlencode(new_params)
        return urllib.parse.urlunparse(parsed_url)

    def create_url(
            self, action: str, params: Union[Dict[str, Union[str, int, float, bool]], List[Tuple[str, Any]]]) -> str:
        """
        Generates URL from provided action identifier and parameters.
        Please note that utf-8 compatible keys and values are expected here
        (i.e. you can pass either pure ASCII values or UTF-8 ones).

        arguments:
        action -- action identification (e.g. 'first_form', 'admin/users')
        params -- a dict-like object containing parameter names and values
        """
        root = self.get_root_url()

        def convert_val(x):
            return x.encode('utf-8') if isinstance(x, str) else str(x)

        fparams = params.items() if isinstance(params, dict) else params
        params_str = '&'.join(f'{k}={quote(convert_val(v))}' for k, v in fparams if v is not None)
        if len(params_str) > 0:
            return f'{root}{action}?{params_str}'
        else:
            return f'{root}{action}'
