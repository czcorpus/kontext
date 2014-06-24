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

<getlang>
    <module>ucnk_setlang</module>
    <cookie extension-by="ucnk">[name of the cookie]</cookie>
</getlang>
"""
import os
import Cookie


class GetLang(object):
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

    def fetch_current_language(self, source):
        """
        Returns currently selected language

        arguments:
        source -- any Cookie.BaseCookie compatible implementation

        returns:
        underscore-separated ISO 639 language code and ISO 3166 country code
        of the detected language or an empty string in case no value was found
        """
        def fetch_translations():
            ans = {}
            root_dir = '%s/../../locale' % os.path.dirname(__file__)
            for item in os.listdir(root_dir):
                c1, c2 = item.split('_')
                if not c1 in ans:
                    ans[c1] = []
                ans[c1].append(item)
            return ans

        if not isinstance(source, Cookie.BaseCookie):
            raise TypeError('%s plugin expects Cookie.BaseCookie instance as a source' % __file__)
        if self.cookie_name in source:
            code = source[self.cookie_name].value
            if '_' not in code:
                avail_trans = fetch_translations()
                code = avail_trans.get(code, (None,))[0]
            return code
        return None

    def get_fallback_language(self):
        """
        This is an optional method (i.e. KonText calls this only if
        a plugin implements this method).

        This specific implementation requires you to specify either an empty value
        or underscore-separated ISO 639 language code and ISO 3166 country code
        """
        return self.fallback_lang


def create_instance(conf):
    """
    arguments:
    conf -- settings module or some compatible object (a compatible get() method is enough here)
    """
    cookie_name = conf.get('plugins', 'getlang')['ucnk:cookie']
    fallback_lang = conf.get('plugins', 'getlang').get('ucnk:fallback_lang', '')
    if fallback_lang is None:  # this is important ('' == default locale while None produces error)
        fallback_lang = ''
    return GetLang(cookie_name=cookie_name, fallback_lang=fallback_lang)

