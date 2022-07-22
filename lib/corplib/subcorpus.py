# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-13

import datetime
from dataclasses import InitVar, asdict, dataclass
from typing import Any, Dict, List, Optional, Union

import ujson

TextTypesType = Dict[str, Union[List[str], List[int]]]

WithinType = List[Dict[str, Union[str, bool]]]  # negated, structure_name, attribute_cql


@dataclass
class SubcorpusIdent:
    """
    SubcorpusIdent is a base subcorpus identification dataclass.
    """
    # id is URL identifier of the subcoprus (typically with name 'usesubcorp' in URL)
    id: str
    name: str  # name user gives to the subcorpus
    corpname: str
    data_path: str


@dataclass
class SubcorpusRecord(SubcorpusIdent):
    """
    SubcorpusRecord is a database representation of a subcorpus. It contains all the data
    necessary to restore actual binary subcorpus at any time.
    """
    user_id: int
    author_id: int
    size: int
    created: datetime.datetime
    archived: datetime.datetime
    cql: InitVar[Optional[str]] = None
    within_cond: InitVar[Optional[str]] = None
    text_types: InitVar[Optional[str]] = None
    _cql: Optional[str] = None
    _within_cond: Optional[WithinType] = None
    _text_types: Optional[TextTypesType] = None

    def __post_init__(self, cql, within_cond, text_types):
        if within_cond:
            self._within_cond = ujson.loads(within_cond)
        if text_types:
            self._text_types = ujson.loads(text_types)
        if cql:
            self._cql = cql

    @property
    def within_cond(self):
        return self._within_cond

    @property
    def text_types(self):
        return self._text_types

    @property
    def cql(self):
        return self._cql

    def to_dict(self) -> Dict[str, Any]:
        """
        Method to get json serializable dict
        """
        res = asdict(self)
        res['timestamp'] = self.timestamp.timestamp()
        return res
