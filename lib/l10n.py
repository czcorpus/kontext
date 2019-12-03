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

import re
from functools import cmp_to_key
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


def import_string(s, from_encoding):
    """
    Imports a string from Manatee to KonText

    arguments:
    s -- converted string
    from_encoding -- expected source encoding
    """
    if type(s) is str:
        if from_encoding.lower() in ('utf-8', ''):
            return s
        else:
            return s.decode(from_encoding)
    elif type(s) is str:
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
    if type(s) is str:
        return s.encode(to_encoding)
    else:
        return s.decode('utf-8').encode(to_encoding)


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
    if key is None:
        kf = cmp_to_key(collator.compare)
    else:
        def tmp(v1, v2):
            return collator.compare(key(v1), key(v2))
        kf = cmp_to_key(tmp)
    return sorted(iterable, key=kf, reverse=reverse)


def time_formatting():
    """
    Returns a time formatting string (as used by time.strftime)
    according to the currently selected formats.json.
    """
    return _current.formatter.conf.get('time')


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
