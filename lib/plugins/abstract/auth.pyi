# Copyright (c) 2019 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2019 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Dict, Any, Optional, Tuple
from controller.plg import PluginApi
from werkzeug.contrib.sessions import Session


class AbstractAuth(object):

    def __init__(self, anonymous_id): ...

    def anonymous_user(self) -> Dict[str, Any]: ...

    def is_anonymous(self, user_id:int) -> bool: ...

    def is_administrator(self, user_id:int) -> bool: ...

    def permitted_corpora(self, user_dict:Dict[str, Any]) -> Dict[str, str]: ...

    def on_forbidden_corpus(self, plugin_api:PluginApi, corpname:str, corp_variant:str): ...

    def get_user_info(self, plugin_api:PluginApi) -> Dict[str, Any]: ...

    def logout_hook(self, plugin_api:PluginApi): ...


class AbstractSemiInternalAuth(AbstractAuth):

    def validate_user(self, plugin_api:PluginApi, username:str, password:str) -> Dict[str, Any]: ...


class AbstractInternalAuth(AbstractSemiInternalAuth):

    def get_login_url(self, return_url:Optional[str]) -> str: ...

    def get_logout_url(self, return_url:Optional[str]) -> str: ...

    def update_user_password(self, user_id:int, password:str): ...

    def logout(self, session:Session): ...

    def get_required_password_properties(self) -> basestring: ...

    def validate_new_password(self, password:str) -> bool: ...

    def init_sign_up_form(self, plugin_api:PluginApi) -> Dict[str, Any]: ...

    def sign_up_user(self, plugin_api:PluginApi, credentials:Dict[str, Any]): ...

    def sign_up_confirm(self, plugin_api:PluginApi, key:str) -> bool: ...

    def get_required_username_properties(self, plugin_api:PluginApi) -> str: ...

    def validate_new_username(self, plugin_api:PluginApi, username:str) -> Tuple[bool, bool]: ...

    def get_form_props_from_token(self, key:str) -> Dict[str, Any]: ...


class AbstractRemoteAuth(AbstractAuth):

    def revalidate(self, plugin_api:PluginApi): ...


class AuthException(Exception):
    pass


class SignUpNeedsUpdateException(AuthException):
    pass