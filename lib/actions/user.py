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
from argmapping import ConcArgsMapping
import l10n


class User(Kontext):

    def __init__(self, request, ui_lang):
        super(User, self).__init__(request, ui_lang)

    def get_mapping_url_prefix(self):
        return '/user/'

    @staticmethod
    def _is_anonymous_id(user_id):
        return plugins.get('auth').is_anonymous(user_id)

    @exposed(skip_corpus_init=True)
    def login(self, request):
        self.disabled_menu_items = (MainMenu.NEW_QUERY, MainMenu.VIEW,
                                    MainMenu.SAVE, MainMenu.CORPORA, MainMenu.CONCORDANCE,
                                    MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)
        return {}

    @exposed(template='user/login.tmpl', skip_corpus_init=True)
    def loginx(self, request):
        ans = {}
        self._session['user'] = plugins.get('auth').validate_user(request.form['username'],
                                                                  request.form['password'])

        if self._session['user'].get('id', None):
            self._redirect('%sfirst_form' % (self.get_root_url(), ))
        else:
            self.disabled_menu_items = (MainMenu.NEW_QUERY, MainMenu.VIEW,
                                        MainMenu.SAVE, MainMenu.CORPORA, MainMenu.CONCORDANCE,
                                        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)
            self.add_system_message('error', _('Incorrect username or password'))
        self.refresh_session_id()
        return ans

    @exposed(access_level=1, template='user/login.tmpl', skip_corpus_init=True)
    def logoutx(self, request):
        self.disabled_menu_items = (MainMenu.NEW_QUERY, MainMenu.VIEW,
                                    MainMenu.SAVE, MainMenu.CORPORA, MainMenu.CONCORDANCE,
                                    MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)
        plugins.get('auth').logout(self._session)
        self._init_session()
        self.refresh_session_id()

        return {
            'message': ('info', _('You have been logged out'))
        }

    @exposed(access_level=1, template='user/user_password_form.tmpl')
    def user_password_form(self, request):
        if not self._uses_internal_user_pages():
            raise UserActionException(_('This function is disabled.'))
        return {}

    @exposed(access_level=1, template='user/user_password.tmpl')
    def user_password(self, request):
        auth = plugins.get('auth')
        try:
            curr_passwd = request.form['curr_passwd']
            new_passwd = request.form['new_passwd']
            new_passwd2 = request.form['new_passwd2']

            if not self._uses_internal_user_pages():
                raise UserActionException(_('This function is disabled.'))
            logged_in = auth.validate_user(self._session_get('user', 'user'), curr_passwd)

            if self._is_anonymous_id(logged_in['id']):
                raise UserActionException(_('Invalid user or password'))
            if new_passwd != new_passwd2:
                raise UserActionException(_('New password and its confirmation do not match.'))

            if not auth.validate_new_password(new_passwd):
                raise UserActionException(auth.get_required_password_properties())

            auth.update_user_password(self._session_get('user', 'id'), new_passwd)
        except UserActionException as e:
            self.add_system_message('error', e)
        return {}

    def _load_query_history(self, offset, limit, from_date, to_date, query_type, current_corpus):
        if plugins.has_plugin('query_storage'):
            from query_history import Export

            if current_corpus:
                corpname = self.args.corpname
            else:
                corpname = None

            exporter = Export(corpus_manager=self.cm, corpname_canonizer=self._canonical_corpname,
                              url_creator=self.create_url)
            rows = plugins.get('query_storage').get_user_queries(
                self._session_get('user', 'id'),
                offset=offset, limit=limit,
                query_type=query_type, corpname=corpname,
                from_date=from_date, to_date=to_date)
            rows = [exporter.export_row(row) for row in rows]
        else:
            rows = ()
        return rows

    @exposed(access_level=1, legacy=True)
    def query_history(self, offset=0, limit=100, from_date='', to_date='', query_type='', current_corpus=''):
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.SAVE,
                                    MainMenu.CONCORDANCE, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS)
        self._reset_session_conc()  # TODO in case user returns using back button, this may produce UX problems
        num_records = int(settings.get('plugins', 'query_storage').get('ucnk:page_num_records', 0))

        if not offset:
            offset = 0
        if not limit:
            limit = 0
        rows = self._load_query_history(from_date=from_date, query_type=query_type, current_corpus=current_corpus,
                                        to_date=to_date, offset=offset, limit=num_records)
        return {
            'data': rows,
            'from_date': from_date,
            'to_date': to_date,
            'offset': offset,
            'limit': limit,
            'page_num_records': num_records,
            'page_append_records': settings.get('plugins', 'query_storage').get('ucnk:page_append_records', 0)
        }

    @exposed(access_level=1, return_type='json', legacy=True)
    def ajax_query_history(self, current_corpus='', offset=0, limit=20, query_type=''):
        if not offset:
            offset = 0
        if not limit:
            limit = 0
        rows = self._load_query_history(offset=offset, limit=limit, query_type=query_type,
                                        current_corpus=current_corpus, from_date=None, to_date=None)
        return {
            'data': rows,
            'from_date': None,
            'to_date': None,
            'offset': offset,
            'limit': limit
        }

    @exposed(return_type='json', argmappings=(ConcArgsMapping,), access_level=1, skip_corpus_init=True)
    def set_favorite_item(self, request, conc_args):
        """
        """
        main_corp = self.cm.get_Corpus(request.form['corpus_id'], request.form['subcorpus_id'])
        corp_size = main_corp.search_size()
        data = {
            'corpora': [],
            'canonical_id': request.form['canonical_id'],
            'corpus_id': request.form['corpus_id'],
            'subcorpus_id': request.form['subcorpus_id'],
            'name': request.form['name'],
            'size': corp_size,
            'size_info': l10n.simplify_num(corp_size),
            'type': request.form['type']
        }

        aligned_corpnames = request.form.getlist('corpora[]')
        for ac in aligned_corpnames:
            data['corpora'].append({
                'name': ac,  # TODO fetch real name??
                'corpus_id': ac,
                'canonical_id': self._canonical_corpname(ac),
                'type': 'corpus'
            })

        item = plugins.get('user_items').from_dict(data)
        plugins.get('user_items').add_user_item(self._session_get('user', 'id'), item)
        return {'id': item.id}

    @exposed(return_type='json', access_level=1, skip_corpus_init=True)
    def unset_favorite_item(self, request):
        plugins.get('user_items').delete_user_item(
            self._session_get('user', 'id'), request.form['id'])
        return {}

    @exposed(return_type='json', access_level=1, skip_corpus_init=True)
    def get_favorite_corpora(self, request):
        return lambda: plugins.get('user_items').to_json(self._load_fav_items())

    @exposed(return_type='html', template='empty.tmpl', legacy=True, skip_corpus_init=True)
    def ajax_get_toolbar(self):
        html = plugins.get('application_bar').get_contents(plugin_api=self._plugin_api,
                                                           return_url=self.return_url)
        return {'html': html}
