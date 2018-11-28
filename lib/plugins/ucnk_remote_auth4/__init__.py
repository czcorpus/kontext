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

import urllib
import httplib
import json
import ssl
import logging

import plugins
from plugins.abstract.auth import AbstractRemoteAuth
from plugins import inject
from plugins.ucnk_remote_auth4.backend.mysql import Backend, MySQLConf


IMPLICIT_CORPUS = 'susanne'


class ToolbarConf(object):
    def __init__(self, conf):
        self.server = conf.get('plugins', 'auth')['ucnk:toolbar_server']
        self.path = conf.get('plugins', 'auth')['ucnk:toolbar_path']
        self.port = int(conf.get('plugins', 'auth')['ucnk:toolbar_port'])


class AuthConf(object):
    def __init__(self, conf):
        self.login_url = conf.get('plugins', 'auth')['login_url']
        self.logout_url = conf.get('plugins', 'auth')['logout_url']
        self.anonymous_user_id = int(conf.get('plugins', 'auth')['anonymous_user_id'])
        self.toolbar_server_timeout = int(conf.get('plugins', 'auth')[
                                          'ucnk:toolbar_server_timeout'])
        self.api_cookies = conf.get('plugins', 'auth', {}).get('ucnk:api_cookies', [])
        self.unverified_ssl_cert = bool(int(conf.get('plugins', 'auth', {}).get(
            'ucnk:toolbar_unverified_ssl_cert', '0')))


class CentralAuth(AbstractRemoteAuth):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    def __init__(self, db, sessions, conf, toolbar_conf):
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
                return httplib.HTTPSConnection(self._toolbar_conf.server,
                                               port=self._toolbar_conf.port,
                                               timeout=self._conf.toolbar_server_timeout,
                                               context=self._ssl_context)
            else:
                return httplib.HTTPSConnection(self._toolbar_conf.server,
                                               port=self._toolbar_conf.port,
                                               timeout=self._conf.toolbar_server_timeout)
        else:
            return httplib.HTTPConnection(self._toolbar_conf.server,
                                          port=self._toolbar_conf.port,
                                          timeout=self._conf.toolbar_server_timeout)

    def _fetch_toolbar_api_response(self, args):
        connection = self._create_connection()
        try:
            connection.request('GET', self._toolbar_conf.path + '?' + urllib.urlencode(args))
            response = connection.getresponse()
            if response and response.status == 200:
                return response.read().decode('utf-8')
            else:
                raise Exception('Failed to load data from authentication server (UCNK toolbar): %s' % (
                    'status %s' % response.status if response else 'unknown error'))
        finally:
            connection.close()

    def revalidate(self, plugin_api):
        """
        User re-validation as required by plug-in specification. The method
        catches no exceptions which means that in case of a problem with response
        from the authentication server (aka "CNC toolbar") KonText re-sets user to
        anonymous and shows an error message to a user.

        Method also stores the response for CNC toolbar to prevent an extra API call.
        """
        curr_user_id = plugin_api.session.get('user', {'id': None})['id']

        api_args = map(lambda x: (x[0][len('cnc_toolbar_'):], x[1].value),
                       filter(lambda x: x[0] in self._conf.api_cookies, plugin_api.cookies.items()))
        api_args.extend([('current',  'kontext'), ('continue', plugin_api.current_url)])
        api_response = self._fetch_toolbar_api_response(api_args)
        response_obj = json.loads(api_response)
        plugin_api.set_shared('toolbar', response_obj)  # toolbar plug-in will access this

        if 'redirect' in response_obj:
            plugin_api.redirect(response_obj['redirect'])

        if 'user' not in response_obj:
            response_obj['user'] = {}
        if 'id' not in response_obj['user']:
            response_obj['user']['id'] = self._anonymous_id
        else:
            # just to make sure we work with proper type (the response_obj is a 3rd party stuff)
            response_obj['user']['id'] = int(response_obj['user']['id'])

        if curr_user_id != response_obj['user']['id']:
            plugin_api.refresh_session_id()
            if response_obj['user']['id'] != self._anonymous_id:
                # user logged in => keep session data (except for credentials)
                plugin_api.session['user'] = dict(
                    id=int(response_obj['user']['id']),
                    user=response_obj['user'].get('user'),
                    fullname=u'%s %s' % (response_obj['user'].get('firstName'),
                                         response_obj['user'].get('surname')),
                    email=response_obj['user'].get('email'))
                # reload available corpora from remote server
            else:  # logout => clear current user's session data and set new credentials
                plugin_api.session.clear()
                plugin_api.session['user'] = self.anonymous_user()

    def permitted_corpora(self, user_dict):
        """
        Fetches list of corpora available to the current user

        arguments:
        user_dict -- a user credentials dictionary

        returns:
        a dict (corpus_id, corpus_variant)
        """
        corpora = self._db.get_permitted_corpora(user_dict['id'])
        if (IMPLICIT_CORPUS, None) not in corpora:
            corpora.append((IMPLICIT_CORPUS, None))
        return dict((c, pref) for c, pref in corpora)

    def get_user_info(self, plugin_api):
        ans = {}
        ans.update(plugin_api.user_dict)
        ans['username'] = ans['user']
        del (ans['user'])
        return ans

    def is_administrator(self, user_id):
        """
        Currently not supported (always returns False)
        """
        return False

    def get_login_url(self, return_url=None):
        return self._conf.login_url % (urllib.quote(return_url) if return_url is not None else '')

    def get_logout_url(self, return_url=None):
        return self._conf.logout_url % (urllib.quote(return_url) if return_url is not None else '')


@inject(plugins.runtime.SESSIONS)
def create_instance(conf, sessions):
    backend = Backend(MySQLConf(conf))
    return CentralAuth(db=backend, sessions=sessions, conf=AuthConf(conf),
                       toolbar_conf=ToolbarConf(conf))
