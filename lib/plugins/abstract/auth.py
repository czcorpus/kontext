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

    def get_login_url(self):
        """
        Specifies where should KonText redirect a user in case
        he wants to log in. In general, it can be KonText's URL
        or a URL of some other authentication application.
        """
        return '%slogin' % self.root_url

    def get_logout_url(self):
        """
        Specifies where should KonText redirect a user in case
        he wants to log out. In general, it can be KonText's URL
        or a URL of some other authentication application.
        """
        return '%slogoutx' % self.root_url

    def is_administrator(self):
        """
        Should return True if user has administrator's privileges
        else False
        """
        return False

    def uses_internal_user_pages(self):
        """
        If True then actions like 'user_password', 'user_password_form' etc. are enabled
        (if False then KonText raises an exception in case user tries to access them).
        This should be fixed during module life-cycle (i.e. hardcoded).
        """
        return True

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


class AuthException(Exception):
    """
    General authentication/authorization exception
    """
    pass