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
This is a custom authentication plugin for the Institute of
the Czech National Corpus. It works in a slightly different
way when compared to ucnk_auth.py as it expects some external
(yet still available via a database connection) service to provide
login/logout functions and set a cookie with authentication
ticket. User status is then checked by calling the 'revalidate()'
method.
"""

import urllib
import os
import urlparse

from auth import AbstractAuth


def get_current_url(conf):
    if os.getenv('SERVER_PORT') and os.getenv('SERVER_PORT') not in ('80', '443'):
        port_s = ':%s' % os.getenv('SERVER_PORT')
    else:
        port_s = ''
    return '%(req_scheme)s://%(host)s%(port_s)s%(uri)s' % {'req_scheme': conf.get_uri_scheme_name(),
                                                           'host': os.environ.get('HTTP_HOST'),
                                                           'port_s': port_s,
                                                           'uri': os.environ.get('REQUEST_URI', '')}


def create_instance(conf, sessions, db):
    """
    Factory function (as required by the application) providing
    an instance of authentication module.
    """
    curr_url = list(urlparse.urlparse(get_current_url(conf)))
    login_params = urlparse.parse_qsl(curr_url[4])
    logout_params = login_params[:] + [('reload', '1')]

    curr_url[4] = urllib.urlencode(login_params)
    login_url_continue = urlparse.urlunparse(curr_url)
    curr_url[4] = urllib.urlencode(logout_params)
    logout_url_continue = urlparse.urlunparse(curr_url)

    login_url = conf.get('plugins', 'auth')['login_url'] % (urllib.quote(login_url_continue))
    logout_url = conf.get('plugins', 'auth')['logout_url'] % (urllib.quote(logout_url_continue))
    cookie_name = conf.get('plugins', 'auth').get('ucnk:central_auth_cookie_name', None)
    return CentralAuth(db_conn=db.get(), sessions=sessions, admins=conf.get('global', 'ucnk:administrators'),
                       login_url=login_url, logout_url=logout_url, cookie_name=cookie_name)


class CentralAuth(AbstractAuth):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    def __init__(self, db_conn, sessions, admins, login_url, logout_url, cookie_name):
        """
        Parameters
        ----------
        db_conn : object
            database connection
        sessions : objet
            a session handler
        admins : tuple|list
            list of usernames with administrator privileges
        login_url : str
            the application redirects a user to this URL when login is necessary
        logout_url : str
            the application redirects a user to this URL when logout is requested
        cookie_name : str
            name of the cookie used to store authentication ticket
        """
        self.db_conn = db_conn
        self.sessions = sessions
        self.corplist = []
        self.admins = admins
        self.login_url = login_url
        self.logout_url = logout_url
        self.cookie_name = cookie_name
        self.user = 'anonymous'

    def get_ticket(self, cookies):
        if self.cookie_name in cookies:
            ticket_id = cookies[self.cookie_name].value
        else:
            ticket_id = None
        return ticket_id

    def revalidate(self, cookies, session):
        """
        Re-validates user authentication using cookie and session data (in general).
        Resulting user data is written to session. No value is returned.

        Parameters
        ----------
        cookies : dict
            cookies

        session : dict
            session data
        """
        ticket_id = self.get_ticket(cookies)
        cols = ('u.id', 'u.user', 'u.pass', 'u.firstName', 'u.surname', 't.lang')
        cursor = self.db_conn.cursor()
        cursor.execute("SELECT %s FROM user AS u JOIN toolbar_session AS t ON u.id = t.user_id WHERE t.id = %%s"
                       % ','.join(cols), (ticket_id, ))
        row = cursor.fetchone()
        if row:
            row = dict(zip(cols, row))
        else:
            row = {}
        cursor.close()
        if 'u.id' in row:
            session['user']['id'] = row['u.id']
            session['user']['user'] = row['u.user']
            session['user']['fullname'] = u'%s %s' % (row['u.firstName'].decode('utf-8'), row['u.surname'].decode('utf-8'))

        else:
            user = self.anonymous_user()
            session['user']['id'] = user['id']
            session['user']['user'] = user['user']
            session['user']['fullname'] = user['fullname']

    def get_corplist(self, user):
        """
        Fetches list of available corpora according to provided user

        Returns
        -------
        list
          list of corpora names (sorted alphabetically) available to current user (specified in the _user variable)
        """
        global _corplist

        if len(self.corplist) == 0:
            conn = self.db_conn
            cursor = conn.cursor()
            cursor.execute("""SELECT corpora.name FROM (
SELECT ucr.corpus_id AS corpus_id
FROM user_corpus_relation AS ucr JOIN user AS u1 ON ucr.user_id = u1.id AND u1.user = %s
UNION
SELECT r2.corpora AS corpus_id
FROM user AS u2
JOIN relation AS r2 on r2.corplist = u2.corplist AND u2.user = %s) AS ucn
JOIN corpora on corpora.id = ucn.corpus_id ORDER BY corpora.name""", (user, user))
            rows = cursor.fetchall()
            if len(rows) > 0:
                cursor.close()
                corpora = [row[0] for row in rows]
            else:
                corpora = []
            if not 'susanne' in corpora:
                corpora.append('susanne')
            corpora.sort()
            _corplist = corpora
        return _corplist

    def is_administrator(self):
        """
        Tests whether the current user's name belongs to the 'administrators' group
        """
        return self.user in self.admins

    def get_login_url(self):
        return self.login_url

    def get_logout_url(self):
        return self.logout_url

    def get_restricted_corp_variant(self, corpus_name):
        """
        See the AbstractAuth.get_restricted_corp_variant() for the documentation.
        """
        if not corpus_name.startswith('omezeni/'):
            return 'omezeni/%s' % corpus_name
        return corpus_name