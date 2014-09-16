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

from l10n import format_number


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
    def filter(self, val, **kw):
        length = kw['length'] if 'length' in kw else 8
        if len(val) > length:
            suff = kw['suffix'] if 'suffix' in kw else '...'
        else:
            suff = ''
        return '%s%s' % (val[:length], suff)


class Jsonize(Filter):
    def filter(self, val, **kw):
        return json.dumps(val)


class URLEncode(Filter):
    def filter(self, val, **kw):
        if type(val) is unicode:
            val = val.encode('utf-8')
        return urllib.quote(val)