# Copyright (c) 2022 Institute of the Czech National Corpus
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

"""
This is the 6-generation of UCNK-specific authentication module.
The main difference between this version and the previous (5) is:

1) adoption of async/await for IO operations (aiohttp in this case)
2) access rights for a new entity "kontext_parallel_corpus" which
   groups mutually aligned corpora

The key principle remains the same in this version:
All the authentication operations are left on an external
HTTP service accessed via an internal network.
Once the service receives a specific cookie-stored token,
it returns two values (everything is JSON-encoded):

1. user credentials and authentication status
2. HTML code for the ucnk_appbar3 plugin (top bar toolbar)

The ucnk_remote_auth6 plug-in stores the received HTML code into a special
'shared' storage for ucnk_appbar3 (which, in consequence, does not have to
trigger another HTTP request to get its HTML code).

Required config.xml/plugins entries (RelaxNG compact format): please see config.rng
"""

from typing import List, Optional, Tuple
import urllib.parse
import ujson as json
import ssl
import logging
import aiohttp
from dataclasses import dataclass

from secure_cookie.session import Session
from action.plugin.ctx import PluginCtx

from plugin_types.auth import AbstractRemoteAuth, CorpusAccess, GetUserInfo, UserInfo
from plugin_types.corparch.backend import DatabaseBackend
from plugin_types.integration_db import IntegrationDatabase
import plugins
from plugins import inject
from plugins.mysql_corparch.backend import Backend


IMPLICIT_CORPUS = 'susanne'


@dataclass
class AuthConf:
    login_url: str
    logout_url: str
    anonymous_user_id: int
    toolbar_url: str
    toolbar_server_timeout: int
    cookie_sid: str
    cookie_at: str
    cookie_rmme: str
    cookie_lang: str
    unverified_ssl_cert: bool

    @staticmethod
    def from_conf(conf) -> 'AuthConf':
        return AuthConf(
            conf.get('plugins', 'auth')['login_url'],
            conf.get('plugins', 'auth')['logout_url'],
            int(conf.get('plugins', 'auth')['anonymous_user_id']),
            conf.get('plugins', 'auth')['toolbar_url'],
            int(conf.get('plugins', 'auth')['toolbar_server_timeout']),
            conf.get('plugins', 'auth')['cookie_sid'],
            conf.get('plugins', 'auth')['cookie_at'],
            conf.get('plugins', 'auth')['cookie_rmme'],
            conf.get('plugins', 'auth')['cookie_lang'],
            bool(int(conf.get('plugins', 'auth', {}).get('toolbar_unverified_ssl_cert', '0'))),
        )


class CentralAuth(AbstractRemoteAuth):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    def __init__(self, db: DatabaseBackend, sessions: Session, auth_conf: AuthConf):
        """
        arguments:
        db -- a key-value storage plug-in
        sessions -- a sessions plug-in
        conf -- a 'settings' module
        """
        super().__init__(auth_conf.anonymous_user_id)
        self._db = db
        self._sessions = sessions
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

    @staticmethod
    def _mk_user_key(user_id: int) -> str:
        return f'user:{user_id}'

    def _create_session(self) -> aiohttp.ClientSession:
        timeout = aiohttp.ClientTimeout(total=self._auth_conf.toolbar_server_timeout)
        if self._ssl_context is not None:
            return aiohttp.ClientSession(
                connector=aiohttp.TCPConnector(ssl_context=self._ssl_context),
                timeout=timeout,
                headers={'Content-Type': 'application/x-www-form-urlencoded'},
            )
        return aiohttp.ClientSession(
            timeout=timeout,
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
        )

    async def _fetch_toolbar_api_response(self, args: List[Tuple[str, str]]) -> str:
        async with self._create_session() as session:
            async with session.post(self._auth_conf.toolbar_url, params=args) as response:
                if response.status == 200:
                    return (await response.read()).decode('utf-8')
                else:
                    raise Exception(
                        f'Failed to load data from authentication server (UCNK toolbar): status {response.status}'
                    )

    async def revalidate(self, plugin_ctx: PluginCtx):
        """
        User re-validation as required by plug-in specification. The method
        catches no exceptions which means that in case of a problem with response
        from the authentication server (aka "CNC toolbar") KonText re-sets user to
        anonymous and shows an error message to a user.

        Method also stores the response for CNC toolbar to prevent an extra API call.
        """
        curr_user_id = plugin_ctx.session.get('user', {'id': None})['id']
        cookie_sid = plugin_ctx.cookies[
            self._auth_conf.cookie_sid] if self._auth_conf.cookie_sid in plugin_ctx.cookies else ''
        cookie_at = plugin_ctx.cookies[
            self._auth_conf.cookie_at] if self._auth_conf.cookie_at in plugin_ctx.cookies else ''
        cookie_rmme = plugin_ctx.cookies[
            self._auth_conf.cookie_rmme] if self._auth_conf.cookie_rmme in plugin_ctx.cookies else '0'
        cookie_lang = plugin_ctx.cookies[
            self._auth_conf.cookie_lang] if self._auth_conf.cookie_lang in plugin_ctx.cookies else 'en'
        api_args = [
            ('sid', cookie_sid),
            ('at', cookie_at),
            ('rmme', cookie_rmme),
            ('lang', cookie_lang),
            ('current', 'kontext'),
            ('continue', plugin_ctx.current_url)
        ]
        api_response = await self._fetch_toolbar_api_response(api_args)
        response_obj = json.loads(api_response)
        plugin_ctx.set_shared('toolbar', response_obj)  # toolbar plug-in will access this

        if 'redirect' in response_obj:
            plugin_ctx.redirect(response_obj['redirect'])

        if 'user' not in response_obj:
            response_obj['user'] = {}
        if 'id' not in response_obj['user']:
            response_obj['user']['id'] = self._anonymous_id
        else:
            # just to make sure we work with proper type (the response_obj is a 3rd party stuff)
            response_obj['user']['id'] = int(response_obj['user']['id'])

        if curr_user_id != response_obj['user']['id']:
            plugin_ctx.refresh_session_id()
            if response_obj['user']['id'] != self._anonymous_id:
                # user logged in => keep session data (except for credentials)
                plugin_ctx.session['user'] = UserInfo(
                    id=int(response_obj['user']['id']),
                    user=response_obj['user'].get('user'),
                    fullname='%s %s' % (response_obj['user'].get('firstName'),
                                        response_obj['user'].get('surname')),
                    email=response_obj['user'].get('email'),
                    api_key=None)
                # reload available corpora from remote server
            else:  # logout => clear current user's session data and set new credentials
                plugin_ctx.session.clear()
                plugin_ctx.session['user'] = self.anonymous_user(plugin_ctx)

    async def corpus_access(self, user_dict, corpus_name: str) -> CorpusAccess:
        if corpus_name == IMPLICIT_CORPUS:
            return CorpusAccess(False, True, '')
        async with self._db.cursor() as cursor:
            _, access, variant = await self._db.corpus_access(cursor, user_dict['id'], corpus_name)
        return CorpusAccess(False, access, variant)

    async def permitted_corpora(self, user_dict):
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

    async def get_user_info(self, plugin_ctx: PluginCtx) -> GetUserInfo:
        return {
            'username' if k == 'user' else k: v
            for k, v in plugin_ctx.user_dict.items()
        }

    def is_administrator(self, user_id: int) -> bool:
        """
        Currently not supported (always returns False)
        """
        return False

    def get_login_url(self, return_url: Optional[str] = None) -> str:
        return self._auth_conf.login_url % (urllib.parse.quote(return_url) if return_url is not None else '')

    def get_logout_url(self, return_url: Optional[str] = None) -> str:
        return self._auth_conf.logout_url % (urllib.parse.quote(return_url) if return_url is not None else '')


@inject(plugins.runtime.SESSIONS, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, sessions: Session, cnc_db: IntegrationDatabase):
    logging.getLogger(__name__).info(f'ucnk_remote_auth6 uses integration_db[{cnc_db.info}]')
    backend = Backend(
        cnc_db, user_table='user', corp_table='corpora', corp_id_attr='id',
        group_acc_table='relation', group_acc_group_attr='corplist', group_acc_corp_attr='corpora',
        user_acc_table='user_corpus_relation', user_acc_corp_attr='corpus_id',
        group_pc_acc_table='corplist_parallel_corpus', group_pc_acc_pc_attr='parallel_corpus_id',
        group_pc_acc_group_attr='corplist_id', user_pc_acc_table='user_parallel_corpus',
        user_pc_acc_pc_attr='parallel_corpus_id', enable_parallel_acc=True)
    return CentralAuth(db=backend, sessions=sessions, auth_conf=AuthConf.from_conf(conf))
