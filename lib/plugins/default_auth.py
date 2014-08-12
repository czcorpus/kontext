# Copyright (c) 2014 Institute of the Czech National Corpus
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
A simple authentication module to start with.
It relies on default_db module which requires no database backend.
"""
import hashlib

from auth import AbstractAuth
from translation import ugettext as _


class DefaultAuthHandler(AbstractAuth):
    """
    Sample authentication handler
    """

    def __init__(self, db, sessions):
        self.db = db
        self.sessions = sessions
        index_path = self._mk_index_path()
        curr_index = self.db.get(index_path)
        self._index = curr_index if curr_index is not None else {}

    def _mk_index_path(self):
        return 'user-idx'

    def _mk_user_key(self, user_id):
        return 'user-%04d' % user_id

    def validate_user(self, username, password):
        """
        arguments:
        username -- user's login username
        password -- user's password

        returns
        True on success, False on failure.
        """
        user_data = self.find_user(username)
        pwd_hash = hashlib.md5(password).hexdigest()

        if user_data and user_data['username'] == username and user_data['pwd_hash'] == pwd_hash:
            return {
                'id': user_data['id'],
                'user': user_data['username'],
                'fullname': '%s %s' % (user_data['firstname'], user_data['lastname'])
            }
        return self.anonymous_user()

    def logout(self, session_id):
        """
        """
        self.sessions.delete(session_id)

    def update_user_password(self, password):
        """
        Updates current user's password.
        There is no need to hash/encrypt the password - function does it automatically.

        arguments:
        password -- new password
        """
        pass

    def get_corplist(self, user):
        """
        Fetches list of corpora available to the current user

        Returns
        -------
        corplist : list
            list of corpora names (sorted alphabetically)
        """
        data = self.find_user(user)
        return data['corpora']

    def is_administrator(self):
        """
        Tests whether the current user's name belongs to the 'administrators' group
        """
        return True

    def validate_password(self, password):
        """
        Tests whether provided password matches user's current password
        """
        return True

    def validate_new_password(self, password):
        """
        Tests whether the password candidate matches required password properties
        (like minimal length, presence of special characters etc.)

        Returns
        -------
        True on success else False
        """
        return True

    def get_required_password_properties(self):
        """
        """
        return _('Any string can be used.')

    def get_login_url(self, root_url):
        return '%slogin' % root_url

    def get_logout_url(self, root_url):
        return '%slogoutx' % root_url

    def find_user(self, username):
        """
        Searches for user's data by his username. We assume that username is unique.

        arguments:
        username -- log-in username of a user

        returns:
        a dictionary containing user data or None if nothing is found
        """
        if self._index is None or username not in self._index:
            self._index = {}
            for item in self.db.all_with_key_prefix('user-'):
                self._index[item['username']] = item['id']
            self.db.set('username-idx', self._index)

        item_id = self._index[username]
        return self.db.get(self._mk_user_key(item_id))


def create_instance(conf, sessions, db):
    """
    This function must be always implemented. KonText uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    return DefaultAuthHandler(db, sessions)

