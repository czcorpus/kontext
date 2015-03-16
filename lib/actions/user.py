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

from controller import exposed
from kontext import Kontext
from kontext import MainMenu
from translation import ugettext as _
import plugins


class User(Kontext):

    def get_mapping_url_prefix(self):
        return '/user/'

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