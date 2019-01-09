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
import logging

from controller import exposed
from controller.errors import UserActionException, ImmediateRedirectException
from controller.kontext import Kontext
from main_menu import MainMenu
from translation import ugettext as _
import plugins
from plugins.abstract.auth import SignUpNeedsUpdateException
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

    @exposed(skip_corpus_init=True, template='user/login.tmpl', http_method='POST')
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

    @exposed(access_level=1, template='user/login.tmpl', skip_corpus_init=True, page_model='login', http_method='POST')
    def logoutx(self, request):
        self.disabled_menu_items = USER_ACTIONS_DISABLED_ITEMS
        plugins.runtime.AUTH.instance.logout(self._session)
        self.init_session()
        self.refresh_session_id()
        plugins.runtime.AUTH.instance.logout_hook(self._plugin_api)
        self.redirect(self.create_url('first_form', {}))
        return {}

    @exposed(access_level=0, template='user/administration.tmpl', skip_corpus_init=True, page_model='userSignUp',
             http_method='GET')
    def sign_up_form(self, request):
        ans = dict(credentials_form={}, username_taken=False, user_registered=False)
        with plugins.runtime.AUTH as auth:
            token_key = request.args.get('key')
            username_taken = bool(int(request.args.get('username_taken', '0')))
            if token_key:
                credentials = auth.get_form_props_from_token(token_key)
                if not credentials:
                    raise UserActionException('Invalid confirmation token')
                del credentials['password']
                ans['credentials_form'] = credentials
                ans['username_taken'] = username_taken
            if not self.user_is_anonymous():
                raise UserActionException('You are already registered')
            else:
                ans['user'] = dict(username=None)
        return ans

    @exposed(access_level=0, skip_corpus_init=True, return_type='json', http_method='POST')
    def sign_up(self, request):
        with plugins.runtime.AUTH as auth:
            errors = auth.sign_up_user(self._plugin_api, dict(
                username=request.form['username'],
                firstname=request.form['firstname'],
                lastname=request.form['lastname'],
                email=request.form['email'],
                password=request.form['password'],
                password2=request.form['password2']
            ))
        if len(errors) == 0:
            return dict(ok=True)
        else:
            raise UserActionException(_('Failed to sign up user'), error_args=errors)

    @exposed(access_level=0, skip_corpus_init=True, return_type='json', http_method='GET')
    def test_username(self, request):
        with plugins.runtime.AUTH as auth:
            available, valid = auth.validate_new_username(
                self._plugin_api, request.args['username'])
            return dict(available=available if available and valid else False, valid=valid)

    @exposed(access_level=0, skip_corpus_init=True, http_method='GET', template='user/token_confirm.tmpl',
             page_model='userTokenConfirm')
    def sign_up_confirm_email(self, request):
        with plugins.runtime.AUTH as auth:
            try:
                key = request.args['key']
                ans = dict(sign_up_url=self.create_url('user/sign_up_form', {}))
                ans.update(auth.sign_up_confirm(self._plugin_api, key))
                return ans
            except SignUpNeedsUpdateException as ex:
                logging.getLogger(__name__).warning(ex)
                raise ImmediateRedirectException(self.create_url('user/sign_up_form',
                                                                 dict(key=key, username_taken=1)))

    @exposed(access_level=1, http_method='POST', skip_corpus_init=True, return_type='json')
    def set_user_password(self, request):
        with plugins.runtime.AUTH as auth:
            curr_passwd = request.form['curr_passwd']
            new_passwd = request.form['new_passwd']
            new_passwd2 = request.form['new_passwd2']
            fields = dict(curr_passwd=True, new_passwd=True, new_passwd2=True)
            ans = dict(fields=fields, messages=[])

            if not self._uses_internal_user_pages():
                raise UserActionException(_('This function is disabled.'))
            logged_in = auth.validate_user(
                self._plugin_api, self.session_get('user', 'user'), curr_passwd)

            if self._is_anonymous_id(logged_in['id']):
                fields['curr_passwd'] = False
                ans['messages'].append(_('Invalid user or password'))
                return ans

            if new_passwd != new_passwd2:
                fields['new_passwd'] = False
                fields['new_passwd2'] = False
                ans['messages'].append(_('New password and its confirmation do not match.'))
                return ans

            if not auth.validate_new_password(new_passwd):
                ans['messages'].append(auth.get_required_password_properties())
                fields['new_passwd'] = False
                fields['new_passwd2'] = False
                return ans

            auth.update_user_password(self.session_get('user', 'id'), new_passwd)
            return ans

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

    @exposed(return_type='template', skip_corpus_init=True)
    def ajax_get_toolbar(self, _):
        with plugins.runtime.APPLICATION_BAR as ab:
            return ab.get_contents(plugin_api=self._plugin_api, return_url=self.return_url)

    @exposed(return_type='json', skip_corpus_init=True)
    def ajax_user_info(self, request):
        with plugins.runtime.AUTH as auth:
            user_info = auth.get_user_info(self._plugin_api)
            if not self.user_is_anonymous():
                return {'user': user_info}
            else:
                return {'user': {'username': user_info['username']}}

    @exposed(return_type='template', template='user/administration.tmpl', page_model='userProfile',
             skip_corpus_init=True, access_level=1)
    def profile(self, request):
        if not self._uses_internal_user_pages():
            raise UserActionException(_('This function is disabled.'))
        with plugins.runtime.AUTH as auth:
            user_info = auth.get_user_info(self._plugin_api)
            if not self.user_is_anonymous():
                return dict(credentials_form=user_info, user_registered=True)
            else:
                return dict(credentials_form=dict(username=user_info['username']), user_registered=False)

    @exposed(skip_corpus_init=True, http_method='POST', access_level=0)
    def switch_language(self, request):
        if plugins.runtime.GETLANG.exists:
            pass  # TODO should the plug-in do something here?
        else:
            path_prefix = settings.get_str('global', 'action_path_prefix')
            self._new_cookies['kontext_ui_lang'] = request.form.get('language')
            self._new_cookies['kontext_ui_lang']['path'] = path_prefix if path_prefix else '/'
            self._new_cookies['kontext_ui_lang']['expires'] = time.strftime('%a, %d %b %Y %T GMT',
                                                                            time.gmtime(time.time() + 180 * 24 * 3600))
            self.redirect(
                request.environ.get('HTTP_REFERER', self.create_url('first_form', dict(corpname=self.args.corpname))))
        return {}
