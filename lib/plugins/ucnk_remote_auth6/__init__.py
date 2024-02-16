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

import logging
import ssl
import urllib.parse
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import aiohttp
import plugins
import ujson as json
from action.plugin.ctx import PluginCtx
from plugin_types.auth import (
    AbstractRemoteAuth, CorpusAccess, GetUserInfo, UserInfo)
from plugin_types.corparch.backend import DatabaseBackend
from plugin_types.integration_db import IntegrationDatabase
from plugins import inject
from plugins.mysql_corparch.backend import Backend
from sanic import Sanic

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

    def __init__(self, db: DatabaseBackend, auth_conf: AuthConf):
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

    @property
    def _toolbar_uses_ssl(self):
        return self._auth_conf.toolbar_url.startswith('https://')

    @staticmethod
    def _mk_user_key(user_id: int) -> str:
        return f'user:{user_id}'

    async def _fetch_toolbar_api_response(
            self,
            http_client: aiohttp.ClientSession,
            args: List[Tuple[str, str]],
            cookies: Optional[Dict[str, str]] = None) -> str:
        if cookies is None:
            cookies = {}
            async with http_client.post(
                    self._auth_conf.toolbar_url,
                    headers={'Content-Type': 'application/x-www-form-urlencoded'},
                    params=args,
                    cookies=cookies,
                    timeout=self._auth_conf.toolbar_server_timeout,
                    ssl=self._ssl_context) as response:
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
        cookie_sid = plugin_ctx.cookies.get(self._auth_conf.cookie_sid, '')
        cookie_at = plugin_ctx.cookies.get(self._auth_conf.cookie_at, '')
        cookie_rmme = plugin_ctx.cookies.get(self._auth_conf.cookie_rmme, '0')
        cookie_lang = plugin_ctx.cookies.get(self._auth_conf.cookie_lang, 'en')
        api_args = [
            ('sid', cookie_sid),
            ('at', cookie_at),
            ('rmme', cookie_rmme),
            ('lang', cookie_lang),
            ('current', 'kontext'),
            ('continue', plugin_ctx.current_url)
        ]
        api_response = await self._fetch_toolbar_api_response(plugin_ctx.request.ctx.http_client, api_args)
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
            logging.getLogger(__name__).warning(
                f'>>>> changed user ID from {curr_user_id} to {response_obj["user"]["id"]}')
            plugin_ctx.clear_session()
            if response_obj['user']['id'] != self._anonymous_id:
                # user logged in => keep session data (except for credentials)
                plugin_ctx.session['user'] = UserInfo(
                    id=int(response_obj['user']['id']),
                    user=response_obj['user'].get('user'),
                    fullname='{} {}'.format(
                        response_obj['user'].get('firstName'),
                        response_obj['user'].get('surname')),
                    email=response_obj['user'].get('email'),
                    api_key=None)
                # reload available corpora from remote server
            else:  # logout => clear current user's session data and set new credentials
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


@inject(plugins.runtime.INTEGRATION_DB)
def create_instance(conf, cnc_db: IntegrationDatabase):
    logging.getLogger(__name__).info(f'ucnk_remote_auth6 uses integration_db[{cnc_db.info}]')
    backend = Backend(
        cnc_db, user_table='user', user_group_acc_attr='corplist', corp_table='corpora', corp_id_attr='id',
        group_acc_table='corplist_corpus', group_acc_group_attr='corplist_id', group_acc_corp_attr='corpus_id',
        user_acc_table='user_corpus', user_acc_corp_attr='corpus_id',
        group_pc_acc_table='corplist_parallel_corpus', group_pc_acc_pc_attr='parallel_corpus_id',
        group_pc_acc_group_attr='corplist_id', user_pc_acc_table='user_parallel_corpus',
        user_pc_acc_pc_attr='parallel_corpus_id', enable_parallel_acc=True)
    return CentralAuth(db=backend, auth_conf=AuthConf.from_conf(conf))
