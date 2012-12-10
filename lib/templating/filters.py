# Copyright (c) 2012 Czech National Corpus
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
Custom Cheetah filters for the Bonito 2 interface
"""
import locale
from Cheetah.Filters import Filter

class IntegerFormatter(Filter):
    """
    Formats integer numbers according to the locales currently set
    """
    def filter(self, val, **kw):
        if val:
            return locale.format('%d', val, True).decode('UTF-8')
        return str(val)


class FloatFormatter(Filter):
    """
    Formats float numbers according to the locales currently set
    """

    def filter(self, val, **kw):
        if val:
            return locale.format('%01.2f', val, True).decode('UTF-8')
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
