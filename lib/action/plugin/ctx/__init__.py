# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2013 Charles University, Faculty of Arts,
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

from typing import Optional, Dict, Any, TypeVar
from corplib.abstract import AbstractKCorpus
from secure_cookie.session import Session
from action.cookie import KonTextCookie
from corplib import CorpusManager
import settings
from plugin_types.auth import UserInfo
from action.krequest import KRequest
from action.model.base import BaseActionModel

T = TypeVar('T')


class PluginCtx:

    """
    PluginCtx provides a runtime context for plug-ins.

    Please note that it should be never an attribute of a plug-in as
    the plug-in instance is always shared between requests. In most
    cases KonText passes the instance to respective plug-in methods
    called during request processing.
    """

    def __init__(self, action_model: 'BaseActionModel', request: KRequest) -> None:
        self._action_model: 'BaseActionModel' = action_model
        self._request: KRequest = request
        self._shared_data: Dict[str, Any] = {}

    def set_shared(self, key: str, value: Any):
        self._shared_data[key] = value

    def get_shared(self, key: str, default: Optional[T] = None) -> Any:
        return self._shared_data.get(key, default)

    @property
    def client_ip(self) -> str:
        return self._request.headers.get('HTTP_X_FORWARDED_FOR', self._request.remote_addr)

    @property
    def http_headers(self):
        return self._request.headers

    @property
    def request(self) -> KRequest:
        return self._request

    @property
    def cookies(self) -> KonTextCookie:
        return self._cookies

    @property
    def session(self) -> Session:
        return self._request.ctx.session

    def refresh_session_id(self) -> None:
        return self._action_model.refresh_session_id()

    @property
    def user_lang(self) -> str:
        return self._action_model.ui_lang

    @property
    def user_id(self) -> int:
        return self._request.ctx.session.get('user', {'id': None}).get('id')

    @property
    def user_dict(self) -> UserInfo:
        return self._request.ctx.session.get('user', {'id': None})

    @property
    def user_is_anonymous(self) -> bool:
        return self._action_model.user_is_anonymous()

    @property
    def current_corpus(self) -> AbstractKCorpus:
        return self._action_model.corp

    @property
    def aligned_corpora(self):
        return getattr(self._action_model.args, 'align')

    @property
    def available_aligned_corpora(self):
        return self._action_model.get_available_aligned_corpora()

    @property
    def current_url(self) -> str:
        return self._action_model.get_current_url()

    @property
    def root_url(self) -> str:
        return self._action_model.get_root_url()

    def create_url(self, action, params):
        return self._action_model.create_url(action, params)

    def updated_current_url(self, args):
        return self._action_model.updated_current_url(args)

    def redirect(self, url: str, code: int = 303) -> None:
        return self._action_model.redirect(url, code=code)

    def set_not_found(self):
        return self._action_model.set_not_found()

    def set_respose_status(self, status: int):
        self._action_model.set_respose_status(status)

    def add_system_message(self, msg_type, text):
        self._action_model.add_system_message(msg_type, text)

    @property
    def corpus_manager(self) -> CorpusManager:
        return self._action_model.cm

    @property
    def text_types(self) -> Dict:
        ans = {}
        maxlistsize = settings.get_int('global', 'max_attr_list_size')
        subcorpattrs = self.current_corpus.get_conf('SUBCORPATTRS')
        if not subcorpattrs:
            subcorpattrs = self.current_corpus.get_conf('FULLREF')
        tt = self._action_model.tt.export(subcorpattrs, maxlistsize)
        for item in tt:
            for tt2 in item['Line']:
                ans[tt2['name']] = {'type': 'default', 'values': [x['v']
                                                                  for x in tt2.get('Values', [])]}
        return ans
