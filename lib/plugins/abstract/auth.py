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

from translation import ugettext as _


class AbstractAuth(object):
    """
    Represents general authentication module.
    Custom implementations should inherit this.
    """

    def __init__(self, anonymous_id):
        """
        arguments:
        anonymous_id -- a numeric ID of anonymous user
        """
        self._anonymous_id = anonymous_id

    def anonymous_user(self):
        """
        Returns a dictionary containing (key, value) pairs
        specifying anonymous user. By default it is ID = 0,
        user = 'anonymous', fullname = _('anonymous')
        """
        return {
            'id': self._anonymous_id,
            'user': 'anonymous',
            'fullname': _('anonymous')
        }

    def get_login_url(self, return_url=None):
        """
        Specifies where should KonText redirect a user in case
        he wants to log in. In general, it can be KonText's URL
        or a URL of some other authentication application.
        """
        raise NotImplementedError()

    def get_logout_url(self, return_url=None):
        """
        Specifies where should KonText redirect a user in case
        he wants to log out. In general, it can be KonText's URL
        or a URL of some other authentication application.
        """
        raise NotImplementedError()

    def is_anonymous(self, user_id):
        return user_id == self._anonymous_id

    def is_administrator(self, user_id):
        """
        Should return True if user has administrator's privileges
        else False

        arguments:
        user_id -- user's database ID
        """
        return False

    def canonical_corpname(self, corpname):
        """
        Internally we sometimes use path-like corpora names to distinguish between
        two access levels (this is achieved by two different registry files).
        E.g. you have 'syn2010' corpus and 'spec/syn2010' corpus which means that somewhere
        there is a registry file called 'syn2010' and also a directory 'spec' with
        another registry file 'syn2010'. But this should be transparent to users so that
        they see 'syn2010' in both cases. This method solves the problem by converting
        path-like names to basename ones.
        """
        return corpname

    def permitted_corpora(self, user_id):
        """
        Returns a dictionary containing corpora IDs user can access.

        arguments:
        user_id -- database user ID

        returns:
        a dict canonical_corpus_id=>corpus_id
        """
        raise NotImplementedError()

    def get_user_info(self, user_id):
        """
        Returns a dictionary containing all the data about a user.
        Sensitive information like password hashes, recovery questions
        etc. are not expected/required to be present there.
        """
        raise NotImplementedError()


class AbstractInternalAuth(AbstractAuth):
    """
    A general authentication running within KonText.
    """

    def update_user_password(self, user_id, password):
        """
        Changes a password of provided user.
        """
        raise NotImplementedError()

    def logout(self, session):
        """
        Logs-out current user (identified by passed session object).
        """
        raise NotImplementedError()

    def get_required_password_properties(self):
        """
        Returns a text description of required password
        properties (e.g.: "at least 5 characters long, at least one digit)
        This should be consistent with validate_new_password().
        """
        raise NotImplementedError()

    def validate_new_password(self, password):
        """
        Tests whether the provided password matches all the
        required properties. This should be consistent with
        get_required_password_properties().
        """
        raise NotImplementedError()

    def validate_user(self, plugin_api, username, password):
        """
        Tries to find a user with matching 'username' and 'password'.
        If a match is found then proper credentials of the user are
        returned. Otherwise an anonymous user's credentials should be
        returned.

        arguments:
        plugin_api -- a kontext.PluginApi instance
        username -- login username
        password -- login password

        returns
        a dict {'id': ..., 'user': ..., 'fullname'} where 'user' means
        actually 'username'.
        """
        raise NotImplementedError()


class AbstractRemoteAuth(AbstractAuth):
    """
    A general authentication based on an external authentication service.
    """

    def revalidate(self, plugin_api):
        """
        Re-validates user authentication against external database with central
        authentication ticket (expected to be found in cookies) and session data.
        Resulting user data is written to the session (typically - if a remote
        service marks auth. cookie as invalid we store an anonymous user into
        the session. The method returns no value.

        Please note that in case this method raises an exception, KonText
        automatically sets current user as 'anonymous' to prevent security issues.

        arguments:
        plugin_api -- a controller.PluginApi instance
        """
        raise NotImplementedError()


class AuthException(Exception):
    """
    General authentication/authorization exception
    """
    pass
