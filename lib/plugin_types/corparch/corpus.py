# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2022 Martin Zimandl <martin.zimandlk@gmail.com>
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


import enum
from dataclasses import dataclass, field
from typing import Any, Dict, List, NamedTuple, Optional, Tuple

from corplib.abstract import AbstractKCorpus, SubcorpusIdent
from dataclasses_json import dataclass_json
from dataclasses_json.api import LetterCase


@dataclass_json
@dataclass
class CorpusMetadata:
    """
    TODO: this class needs some clean-up as some properties do not fit here
    """
    database: Optional[str] = None
    label_attr: Optional[str] = None
    avg_label_attr_len: Optional[int] = None
    id_attr: Optional[str] = None
    sort_attrs: bool = False
    desc: Dict[str, Any] = field(default_factory=dict)
    keywords: List[Tuple[str, str]] = field(default_factory=list)
    interval_attrs: List[Tuple[str, str]] = field(default_factory=list)
    group_duplicates: bool = False
    default_virt_keyboard: Optional[str] = None
    featured: bool = False


@dataclass_json
@dataclass
class CitationInfo:
    default_ref: Optional[str] = None
    article_ref: List[str] = field(default_factory=list)
    other_bibliography: Optional[str] = None


@dataclass_json
@dataclass
class ManateeCorpusInfo:
    """
    Represents a subset of corpus information
    as provided by manatee.Corpus instance
    """
    encoding: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    attrs: List[str] = field(default_factory=list)
    size: int = 0
    has_lemma: bool = False
    tagset_doc: Optional[str] = None
    lang: Optional[str] = None


@dataclass_json
@dataclass
class DefaultManateeCorpusInfo(ManateeCorpusInfo):
    """
    Represents a subset of corpus information
    as provided by manatee.Corpus instance
    """

    def __init__(self, corpus: AbstractKCorpus, corpus_id) -> None:
        super().__init__()
        self.encoding = corpus.get_conf('ENCODING')
        self.name = corpus.get_conf('NAME') if corpus.get_conf('NAME') else corpus_id
        self.description = corpus.get_info()
        self.size = corpus.size
        attrlist = corpus.get_posattrs()
        self.attrs = [x for x in attrlist if len(x) > 0]
        self.has_lemma = 'lempos' in attrlist or 'lemma' in attrlist
        self.tagset_doc = corpus.get_conf('TAGSETDOC')
        self.lang = corpus.get_conf('LANGUAGE')


@dataclass_json
@dataclass
class TokenConnect:
    providers: List[Any] = field(default_factory=list)


@dataclass_json
@dataclass
class KwicConnect:
    providers: List[Any] = field(default_factory=list)


@dataclass_json
@dataclass
class TokensLinking:
    providers: List[Any] = field(default_factory=list)


class PosCategoryItem(NamedTuple):
    pattern: str
    pos: str


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class TagsetInfo:
    ident: Optional[str] = None
    type: Optional[str] = None
    corpus_name: Optional[str] = None
    pos_attr: Optional[str] = None
    feat_attr: Optional[str] = None
    widget_enabled: bool = False
    doc_url_local: Optional[str] = None
    doc_url_en: Optional[str] = None
    pos_category: List[PosCategoryItem] = field(default_factory=list)


@dataclass_json
@dataclass
class QuerySuggest:
    providers: List[Any] = field(default_factory=list)


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class StructAttrInfo:
    structure_name: str
    name: str
    label: str
    n: str
    dt_format: Optional[str] = None


class MLPositionFilter(enum.Enum):
    """
    MLPositionFilter specifies position filters used to create 1:1 position-matching aligned
    sentences (or other structures). Using such a filter in specific cases, a simulation of
    a multi-layer corpus can be achieved via aligned corpora.

    For now only None and "alphanum" filters are available.
    Note: in older versions there was a string value 'none' instead of actual None
    used. To keep backward compatibility, the class is able to handle 'none' too
    (see method _missing_).
    """

    none = None
    """
    The 'none' filter is the default and basically means that the corpora cannot be layered
    """

    alphanum = 'alphanum'
    """
    The 'alphanum' filter can be used for aligned corpora where by removing any non-alphanumeric characters
    (with the exception for the underscore char.), the positions from different corpora become 1:1.
    """

    @classmethod
    def _missing_(cls, value):
        """
        for backward compatibility, we also support creating None value from 'none' value
        """
        if value == 'none':
            return cls.none
        return None


@dataclass_json
@dataclass
class   CorpusInfo:
    """
    Genereal corpus information and metadata.
    All the possible implementations are expected to
    be user-independent. I.e. all the information must
    apply for all the users.

    In terms of l10n, this is kind of a hybrid as it
    is expected that it stores localized information
    but at the same time, for some items (description)
    it must also store i18n values, so we can create
    localized copies for different languages.
    (see _localize_corpus_info in different corparch
    plug-ins).
    """

    id: Optional[str] = None
    pid: Optional[str] = None # TODO see https://github.com/czcorpus/kontext/issues/6039
    name: Optional[str] = None
    description: Optional[str] = None  # filled in during localization
    _description_cs: Optional[str] = None
    _description_en: Optional[str] = None
    path: Optional[str] = None
    web: Optional[str] = None
    sentence_struct: Optional[str] = None
    default_tagset: Optional[str] = None
    tagsets: List[TagsetInfo] = field(default_factory=list)
    speech_segment: Optional[str] = None
    speaker_id_attr: Optional[str] = None
    speech_overlap_attr: Optional[str] = None
    speech_overlap_val: Optional[str] = None
    bib_struct: Optional[str] = None
    featured: bool = False
    _collator_locale: str = 'en_US'  # this does not apply for Manatee functions
    use_safe_font: bool = False
    citation_info: CitationInfo = field(default_factory=lambda: CitationInfo())
    metadata: CorpusMetadata = field(default_factory=lambda: CorpusMetadata())
    token_connect: TokenConnect = field(default_factory=lambda: TokenConnect())
    kwic_connect: KwicConnect = field(default_factory=lambda: KwicConnect())
    tokens_linking: TokensLinking = field(default_factory=lambda: TokensLinking())
    manatee: ManateeCorpusInfo = field(default_factory=lambda: ManateeCorpusInfo())
    default_view_opts: Dict[str, Any] = field(default_factory=dict)
    query_suggest: QuerySuggest = field(default_factory=lambda: QuerySuggest())
    simple_query_default_attrs: List[str] = field(default_factory=list)
    part_of_ml_corpus: bool = False
    ml_position_filter: MLPositionFilter = MLPositionFilter.none

    def localized_desc(self, lang) -> str:
        if lang.split('_')[0] == 'cs':
            return self._description_cs
        else:
            return self._description_en

    @property
    def collator_locale(self) -> str:
        if self._collator_locale is None:
            return 'en_US'
        else:
            return self._collator_locale

    @collator_locale.setter
    def collator_locale(self, value):
        self._collator_locale = value


@dataclass_json
@dataclass
class BrokenCorpusInfo(CorpusInfo):
    """
    An incomplete corpus information. It should be used in corpora lists/search
    results instead of None and similar solutions to prevent unwanted exceptions
    to be risen. Broken corpus information still does not mean that the corpus
    cannot be used - but KonText prevents this (in controller's pre_dispatch)
    because missing configuration can break/disable many functions.
    """

    def __init__(self, name: Optional[str] = None) -> None:
        super().__init__()
        self.name = name if name else 'undefined'
