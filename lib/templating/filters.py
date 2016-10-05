# Copyright (c) 2012 Institute of the Czech National Corpus
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

"""
Custom Cheetah filters for the KonText interface
"""
from Cheetah.Filters import Filter
import json
import urllib
from datetime import datetime
import time
import re

from l10n import format_number
from l10n import datetime_formatting


class IntegerFormatter(Filter):
    """
    Formats integer numbers according to the locales currently set
    """
    def filter(self, val, **kw):
        if val:
            return format_number(val)
        return str(val)


class FloatFormatter(Filter):
    """
    Formats float numbers according to the locales currently set
    """

    def filter(self, val, **kw):
        if val:
            return format_number(val, mask='%01.2f')
        return str(val)


class HtmlEscape(Filter):
    """
    """

    def filter(self, val, **kw):
        val = val.replace('&', '&amp;')
        val = val.replace('<', '&lt;')
        val = val.replace('>', '&gt;')
        val = val.replace('"', '&quot;')
        val = val.replace("'", '&apos;')
        return val


class Shortener(Filter):
    """
    arguments:
    length -- the length of a resulting string (excluding suffix)
    suffix -- a custom saffix to be used (default is '...')
    nice -- if True then words are respected (and the length is not guaranteed to be exact)
    escape -- escape HTML-special characters
    """
    def filter(self, val, **kw):
        length = kw['length'] if 'length' in kw else 8
        if len(val) > length:
            suff = kw['suffix'] if 'suffix' in kw else '...'
        else:
            suff = ''

        if kw.get('nice', False) and length < len(val):
            try:
                s = re.split(r'\s+', val[length::-1], maxsplit=1)[1][::-1]
            except IndexError:   # the string cannot be split into two strings
                s = val[:length]
        else:
            s = val[:length]
        if kw.get('escape', False):
            s = HtmlEscape().filter(s)
        return '%s%s' % (s, suff)


class Join(Filter):
    def filter(self, val, **kw):
        separ = kw.get('separator', ', ')
        mask = kw.get('mask', '%s')
        return separ.join([mask % v for v in val])


class URLEncode(Filter):
    def filter(self, val, **kw):
        if type(val) is unicode:
            val = val.encode('utf-8')
        return urllib.quote(val)


class Datetime(Filter):
    def filter(self, val, **kw):
        if type(val) is datetime:
            return time.strftime(datetime_formatting(), val.timetuple())
        elif type(val) is str:
            return val
        else:
            return '??'


class Bool2Num(Filter):
    def filter(self, val, **kw):
        if type(val) is bool:
            return str(int(val))
        elif type(val) is str:
            return {'true': '1', 'false': '0'}[val.lower()]
        else:
            return str(int(bool(val)))