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

"""
A custom solution to obtain language settings from a cookie.

Required config.xml/plugins entries:

element getlang {
  element module { "ucnk_getlang" }
  element cookie {
    attribute extension-by { "ucnk" }
    text # name of the cookie
  }
}
"""
import os
import Cookie
from collections import defaultdict

from plugins.abstract.getlang import AbstractGetLang


def normalize_lang(s): return s.replace('-', '_')


class GetLang(AbstractGetLang):
    """
    Looks for a language settings in user's cookies. It is ok
    to return also None. In such case, KonText will try to
    infer the language from request headers.

    arguments:
    cookie_name -- name of the cookie storing current language setting
    fallback_lang -- language code to be used in case no setting is found (default is '')
    """

    def __init__(self, cookie_name, fallback_lang='en_US'):
        self.cookie_name = cookie_name
        self.fallback_lang = fallback_lang
        self._translations = self.fetch_translations()

    @staticmethod
    def fetch_translations():
        ans = defaultdict(lambda: [])
        root_dir = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'locale')
        for item in os.listdir(root_dir):
            c = item.split('_')[0]
            ans[c].append(item)
        return ans

    def fetch_current_language(self, source):
        """
        Returns currently selected language

        arguments:
        source -- any Cookie.BaseCookie compatible implementation

        returns:
        underscore-separated ISO 639 language code and ISO 3166 country code
        of the detected language or an empty string in case no value was found
        """
        code = self.fallback_lang
        if not isinstance(source, Cookie.BaseCookie):
            raise TypeError('%s plugin expects Cookie.BaseCookie instance as a source' % __file__)
        if self.cookie_name in source:
            code = normalize_lang(source[self.cookie_name].value).split('_')[0]
            variants = self._translations[code]
            if len(variants) > 0:
                code = variants[0]
        return code


def create_instance(conf):
    """
    arguments:
    conf -- settings module or some compatible object (a compatible get() method is enough here)
    """
    cookie_name = conf.get('plugins', 'getlang')['ucnk:cookie']
    fallback_lang = conf.get('plugins', 'getlang').get('ucnk:fallback_lang', 'en-US')
    return GetLang(cookie_name=cookie_name, fallback_lang=normalize_lang(fallback_lang))
