# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

import hashlib
from typing import Any, Dict, List, Optional, Tuple

import l10n
import settings
from action.cookie import KonTextCookie
from action.errors import UserActionException
from action.krequest import KRequest
from action.model.abstract import AbstractPageModel
from action.plugin.ctx import AbstractBasePluginCtx
from action.props import ActionProps
from action.req_args import create_req_arg_proxy
from action.response import KResponse
from main_menu.model import AbstractMenuItem, MainMenuItemId
from sanic import Sanic
from sanic_session import Session
from texttypes.cache import TextTypesCache


class BaseActionModel(AbstractPageModel):
    """
    BaseActionModel provides a bare minimum for what is needed from an action model.
    Please note that in most cases, you will need some extended implementation.
    """

    LOCAL_COLL_OPTIONS = ('cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr', 'cbgrfns', 'csortfn')

    BASE_ATTR: str = 'word'  # TODO this value is actually hardcoded throughout the code

    ANON_FORBIDDEN_MENU_ITEMS = []

    # a user settings key entry used to access user's scheduled actions
    SCHEDULED_ACTIONS_KEY = '_scheduled'

    def __init__(self, req: KRequest, resp: KResponse, action_props: ActionProps, tt_cache: TextTypesCache) -> None:
        self._req: KRequest = req
        self._resp: KResponse = resp
        self._action_props: ActionProps = action_props
        self._files_path: str = settings.get('global', 'static_files_prefix', '../files')
        self.disabled_menu_items: Tuple[MainMenuItemId, ...] = ()
        # menu items - they should not be handled directly
        self._dynamic_menu_items: List[AbstractMenuItem] = []
        self._plugin_ctx: Optional[BasePluginCtx] = None

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

    async def init_session(self) -> None:
        pass

    async def add_globals(self, app: Sanic, action_props: ActionProps, result: Dict[str, Any]):
        result['active_plugins'] = []
        result['plugin_data'] = {}
        result['corpus_ident'] = None
        result['root_url'] = self._req.get_root_url()
        result['files_path'] = self._files_path
        result['debug'] = settings.is_debug_mode()
        result['methodname'] = self._action_props.action_name
        deployment_id = settings.get('global', 'deployment_id', None)
        result['deployment_suff'] = '?_v={0}'.format(hashlib.md5(deployment_id.encode('utf-8')).hexdigest()[
                                                     :6]) if deployment_id else ''
        if self._action_props.action_prefix:
            result['current_action'] = f'{self._action_props.action_prefix}/{self._action_props.action_name}'
        else:
            result['current_action'] = self._action_props.action_name
        result['user_id'] = self._req.session_get('user', 'id')
        result['locale'] = self._req.ui_lang
        result['messages'] = []
        result['uses_corp_instance'] = False
        result['use_conc_toolbar'] = False
        result['shuffle_min_result_warning'] = 0
        result['multilevel_freq_dist_max_levels'] = 0
        page_model = action_props.page_model if action_props.page_model else l10n.camelize(
            action_props.action_name)
        result['page_model'] = page_model
        avail_languages = settings.get_full('global', 'translations')
        ui_lang = self._req.ui_lang.replace('_', '-') if self._req.ui_lang else 'en-US'
        # available languages; used just by UI language switch
        result['avail_languages'] = avail_languages
        result['uiLang'] = ui_lang
        result['is_local_ui_lang'] = any(settings.import_bool(meta.get('local', '0'))
                                         for code, meta in avail_languages if code == ui_lang)
        day_map = {0: 'mo', 1: 'tu', 2: 'we', 3: 'th', 4: 'fr', 5: 'sa', 6: 'su'}
        result['first_day_of_week'] = day_map[self._req.locale.first_week_day]
        if 'popup_server_messages' not in result:
            result['popup_server_messages'] = True
        result['menu_data'] = {'submenuItems': []}
        result['async_tasks'] = []
        result['issue_reporting_action'] = None
        result['help_links'] = {}
        result['_version'] = None
        return result

    def init_menu(self, result):
        pass

    async def pre_dispatch(self, args_proxy):
        if 'format' in self._req.args:
            if self._is_valid_return_type(self._req.args.get('format')):
                self._action_props.return_type = self._req.args.get('format')
            else:
                raise UserActionException(f'Unknown output format: {self._req.args.get("format")}')
        return create_req_arg_proxy(self._req.form, self._req.args, self._req.json)

    async def post_dispatch(self, action_props, result, err_desc):
        pass

    async def resolve_error_state(self, req: KRequest, resp: KResponse, result, err: Exception):
        """
        In case an HTTP action throws an error, the involved model has a chance to react
        using this method. It can e.g. provide some "last valid state" information to provide
        some reasonable "escape hatch" for user (e.g. "go to the last used corpus").
        """
        pass


class BasePluginCtx(AbstractBasePluginCtx):

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

    @property
    def cookies(self) -> KonTextCookie:
        return self._request.cookies

    @property
    def session(self) -> Session:
        return self._request.ctx.session

    @property
    def user_lang(self) -> str:
        return self._request.ui_lang

    def translate(self, string: str) -> str:
        return self._request.translate(string)
