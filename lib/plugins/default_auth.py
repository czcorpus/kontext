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
A simple authentication module for development, single user and
testing purposes.
"""
from auth import AbstractAuth


def create_instance(conf, *args):
    """
    This function must be always implemented. Bonito uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    return DefaultAuthHandler(conf.get_root_url())


class DefaultAuthHandler(AbstractAuth):
    """
    Sample authentication handler
    """

    def __init__(self, root_url):
        self.root_url = root_url
        self.corplist = ('syn2010', 'intercorp_cs', 'intercorp_en')

    def validate_user(self, username, password):
        """
        DummyAuthHandler always allows logging in (i.e. it
        always returns True)

        Parameters
        ----------
        username : str

        password : str

        Returns
        -------
        bool : True on success, False on failure.
        """
        self.user = username
        return {
            'id': 333,
            'user': 'Dummy',
            'fullname': 'Dummy User'
        }

    def logout(self, session_id):
        """
        """
        pass

    def auth_session(self, session_id):
        """
        Validates user's session ID in terms of his log-in status
        """
        return True

    def update_user_password(self, password):
        """
        Updates current user's password.
        There is no need to hash/encrypt the password - function does it automatically.

        Parameters
        ----------
        password : str
            new password
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
        return self.corplist

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

