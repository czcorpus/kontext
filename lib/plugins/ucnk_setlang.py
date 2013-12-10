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
A custom solution to obtain language settings in a non-KonText way
"""


class SetLang(object):
    """
    Please note that both fetch_current_language() and
    get_fallback_language() should not return None in any case.
    If you want to set system default locale just use '' (empty string).
    """

    def __init__(self, cookie_name, fallback_lang=''):
        self.cookie_name = cookie_name
        self.fallback_lang = fallback_lang

    def fetch_current_language(self, cookie):
        """
        Returns currently selected language
        """
        if self.cookie_name in cookie:
            return cookie[self.cookie_name].value
        return ''

    def get_fallback_language(self):
        """
        This is an optional method (i.e. KonText calls this only if
        a plugin implements this method).

        This specific implementation requires you to specify either an empty value
        or four-letter specification (language & country, e.g. en_US, cs_CZ etc.)
        """
        return self.fallback_lang


def create_instance(conf):
    cookie_name = conf.get('plugins', 'setlang')['ucnk:cookie']
    fallback_lang = conf.get('plugins', 'setlang').get('ucnk:fallback_lang', '')
    if fallback_lang is None:  # this is important ('' == default locale while None produces error)
        fallback_lang = ''
    return SetLang(cookie_name=cookie_name, fallback_lang=fallback_lang)

