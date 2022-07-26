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
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Callable

from dataclasses_json import config, dataclass_json
from manatee import Corpus, SubCorpus, Concordance, create_subcorpus as m_create_subcorpus
import aiofiles

from ..errors import CorpusInstantiationError
from ..abstract import SubcorpusIdent
from ..corpus import KCorpus

try:
    from markdown import markdown
    from markdown.extensions import Extension

    class EscapeHtml(Extension):
        def extendMarkdown(self, md, md_globals):
            del md.preprocessors['html_block']
            del md.inlinePatterns['html']

    def k_markdown(s): return markdown(s, extensions=[EscapeHtml()])

except ImportError:
    import html

    def k_markdown(s): return html.escape(s)



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
    name: str
    user_id: int
    author_id: int
    author_fullname: str
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
        res['published'] = self.published.timestamp() if self.published else None
        return res


class KSubcorpus(KCorpus):
    """
    KSubcorpus is an abstraction of a subcorpus used by KonText.

    Please note that properties like 'author', 'author_id',
    'description' refer here to the author of the subcorpus.
    To obtain the original author of the main corpus, new properties
    are available in KSubcorpus - orig_author, orig_author_id,
    orig_description.
    """

    def __init__(self, corp: SubCorpus, data_record: SubcorpusIdent):
        super().__init__(corp, data_record.corpus_name)
        self._corpname = data_record.corpus_name
        self._data_record = data_record

    def __str__(self):
        return f'KSubcorpus(corpname={self.corpname}, subcorpus_id={self.subcorpus_id}, subcorpus_name={self.subcorpus_name})'

    @staticmethod
    async def load(corp: Corpus, data_record: SubcorpusIdent, subcorp_root_dir: str) -> 'KSubcorpus':
        """
        load is a recommended factory function to create a KSubcorpus instance.
        """
        full_data_path = os.path.join(subcorp_root_dir, data_record.data_path)
        if not await aiofiles.os.path.isfile(full_data_path):
            raise CorpusInstantiationError(f'Subcorpus data not found for "{data_record.id}"')
        subc = SubCorpus(corp, full_data_path)
        kcorp = KSubcorpus(subc, data_record)
        kcorp._corp = subc
        return kcorp

    @property
    def portable_ident(self) -> Union[str, SubcorpusIdent]:
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
    def description(self):
        if self.is_unbound:
            return None
        return k_markdown(self._data_record.public_description)

    @property
    def cache_key(self):
        """
        Return a hashed version of subc. name used mainly
        for caching purposes.
        In case of a regular corpus, the value is None
        """
        return f'{self._corpname}/{self._data_record.id}'

    @property
    def is_unbound(self):
        return not isinstance(self._data_record, SubcorpusRecord)

    @property
    def source_description(self):
        """
        Return a description of the source corpus this subc. is derived from
        """
        if self.is_unbound:
            return None
        return self._data_record.public_description

    def freq_precalc_file(self, attrname: str) -> str:
        return self._data_record.data_path[:-4] + attrname


async def create_subcorpus(
        path: str,
        corpus: KCorpus,
        structname: str,
        subquery: str,
        translate: Callable[[str], str] = lambda x: x) -> SubCorpus:
    """
    Creates a subcorpus

    arguments:
    path -- path of the new subcorpus file
    corpus -- parent corpus (a manatee.Corpus instance)
    structname -- a structure used to specify subcorpus content (only one structure name can be used)
    subquery -- a within query specifying attribute values (attributes must be ones from the 'structname' structure)
    """
    if await aiofiles.os.path.exists(path):
        raise RuntimeError(translate('Subcorpus already exists'))
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
