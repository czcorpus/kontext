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

_conn = None

fq = None


def create_fq(adapter):
    """
    This function allows using a unified parameter placeholder "%(p)s" in your SQL queries.
    When called, db-dependent variant is returned (i.e. with "?", "%s",... replacements)
    """

    global fq

    def fq2(q):
        return {
            'mysql': q % {'p': '%s'},
            'sqlite': q % {'p': '?'}
        }[adapter]
    return fq2


def db_open(adapter, db_name, host=None, username=None, password=None):
    """
    If called for the first time then opens new database connection according to provided database connection
    data. The connection is kept open until explicitly closed. If the function is called again then already opened
    connection is returned.

    MySQL and SQLite database adapters are supported.

    Parameters
    ----------
    adapter : str
        {mysql, sqlite}

    db_name : str
        name or path to the database

    host : str
        hostname

    username : str
        database username

    password : str
        database user's password

    Returns
    -------
    connection : object
                 connection object as provided by selected module
    """
    global _conn, fq

    if _conn is None:
        fq = create_fq(adapter)
        if adapter == 'mysql':
            import MySQLdb
            _conn = MySQLdb.connect(host=host, user=username, passwd=password, db=db_name)
        elif adapter == 'sqlite':
            import sqlite3
            _conn = sqlite3.connect(db_name)
    return _conn


def create_salt(length=2):
    """
    Creates random salt of required length (default is 2) and composed
    of a-z,A-Z letters.
    """
    import random
    salt_chars = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"
    return ''.join([salt_chars[random.randint(0, len(salt_chars) - 1)] for i in range(length)])


def create_instance(conf, sessions):
    """
    Factory function (as required by the application) providing
    an instance of authentication module.
    """
    db_adapter = conf.get('plugins', 'auth').get('ucnk:db_adapter', None)
    db_name = conf.get('plugins', 'auth').get('ucnk:db_name', None)
    db_host = conf.get('plugins', 'auth').get('ucnk:db_host', None)
    db_username = conf.get('plugins', 'auth').get('ucnk:db_username', None)
    db_password = conf.get('plugins', 'auth').get('ucnk:db_password', None)
    conn = db_open(db_name=db_name, adapter=db_adapter, host=db_host, username=db_username, password=db_password)
    return UCNKAuth(conn, sessions, conf.get('global', 'ucnk:administrators'))


class UCNKAuth(object):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    MIN_PASSWORD_LENGTH = 5

    def __init__(self, db_conn, sessions, admins):
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
        self.user = 'anonymous'

    def login(self, username, password):
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
        cursor.execute(fq("SELECT %s FROM user WHERE user = %%(p)s" % ','.join(cols)), (username, ))
        row = cursor.fetchone()
        if row and crypt.crypt(password, row[2]) == row[2]:
            row = dict(zip(cols, row))
        cursor.close()
        if 'id' in row:
            return {
                'id': row['id'],
                'user': row['user'],
                'fullname': '%s %s' % (row['firstName'], row['surname'])
            }
        return None

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
        ans = cursor.execute(fq("UPDATE user SET pass = %(p)s WHERE user = %(p)s"), (hashed_pass, self.user,))
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
            cursor.execute(fq("SELECT uc.name FROM user_corpus AS uc JOIN user AS un ON uc.user_id = un.id "
                              " WHERE un.user = %(p)s"),  (user, ))
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
