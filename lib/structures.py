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

import threading


class Nicedict(object):
    """
    A dictionary which does not throw KeyError in case user
    accesses a key which is not present.
    """
    def __init__(self, data=None, strict=False):
        self.data = data if data else {}
        self.strict = strict

    def __getitem__(self, k):
        if not self.strict:
            return self.data.get(k, None)
        else:
            return self.data[k]

    def __setitem__(self, k, v):
        self.data[k] = v

    def __contains__(self, k):
        return self.data.__contains__(k)

    def __delitem__(self, k):
        return self.data.__delitem__(k)

    def __len__(self):
        return self.data.__len__()

    def __iter__(self):
        return self.data.__iter__()

    def __str__(self):
        return self.data.__str__()

    def items(self):
        return self.data.items()

    def update(self, data):
        """
        Upates this dictionary using passed one

        arguments:
        data -- a Python dict or Nicedict
        """
        if isinstance(data, Nicedict):
            self.data.update(data.data)
        else:
            self.data.update(data)


class ThreadLocalData(object):
    """
    A class which provides a way to store and retrieve thread-local properties
    without interfering with normal properties.
    A predefined set of attributes can be specified to make the behavior more
    'static-like'.
    """

    def __init__(self, fixed_attrs=None):
        """
        arguments:
        fixed_attrs -- if a list or a tuple is provided then 'setlocal' and 'getlocal' check
        whether the requested attribute is one of fixed_attrs. If not then AttributeError
        is thrown.
        """
        self._local = threading.local()
        self._fixed_local = tuple(fixed_attrs) if fixed_attrs is not None else None

    def _validate(self, key):
        if self._fixed_local is not None and key not in self._fixed_local:
            raise AttributeError('Foo[local=%s] does not permit attribute %s' % (self._fixed_local, key))

    def haslocal(self, key):
        return hasattr(self._local, key)

    def setlocal(self, key, value):
        self._validate(key)
        setattr(self._local, key, value)

    def getlocal(self, *args):
        self._validate(args[0])
        try:
            return getattr(*((self._local,) + args))
        except AttributeError:
            raise AttributeError('%s object has no attribute %s' % (self.__class__.__name__, args[0]))