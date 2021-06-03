# Copyright (c) 2013 Institute of the Czech National Corpus
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
This is the 4-generation of UCNK-specific authentication module.
It leaves all the authentication and authorization on an external
HTTP service. Once the service receives a specific cookie-stored token,
it returns two values (everything is JSON-encoded):

1. user credentials and authentication status
2. HTML code for the ucnk_appbar3 plugin (top bar toolbar)

The ucnk_remote_auth4 plug-in stores the received HTML code into a special
'shared' storage for ucnk_appbar3 (which, in consequence, does not have to
produce another HTTP request).

Required config.xml/plugins entries (RelaxNG compact format): please see config.rng
"""

import urllib.request
import urllib.parse
import urllib.error
import http.client
import json
import ssl
import logging

import plugins
from plugins.abstract.auth import AbstractRemoteAuth
from plugins.abstract.corparch.backend import DatabaseBackend
from plugins import inject
from plugins.mysql_corparch.backend import Backend


IMPLICIT_CORPUS = 'susanne'


class ToolbarConf(object):
    def __init__(self, conf):
        self.server = conf.get('plugins', 'auth')['toolbar_server']
        self.path = conf.get('plugins', 'auth')['toolbar_path']
        self.port = int(conf.get('plugins', 'auth')['toolbar_port'])


class AuthConf(object):
    def __init__(self, conf):
        self.login_url = conf.get('plugins', 'auth')['login_url']
        self.logout_url = conf.get('plugins', 'auth')['logout_url']
        self.anonymous_user_id = int(conf.get('plugins', 'auth')['anonymous_user_id'])
        self.toolbar_server_timeout = int(conf.get('plugins', 'auth')[
                                          'toolbar_server_timeout'])
        self.cookie_sid = conf.get('plugins', 'auth')['cookie_sid']
        self.cookie_at = conf.get('plugins', 'auth')['cookie_at']
        self.cookie_rmme = conf.get('plugins', 'auth')['cookie_rmme']
        self.cookie_lang = conf.get('plugins', 'auth')['cookie_lang']
        self.unverified_ssl_cert = bool(int(conf.get('plugins', 'auth', {}).get(
            'toolbar_unverified_ssl_cert', '0')))


class CentralAuth(AbstractRemoteAuth):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    def __init__(self, db: DatabaseBackend, sessions, conf: AuthConf, toolbar_conf: ToolbarConf):
        """
        arguments:
        db -- a key-value storage plug-in
        sessions -- a sessions plug-in
        conf -- a 'settings' module
        """
        super(CentralAuth, self).__init__(conf.anonymous_user_id)
        self._db = db
        self._sessions = sessions
        self._toolbar_conf = toolbar_conf
        self._conf = conf
        try:
            if self._conf.unverified_ssl_cert:
                self._ssl_context = ssl._create_unverified_context() if self._toolbar_uses_ssl else None
            else:
                self._ssl_context = ssl.create_default_context() if self._toolbar_uses_ssl else None
        except AttributeError:
            logging.getLogger(__name__).warning(
                'Using fallback https client initialization due to older Python version.')
            self._ssl_context = None

    @staticmethod
    def _mk_user_key(user_id):
        return 'user:%d' % user_id

    @property
    def _toolbar_uses_ssl(self):
        return self._toolbar_conf.port == 443

    def _create_connection(self):
        if self._toolbar_uses_ssl:
            if self._ssl_context is not None:
                return http.client.HTTPSConnection(self._toolbar_conf.server,
                                                   port=self._toolbar_conf.port,
                                                   timeout=self._conf.toolbar_server_timeout,
                                                   context=self._ssl_context)
            else:
                return http.client.HTTPSConnection(self._toolbar_conf.server,
                                                   port=self._toolbar_conf.port,
                                                   timeout=self._conf.toolbar_server_timeout)
        else:
            return http.client.HTTPConnection(self._toolbar_conf.server,
                                              port=self._toolbar_conf.port,
                                              timeout=self._conf.toolbar_server_timeout)

    def _fetch_toolbar_api_response(self, args):
        connection = self._create_connection()
        try:
            connection.request('POST', self._toolbar_conf.path, urllib.parse.urlencode(args),
                               {'Content-Type': 'application/x-www-form-urlencoded'})
            response = connection.getresponse()
            if response and response.status == 200:
                return response.read().decode('utf-8')
            else:
                raise Exception('Failed to load data from authentication server (UCNK toolbar): %s' % (
                    'status %s' % response.status if response else 'unknown error'))
        finally:
            connection.close()

    def revalidate(self, plugin_ctx):
        """
        User re-validation as required by plug-in specification. The method
        catches no exceptions which means that in case of a problem with response
        from the authentication server (aka "CNC toolbar") KonText re-sets user to
        anonymous and shows an error message to a user.

        Method also stores the response for CNC toolbar to prevent an extra API call.
        """
        curr_user_id = plugin_ctx.session.get('user', {'id': None})['id']
        cookie_sid = plugin_ctx.cookies[
            self._conf.cookie_sid].value if self._conf.cookie_sid in plugin_ctx.cookies else ''
        cookie_at = plugin_ctx.cookies[
            self._conf.cookie_at].value if self._conf.cookie_at in plugin_ctx.cookies else ''
        cookie_rmme = plugin_ctx.cookies[
            self._conf.cookie_rmme].value if self._conf.cookie_rmme in plugin_ctx.cookies else '0'
        cookie_lang = plugin_ctx.cookies[
            self._conf.cookie_lang].value if self._conf.cookie_lang in plugin_ctx.cookies else 'en'
        api_args = [
            ('sid', cookie_sid),
            ('at', cookie_at),
            ('rmme', cookie_rmme),
            ('lang', cookie_lang),
            ('current', 'kontext'),
            ('continue', plugin_ctx.current_url)
        ]
        api_response = self._fetch_toolbar_api_response(api_args)
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
                plugin_ctx.session['user'] = dict(
                    id=int(response_obj['user']['id']),
                    user=response_obj['user'].get('user'),
                    fullname='%s %s' % (response_obj['user'].get('firstName'),
                                        response_obj['user'].get('surname')),
                    email=response_obj['user'].get('email'))
                # reload available corpora from remote server
            else:  # logout => clear current user's session data and set new credentials
                plugin_ctx.session.clear()
                plugin_ctx.session['user'] = self.anonymous_user()

    def corpus_access(self, user_dict, corpus_name):
        if corpus_name == IMPLICIT_CORPUS:
            return False, True, ''
        _, access, variant = self._db.corpus_access(user_dict['id'], corpus_name)
        return False, access, variant

    def permitted_corpora(self, user_dict):
        """
        Fetches list of corpora available to the current user

        arguments:
        user_dict -- a user credentials dictionary
        """
        corpora = self._db.get_permitted_corpora(user_dict['id'])
        if IMPLICIT_CORPUS not in corpora:
            corpora.append(IMPLICIT_CORPUS)
        return corpora

    def get_user_info(self, plugin_ctx):
        ans = {}
        ans.update(plugin_ctx.user_dict)
        ans['username'] = ans['user']
        del (ans['user'])
        return ans

    def is_administrator(self, user_id):
        """
        Currently not supported (always returns False)
        """
        return False

    def get_login_url(self, return_url=None):
        return self._conf.login_url % (urllib.parse.quote(return_url) if return_url is not None else '')

    def get_logout_url(self, return_url=None):
        return self._conf.logout_url % (urllib.parse.quote(return_url) if return_url is not None else '')


@inject(plugins.runtime.SESSIONS, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, sessions, cnc_db):
    logging.getLogger(__name__).info(f'ucnk_remote_auth5 uses integration_db[{cnc_db.info}]')
    backend = Backend(
        cnc_db, user_table='user', corp_table='corpora', group_acc_table='relation',
        user_acc_table='user_corpus_relation', user_acc_corp_attr='corpus_id', group_acc_corp_attr='corpora',
        group_acc_group_attr='corplist')
    return CentralAuth(db=backend, sessions=sessions, conf=AuthConf(conf),
                       toolbar_conf=ToolbarConf(conf))
