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
This is another version of a custom authentication plugin for the
Institute of the Czech National Corpus (for the original documentation
please see lib/plugins/ucnk_remote_auth.py). It is based on
RedisDB.

Required config.xml/plugins entries:

<auth>
    <module>devel_remote_auth</module>
    <auth_cookie_name>[name of a cookie used to store KonText's internal auth ID]</auth_cookie_name>
    <login_url>[URL where KonText redirects user to log her in; placeholders can be used]</login_url>
    <logout_url>[URL where KonText redirects user to log her out; placeholders can be used]</logout_url>
    <central_auth_cookie_name extension-by="ucnk">[name of a cookie used by a central-authentication service]</central_auth_cookie_name>
</auth>

"""

import urllib
import random
import logging

from abstract.auth import AbstractRemoteAuth
from plugins import inject

import MySQLdb


IMPLICIT_CORPUS = 'susanne'
REVALIDATION_PROBABILITY = 0.1


def create_auth_db_params(conf):
    """
    """
    if conf['ucnk:auth_db_charset'].lower() in ('utf8', 'utf-8'):
        use_unicode = True
    else:
        use_unicode = False
    return dict(
        host=conf['ucnk:auth_db_host'],
        user=conf['ucnk:auth_db_username'],
        passwd=conf['ucnk:auth_db_password'],
        db=conf['ucnk:auth_db_name'],
        charset=conf['ucnk:auth_db_charset'],
        use_unicode=use_unicode
    )


def connect_auth_db(**conn_params):
    return MySQLdb.connect(**conn_params)


def _toss():
    return random.random() < REVALIDATION_PROBABILITY


class CentralAuth(AbstractRemoteAuth):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    def __init__(self, redis_db, sessions, conf):
        """
        arguments:
        db_provider -- a database connection wrapper (SQLAlchemy)
        sessions -- a session plug-in instance
        admins -- tuple/list of usernames with administrator privileges
        login_url -- a URL the application redirects a user to when login is necessary
        logout_url -- a URL the application redirects a user to when logout is requested
        cookie_name -- name of the cookie used to store authentication ticket
        anonymous_id -- numeric ID of anonymous user
        """
        super(CentralAuth, self).__init__(conf.get_int('global', 'anonymous_user_id'))
        self.redis_db = redis_db
        self.sessions = sessions
        self.corplist = []
        self.admins = conf.get('global', 'ucnk:administrators')
        self.login_url = conf.get('plugins', 'auth')['login_url']
        self.logout_url = conf.get('plugins', 'auth')['logout_url']
        self.cookie_name = conf.get('plugins', 'auth').get('ucnk:central_auth_cookie_name', None)
        self.user = 'anonymous'
        self.auth_db_params = create_auth_db_params(conf.get('plugins', 'auth'))

    @staticmethod
    def _mk_user_key(user_id):
        return 'user:%d' % user_id

    @staticmethod
    def _mk_list_key(user_id):
        return 'corplist:user:%s' % user_id

    def get_ticket(self, cookies):
        """
        Returns authentication ticket. Please note that this
        is not a part of AbstractAuth interface.

        arguments:
        cookies -- a Cookie.BaseCookie compatible instance

        returns:
        ticket id
        """
        if self.cookie_name in cookies:
            ticket_id = cookies[self.cookie_name].value
        else:
            ticket_id = None
        return ticket_id

    def revalidate(self, cookies, session, query_string):
        if 'remote=1' in query_string.split('&'):
            session.clear()

        if not 'user' in session:
            session['user'] = {}
        user_data = session['user']
        ticket_id = self.get_ticket(cookies)

        if not user_data.get('revalidated', None) or _toss():
            logging.getLogger(__name__).debug('re-validating user')
            cols = ('u.id', 'u.user', 'u.pass', 'u.firstName', 'u.surname', 't.lang')
            db = connect_auth_db(**self.auth_db_params)
            cursor = db.cursor()
            cursor.execute("SELECT %s FROM user AS u JOIN toolbar_session AS t ON u.id = t.user_id WHERE t.id = %%s"
                           % ','.join(cols), (ticket_id, ))
            row = cursor.fetchone()
            if row:
                row = dict(zip(cols, row))
            else:
                row = {}
            if 'u.id' in row:
                user_data['id'] = row['u.id']
                user_data['user'] = row['u.user']
                user_data['fullname'] = u'%s %s' % (row['u.firstName'], row['u.surname'])
            else:
                user = self.anonymous_user()
                user_data['id'] = user['id']
                user_data['user'] = user['user']
                user_data['fullname'] = user['fullname']
            user_data['revalidated'] = True
            db.close()
            # Normally, the 'modified' flag should be set by Werkzeug's session automatically
            # (via its CallbackDict) but there was a problem detected once (Werkzeug v0.9.6)
            # when the auto-update failed from unknown reason. So just to be sure this won't happen again.
            session.modified = True

    def canonical_corpname(self, corpname):
        """
        """
        return corpname.rsplit('/', 1)[-1]

    def permitted_corpora(self, user_id):
        """
        Fetches list of corpora available to the current user

        arguments:
        user -- username

        returns:
        a list of corpora names (sorted alphabetically)
        """
        corpora = self.redis_db.get(self._mk_list_key(user_id), [])
        if IMPLICIT_CORPUS not in corpora:
            corpora.append(IMPLICIT_CORPUS)
        return dict([(self.canonical_corpname(c), c) for c in corpora])

    def is_administrator(self):
        """
        Tests whether the current user's name belongs to the 'administrators' group.
        This is affected by /kontext/global/administrators configuration section.

        returns:
        bool
        """
        return self.user in self.admins

    def get_login_url(self, return_url):
        return self.login_url % (urllib.quote(return_url))

    def get_logout_url(self, return_url):
        return self.logout_url % (urllib.quote(return_url))


@inject('db', 'sessions')
def create_instance(conf, db_provider, sessions):
    """
    Factory function providing
    an instance of authentication module.
    """
    return CentralAuth(redis_db=db_provider, sessions=sessions, conf=conf)