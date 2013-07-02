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


def create_instance(conf):
    """
    This function must be always implemented. Bonito uses it to create an instance of your
    authentication object. The settings module is passed as a parameter.
    """
    return DummyAuthHandler()


class DummyAuthHandler(object):
    """
    Sample authentication handler
    """

    def __init__(self):
        self.corplist = ('syn2010', 'intercorp_cs', 'intercorp_en')

    def login(self, username, password):
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

    def get_corplist(self):
        """
        Fetches list of corpora available to the current user

        Returns
        -------
        corplist : list
            list of corpora names (sorted alphabetically)
        """
        return self.corplist

    def user_has_access_to(self, corpname):
        """
        Tests whether the current user has access to provided corpus name

        Parameters
        ----------
        corpname : str
        """
        return corpname in self.get_corplist()

    def is_administrator(self):
        """
        Tests whether the current user's name belongs to the 'administrators' group
        """
        return True
