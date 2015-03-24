# Copyright (c) 2015 Institute of the Czech National Corpus
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

from controller import exposed, UserActionException
from kontext import Kontext
from kontext import MainMenu
from translation import ugettext as _
import plugins
import settings


class User(Kontext):

    def get_mapping_url_prefix(self):
        return '/user/'

    @staticmethod
    def _is_anonymous_id(user_id):
        return settings.get_int('global', 'anonymous_user_id') == user_id

    @exposed()
    def login(self, request):
        self.disabled_menu_items = (MainMenu.NEW_QUERY, MainMenu.VIEW,
                                    MainMenu.SAVE, MainMenu.CORPORA, MainMenu.CONCORDANCE,
                                    MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)
        return {}

    @exposed()
    def loginx(self, request):
        ans = {}
        self._session['user'] = plugins.auth.validate_user(request.form['username'],
                                                           request.form['password'])

        if self._session['user'].get('id', None):
            self._redirect('%sfirst_form' % (self.get_root_url(), ))
        else:
            self.disabled_menu_items = (MainMenu.NEW_QUERY, MainMenu.VIEW,
                                        MainMenu.SAVE, MainMenu.CORPORA, MainMenu.CONCORDANCE,
                                        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)
            ans['message'] = ('error', _('Incorrect username or password'))
        return ans

    @exposed(access_level=1, template='user/login.tmpl')
    def logoutx(self, request):
        self.disabled_menu_items = (MainMenu.NEW_QUERY, MainMenu.VIEW,
                                    MainMenu.SAVE, MainMenu.CORPORA, MainMenu.CONCORDANCE,
                                    MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)
        plugins.auth.logout(self._session.sid)
        self._init_session()

        return {
            'message': ('info', _('You have been logged out'))
        }


    @exposed(access_level=1, template='user/user_password_form.tmpl')
    def user_password_form(self, request):
        if not plugins.auth.uses_internal_user_pages():
            raise UserActionException(_('This function is disabled.'))
        return {}

    @exposed(access_level=1, template='user/user_password.tmpl')
    def user_password(self, request):
        try:
            curr_passwd = request.form['curr_passwd']
            new_passwd = request.form['new_passwd']
            new_passwd2 = request.form['new_passwd2']

            if not plugins.auth.uses_internal_user_pages():
                raise UserActionException(_('This function is disabled.'))
            logged_in = plugins.auth.validate_user(self._session_get('user', 'user'), curr_passwd)

            if self._is_anonymous_id(logged_in['id']):
                raise UserActionException(_('Invalid user or password'))
            if new_passwd != new_passwd2:
                raise UserActionException(_('New password and its confirmation do not match.'))

            if not plugins.auth.validate_new_password(new_passwd):
                raise UserActionException(plugins.auth.get_required_password_properties())

            plugins.auth.update_user_password(self._session_get('user', 'id'), new_passwd)
        except UserActionException as e:
            self.add_system_message('error', e)
        return {}