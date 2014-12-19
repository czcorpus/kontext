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