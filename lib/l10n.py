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

"""
This module contains localization-related helper functions:

* number formatting
* date and time formatting
* string encoding (used mainly to ensure utf-8 is used even if
  Manatee uses a corpus with different encoding)

There are two important facts to consider when dealing with
internationalisation of KonText:

1. In WSGI environment, standard 'locale' cannot be used as
   it works per-process while WSGI typically operates in multi-threaded mode.
2. Manatee module contains method set_encoding() but it is module-global
   which is useless in multi-threaded environment as multiple requests are
   processed using the same module.
"""

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
        """
        Formats a number according to the current session locale. By default,
        two decimal places are displayed in case of float numbers. This can be
        modified ad-hoc using 'mask' parameter.

        arguments:
        v -- value to be converted; None is permitted (in such case, None is returned)
        mask -- allows e.g. changing number of decimal places passed to the formatter (e.g. '%01.8f'); please note
        that using some formatting masks may lead to unexpected results
        """
        if v is not None:
            ans = ''

            if type(v) in (int, long):
                n1 = str(v)
                n2 = ''
            elif type(v) is float:
                if mask is None:
                    mask = '%01.2f'
                n1, n2 = (mask % v).split('.')
            else:
                raise TypeError('format_number accepts only int and float types, %s obtained' % (type(v).__name__,))

            for i, v in enumerate(n1[::-1]):
                if i > 0 and i % self.conf['numbers']['numberGrouping'] == 0:
                    ans += self.conf['numbers']['thousandSeparator']
                ans += v
            ans = ans[::-1]
            if n2:
                ans += '%s%s' % (self.conf['numbers']['decimalSeparator'], n2)
        else:
            ans = None
        return ans


def configure(languages):
    """
    Configures the package. You can call this only once (once the application starts).
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


def time_formatting():
    """
    Returns a time formatting string (as used by time.strftime)
    according to the currently selected formats.json.
    """
    return _current.formatter.conf.get('time')


def date_formatting():
    """
    Returns a date formatting string (as used by time.strftime)
    according to the currently selected formats.json.
    """
    return _current.formatter.conf.get('date')


def datetime_formatting(separator=' '):
    """
    Returns combined formatting for date and time:
    [date format string][separator][time format string]
    according to the currently selected formats.json
    """
    return '%s%s%s' % (date_formatting(), separator, time_formatting())


def escape(s):
    """
    Escapes a CQL attribute value to protect it against RegExp evaluation

    TODO - this function should be located in a more appropriate module
    """
    return re.compile(r'[\'\]\[.*+{}?()|\\"$^]').sub(r'\\\g<0>', s)


def camelize(s):
    """
    Converts underscore-separated identifier into a camel-case one
    (e.g. foo_and_bar will become fooAndBar)

    TODO - this function should be located in a more appropriate module
    """
    a = [x for x in s.split('_') if len(x) > 0]
    return a[0] + ''.join([x[0].upper() + x[1:] for x in a[1:]])


def corpus_get_conf(corp, conf_key):
    """
    A helper function to retrieve values from corpus registry file using proper
    encoding conversion.

    arguments:
    corp -- a manatee.corpus instance
    conf_key -- a registry configuration value
    """
    if conf_key != 'ENCODING':
        return import_string(corp.get_conf(conf_key), from_encoding=corp.get_conf('ENCODING'))
    else:
        return corp.get_conf(conf_key)


def simplify_num(v):
    if v >= 1e12:
        return '%sT' % (round(v / 1e12, 0))
    if v >= 1e9:
        return '%dG' % (round(v / 1e9, 0))
    if v >= 1e6:
        return '%dM' % (round(v / 1e6, 0))
    if v >= 1e3:
        return '%dk' % (round(v / 1e3, 0))
    return '%d' % (round(v / 1e2, 0) * 100,)


def desimplify_num(v, strict=True):
    v = str(v)
    correct_suffs = ('k', 'M', 'G', 'T')
    if v[-1].isalpha():
        if strict and v[-1] not in correct_suffs:
            raise Exception('Unknown number suffix: %s' % v[-1])
        x = {'k': 1e3, 'm': 1e6, 'g': 1e9, 't': 1e12}.get(v[-1].lower(), None)
        if x is None:
            x = 1
        return int(v[:-1]) * x
    else:
        return int(v)