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

import os
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Union

import aiofiles
from dataclasses_json import config, dataclass_json
from manatee import Concordance, Corpus, SubCorpus
from manatee import create_subcorpus as m_create_subcorpus

from ..abstract import SubcorpusIdent
from ..corpus import KCorpus
from ..errors import (
    CorpusInstantiationError, InvalidSubCorpFreqFileType,
    SubcorpusAlreadyExistsError)

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


def serialize_datetime(dt: Optional[datetime]) -> Optional[float]:
    return None if dt is None else dt.timestamp()


def deserialize_datetime(timestamp: Optional[float]) -> Optional[datetime]:
    return None if timestamp is None else datetime.fromtimestamp(timestamp)


@dataclass_json
@dataclass
class SubcorpusRecord(SubcorpusIdent):
    """
    SubcorpusRecord is a database representation of a subcorpus. It contains all the data
    necessary to restore actual binary subcorpus at any time.

    Attributes:
        name:  name user gives to the subcorpus (please note that it cannot be used e.g. in URLs as identifier)
        user_id: user ID of actual owner; this is removed once user deletes the corpus (but it is still avail.
            via existing URLs)
        author_id: user ID of the author (this is kept no matter whether corpus is active/archived/deleted)
        author_fullname: author first and last names
        size: size of the subcorpus in tokens
        is_draft: if True then the subcorpus structure can be modified; this state should normally exist only when
            moving from an ad-hoc subcorpus definition to the true (stored) subcorpus
        created: datetime of corpus creation
        public_description: a public description in a decoded format (HTML)
        public_description_raw: a public description in Markdown format - just like stored in db
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
    name: str
    user_id: int
    author_id: int
    author_fullname: str
    size: int
    is_draft: bool
    created: datetime = field(metadata=config(
        encoder=datetime.timestamp,
        decoder=datetime.fromtimestamp))
    public_description: str
    public_description_raw: str
    archived: Optional[datetime] = field(default=None, metadata=config(
        encoder=serialize_datetime,
        decoder=deserialize_datetime))
    published: Optional[datetime] = field(default=None, metadata=config(
        encoder=serialize_datetime,
        decoder=deserialize_datetime))
    cql: Optional[str] = None
    within_cond: Optional[WithinType] = None
    text_types: Optional[TextTypesType] = None


class KSubcorpus(KCorpus):
    """
    KSubcorpus is an abstraction of a subcorpus used by KonText.

    Please note that properties like 'author', 'author_id',
    'description' refer here to the author of the subcorpus.
    To obtain the original author of the main corpus, new properties
    are available in KSubcorpus - orig_author, orig_author_id,
    orig_description.
    """

    def __init__(self, corp: SubCorpus, data_record: Union[SubcorpusIdent, SubcorpusRecord], subcorp_root_dir: str):
        super().__init__(corp, data_record.corpus_name)
        self._corpname = data_record.corpus_name
        self._data_record = data_record
        self._subcorp_root_dir = subcorp_root_dir

    def __str__(self):
        return f'KSubcorpus(corpname={self.corpname}, subcorpus_id={self.subcorpus_id}, subcorpus_name={self.subcorpus_name})'

    @staticmethod
    async def load(corp: Corpus, data_record: Union[SubcorpusIdent, SubcorpusRecord], subcorp_root_dir: str) -> 'KSubcorpus':
        """
        load is a recommended factory function to create a KSubcorpus instance.
        """
        full_data_path = os.path.join(subcorp_root_dir, data_record.data_path)
        if not await aiofiles.os.path.isfile(full_data_path):
            if isinstance(data_record, SubcorpusIdent) and not (isinstance(data_record, SubcorpusRecord) and data_record.is_draft):
                raise CorpusInstantiationError(f'Subcorpus data not found for "{data_record.id}"')
            subc = corp
        else:
            subc = SubCorpus(corp, full_data_path)
        kcorp = KSubcorpus(subc, data_record, subcorp_root_dir)
        kcorp._corp = subc
        return kcorp

    @property
    def portable_ident(self) -> Union[SubcorpusIdent, SubcorpusRecord]:
        return self._data_record

    @property
    def subcorpus_id(self):
        return self._data_record.id

    @property
    def subcorpus_name(self):
        if self.is_unbound:
            return None
        return self._data_record.name

    @property
    def author_id(self):
        if self.is_unbound:
            return None
        return self._data_record.author_id

    @property
    def author(self):
        if self.is_unbound:
            return None
        return self._data_record.author_fullname

    @property
    def description(self):
        if self.is_unbound:
            return None
        return self._data_record.public_description

    @property
    def cache_key(self):
        """
        Return a hashed version of subc. name used mainly
        for caching purposes.
        In case of a regular corpus, the value is None
        """
        return f'{self._corpname.lower()}/{self._data_record.id}'

    @property
    def data_path(self):
        """
        Provide relative data path of the subcorpus
        """
        return self._data_record.data_path

    @property
    def is_unbound(self):
        return not isinstance(self._data_record, SubcorpusRecord)

    @property
    def is_draft(self):
        if isinstance(self._data_record, SubcorpusRecord):
            return self._data_record.is_draft
        return False

    @property
    def source_description(self):
        """
        Return a description of the source corpus this subc. is derived from
        """
        if self.is_unbound:
            return None
        return self._data_record.public_description

    def freq_precalc_file(self, attrname: str, ftype: str) -> str:
        if ftype not in ('frq', 'docf', 'arf'):
            raise InvalidSubCorpFreqFileType(
                f'invalid subcorpus freq type file specification: {ftype}')
        return os.path.join(self._subcorp_root_dir, self._data_record.data_dir, f'data.{attrname}.{ftype}')

    def compile_arf(self, attr):
        return self._corp.compile_arf(attr)


async def create_subcorpus(
        path: str,
        corpus: KCorpus,
        structname: str,
        subquery: str) -> SubCorpus:
    """
    Creates a subcorpus

    arguments:
    path -- path of the new subcorpus file
    corpus -- parent corpus (a manatee.Corpus instance)
    structname -- a structure used to specify subcorpus content (only one structure name can be used)
    subquery -- a within query specifying attribute values (attributes must be ones from the 'structname' structure)
    """
    if await aiofiles.os.path.exists(path):
        raise SubcorpusAlreadyExistsError('Subcorpus already exists')
    return m_create_subcorpus(path, corpus.unwrap(), structname, subquery)


def subcorpus_from_conc(path: str, conc: Concordance, struct: Optional[str] = None) -> SubCorpus:
    """
    Creates a subcorpus from provided concordance. In case
    a struct is provided then only positions located wihtin
    the provided structure are included.

    arguments:
    path -- path to the subcorpus we want to create
    conc -- a manatee.Concordance instance
    struct -- an optional structure to restrict the result to

    returns:
    True in case of success else False (= empty subcorpus)
    """
    return m_create_subcorpus(path, conc.RS(), struct)
