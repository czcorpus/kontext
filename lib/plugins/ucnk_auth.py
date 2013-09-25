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
A custom authentication module for the Institute of the Czech National Corpus.
You probably want to implement an authentication solution of your own. Please refer
to the documentation or read the dummy_auth.py module to see the required interface.
"""
import crypt

import ucnk_db


def create_salt(length=2):
    """
    Creates random salt of required length (default is 2) and composed
    of a-z,A-Z letters.
    """
    import random
    salt_chars = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"
    return ''.join([salt_chars[random.randint(0, len(salt_chars) - 1)] for i in range(length)])


def create_instance(conf, sessions, db):
    """
    Factory function (as required by the application) providing
    an instance of authentication module.
    """
    return UCNKAuth(db.get(), sessions, conf.get('global', 'ucnk:administrators'), conf.get_root_url())


class UCNKAuth(object):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    MIN_PASSWORD_LENGTH = 5

    def __init__(self, db_conn, sessions, admins, root_url):
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
        self.root_url = root_url
        self.user = 'anonymous'

    def anonymous_user(self):
        return {
            'id': None,
            'user': None,
            'fullname': _('anonymous')
        }

    def validate_user(self, username, password):
        """
        Parameters
        ----------
        username : str

        password : str

        Returns
        -------
        str : session ID on success else None
        """
        cols = ('id', 'user', 'pass', 'firstName', 'surname')
        cursor = self.db_conn.cursor()
        cursor.execute("SELECT %s FROM user WHERE user = %%s" % ','.join(cols), (username, ))
        row = cursor.fetchone()
        if row and crypt.crypt(password, row[2]) == row[2]:
            row = dict(zip(cols, row))
        else:
            row = {}
        cursor.close()
        if 'id' in row:
            return {
                'id': row['id'],
                'user': row['user'],
                'fullname': '%s %s' % (row['firstName'], row['surname'])
            }
        return self.anonymous_user()

    def logout(self, session_id):
        self.sessions.delete(session_id)

    def update_user_password(self, password):
        """
        Updates current user's password.
        There is no need to hash/encrypt the password - function does it automatically.

        Parameters
        ----------
        password : str
            new password
        """
        import crypt

        hashed_pass = crypt.crypt(password, create_salt())
        cursor = self.db_conn.cursor()
        ans = cursor.execute("UPDATE user SET pass = %s WHERE user = %s", (hashed_pass, self.user,))
        cursor.close()
        self.db_conn.commit()
        return ans

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

    def validate_password(self, password):
        """
        Tests whether provided password matches user's current password
        """
        return crypt.crypt(password, getattr(self, 'pass')) == getattr(self, 'pass')

    def validate_new_password(self, password):
        """
        Tests whether the password candidate matches required password properties
        (like minimal length, presence of special characters etc.)

        Returns
        -------
        True on success else False
        """
        return len(password) >= UCNKAuth.MIN_PASSWORD_LENGTH

    def get_required_password_properties(self):
        """
        """
        return _('Password must be at least %s characters long.' % UCNKAuth.MIN_PASSWORD_LENGTH)

    def is_administrator(self):
        """
        Tests whether the current user's name belongs to the 'administrators' group
        """
        return self.user in self.admins

    def get_login_url(self):
        return '%slogin' % self.root_url

    def get_logout_url(self):
        return '%slogoutx' % self.root_url