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

    def anonymous_user(self):
        """
        Returns a dictionary containing (key, value) pairs
        specifying anonymous user. By default it is ID = 0,
        user = 'anonymous', fullname = _('anonymous')
        """
        return {
            'id': 0,
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


class AuthException(Exception):
    """
    General authentication/authorization exception
    """
    pass