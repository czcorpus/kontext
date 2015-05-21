# Copyright (c) 2014 Institute of Formal and Applied Linguistics
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
A custom authentication module for the Institute of Formal and Applied Linguistics.
You probably want to implement an authentication solution of your own. Please refer
to the documentation or read the dummy_auth.py module to see the required interface.
"""
import os
import plugins
import crypt
import logging

def create_instance(conf, sessions, db):
    """
    Factory function (as required by the application) providing
    an instance of authentication module.
    """
    return LINDATAuth(db.get(), sessions, conf.get('global', 'ucnk:administrators'), conf.get_root_url())


class LINDATAuth(object):
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
            'id': 0,
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
        dict : dict with user properties or empty dict
        """
        logger = logging.getLogger(__name__)
        if username is not None and username != '':
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
        else:
            username = os.getenv('HTTP_EPPN') or os.getenv('HTTP_PERSISTENT_ID') or os.getenv('HTTP_MAIL')
            if username is None or username == '':
                logger.debug(os.environ);
                return self.anonymous_user()
            first_name = os.getenv('HTTP_GIVENNAME')
            surname = os.getenv('HTTP_SN')
            if not first_name and not surname:
                full_name = os.getenv('HTTP_DISPLAYNAME') or os.getenv('HTTP_CN')
                [first_name, surname] = self.parse_full_name(full_name)
            cols = ('id', 'user', 'pass', 'firstName', 'surname')
            cursor = self.db_conn.cursor()
            cursor.execute("SELECT %s FROM user WHERE user = %%s" % ','.join(cols), (username, ))
            row = cursor.fetchone()
            if not row:
                cursor.execute("INSERT INTO user (user, firstName, surname) VALUES (%s, %s, %s)", (username, first_name, surname))
            else:
                cursor.execute("UPDATE user SET firstName=%s, surname=%s WHERE user=%s", (first_name, surname, username))
            cursor.execute("SELECT %s FROM user WHERE user = %%s" % ','.join(cols), (username, ))
	    row = cursor.fetchone()
            if row:
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

    def get_corplist(self, user):
        """
        Fetches list of available corpora according to provided user

        Returns
        -------
        list
          list of corpora names (sorted alphabetically) available to current user (specified in the _user variable)
        """
        if plugins.has_plugin('corptree'):
            corpora = plugins.corptree.list
        else:
            corpora = []
        corplist = []
        for corpus in corpora:
            corplist.append(corpus['id'])
        corplist.sort()
        return corplist

    def is_administrator(self):
        """
        Tests whether the current user's name belongs to the 'administrators' group
        """
        return self.user in self.admins

    def get_login_url(self):
        return '%slogin' % self.root_url

    def get_logout_url(self):
        return '%slogoutx' % self.root_url

    def uses_aai(self):
        return True

    def get_restricted_corp_variant(self, corpus_name):
        return corpus_name

    def parse_full_name(self, full_name):
        parts = full_name.split(" ")
        first_name = " ".join(parts[:-1])
        surname = parts[-1]
        return [first_name, surname]
