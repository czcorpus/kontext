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


class AbstractAuth(object):
    """
    Represents general authentication module.
    Custom implementations should inherit this.
    """

    def anonymous_user(self):
        return {
            'id': 0,
            'user': 'anonymous',
            'fullname': _('anonymous')
        }

    def get_login_url(self):
        return '%slogin' % self.root_url

    def get_logout_url(self):
        return '%slogoutx' % self.root_url

    def is_administrator(self):
        return False


class AuthException(Exception):
    """
    """
    pass