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

import time

from controller import exposed
from controller.errors import UserActionException
from controller.kontext import Kontext
from main_menu import MainMenu
from translation import ugettext as _
import plugins
import settings


USER_ACTIONS_DISABLED_ITEMS = (MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.SAVE,
                               MainMenu.CONCORDANCE, MainMenu.VIEW)


class User(Kontext):

    def __init__(self, request, ui_lang):
        super(User, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/user/'

    @staticmethod
    def _is_anonymous_id(user_id):
        return plugins.runtime.AUTH.instance.is_anonymous(user_id)

    @exposed(skip_corpus_init=True, template='user/login.tmpl')
    def login(self, request):
        self.disabled_menu_items = USER_ACTIONS_DISABLED_ITEMS
        if request.method == 'GET':
            return {}
        elif request.method == 'POST':
            with plugins.runtime.AUTH as auth:
                ans = {}
                self._session['user'] = auth.validate_user(self._plugin_api,
                                                           request.form['username'],
                                                           request.form['password'])
                if not auth.is_anonymous(self._session['user'].get('id', None)):
                    if request.args.get('return_url', None):
                        self.redirect(request.args.get('return_url'))
                    else:
                        self.redirect(self.create_url('first_form', {}))
                else:
                    self.disabled_menu_items = USER_ACTIONS_DISABLED_ITEMS
                    self.add_system_message('error', _('Incorrect username or password'))
                self.refresh_session_id()
                return ans

    @exposed(access_level=1, template='user/login.tmpl', skip_corpus_init=True, page_model='login')
    def logoutx(self, request):
        self.disabled_menu_items = USER_ACTIONS_DISABLED_ITEMS
        plugins.runtime.AUTH.instance.logout(self._session)
        self.init_session()
        self.refresh_session_id()
        plugins.runtime.AUTH.instance.logout_hook(self._plugin_api)
        self.redirect(self.create_url('first_form', {}))
        return {}

    @exposed(access_level=0, return_type='json')
    def validate_password_props(self, request):
        with plugins.runtime.AUTH as auth:
            if not auth.validate_new_password(request.args['password']):
                raise UserActionException(auth.get_required_password_properties())
        return {}

    @exposed(access_level=1, http_method='POST', skip_corpus_init=True, return_type='json')
    def set_user_password(self, request):
        with plugins.runtime.AUTH as auth:
            curr_passwd = request.form['curr_passwd']
            new_passwd = request.form['new_passwd']
            new_passwd2 = request.form['new_passwd2']

            if not self._uses_internal_user_pages():
                raise UserActionException(_('This function is disabled.'))
            logged_in = auth.validate_user(
                self._plugin_api, self.session_get('user', 'user'), curr_passwd)

            if self._is_anonymous_id(logged_in['id']):
                raise UserActionException(_('Invalid user or password'))
            if new_passwd != new_passwd2:
                raise UserActionException(_('New password and its confirmation do not match.'))

            if not auth.validate_new_password(new_passwd):
                raise UserActionException(auth.get_required_password_properties())

            auth.update_user_password(self.session_get('user', 'id'), new_passwd)
            return {}

    def _load_query_history(self, offset, limit, from_date, to_date, query_type, current_corpus, archived_only):
        if plugins.runtime.QUERY_STORAGE.exists:
            corpname = self.args.corpname if current_corpus else None
            with plugins.runtime.QUERY_STORAGE as qs:
                rows = qs.get_user_queries(
                    self.session_get('user', 'id'),
                    self.cm,
                    offset=offset, limit=limit,
                    query_type=query_type, corpname=corpname,
                    from_date=from_date, to_date=to_date,
                    archived_only=archived_only)
        else:
            rows = ()
        return rows

    @exposed(access_level=1)
    def query_history(self, request):
        self.disabled_menu_items = USER_ACTIONS_DISABLED_ITEMS
        num_records = int(settings.get('plugins', 'query_storage').get('page_num_records', 0))
        # offset=0, limit=100, from_date='', to_date='', query_type='', current_corpus=''
        offset = int(request.args.get('offset', '0'))
        pages = 1
        from_date = request.args.get('from_date')
        to_date = request.args.get('to_date')
        query_type = request.args.get('query_type')
        current_corpus = int(request.args.get('current_corpus', '0'))
        archived_only = bool(int(request.args.get('archived_only', '0')))

        rows = self._load_query_history(query_type=query_type, current_corpus=current_corpus,
                                        from_date=from_date, to_date=to_date, archived_only=archived_only,
                                        offset=offset, limit=num_records * pages)
        return dict(
            data=rows,
            from_date=from_date,
            to_date=to_date,
            offset=offset,
            limit=num_records * pages,
            page_num_records=num_records
        )

    @exposed(access_level=1, return_type='json', skip_corpus_init=True)
    def ajax_query_history(self, request):
        offset = int(request.args.get('offset', '0'))
        limit = int(request.args.get('limit'))
        query_type = request.args.get('query_type')
        current_corpus = int(request.args.get('current_corpus', '0'))
        archived_only = bool(int(request.args.get('archived_only', '0')))
        rows = self._load_query_history(query_type=query_type, current_corpus=current_corpus,
                                        from_date=None, to_date=None, archived_only=archived_only,
                                        offset=offset, limit=limit)
        return dict(
            data=rows,
            from_date=None,
            to_date=None,
            offset=offset,
            limit=limit
        )

    @exposed(return_type='html', legacy=True, skip_corpus_init=True)
    def ajax_get_toolbar(self):
        with plugins.runtime.APPLICATION_BAR as ab:
            return ab.get_contents(plugin_api=self._plugin_api, return_url=self.return_url)

    @exposed(return_type='json', skip_corpus_init=True)
    def ajax_user_info(self, request):
        with plugins.runtime.AUTH as auth:
            user_info = auth.get_user_info(self.session_get('user', 'id'))
            if not self.user_is_anonymous():
                return {'user': user_info}
            else:
                return {'user': {'username': user_info['username']}}

    @exposed(return_type='html', template='user/profile.tmpl', page_model='userProfile',
             skip_corpus_init=True, access_level=1)
    def profile(self, request):
        if not self._uses_internal_user_pages():
            raise UserActionException(_('This function is disabled.'))
        with plugins.runtime.AUTH as auth:
            user_info = auth.get_user_info(self.session_get('user', 'id'))
            if not self.user_is_anonymous():
                return {'user': user_info}
            else:
                return {'user': {'username': user_info['username']}}

    @exposed(skip_corpus_init=True, http_method='POST')
    def switch_language(self, request):
        if plugins.runtime.GETLANG.exists:
            pass  # TODO should the plug-in do something here?
        else:
            path_prefix = settings.get_str('global', 'action_path_prefix')
            self._new_cookies['kontext_ui_lang'] = request.form.get('language')
            self._new_cookies['kontext_ui_lang']['path'] = path_prefix if path_prefix else '/'
            self._new_cookies['kontext_ui_lang']['expires'] = time.strftime('%a, %d %b %Y %T GMT',
                                                                            time.gmtime(time.time() + 180 * 24 * 3600))
            self.redirect(request.form.get('continue'))
        return {}
