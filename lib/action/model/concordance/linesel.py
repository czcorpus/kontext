# Copyright(c) 2016 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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


from typing import Any, Dict, Iterator, List, Tuple, Union


class LinesGroups:
    """
    Handles concordance lines groups manually defined by a user.
    It is expected that the controller has always an instance of
    this class available (i.e. no None value).
    """

    def __init__(self, data: List[Any]) -> None:
        if not isinstance(data, list):
            raise ValueError('LinesGroups data argument must be a list')
        self.data = data
        self.sorted = False

    def __len__(self) -> int:
        return len(self.data) if self.data else 0

    def __iter__(self) -> Iterator:
        return iter(self.data) if self.data else iter([])

    def serialize(self) -> Dict[str, Any]:
        return {'data': self.data, 'sorted': self.sorted}

    def as_list(self) -> List[Any]:
        return self.data if self.data else []

    def is_defined(self) -> bool:
        return len(self.data) > 0

    @staticmethod
    def deserialize(data: Union[Dict[str, Any], List[Tuple[str, Any]]]) -> 'LinesGroups':
        data_dict = dict(data) if isinstance(data, list) else data
        ans = LinesGroups(data_dict.get('data', []))
        ans.sorted = data_dict.get('sorted', False)
        return ans
