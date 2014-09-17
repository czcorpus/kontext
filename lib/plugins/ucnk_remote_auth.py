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

from abstract.auth import AbstractAuth


IMPLICIT_CORPUS = 'susanne'


class CentralAuth(AbstractAuth):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    def __init__(self, db_provider, sessions, admins, login_url, logout_url, cookie_name):
        """
        arguments:
        db_provider -- a database connection wrapper (SQLAlchemy)
        sessions -- a session plug-in instance
        admins -- tuple/list of usernames with administrator privileges
        login_url -- a URL the application redirects a user to when login is necessary
        logout_url -- a URL the application redirects a user to when logout is requested
        cookie_name -- name of the cookie used to store authentication ticket
        """
        self.db_provider = db_provider
        self.sessions = sessions
        self.corplist = []
        self.admins = admins
        self.login_url = login_url
        self.logout_url = logout_url
        self.cookie_name = cookie_name
        self.user = 'anonymous'

    def get_ticket(self, cookies):
        """
        Returns authentication ticket

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

    def revalidate(self, cookies, session):
        """
        Re-validates user authentication using cookie and session data (in general).
        Resulting user data is written to session. No value is returned.

        arguments:
        cookies -- a Cookie.BaseCookie compatible instance
        session -- dictionary like session data
        """
        ticket_id = self.get_ticket(cookies)
        cols = ('u.id', 'u.user', 'u.pass', 'u.firstName', 'u.surname', 't.lang')
        db = self.db_provider()
        row = db.execute("SELECT %s FROM user AS u JOIN toolbar_session AS t ON u.id = t.user_id WHERE t.id = %%s"
                         % ','.join(cols), (ticket_id, )).fetchone()
        if row:
            row = dict(zip(cols, row))
        else:
            row = {}
        db.close()
        if not 'user' in session:
            session['user'] = {}
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

        arguments:
        user -- username

        returns:
        list of corpora names (sorted alphabetically) available to current user (specified in the _user variable)
        """
        global _corplist

        if len(self.corplist) == 0:
            db = self.db_provider()
            rows = db.execute("""SELECT corpora.name, limited FROM (
SELECT ucr.corpus_id AS corpus_id, ucr.limited AS limited
FROM user_corpus_relation AS ucr JOIN user AS u1 ON ucr.user_id = u1.id AND u1.user = %s
UNION
SELECT r2.corpora AS corpus_id, r2.limited AS limited
FROM user AS u2
JOIN relation AS r2 on r2.corplist = u2.corplist AND u2.user = %s) AS ucn
JOIN corpora on corpora.id = ucn.corpus_id ORDER BY corpora.name""", (user, user)).fetchall()
            corpora = []
            for row in rows:
                if row[1]:
                    corpora.append('omezeni/%s' % row[0])
                else:
                    corpora.append(row[0])
            db.close()
            if not IMPLICIT_CORPUS in corpora:
                corpora.append(IMPLICIT_CORPUS)
            corpora.sort()
            _corplist = corpora
        return _corplist

    def is_administrator(self):
        """
        Tests whether the current user's name belongs to the 'administrators' group.
        This is affected by /kontext/global/administrators configuration section.

        returns:
        bool
        """
        return self.user in self.admins

    def get_login_url(self, root_url):
        return self.login_url % (urllib.quote('%sfirst_form' % root_url))

    def get_logout_url(self, root_url):
        return self.logout_url % (urllib.quote('%sfirst_form' % root_url))


def create_instance(conf, db_provider, sessions):
    """
    Factory function providing
    an instance of authentication module.
    """
    login_url = conf.get('plugins', 'auth')['login_url']
    logout_url = conf.get('plugins', 'auth')['logout_url']
    cookie_name = conf.get('plugins', 'auth').get('ucnk:central_auth_cookie_name', None)
    return CentralAuth(db_provider=db_provider, sessions=sessions, admins=conf.get('global', 'ucnk:administrators'),
                       login_url=login_url, logout_url=logout_url, cookie_name=cookie_name)