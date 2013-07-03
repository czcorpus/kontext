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
import os
import crypt

import manatee
import db
from db import fq


def create_salt(length=2):
    """
    Creates random salt of required length (default is 2) and composed
    of a-z,A-Z letters.
    """
    import random
    salt_chars = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"
    return ''.join([salt_chars[random.randint(0, len(salt_chars) - 1)] for i in range(length)])


def create_instance(conf):
    """
    Factory function (as required by the application) providing
    an instance of authentication module.
    """
    conn = db.open(conf.get('ucnk:database'))
    return UCNKAuth(conn, conf.get('global', 'ucnk:administrators'))


class UCNKAuth(object):
    """
    A custom authentication class for the Institute of the Czech National Corpus
    """

    MIN_PASSWORD_LENGTH = 5

    def __init__(self, db_conn, admins):
        """
        Parameters
        ----------
        db_conn : object
            database connection
        admins : tuple|list
            list of usernames with administrator privileges
        """
        self.db_conn = db_conn
        self.corplist = None
        self.admins = admins

    def login(self, username, password=None):
        """
        Parameters
        ----------
        username : str

        password : str

        Returns
        -------
        bool : True on success, False on failure.
        """
        cols = ('user', 'pass')
        cursor = self.db_conn.cursor()
        cursor.execute(fq("SELECT %s FROM user WHERE user = %%(p)s" % ','.join(cols)), (username,))
        row = cursor.fetchone()
        cursor.close()

        if row:
            for k, v in dict(zip(cols, row)).items():
                setattr(self, k, v)
            return True
        return False

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

    def get_corplist(self):
        """
        Fetches list of corpora available to the current user

        Returns
        -------
        corplist : list
            list of corpora names (sorted alphabetically)
        """
        if self.corplist is None:
            cursor = self.db_conn.cursor()
            cursor.execute(fq("SELECT corplist FROM user WHERE user LIKE %(p)s"),  (self.user, ))
            row = cursor.fetchone()
            c = row[0].split()
            corpora = []

            for i in c:
                if i[0].startswith('@'):
                    i = i[1:]
                    cursor.execute(fq("SELECT corpora.name" +
                                      " FROM corplist,relation,corpora" +
                                      " WHERE corplist.id=relation.corplist" +
                                      " AND relation.corpora=corpora.id"
                                      " AND corplist.name=%(p)s"), i)
                    row = cursor.fetchall()

                    for y in row:
                        corpora.append(y[0])
                else:
                    corpora.append(i)
            cursor.close()
            path_info = os.getenv('PATH_INFO')

            if path_info in ('/wsketch_form', '/wsketch', '/thes_form', '/thes', '/wsdiff_form', '/wsdiff'):
                r = []
                for ws in range(len(corpora)):
                    c = manatee.Corpus(corpora[ws]).get_conf('WSBASE')
                    if c == 'none':
                        r.append(corpora[ws])
                for x in r:
                    corpora.remove(x)
            corpora.sort()
            self.corplist = tuple(corpora)
        return self.corplist

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
