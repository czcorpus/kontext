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
This is a specific authentication module as used by the Institute
of The Czech National Corpus. It obtains a user status via
a custom HTTP service (aka "CNC toolbar"). When asked about passed
cookie-stored identifier, the remote service returns two values mixed
into one:

1. an HTML code for KonText's application bar (= a part of KonText's web interface)
2. a JSON inserted in a <div> element containing current user credentials

(note: the search pattern to extract the JSON part is defined
here in CentralAuth.UCNK_TOOLBAR_PATTERN)

Because there is also a UCNK-specific plug-in "ucnk_appbar" which
requires the HTML part of the response, the ucnk_remote_auth2 plug-in
stores the received HTML code into user's session where it is available for
later pick-up. (Please note that KonText plug-ins cannot send user/request
data to each other). This prevents additional HTTP request from ucnk_appbar.

Required config.xml/plugins entries (RelaxNG compact format):

element auth {
    element module { "ucnk_remote_auth3" }
    element auth_cookie_name {
        text  # name of a cookie used to store KonText's internal auth ID
    }
    element api_cookies {
        attribute extension-by { "ucnk" }
        element item { text }*  # a list of cnc_toolbar_* cookies to be passed to API as arguments
    }
    element login_url {
        text  # URL where KonText redirects user to log her in; placeholders can be used
    }
    element logout_url {
        text  # URL where KonText redirects user to log her out; placeholders can be used
    }
    element toolbar_server {
        attribute extension-by { "ucnk" }
        text  # authentication service address (without path part)
    }
    element toolbar_port {
        attribute extension-by { "ucnk" }
        text  # TCP port used by the external service
    }
    element toolbar_path {
        attribute extension-by { "ucnk" }
        text  # path part of the service; placeholders are supported
    }
    element toolbar_server_timeout {
        attribute extension-by { "ucnk" }
        xsd:integer  # number of seconds to wait for the response
    }
    element sync_host {
        attribute extension-by { "ucnk" }
        text # hostname of a remote MySQL server
    }
    element sync_db {
        attribute extension-by { "ucnk" }
        text # database name
    }
    element sync_user {
        attribute extension-by { "ucnk" }
        text # database username
    }
    element sync_passwd {
        attribute extension-by { "ucnk" }
        text # database password
    }

}
"""

import urllib
import httplib
import json
import ssl

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
        self.admins = conf.get('plugins', 'auth').get('ucnk:administrators', [])
        self.login_url = conf.get('plugins', 'auth')['login_url']
        self.logout_url = conf.get('plugins', 'auth')['logout_url']
        self.anonymous_user_id = int(conf.get('plugins', 'auth')['anonymous_user_id'])
        self.toolbar_server_timeout = int(conf.get('plugins', 'auth')[
                                          'ucnk:toolbar_server_timeout'])


class CentralAuth(AbstractRemoteAuth):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    def __init__(self, db, sessions, conf):
        """
        arguments:
        db -- a key-value storage plug-in
        sessions -- a sessions plug-in
        conf -- a 'settings' module
        """
        auth_conf = AuthConf(conf)
        super(CentralAuth, self).__init__(auth_conf.anonymous_user_id)
        self._db = db
        self._sessions = sessions
        self._toolbar_conf = ToolbarConf(conf)
        self._auth_conf = auth_conf
        self._conf = conf
        self._ssl_context = ssl.create_default_context() if self._toolbar_conf.port == 443 else None

    @staticmethod
    def _mk_user_key(user_id):
        return 'user:%d' % user_id

    def _create_connection(self):
        if self._ssl_context is not None:
            return httplib.HTTPSConnection(self._toolbar_conf.server,
                                           port=self._toolbar_conf.port,
                                           timeout=self._auth_conf.toolbar_server_timeout,
                                           context=self._ssl_context)
        else:
            return httplib.HTTPConnection(self._toolbar_conf.server,
                                          port=self._toolbar_conf.port,
                                          timeout=self._auth_conf.toolbar_server_timeout)

    def _fetch_toolbar_api_response(self, args):
        ## ----------------- DEBUG/DEVEL BEGIN
        return json.dumps(dict(user=dict(id=2)))
        ## ----------------- DEBUG/DEVEL END
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
        api_cookies = self._conf.get('plugins', 'auth', {}).get('ucnk:api_cookies', [])

        api_args = map(lambda x: (x[0][len('cnc_toolbar_'):], x[1].value),
                       filter(lambda x: x[0] in api_cookies, plugin_api.cookies.items()))
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

        if curr_user_id != response_obj['user']['id']:
            plugin_api.refresh_session_id()
            if response_obj['user']['id'] != self._anonymous_id:
                # user logged in => keep session data (except for credentials)
                plugin_api.session['user'] = {
                    'id': int(response_obj['user']['id']),
                    'user': response_obj['user'].get('user'),  # TODO API unknown
                    'fullname': u'%s %s' % (response_obj['user'].get('firstName'),
                                            response_obj['user'].get('surname'))  # TODO API unknown
                }
                # reload available corpora from remote server
                self.refresh_user_permissions(plugin_api)
            else:  # logout => clear current user's session data and set new credentials
                plugin_api.session.clear()
                plugin_api.session['user'] = self.anonymous_user()

    def _variant_prefix(self, corpname):
        return corpname.rsplit('/', 1)[0] if '/' in corpname else ''

    def permitted_corpora(self, user_dict):
        """
        Fetches list of corpora available to the current user

        arguments:
        user_dict -- a user credentials dictionary

        returns:
        a dict (corpus_id, corpus_variant)
        """
        corpora = self._db.get_permitted_corpora(user_dict['id'])
        if IMPLICIT_CORPUS not in corpora:
            corpora.append(IMPLICIT_CORPUS)
        return dict((c, self._variant_prefix(c)) for c in corpora)

    def refresh_user_permissions(self, plugin_api):
        self._db.refresh_user_permissions(
            user_id=plugin_api.session.get('user', {'id': None})['id'])

    def get_user_info(self, user_id):
        user_key = self._mk_user_key(user_id)
        info = self._db.get(user_key)
        if info is None:
            raise ValueError('Failed to obtain information about user {0}'.format(user_key))
        info.pop('pwd_hash', None)
        info.pop('recovery_hash', None)
        return info

    def is_administrator(self, user_id):
        """
        Currently not supported (always returns False)
        """
        return False

    def get_login_url(self, return_url=None):
        return self._auth_conf.login_url % (urllib.quote(return_url) if return_url is not None else '')

    def get_logout_url(self, return_url=None):
        return self._auth_conf.logout_url % (urllib.quote(return_url) if return_url is not None else '')


@inject(plugins.runtime.SESSIONS)
def create_instance(conf, sessions):
    backend = Backend(MySQLConf(conf))
    return CentralAuth(db=backend, sessions=sessions, conf=conf)
