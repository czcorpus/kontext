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

from urllib.parse import quote

import settings


class Routing:
    """
    Routing provides some basic routing functionality like generating action URLs,
    getting correct root URL, obtaining required action name etc.
    """

    def __init__(self, environ: Dict[str, str], mapping_url_prefix: str, http_protocol: str):
        self._environ = environ
        self._mapping_url_prefix = mapping_url_prefix
        self._http_protocol = http_protocol

    def get_current_url(self) -> str:
        """
        Returns an URL representing current application state
        """
        action_str = '/'.join([x for x in self.get_current_action() if x])
        qs = self._environ.get('QUERY_STRING', '')
        return self.get_root_url() + action_str + (f'?{qs}' if qs else '')

    def get_current_action(self) -> Tuple[str, str]:
        """
        Returns a 2-tuple where:
        1st item = module name (or an empty string if an implicit one is in use)
        2nd item = action method name
        """
        prefix, action = self._environ.get('PATH_INFO', '').rsplit('/', 1)
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
        module, _ = self._environ.get('PATH_INFO', '').rsplit('/', 1)
        module = '%s/' % module
        if module.endswith(self._mapping_url_prefix):
            action_module_path = module[:-len(self._mapping_url_prefix)]
        else:
            action_module_path = ''
        if len(action_module_path) > 0:  # => app is not installed in root path (e.g. http://127.0.0.1/app/)
            action_module_path = action_module_path[1:]
        url_items = ('{}://{}'.format(
                self._http_protocol, settings.get_str(
                    'global', 'http_host', self._environ.get('HTTP_HOST'))),
                    settings.get_str('global', 'action_path_prefix', ''),
                    action_module_path)
        return '/'.join([x for x in [x.strip('/') for x in url_items] if bool(x)]) + '/'

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
