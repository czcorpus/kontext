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
import cPickle

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

    cache_path = conf.get('plugins', 'auth').get('ucnk:cache_path', None)
    cache = Cache(cache_path) if cache_path else None

    return CentralAuth(db_conn=db.get(), sessions=sessions, admins=conf.get('global', 'ucnk:administrators'),
                       login_url=login_url, logout_url=logout_url, cookie_name=cookie_name, cache=cache)


class Cache(object):
    """
    cPickle-based key-value storage. Data are saved automatically
    before the object is being destroyed.
    Cache supports dict-like access to individual records (d = cache['foo'],
    cache['bar'] = ...).
    """
    def __init__(self, data_path):
        """
        arguments:
        data_path -- path to a serialized cache data; if it does not exist then a new file is created
        """
        self.data_path = data_path
        self.data = {}
        try:
            with open(self.data_path, 'rb') as f:
                self.data = cPickle.load(f)
        finally:
            pass

    def save(self):
        """
        Saves cache to the 'self.data_path' file. This is also
        done automatically via __del__ method.
        """
        with open(self.data_path, 'wb') as f:
            cPickle.dump(self.data, f)

    def __getitem__(self, user_id):
        return self.data[user_id]

    def __setitem__(self, user_id, data):
        self.data[user_id] = data

    def __contains__(self, user_id):
        return self.data.__contains__(user_id)

    def __del__(self):
        self.save()


class CentralAuth(AbstractAuth):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    def __init__(self, db_conn, sessions, admins, login_url, logout_url, cookie_name, cache=None):
        """
        arguments:
        db_conn -- database connection
        sessions -- session handler
        admins -- list of usernames with administrator privileges
        login_url -- the application redirects a user to this URL when login is requested
        logout_url -- the application redirects a user to this URL when logout is requested
        cookie_name -- name of the cookie used to store an authentication ticket
        cache -- dict-like object used to cache some data; optional
        """
        self.db_conn = db_conn
        self.sessions = sessions
        self.admins = admins
        self.login_url = login_url
        self.logout_url = logout_url
        self.cookie_name = cookie_name

        self.user = 'anonymous'
        self.corplist = []
        self.cache = cache

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
            if self.cache and user in self.cache:
                _corplist = self.cache[user]
            else:
                conn = self.db_conn
                cursor = conn.cursor()
                cursor.execute("""SELECT corpora.name, limited FROM (
    SELECT ucr.corpus_id AS corpus_id, ucr.limited AS limited
    FROM user_corpus_relation AS ucr JOIN user AS u1 ON ucr.user_id = u1.id AND u1.user = %s
    UNION
    SELECT r2.corpora AS corpus_id, r2.limited AS limited
    FROM user AS u2
    JOIN relation AS r2 on r2.corplist = u2.corplist AND u2.user = %s) AS ucn
    JOIN corpora on corpora.id = ucn.corpus_id ORDER BY corpora.name""", (user, user))
                rows = cursor.fetchall()
                corpora = []
                for row in rows:
                    if row[1]:
                        corpora.append('omezeni/%s' % row[0])
                    else:
                        corpora.append(row[0])
                cursor.close()
                if not 'susanne' in corpora:
                    corpora.append('susanne')
                corpora.sort()
                _corplist = corpora
                if self.cache:
                    self.cache[user] = corpora
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