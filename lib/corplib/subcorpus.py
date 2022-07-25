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

"""
This module defines a backend-independent subcorpus representation.
"""

TextTypesType = Dict[str, Union[List[str], List[int]]]
"""
({attrA: [value_A1, ...,value_Aa], ..., attrZ: [value_Z1, ...,valueZz) 
"""
# TODO: I am not very sure about the List[int] here

WithinType = List[Dict[str, Union[str, bool]]]
"""
for each structural attribute, specify: negated? (!within), structure_name, attribute_cql
"""


@dataclass_json
@dataclass
class SubcorpusIdent:
    """
    SubcorpusIdent is a base subcorpus identification dataclass. It contains all the
    necessary data for opening a Manatee subcorpus.

    Attributes:
        id: a URL identifier of the subcoprus (typically with name 'usesubcorp' in URL)
        name:  name user gives to the subcorpus
        corpus_name: an identifier of the corpus (registry file name)
        data_path: a relative path (to a configured common root for all user subcorpora) of actual data files
    """
    id: str
    name: str
    corpus_name: str
    data_path: str


@dataclass_json
@dataclass
class SubcorpusRecord(SubcorpusIdent):
    """
    SubcorpusRecord is a database representation of a subcorpus. It contains all the data
    necessary to restore actual binary subcorpus at any time.

    Attributes:
        user_id: user ID of actual owner; this is removed once user deletes the corpus (but it is still avail.
            via existing URLs)
        author_id: user ID of the author (this is kept no matter whether corpus is active/archived/deleted)
        size: size of the subcorpus in tokens
        created: datetime of corpus creation
        public_description: a public descripton (Markdown format) allows the subcorpus to be searched on the
            "published subcorpora" page
        archived: datetime specifying when the subcorpus was archived (= not listed anywhere by default but URLs
            with the subcorpus are still available
        cql: (mutually exclusive with 'within_cond' and 'text_types') defines a raw CQL specification of the subcorpus;
            this is mainly for legacy reasons as no user interface allows creating new subcorpus in this way
        within_cond (mutually exclusive with 'cql' and 'text_types') defines a set of CQL expressions to specify
            a subcorpus using a "within helper form"
        text_types (mutually exclusive with 'cql' and 'within_cond') defines an encoded set of individually selected
            structural attributes and their values:
            ({attrA: [value_A1, ...,value_Aa], ..., attrZ: [value_Z1, ...,valueZz)

    """
    user_id: int
    author_id: int
    size: int
    created: datetime = field(metadata=config(
        encoder=datetime.isoformat,
        decoder=datetime.fromisoformat))
    public_description: str
    archived: Optional[datetime] = None
    published: Optional[datetime] = None
    cql: Optional[str] = None
    within_cond: Optional[WithinType] = None
    text_types: Optional[TextTypesType] = None

    def prepare_response(self) -> Dict[str, Any]:
        """
        Method to get json serializable dict
        """
        res = asdict(self)
        res['created'] = self.created.timestamp()
        res['archived'] = self.archived.timestamp() if self.archived else None
        res['published'] = self.published.timestamp() if self.archived else None
        del res['data_path']
        return res
