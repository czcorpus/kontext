# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

import os
from collections import defaultdict

from plugin_types.getlang import AbstractGetLang
from sanic.cookies.request import CookieRequestParameters


def normalize_lang(s: str): return s.replace('-', '_')


class GetLang(AbstractGetLang):
    """
    A simple implementation of the 'getlang' plugin where a selected
    language is stored in a defined cookie.

    arguments:
    cookie_name -- name of the cookie storing current language setting
    fallback_lang -- language code to be used in case no setting is found (default is '')
    """

    def __init__(self, cookie_name: str, fallback_lang: str = 'en_US'):
        self.cookie_name = cookie_name
        self.fallback_lang = fallback_lang
        self._translations = self.fetch_translations()

    @staticmethod
    def fetch_translations():
        ans = defaultdict(lambda: [])
        ans['en'].append('en_US')
        root_dir = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'locale')
        for item in os.listdir(root_dir):
            c = item.split('_')[0]
            ans[c].append(item)
        return ans

    def fetch_current_language(self, source):
        """
        Returns currently selected language. In this specific
        implementation it is always the 'fallback_lang' (i.e. the
        'source' argument is not used in any way).

        arguments:
        source -- any Cookie.BaseCookie compatible implementation

        returns:
        underscore-separated ISO 639 language code and ISO 3166 country code
        of the detected language or an empty string in case no value was found
        """
        code = self.fallback_lang
        if not isinstance(source, CookieRequestParameters):
            raise TypeError(
                f'{__file__} plugin expects CookieRequestParameters instance as a source')
        cookie = source.get(self.cookie_name)
        if cookie is not None:
            key = normalize_lang(cookie).split('_')[0]
            variants = self._translations[key]
            if len(variants) > 0:
                code = variants[0]
        return code


def create_instance(conf):
    """
    Creates a plug-in instance

    arguments:
    conf -- settings module or some compatible object (a compatible get() method is enough here)
    """
    cookie_name = conf.get('plugins', 'getlang')['cookie']
    fallback_lang = conf.get('plugins', 'getlang').get('fallback_lang', '')
    if fallback_lang is None:
        fallback_lang = ''
    else:
        fallback_lang = fallback_lang.replace('-', '_')
    return GetLang(cookie_name=cookie_name, fallback_lang=fallback_lang)
