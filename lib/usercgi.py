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

    def user_password_form(self):
        if not settings.supports_password_change():
            return {'error': _('This function is disabled.')}
        return {}

    user_password_form.template = 'user_password_form.tmpl'

    def user_password(self, curr_passwd='', new_passwd='', new_passwd2=''):
        if not settings.supports_password_change():
            return {'error': _('This function is disabled.')}
        logged_in = settings.auth.login(self._user, curr_passwd)
        if not logged_in:
            raise UserActionException(_('Unknown user'))
        if settings.auth.validate_password(curr_passwd):
            pass
        else:
            raise UserActionException(_('Invalid password'))

        if new_passwd != new_passwd2:
            raise UserActionException(_('New password and its confirmation do not match.'))

        if not settings.auth.validate_new_password(new_passwd):
            raise UserActionException(settings.auth.get_required_password_properties())

        settings.auth.update_user_password(new_passwd)
        self.redirect(settings.get_root_uri())

    def login(self):
        self.disabled_menu_items = ('menu-new-query', 'menu-word-list', 'menu-view', 'menu-sort', 'menu-sample',
                                    'menu-save', 'menu-subcorpus', 'menu-concordance', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc')
        return {}

    def loginx(self, username='', password=''):
        user = plugins.auth.login(username, password)
        if user is not None:
            self._session['user'] = user
            self.redirect('%s%s' % (settings.get_root_url(), 'first_form'))
        else:
            self.redirect('login')
        return {}

    def logoutx(self):
        self.disabled_menu_items = ('menu-new-query', 'menu-word-list', 'menu-view', 'menu-sort', 'menu-sample',
                                    'menu-save', 'menu-subcorpus', 'menu-concordance', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc')
        plugins.auth.logout(self._get_session_id())
        self._session = {
            'user': plugins.auth.anonymous_user()  # just to keep rendering ok
        }
        self._user = None
        return {
            'notification': _('You have been logged out')
        }

    logoutx.template = 'login.tmpl'

    user_password.template = 'user_password.tmpl'