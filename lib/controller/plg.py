# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

import settings
import plugins
from texttypes import get_tt


class PluginApi(object):

    def __init__(self, controller, request, cookies):
        self._controller = controller
        self._request = request
        self._cookies = cookies
        self._shared_data = {}

    def set_shared(self, key, value):
        self._shared_data[key] = value

    def get_shared(self, key, default=None):
        return self._shared_data.get(key, default)

    def get_from_environ(self, key, default=None):
        """
        Return a WSGI environment variable
        """
        return self._controller.environ.get(key, default)

    @property
    def request(self):
        return self._request

    @property
    def cookies(self):
        return self._cookies

    @property
    def session(self):
        return self._request.session

    def refresh_session_id(self):
        return self._controller.refresh_session_id()

    @property
    def user_lang(self):
        return self._controller.ui_lang

    @property
    def user_id(self):
        return self._request.session.get('user', {'id': None}).get('id')

    @property
    def user_dict(self):
        return self._request.session.get('user', {'id': None})

    @property
    def user_is_anonymous(self):
        return self._controller.user_is_anonymous()

    @property
    def current_corpus(self):
        return self._controller.corp

    @property
    def aligned_corpora(self):
        return self._controller.args.align

    @property
    def current_url(self):
        return self._controller.get_current_url()

    @property
    def root_url(self):
        return self._controller.get_root_url()

    def create_url(self, action, params):
        return self._controller.create_url(action, params)

    def updated_current_url(self, args):
        return self._controller.updated_current_url(args)

    def redirect(self, url, code=303):
        return self._controller.redirect(url, code=code)

    def set_not_found(self):
        return self._controller.set_not_found()

    def add_system_message(self, msg_type, text):
        self._controller.add_system_message(msg_type, text)

    @property
    def text_types(self):
        ans = {}
        maxlistsize = settings.get_int('global', 'max_attr_list_size')
        subcorpattrs = self.current_corpus.get_conf('SUBCORPATTRS')
        if not subcorpattrs:
            subcorpattrs = self.current_corpus.get_conf('FULLREF')
        tt = get_tt(self.current_corpus, self).export(subcorpattrs, maxlistsize)
        for item in tt:
            for tt2 in item['Line']:
                ans[tt2['name']] = {'type': 'default', 'values': [x['v']
                                                                  for x in tt2.get('Values', [])]}
        return ans
