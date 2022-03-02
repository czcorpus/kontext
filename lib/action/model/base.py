# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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

import os
from typing import Union, Callable, Optional, List, Dict, Any, Tuple
from functools import partial
import hashlib
from action import ActionProps
from action.errors import UserActionException
from action.req_args import RequestArgsProxy, JSONRequestArgsProxy, create_req_arg_proxy
from action.krequest import KRequest
from texttypes.cache import TextTypesCache
from translation import ugettext as translate
import settings
from sanic import Sanic
from translation import ugettext


def _apply_theme(data, app: Sanic, public_files_path: str):
    theme_name = settings.get('theme', 'name')
    logo_img = settings.get('theme', 'logo')
    if settings.contains('theme', 'logo_mouseover'):
        logo_alt_img = settings.get('theme', 'logo_mouseover')
    else:
        logo_alt_img = logo_img

    if settings.contains('theme', 'logo_href'):
        logo_href = str(settings.get('theme', 'logo_href'))
    else:
        logo_href = app.url_for('root.root_action')

    if theme_name == 'default':
        logo_title = ugettext('Click to enter a new query')
    else:
        logo_title = str(logo_href)

    theme_favicon = settings.get('theme', 'favicon', None)
    theme_favicon_type = settings.get('theme', 'favicon_type', None)
    if (theme_favicon and not (theme_favicon.startswith('/') or theme_favicon.startswith('http://') or
                               theme_favicon.startswith('https://'))):
        theme_favicon = os.path.join(public_files_path, theme_name, theme_favicon)

    data['theme'] = dict(
        name=settings.get('theme', 'name'),
        logo_path=os.path.normpath(os.path.join(
            public_files_path, 'themes', theme_name, logo_img)),
        logo_mouseover_path=os.path.normpath(os.path.join(
            public_files_path, 'themes', theme_name, logo_alt_img)),
        logo_href=logo_href,
        logo_title=logo_title,
        logo_inline_css=settings.get('theme', 'logo_inline_css', ''),
        online_fonts=settings.get_list('theme', 'fonts'),
        favicon=theme_favicon,
        favicon_type=theme_favicon_type
    )


class BaseActionModel:

    GENERAL_OPTIONS = (
        'pagesize', 'kwicleftctx', 'kwicrightctx', 'multiple_copy', 'ctxunit',
        'shuffle', 'citemsperpage', 'pqueryitemsperpage', 'fmaxitems', 'fdefault_view', 'wlpagesize', 'line_numbers',
        'rich_query_editor')

    LOCAL_COLL_OPTIONS = ('cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr', 'cbgrfns', 'csortfn')

    BASE_ATTR: str = 'word'  # TODO this value is actually hardcoded throughout the code

    ANON_FORBIDDEN_MENU_ITEMS = []

    # a user settings key entry used to access user's scheduled actions
    SCHEDULED_ACTIONS_KEY = '_scheduled'

    def __init__(self, request: KRequest, action_props: ActionProps, tt_cache: TextTypesCache) -> None:
        self._request: KRequest = request
        self._action_props: ActionProps = action_props
        self._tt_cache: tt_cache
        self.ui_lang: str = 'en_US'  # TODO fetch from request
        # a list of functions which must pass (= return None) before any action is performed
        self._validators: List[Callable[[ActionProps], Optional[Exception]]] = []
        self._system_messages: List[Tuple[str, str]] = []

    @staticmethod
    def _is_allowed_explicit_out_format(f: str) -> bool:
        return f in ('template', 'json', 'xml', 'plain')

    def _validate_http_method(self, action_metadata: Dict[str, Any]) -> None:
        hm = action_metadata.get('http_method', 'GET')
        if not isinstance(hm, tuple):
            hm = (hm,)
        if self._request.method not in hm:
            raise UserActionException(translate('Unknown action'), code=404)

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

    def add_validator(self, func: Callable[[ActionProps], Optional[Exception]]) -> None:
        """
        Adds a function which is run after pre_dispatch but before action processing.
        If the function returns an instance of Exception then Controller raises this value.
        The validation fails on first encountered error (i.e. subsequent validators are not run).
        This is intended for ancestors to inject pre-run checks.

        arguments:
        func -- a callable instance
        """
        self._validators.append(func)

    def init_session(self) -> None:
        pass

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

    def add_globals(self, app: Sanic, action_props: ActionProps, result: Dict[str, Any]):
        result['methodname'] = self._action_props.action_name
        deployment_id = settings.get('global', 'deployment_id', None)
        result['deployment_suff'] = '?_v={0}'.format(hashlib.md5(deployment_id.encode('utf-8')).hexdigest()[
                                                     :6]) if deployment_id else ''
        result['current_action'] = f'{self._action_props.action_prefix}/{self._action_props.action_name}'
        result['user_id'] = self._request.session_get('user', 'id')
        result['locale'] = self._request.ui_lang
        result['messages'] = []
        _apply_theme(result, app, settings.get('global', 'static_files_prefix', '../files'))
        return result

    def pre_dispatch(
            self,
            args_proxy: Optional[Union[RequestArgsProxy, JSONRequestArgsProxy]]
    ) -> Union[RequestArgsProxy, JSONRequestArgsProxy]:
        if 'format' in self._request.args:
            if self._is_allowed_explicit_out_format(self._request.args['format']):
                self._action_props.return_type = self._request.args['format']
            else:
                self._action_props.return_type = 'text'
                raise UserActionException(
                    'Unknown output format: {0}'.format(self._request.args['format']))
        self.add_validator(partial(self._validate_http_method, self._action_props))
        return create_req_arg_proxy(self._request.form, self._request.args, self._request.json)

    def post_dispatch(self, action_props: ActionProps, result, err_desc):
        pass
