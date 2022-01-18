# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

from collections import defaultdict
from typing import Dict, Union, Any, List, Iterable, Optional


class MultiDict:
    """
    A key->[list of values] dictionary for simple values
    (ints, strings, bools).
    """

    def __init__(self, data: Dict[str, Union[Any, List[Any]]]):
        """
        arguments:
            data -- a dictionary where value can be a list of values
                    or a single value (in such case, it is converted to
                    a single value list).
        """
        self._data = defaultdict(lambda: [])
        for k, v in data.items():
            if type(v) is list:
                self._data[k] = v
            elif isinstance(v, Iterable):
                self._data[v] = list(v)
            else:
                self._data[k].append(v)

    def __getitem__(self, key: str) -> Optional[Any]:
        """
        Return first item with the specified key.
        If no such item is available, None is returned.
        """
        if len(self._data[key]) > 0:
            return self._data[key][0]

    def __repr__(self):
        return dict(self._data).__repr__()

    def getlist(self, item) -> List[Any]:
        return self._data[item]
