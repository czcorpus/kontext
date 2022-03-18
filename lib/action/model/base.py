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

from typing import Union, Optional, List, Dict, Any, Tuple
import hashlib
from action import ActionProps
from action.errors import UserActionException
from action.req_args import RequestArgsProxy, JSONRequestArgsProxy, create_req_arg_proxy
from action.krequest import KRequest
from action.response import KResponse
from action.cookie import KonTextCookie
from main_menu.model import AbstractMenuItem
from texttypes.cache import TextTypesCache
import l10n
import settings
from sanic import Sanic
from action.model.tools import apply_theme
from util import as_async


class BaseActionModel:

    GENERAL_OPTIONS = (
        'pagesize', 'kwicleftctx', 'kwicrightctx', 'multiple_copy', 'ctxunit', 'shuffle', 'citemsperpage',
        'pqueryitemsperpage', 'fmaxitems', 'fdefault_view', 'wlpagesize', 'line_numbers', 'rich_query_editor')

    LOCAL_COLL_OPTIONS = ('cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr', 'cbgrfns', 'csortfn')

    BASE_ATTR: str = 'word'  # TODO this value is actually hardcoded throughout the code

    ANON_FORBIDDEN_MENU_ITEMS = []

    # a user settings key entry used to access user's scheduled actions
    SCHEDULED_ACTIONS_KEY = '_scheduled'

    def __init__(self, req: KRequest, resp: KResponse, action_props: ActionProps, tt_cache: TextTypesCache) -> None:
        self._req: KRequest = req
        self._resp: KResponse = resp
        self._action_props: ActionProps = action_props
        self._system_messages: List[Tuple[str, str]] = []
        self._files_path: str = settings.get('global', 'static_files_prefix', '../files')
        self.disabled_menu_items: Tuple[str, ...] = ()
        # menu items - they should not be handled directly
        self._dynamic_menu_items: List[AbstractMenuItem] = []
        self._plugin_ctx: Optional[BasePluginCtx] = None

    @property
    def ui_lang(self):
        return self._req.ui_lang

    @property
    def dynamic_menu_items(self):
        return self._dynamic_menu_items

    @property
    def plugin_ctx(self):
        if self._plugin_ctx is None:
            self._plugin_ctx = BasePluginCtx(self, self._req, self._resp)
        return self._plugin_ctx

    @staticmethod
    def _is_valid_return_type(f: str) -> bool:
        return f in ('template', 'json', 'xml', 'plain')

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

    def init_session(self) -> None:
        pass

    @as_async
    def add_globals(self, app: Sanic, action_props: ActionProps, result: Dict[str, Any]):
        result['root_url'] = self._req.get_root_url()
        result['files_path'] = self._files_path
        result['debug'] = settings.is_debug_mode()
        result['methodname'] = self._action_props.action_name
        deployment_id = settings.get('global', 'deployment_id', None)
        result['deployment_suff'] = '?_v={0}'.format(hashlib.md5(deployment_id.encode('utf-8')).hexdigest()[
                                                     :6]) if deployment_id else ''
        result['current_action'] = f'{self._action_props.action_prefix}/{self._action_props.action_name}'
        result['user_id'] = self._req.session_get('user', 'id')
        result['locale'] = self.ui_lang
        result['messages'] = []
        result['uses_corp_instance'] = False
        result['use_conc_toolbar'] = False
        result['shuffle_min_result_warning'] = 0
        result['multilevel_freq_dist_max_levels'] = 0
        apply_theme(result, app, settings.get(
            'global', 'static_files_prefix', '../files'), self._req.translate)
        page_model = action_props.page_model if action_props.page_model else l10n.camelize(
            action_props.action_name)
        result['page_model'] = page_model
        return result

    async def pre_dispatch(
            self,
            args_proxy: Optional[Union[RequestArgsProxy, JSONRequestArgsProxy]]
    ) -> Union[RequestArgsProxy, JSONRequestArgsProxy]:
        if 'format' in self._req.args:
            if self._is_valid_return_type(self._req.args.get('format')):
                self._action_props.return_type = self._req.args.get('format')
            else:
                self._action_props.return_type = 'text'
                raise UserActionException(
                    'Unknown output format: {0}'.format(self._req.args.get('format')))
        return create_req_arg_proxy(self._req.form, self._req.args, self._req.json)

    async def post_dispatch(self, action_props: ActionProps, result, err_desc):
        pass


class BasePluginCtx:

    """
    BasePluginCtx provides a subset of features from BaseActionModel for plug-ins.
    """

    def __init__(self, action_model: BaseActionModel, request: KRequest, response: KResponse):
        self._action_model: BaseActionModel = action_model
        self._request = request
        self._response = response
        self._shared_data: Dict[str, Any] = {}

    def set_shared(self, key: str, value: Any):
        self._shared_data[key] = value

    def get_shared(self, key: str, default: Optional[Any] = None) -> Any:
        return self._shared_data.get(key, default)

    @property
    def client_ip(self) -> str:
        return self._request.headers.get('x-forwarded-for', self._request.remote_addr)

    @property
    def http_headers(self):
        return self._request.headers

    @property
    def request(self) -> KRequest:
        return self._request

    @property
    def current_url(self) -> str:
        return self._request.get_current_url()

    @property
    def root_url(self) -> str:
        return self._request.get_root_url()

    def create_url(self, action, params):
        return self._request.create_url(action, params)

    def updated_current_url(self, args):
        return self._request.updated_current_url(args)

    def redirect(self, url: str, code: int = 303) -> None:
        return self._response.redirect(url, code=code)

    def set_not_found(self):
        return self._response.set_not_found()

    def set_respose_status(self, status: int):
        self._response.set_http_status(status)

    def add_system_message(self, msg_type, text):
        self._action_model.add_system_message(msg_type, text)

    @property
    def cookies(self) -> KonTextCookie:
        return self._request.cookies

    @property
    def session(self):
        return self._request.ctx.session

    @property
    def user_lang(self) -> str:
        return self._request.ui_lang

    def translate(self, string: str) -> str:
        return self._request.translate(string)
