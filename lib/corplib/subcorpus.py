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

from dataclasses import InitVar, asdict, dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

import ujson as json
from dataclasses_json import config, dataclass_json

TextTypesType = Dict[str, Union[List[str], List[int]]]

WithinType = List[Dict[str, Union[str, bool]]]  # negated, structure_name, attribute_cql


@dataclass_json
@dataclass
class SubcorpusIdent:
    """
    SubcorpusIdent is a base subcorpus identification dataclass.
    """
    # id is URL identifier of the subcoprus (typically with name 'usesubcorp' in URL)
    id: str
    name: str  # name user gives to the subcorpus
    corpus_name: str
    data_path: str


@dataclass_json
@dataclass
class SubcorpusRecord(SubcorpusIdent):
    """
    SubcorpusRecord is a database representation of a subcorpus. It contains all the data
    necessary to restore actual binary subcorpus at any time.
    """
    user_id: int
    author_id: int
    size: int
    created: datetime = field(metadata=config(
        encoder=datetime.isoformat,
        decoder=datetime.fromisoformat))
    public_description: str
    data_path: str
    archived: Optional[datetime] = None
    cql: InitVar[Optional[str]] = None
    within_cond: InitVar[Optional[str]] = None
    text_types: InitVar[Optional[str]] = None
    _cql: Optional[str] = None
    _within_cond: Optional[WithinType] = None
    _text_types: Optional[TextTypesType] = None
    archived: Optional[datetime] = field(default=None, metadata=config(
        encoder=lambda x: datetime.isoformat(x) if x else None,
        decoder=lambda x: datetime.fromisoformat(x) if x else None))

    def __post_init__(self, cql, within_cond, text_types):
        if within_cond:
            self._within_cond = json.loads(within_cond)
        if text_types:
            self._text_types = json.loads(text_types)
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
        res['created'] = self.created.timestamp()
        res['archived'] = self.archived.timestamp() if self.archived else None
        return res
