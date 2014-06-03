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
import re
from threading import local
try:
    from icu import Locale, Collator
except ImportError:
    import locale

    class Locale(object):
        def __init__(self, *args, **kwargs):
            pass

    class Collator(object):
        def __init__(self, locale):
            self.locale = locale

        def compare(self, s1, s2):
            return locale.strcoll(s1, s2)

        @staticmethod
        def createInstance(locale):
            return Collator(locale)


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


def export_string(s, to_encoding):
    """
    Exports a string from KonText to Manatee

    arguments:
    s -- converted string
    to_encoding -- target encoding
    """
    if type(s) is unicode:
        return s.encode(to_encoding)
    else:
        return s.decode('utf-8').encode(to_encoding)


def format_number(v, mask=None):
    """
    Converts a number (float, int) to a string with respect
    to configured formatting attached to current language.

    arguments:
    v -- int or float number to be converted
    mask -- optional formatting string
    """
    return _current.formatter.format_number(v, mask)


def sort(iterable, loc, key=None, reverse=False):
    """
    Creates new sorted list from passed list (or any iterable data) according to the passed locale.

    arguments:
    iterable -- iterable object (typically a list or a tuple)
    loc -- locale identifier (e.g. cs_CZ.UTF-8, en_US,...)
    key -- access to sorted value
    reverse -- whether the result should be in reversed order (default is False)
    """
    collator = Collator.createInstance(Locale(loc))
    return sorted(iterable, cmp=collator.compare, key=key, reverse=reverse)


def number_formatting(key=None):
    """
    Returns number formatting related configuration defined in respective formats.json file.
    Both, a single value and all the values can be retrieved.

    arguments:
    key -- concrete value; if none specified then all the key->value pairs are returned

    returns:
    a string if a key is specified and the value exists
    or a dict if no key is provided but the 'numbers' section still exists in formats.json
    or None if nothing is found
    """
    ans = _current.formatter.conf.get('numbers')
    if key is not None and ans is not None:
        ans = ans.get(key)
    return ans


def escape(s):
    """
    Escapes a CQL attribute value to protect it against RegExp evaluation
    """
    return re.compile(r'[][.*+{}?()|\\"$^]').sub(r'\\g<0>', s)


def camelize(s):
    """
    Converts underscore-separated identifier into a camel-case one
    (e.g. foo_and_bar will become fooAndBar)
    """
    a = [x for x in s.split('_') if len(x) > 0]
    return a[0] + ''.join([x[0].upper() + x[1:] for x in a[1:]])