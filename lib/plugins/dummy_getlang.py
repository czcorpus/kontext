# Copyright (c) 2014 Institute of the Czech National Corpus
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
A simple implementation of the 'getlang' plugin.
"""


class GetLang(object):
    """
    A getlang plugin implementation which always returns the 'fallback_lang'.

    arguments:
    cookie_name -- name of the cookie storing current language setting
    fallback_lang -- language code to be used in case no setting is found (default is '')
    """

    def __init__(self, cookie_name, fallback_lang='en_US'):
        self.cookie_name = cookie_name
        self.fallback_lang = fallback_lang

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
        return self.fallback_lang

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
    Creates a plug-in instance

    arguments:
    conf -- settings module or some compatible object (a compatible get() method is enough here)
    """
    cookie_name = conf.get('plugins', 'getlang')['ucnk:cookie']
    fallback_lang = conf.get('plugins', 'getlang').get('ucnk:fallback_lang', '')
    if fallback_lang is None:
        fallback_lang = ''
    return GetLang(cookie_name=cookie_name, fallback_lang=fallback_lang)

