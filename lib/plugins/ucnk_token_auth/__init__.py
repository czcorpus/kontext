# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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
this module contains a UCNK-specific token authentication plug-in for KonText running
as an API instance.
"""
import logging
import ssl
from dataclasses import dataclass
from typing import Dict, List, Optional

import aiohttp
import plugins
import ujson as json
from action.control import http_action
from action.krequest import KRequest
from action.model.user import UserActionModel
from action.plugin.ctx import PluginCtx
from action.response import KResponse
from plugin_types.auth import (
    AbstractRemoteTokenAuth, CorpusAccess, GetUserInfo, UserInfo)
from plugin_types.corparch.backend import DatabaseBackend
from plugin_types.integration_db import IntegrationDatabase
from plugins import inject
from plugins.mysql_corparch.backend import Backend
from sanic import Sanic
from sanic.blueprints import Blueprint

IMPLICIT_CORPUS = 'susanne'

bp = Blueprint('ucnk_token_auth')


@dataclass
class TokenAuthConf:
    login_url: str
    logout_url: str
    anonymous_user_id: int
    toolbar_url: str
    toolbar_server_timeout: int
    cookie_sid: str  # this is used on the KonText <--> authentication server side
    api_key_header: str  # this is used on the client <--> KonText side
    unverified_ssl_cert: bool

    @staticmethod
    def from_conf(conf) -> 'TokenAuthConf':
        return TokenAuthConf(
            login_url=conf.get('plugins', 'auth')['login_url'],
            logout_url=conf.get('plugins', 'auth')['logout_url'],
            anonymous_user_id=int(conf.get('plugins', 'auth')['anonymous_user_id']),
            toolbar_url=conf.get('plugins', 'auth')['toolbar_url'],
            toolbar_server_timeout=int(conf.get('plugins', 'auth')['toolbar_server_timeout']),
            api_key_header=conf.get('plugins', 'auth')['api_key_header'],
            cookie_sid=conf.get('plugins', 'auth')['cookie_sid'],
            unverified_ssl_cert=bool(int(conf.get('plugins', 'auth', {}).get('toolbar_unverified_ssl_cert', '0'))))


@bp.route('/token/authenticate', methods=['POST'])
@http_action(access_level=0, return_type='json', action_model=UserActionModel)
async def token_login(amodel: UserActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.AUTH as auth_plg:
        return await auth_plg.authenticate(amodel.plugin_ctx, req.form.get('t'))


class UCNKTokenAuth(AbstractRemoteTokenAuth):

    def __init__(self, db: DatabaseBackend, auth_conf: TokenAuthConf):
        """
        arguments:
        db -- a key-value storage plug-in
        conf -- a 'settings' module
        """
        super().__init__(auth_conf.anonymous_user_id)
        self._db = db
        self._auth_conf = auth_conf
        try:
            if self._auth_conf.unverified_ssl_cert:
                self._ssl_context = ssl._create_unverified_context() if self._toolbar_uses_ssl else None
            else:
                self._ssl_context = ssl.create_default_context() if self._toolbar_uses_ssl else None
        except AttributeError:
            logging.getLogger(__name__).warning(
                'Using fallback https client initialization due to older Python version.')
            self._ssl_context = None

    async def corpus_access(self, user_dict: UserInfo, corpus_name: str) -> CorpusAccess:
        if corpus_name == IMPLICIT_CORPUS:
            return CorpusAccess(False, True, '')
        async with self._db.cursor() as cursor:
            _, access, variant = await self._db.corpus_access(cursor, user_dict['id'], corpus_name)
        return CorpusAccess(False, access, variant)

    async def permitted_corpora(self, user_dict: UserInfo) -> List[str]:
        """
        Fetches list of corpora available to the current user

        arguments:
        user_dict -- a user credentials dictionary
        """
        async with self._db.cursor() as cursor:
            corpora = await self._db.get_permitted_corpora(cursor, str(user_dict['id']))
        if IMPLICIT_CORPUS not in corpora:
            corpora.append(IMPLICIT_CORPUS)
        return corpora

    async def get_user_info(self, plugin_ctx: 'PluginCtx') -> GetUserInfo:
        return {
            'username' if k == 'user' else k: v
            for k, v in plugin_ctx.user_dict.items()
        }

    def get_login_url(self, return_url: Optional[str] = None) -> str:
        return self._auth_conf.login_url

    def get_logout_url(self, return_url: Optional[str] = None) -> str:
        return self._auth_conf.logout_url

    @property
    def _toolbar_uses_ssl(self):
        return self._auth_conf.toolbar_url.startswith('https://')

    async def _fetch_toolbar_api_response(self, http_client, cookies: Dict[str, str]) -> str:
        if cookies is None:
            cookies = {}
        async with http_client.post(
                self._auth_conf.toolbar_url,
                cookies=cookies,
                timeout=self._auth_conf.toolbar_server_timeout,
                ssl=self._ssl_context) as response:
            if response.status == 200:
                return (await response.read()).decode('utf-8')
            else:
                raise Exception(
                    f'Failed to load data from authentication server (UCNK toolbar): status {response.status}'
                )

    async def authenticate(self, plugin_ctx: 'PluginCtx', token_id):
        async with plugin_ctx.request.ctx.http_client.post(
                self._auth_conf.login_url,
                data={'personal_access_token': token_id},
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
                timeout=self._auth_conf.toolbar_server_timeout,
                ssl=self._ssl_context) as response:
            if response.status == 200:
                return dict(x_api_key=response.cookies[self._auth_conf.cookie_sid].value)
            else:
                raise Exception(
                    f'Failed to load data from authentication server (UCNK toolbar): status {response.status}'
                )

    async def revalidate(self, plugin_ctx: PluginCtx):
        curr_user_id = plugin_ctx.session.get('user', {'id': None})['id']
        cookie_sid = plugin_ctx.request.headers.get(self._auth_conf.api_key_header)
        response_obj = json.loads(await self._fetch_toolbar_api_response({self._auth_conf.cookie_sid: cookie_sid}))
        if 'user' not in response_obj or 'id' not in response_obj['user']:
            response_obj['user'] = {'id': self._anonymous_id, 'user': 'anonymous'}
        response_obj['user']['id'] = int(response_obj['user']['id'])
        if curr_user_id != response_obj['user']['id']:
            plugin_ctx.clear_session()
            if response_obj['user']['id'] != self._anonymous_id:
                # user logged in => keep session data (except for credentials)
                plugin_ctx.session['user'] = UserInfo(
                    id=int(response_obj['user']['id']),
                    user=response_obj['user'].get('user'),
                    fullname='{} {}'.format(
                        response_obj['user'].get('firstName'), response_obj['user'].get('surname')),
                    email=response_obj['user'].get('email'),
                    api_key=None)
                # reload available corpora from remote server
            else:  # logout => clear current user's session data and set new credentials
                plugin_ctx.session.update(dict(user=self.anonymous_user(plugin_ctx)))

    @staticmethod
    def export_actions():
        return bp


@inject(plugins.runtime.INTEGRATION_DB)
def create_instance(conf, cnc_db: IntegrationDatabase):
    logging.getLogger(__name__).info(f'ucnk_token_auth uses integration_db[{cnc_db.info}]')
    backend = Backend(
        cnc_db, user_table='user', user_group_acc_attr='corplist', corp_table='corpora', corp_id_attr='id',
        group_acc_table='corplist_corpus', group_acc_group_attr='corplist_id', group_acc_corp_attr='corpus_id',
        user_acc_table='user_corpus', user_acc_corp_attr='corpus_id',
        group_pc_acc_table='corplist_parallel_corpus', group_pc_acc_pc_attr='parallel_corpus_id',
        group_pc_acc_group_attr='corplist_id', user_pc_acc_table='user_parallel_corpus',
        user_pc_acc_pc_attr='parallel_corpus_id', enable_parallel_acc=True)
    return UCNKTokenAuth(db=backend, auth_conf=TokenAuthConf.from_conf(conf))
