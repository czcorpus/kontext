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

import re


def shorten(val, length=8, suffix='...', nice=False):
    """
    arguments:
    length -- the length of a resulting string (excluding suffix)
    suffix -- a custom saffix to be used (default is '...')
    nice -- if True then words are respected (and the length is not guaranteed to be exact)
    escape -- escape HTML-special characters
    """
    suff = suffix if len(val) > length else ''
    if nice and length < len(val):
        try:
            s = re.split(r'\s+', val[length::-1], maxsplit=1)[1][::-1]
        except IndexError:   # the string cannot be split into two strings
            s = val[:length]
    else:
        s = val[:length]
    return u'%s%s' % (s, suff)
