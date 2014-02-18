# Copyright (c) 2014  Institute of the Czech National Corpus
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import os
import json
from threading import local

_formats = {}  # contains lang_code -> Formatter() pairs
_current = local()  # thread-local variable stores per-request formatter


class Formatter(object):
    """
    Formatter handles miscellaneous conversions of values to strings.
    """
    def __init__(self, conf):
        self.conf = conf

    def format_number(self, v, mask=None):
        ans = ''

        if type(v) is int:
            n1 = str(v)
            n2 = ''
        elif type(v) is float:
            if mask is None:
                mask = '%01.2f'
            n1, n2 = (mask % v).split('.')
        else:
            raise TypeError('format_number accepts only int and float types')

        for i, v in enumerate(n1[::-1]):
            if i > 0 and i % self.conf['numbers']['numberGrouping'] == 0:
                ans += self.conf['numbers']['thousandSeparator']
            ans += v
        ans = ans[::-1]
        if n2:
            ans += '%s%s' % (self.conf['numbers']['decimalSeparator'], n2)
        return ans


def configure(languages):
    """
    Configures package strings. You can call this only once (once the application starts).
    It loads all supported languages and creates respective Formatter objects.

    arguments:
    languages -- list of lang codes (cs_CZ, en_US, ...)
    """
    root_dir = '%s/../locale' % os.path.dirname(__file__)
    for item in os.listdir(root_dir):
        if item in languages:
            _formats[item] = Formatter(json.load(open('%s/%s/formats.json' % (root_dir, item))))
    if not 'en_US' in _formats:
        _formats['en_US'] = Formatter(json.load(open('%s/en_US/formats.json' % (root_dir, ))))


def activate(lang):
    """
    Per-request activation of a specific formatting

    arguments:
    lang -- a language code (cs_CZ, en_US,...)
    """
    _current.formatter = _formats[lang]


def import_string(s, from_encoding):
    """
    Imports a string from Manatee to KonText

    arguments:
    s -- converted string
    from_encoding -- expected source encoding
    """
    if type(s) is str:
        if from_encoding.lower() in ('utf-8', ''):
            return s.decode('utf-8')
        else:
            return s.decode(from_encoding)
    elif type(s) is unicode:
        return s
    else:
        return None  # TODO raise an exception


def export_string(s, from_encoding):
    """
    Exports a string from KonText to Manatee

    arguments:
    s -- converted string
    from_encoding -- target encoding
    """
    if type(s) is unicode:
        return s.encode(from_encoding)
    else:
        return s.decode('utf-8').encode(from_encoding)


def format_number(v, mask=None):
    """
    Converts a number (float, int) to a string with respect
    to configured formatting attached to current language.

    arguments:
    v -- int or float number to be converted
    mask -- optional formatting string
    """
    return _current.formatter.format_number(v, mask)