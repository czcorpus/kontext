# Copyright (c) 2004-2009  Pavel Rychly
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import CGIPublisher
import os
from CGIPublisher import UserActionException

import settings
import plugins


def load_opt_file(options, user_id):
    """
    TODO
    """
    plugins.settings_storage.load(user_id, options)


class UserCGI (CGIPublisher.CGIPublisher):
    _ca_user_info = u''
    _options_dir = u''
    _email = u''
    _default_user = u'defaults'
    attrs2save = []

    def __init__(self, environ, user=None):
        CGIPublisher.CGIPublisher.__init__(self, environ)
        self._user = user

    def _user_defaults(self, user):
        pass

    def _setup_user(self, corpname=''):
        options = {}
        if self._user:
            user_file_id = self._user
        else:
            user_file_id = 'anonymous'
        load_opt_file(options, self._session_get('user', 'id'))
        CGIPublisher.correct_types(options, self.clone_self(), selector=1)
        self._user_defaults(user_file_id)
        self.__dict__.update(options)

    def _save_options(self, optlist=[], selector=''):
        """
        Saves user's options to a file on server
        """
        if selector:
            tosave = [(selector + ':' + opt, self.__dict__[opt])
                      for opt in optlist if opt in self.__dict__]
        else:
            tosave = [(opt, self.__dict__[opt]) for opt in optlist
                      if opt in self.__dict__]
        options = {}
        load_opt_file(options, self._session_get('user', 'id'))
        options.update(tosave)
        if not self._anonymous:
            plugins.settings_storage.save(self._session_get('user', 'id'), options)
        else:
            pass  # TODO save to the session

    def save_global_attrs(self):
        options = [a for a in self.attrs2save if not a.startswith('_')]
        self._save_options(options, '')