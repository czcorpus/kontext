# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
import hashlib
from dataclasses import dataclass
from typing import Dict, List, Optional

import plugins
from action.plugin.ctx import PluginCtx
from plugin_types.auth import (
    AbstractRemoteAuth, CorpusAccess, GetUserInfo, UserInfo)


@dataclass
class ApiTokenZone:
    api_key: str
    user_id: int
    user_info: str
    corpora: Dict[str, str]  # normalized name => full name


class StaticAuth(AbstractRemoteAuth):

    _zones: Dict[str, ApiTokenZone]

    def __init__(self, anonymous_id, api_key_cookie_name, api_key_http_header, zones, login_url, logout_url):
        super(StaticAuth, self).__init__(anonymous_id)
        self._api_key_cookie_name = api_key_cookie_name
        self._api_key_http_header = api_key_http_header
        self._login_url = login_url
        self._logout_url = logout_url

        self._zones = {}
        for zone in zones:
            norm_corpora = {}
            for corp in zone.get('corpora', []):
                tmp = corp.split('/')
                if len(tmp) == 2:
                    norm_corpora[tmp[1].lower()] = tmp[0]
                else:
                    norm_corpora[tmp[0].lower()] = None
            self._zones[zone['api_key']] = ApiTokenZone(
                user_id=zone['user_id'],
                user_info=zone.get('user_info', 'User {}'.format(zone['user_id'])),
                api_key=zone['api_key'],
                corpora=norm_corpora)

    def anonymous_user(self, plugin_ctx) -> UserInfo:
        return UserInfo(
            id=self._anonymous_id,
            user='unauthorized',
            fullname='Unauthorized user',
            email=None,
            api_key=None)

    def _find_user(self, user_id) -> Optional[ApiTokenZone]:
        for item in self._zones.values():
            if item.user_id == user_id:
                return item
        return None

    def is_anonymous(self, user_id):
        return user_id == self._anonymous_id

    def is_administrator(self, user_id):
        return False

    async def corpus_access(self, user_dict: UserInfo, corpus_id: str) -> CorpusAccess:
        zone = self._find_user(user_dict['id'])
        if zone is None:
            return CorpusAccess(False, False, '')
        if corpus_id not in zone.corpora:
            return CorpusAccess(False, False, '')
        return CorpusAccess(False, True, zone.corpora[corpus_id])

    async def permitted_corpora(self, user_dict: UserInfo) -> List[str]:
        if self.is_anonymous(user_dict['id']):
            return []
        else:
            zone = self._find_user(user_dict['id'])
            return list(zone.corpora.keys())

    async def get_user_info(self, plugin_ctx: PluginCtx) -> GetUserInfo:
        return {
            'username' if k == 'user' else k: v
            for k, v in plugin_ctx.user_dict.items()
        }

    def _hash_key(self, k):
        if not k:
            return None
        return hashlib.sha256(k.encode()).hexdigest()

    def _get_api_key(self, plugin_ctx: PluginCtx):
        if self._api_key_cookie_name:
            return plugin_ctx.cookies.get(self._api_key_cookie_name)
        elif self._api_key_http_header:
            return plugin_ctx.request.headers.get(self._api_key_http_header)

    async def revalidate(self, plugin_ctx):
        curr_user_id = plugin_ctx.session.get('user', {'id': None})['id']
        api_key = self._get_api_key(plugin_ctx)
        hash_key = self._hash_key(api_key)
        if api_key and hash_key in self._zones:
            zone = self._zones[hash_key]
            if self.is_anonymous(curr_user_id):
                plugin_ctx.session.clear()
            plugin_ctx.session['user'] = dict(
                id=zone.user_id, user='api_user', fullname=zone.user_info)
        else:
            if not self.is_anonymous(curr_user_id):
                plugin_ctx.session.clear()
            plugin_ctx.session['user'] = self.anonymous_user(plugin_ctx)

    def get_login_url(self, return_url=None):
        return self._login_url

    def get_logout_url(self, return_url=None):
        return self._logout_url


def create_instance(conf):
    """
    This function must be always implemented. KonText uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    plugin_conf = conf.get('plugins', plugins.runtime.AUTH.name)
    custom_conf = conf.get_plugin_custom_conf(plugins.runtime.AUTH.name)
    return StaticAuth(
        anonymous_id=int(plugin_conf['anonymous_user_id']),
        api_key_cookie_name=custom_conf.get('api_key_cookie_name', None),
        api_key_http_header=custom_conf['api_key_http_header'],
        zones=custom_conf['zones'],
        login_url=plugin_conf['login_url'],
        logout_url=plugin_conf['login_url'])
