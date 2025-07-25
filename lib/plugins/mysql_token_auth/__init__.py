# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

"""
An integration db token auth for users with private API keys.

required xml conf: please see ./config.rng
         mysql schema: please see ./scripts/schema.sql
"""
import hashlib
from datetime import datetime
from typing import List, Optional

import plugins
from action.plugin.ctx import PluginCtx
from plugin_types.auth import (
    AbstractRemoteAuth, CorpusAccess, GetUserInfo, UserInfo)
from plugins.mysql_integration_db import MySqlIntegrationDb


class TokenAuth(AbstractRemoteAuth):

    def __init__(
        self,
        db: MySqlIntegrationDb,
        anonymous_id: int,
        api_key_cookie_name: Optional[str],
        api_key_http_header: Optional[str],
    ):

        super(TokenAuth, self).__init__(anonymous_id)
        self._db = db
        self._api_key_cookie_name = api_key_cookie_name
        self._api_key_http_header = api_key_http_header

    def anonymous_user(self, plugin_ctx) -> UserInfo:
        return UserInfo(
            id=self._anonymous_id,
            user='unauthorized',
            fullname='Unauthorized user',
            api_key=None)

    def is_anonymous(self, user_id: int) -> bool:
        return user_id == self._anonymous_id

    def is_administrator(self, user_id: int) -> bool:
        return False

    async def corpus_access(self, user_dict: UserInfo, corpus_id: str) -> CorpusAccess:
        corpora = await self._get_permitted_corpora(user_dict)
        if corpus_id not in corpora:
            return CorpusAccess(False, False, '')
        return CorpusAccess(False, True, '')

    async def permitted_corpora(self, user_dict: UserInfo) -> List[str]:
        if self.is_anonymous(user_dict['id']):
            return []
        else:
            return await self._get_permitted_corpora(user_dict)

    async def get_user_info(self, plugin_ctx: PluginCtx) -> GetUserInfo:
        return {
            'username' if k == 'user' else k: v
            for k, v in plugin_ctx.user_dict.items()
        }

    def _get_api_key(self, plugin_ctx: PluginCtx) -> Optional[str]:
        if self._api_key_cookie_name:
            return plugin_ctx.cookies.get(self._api_key_cookie_name)
        elif self._api_key_http_header:
            return plugin_ctx.request.headers.get(self._api_key_http_header)
        return None

    async def revalidate(self, plugin_ctx: PluginCtx):
        curr_user_id = plugin_ctx.session.get('user', {'id': None})['id']
        api_key = self._get_api_key(plugin_ctx)
        if api_key:
            hash_key = hashlib.sha256(api_key.encode()).hexdigest()
            user_info = await self._find_user(hash_key)
            if self.is_anonymous(curr_user_id):
                plugin_ctx.session.clear()
            if user_info is None:
                plugin_ctx.session['user'] = self.anonymous_user(plugin_ctx)
            else:
                plugin_ctx.session['user'] = user_info
        else:
            if not self.is_anonymous(curr_user_id):
                plugin_ctx.session.clear()
            plugin_ctx.session['user'] = self.anonymous_user(plugin_ctx)

    async def _find_user(self, api_key: str) -> Optional[UserInfo]:
        async with self._db.cursor() as cursor:
            await cursor.execute('''
                SELECT t_token.user_id AS id, t_user.username, t_user.email,
                   CONCAT_WS(" ", t_user.firstname, t_user.lastname) AS fullname
                FROM kontext_api_token AS t_token
                JOIN kontext_user AS t_user ON t_user.id = t_token.user_id
                WHERE value = %s AND
                      active = 1 AND
                      valid_until >= %s
            ''', (api_key, datetime.now()))
            data = await cursor.fetchone()
        if data is None:
            return None
        return UserInfo(
            id=data['id'],
            user=data['username'],
            fullname=data['fullname'],
            email=data['email'],
            api_key=api_key)

    async def _get_permitted_corpora(self, user_dict: UserInfo) -> List[str]:
        async with self._db.cursor() as cursor:
            await cursor.execute('''
                SELECT GROUP_CONCAT(corpus_name SEPARATOR ',') AS corpora
                FROM kontext_api_token_corpus_access
                WHERE token_value = %s AND user_id = %s
            ''', (user_dict['api_key'], user_dict['id']))
            data = await cursor.fetchone()
        return [] if data['corpora'] is None else list(data['corpora'].split(','))


@plugins.inject(plugins.runtime.INTEGRATION_DB)
def create_instance(conf, integration_db: MySqlIntegrationDb):
    """
    This function must be always implemented. KonText uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    plugin_conf = conf.get('plugins', plugins.runtime.AUTH.name)
    anonymous_user_id = int(plugin_conf['anonymous_user_id'])
    cookie_name = plugin_conf.get('api_key_cookie_name', None)
    http_header = plugin_conf.get('api_key_http_header', None)
    if cookie_name is None and http_header is None:
        raise KeyError(
            'Missing settings. Please define `api_key_cookie_name` or `api_key_http_header`.')
    return TokenAuth(integration_db, anonymous_user_id, cookie_name, http_header)
