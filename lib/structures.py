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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

"""
Miscellaneous data structures
"""

import inspect


class FixedDict(object):
    """
    This class allows creating objects with predefined attributes
    (defined via static properties). Any attempt to set an attribute
    not present as a static property raises AttributeError.

    Private-like attributes (i.e. the ones starting with underscore)
    are ignored by FixedDict.
    """

    def __setattr__(self, key, value):
        if key[0] != '_' and key not in dict(inspect.getmembers(self.__class__)):
            raise AttributeError('No such attribute: %s' % key)
        else:
            self.__dict__[key] = value

    def __init__(self, **kw):
        for item in inspect.getmembers(self.__class__):
            if not item[0].startswith('__') and not callable(getattr(self, item[0], None)):
                self.__dict__[item[0]] = item[1]
        for k, v in list(kw.items()):
            setattr(self, k, v)

    def __iter__(self):
        for k, v in list(self.__dict__.items()):
            yield k, v

    def to_dict(self):
        return dict(self.__dict__)
