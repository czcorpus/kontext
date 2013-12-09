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

    def __init__(self, cookie_name):
        self.cookie_name = cookie_name

    def fetch_current_language(self, cookie):
        if self.cookie_name in cookie:
            return cookie[self.cookie_name].value
        return ''


def create_instance(conf):
    cookie_name = conf.get('plugins', 'setlang')['ucnk:cookie']
    return SetLang(cookie_name=cookie_name)

