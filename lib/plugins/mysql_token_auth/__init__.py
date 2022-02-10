# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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
A simple auth for users with private API key.

Please note that this is not intended for installation with many
users as sharing a single token between many people is not
very secure.

required xml conf: please see ./config.rng
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from dataclasses import dataclass
import hashlib

from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursor
from controller.plg import PluginCtx

import plugins
from plugins.abstract.auth import AbstractRemoteAuth, CorpusAccess, UserInfo
from plugins.abstract.integration_db import IntegrationDatabase


class ApiUserInfo(UserInfo):
    api_key: Optional[str]


class TokenAuth(AbstractRemoteAuth):

    def __init__(
        self,
        db: IntegrationDatabase[MySQLConnection, MySQLCursor],
        anonymous_id: int,
        api_key_cookie_name: Optional[str],
        api_key_http_header: Optional[str],
    ):

        super(TokenAuth, self).__init__(anonymous_id)
        self._db = db
        self._api_key_cookie_name = api_key_cookie_name
        self._api_key_http_header = api_key_http_header

    def anonymous_user(self) -> ApiUserInfo:
        return ApiUserInfo(
            id=self._anonymous_id,
            user='unauthorized',
            fullname='Unauthorized user',
            api_key=None,
        )

    def is_anonymous(self, user_id: int) -> bool:
        return user_id == self._anonymous_id

    def is_administrator(self, user_id: int) -> bool:
        return False

    def corpus_access(self, user_dict: ApiUserInfo, corpus_id: str) -> CorpusAccess:
        corpora = self._get_permitted_corpora(user_dict)
        if corpus_id not in corpora:
            return False, False, ''
        return False, True, corpus_id

    def permitted_corpora(self, user_dict: ApiUserInfo) -> List[str]:
        if self.is_anonymous(user_dict['id']):
            return []
        else:
            return self._get_permitted_corpora(user_dict)

    def get_user_info(self, plugin_ctx: PluginCtx) -> ApiUserInfo:
        return plugin_ctx.session['user']

    def _get_api_key(self, plugin_ctx: PluginCtx) -> Optional[str]:
        if self._api_key_cookie_name:
            api_key_cookie = plugin_ctx.cookies.get('api_key')
            return api_key_cookie.value if api_key_cookie else None
        elif self._api_key_http_header:
            key = 'HTTP_{0}'.format(self._api_key_http_header.upper().replace('-', '_'))
            return plugin_ctx.get_from_environ(key)
        return None

    def revalidate(self, plugin_ctx: PluginCtx):
        curr_user_id = plugin_ctx.session.get('user', {'id': None})['id']
        api_key = self._get_api_key(plugin_ctx)
        if api_key:
            user_info = self._find_user(api_key)
            if self.is_anonymous(curr_user_id):
                plugin_ctx.session.clear()
            if user_info is None:
                plugin_ctx.session['user'] = self.anonymous_user()
            else:
                plugin_ctx.session['user'] = user_info
        else:
            if not self.is_anonymous(curr_user_id):
                plugin_ctx.session.clear()
            plugin_ctx.session['user'] = self.anonymous_user()

    def _find_user(self, api_key: str) -> Optional[UserInfo]:
        with self._db.cursor() as cursor:
            cursor.execute('''
                SELECT t_token.user_id AS id, t_user.username, CONCAT_WS(" ", t_user.firstname, t_user.lastname) AS fullname
                FROM kontext_api_token AS t_token
                JOIN kontext_user AS t_user
                WHERE value = %s AND
                      active = 1 AND
                      valid_until >= %s
            ''', (api_key, datetime.now()))
            data = cursor.fetchone()
            if data is None:
                return None
            return UserInfo(data['id'], data['username'], data['fullname'], api_key)

    def _get_permitted_corpora(self, user_dict: ApiUserInfo) -> List[str]:
        with self._db.cursor() as cursor:
            cursor.execute('''
                SELECT GROUP_CONCAT(t2.corpus_name SEPARATOR ',') AS corpora
                FROM kontext_api_token AS t1
                JOIN kontext_api_token_corpus_access AS t2
                ON t1.value = t2.token_value AND
                   t1.user_id = t2.user_id
                WHERE t1.value = %s AND
                      t1.user_id = %s AND
                      t1.active = 1 AND
                      t1.valid_until >= %s
            ''', (user_dict['api_key'], user_dict['user_id'], datetime.now()))
            return list(cursor.fetchone()['corpora'].split(','))


@plugins.inject(plugins.runtime.INTEGRATION_DB)
def create_instance(conf, integration_db: IntegrationDatabase[MySQLConnection, MySQLCursor]):
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
