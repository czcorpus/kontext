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

"""


def create_instance(conf, sessions, db):
    """
    Factory function (as required by the application) providing
    an instance of authentication module.
    """
    login_url = conf.get('plugins', 'auth')['login_url'] % ('%sfirst_form' % conf.get_root_url())
    logout_url = conf.get('plugins', 'auth')['logout_url'] % ('%sfirst_form' % conf.get_root_url())
    return CentralAuth(db_conn=db.get(), sessions=sessions, admins=conf.get('global', 'ucnk:administrators'),
                       login_url=login_url, logout_url=logout_url)


class CentralAuth(object):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    def __init__(self, db_conn, sessions, admins, login_url, logout_url):
        """
        Parameters
        ----------
        db_conn : object
            database connection
        sessions : objet
            a session handler
        admins : tuple|list
            list of usernames with administrator privileges
        """
        self.db_conn = db_conn
        self.sessions = sessions
        self.corplist = []
        self.admins = admins
        self.login_url = login_url
        self.logout_url = logout_url
        self.user = 'anonymous'

    def anonymous_user(self):
        return {
            'id': 0,
            'user': 'anonymous',
            'fullname': _('anonymous')
        }

    def validate_auth_ticket(self, id):
        """
        Parameters
        ----------
        username : str

        password : str

        Returns
        -------
        str : session ID on success else None
        """
        cols = ('u.id', 'u.user', 'u.pass', 'u.firstName', 'u.surname', 't.lang')
        cursor = self.db_conn.cursor()
        cursor.execute("SELECT %s FROM user AS u JOIN toolbar_session AS t ON u.id = t.user_id WHERE t.id = %%s"
                       % ','.join(cols), (id, ))
        row = cursor.fetchone()
        if row:
            row = dict(zip(cols, row))
        else:
            row = {}
        cursor.close()
        if 'u.id' in row:
            return {
                'id': row['u.id'],
                'user': row['u.user'],
                'fullname': '%s %s' % (row['u.firstName'], row['u.surname'])
            }
        else:
            return self.anonymous_user()

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
            cursor.execute("SELECT uc.name FROM user_corpus AS uc JOIN user AS un ON uc.user_id = un.id "
                           " WHERE un.user = %s",  (user, ))
            rows = cursor.fetchall()
            if len(rows) > 0:
                cursor.close()
                corpora = [row[0] for row in rows]
            else:
                corpora = []

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