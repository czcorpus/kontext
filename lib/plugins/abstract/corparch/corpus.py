# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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


from typing import NamedTuple, Optional, Dict, Any, List, Tuple, Union
from dataclasses_json.api import LetterCase
from corplib.corpus import KCorpus
from corplib.fallback import EmptyCorpus
from dataclasses import dataclass, field
from dataclasses_json import dataclass_json


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

    def __init__(self, corpus: Union[KCorpus, EmptyCorpus], corpus_id) -> None:
        super().__init__()
        self.encoding = corpus.get_conf('ENCODING')
        self.name = corpus.get_conf('NAME') if corpus.get_conf('NAME') else corpus_id
        self.description = corpus.get_info()
        self.attrs = [x for x in corpus.get_conf('ATTRLIST').split(',') if len(x) > 0]
        self.size = corpus.size
        attrlist = corpus.get_conf('ATTRLIST').split(',')
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

    def __post_init__(self):
        self.widget_enabled = bool(self.widget_enabled)


@dataclass_json
@dataclass
class QuerySuggest:
    providers: List[Any] = field(default_factory=list)


@dataclass_json
@dataclass
class CorpusInfo:
    """
    Genereal corpus information and metadata.
    All the possible implementations are expected to
    be user-independent. I.e. all the information must
    apply for all the users.

    In terms of l10n, this is kind of a hybrid as it
    is expected that it stores localized information
    but at the same time, for some items (description)
    it must also store i18n values so we can create
    localized copies for different languages.
    (see _localize_corpus_info in different corparch
    plug-ins).
    """

    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None  # filled in during localization
    _description_cs: Optional[str] = None
    _description_en: Optional[str] = None
    path: Optional[str] = None
    web: Optional[str] = None
    sentence_struct: Optional[str] = None
    default_tagset: Optional[str] = None
    tagsets: List[TagsetInfo] = field(default_factory=list)
    speech_segment = None
    speaker_id_attr = None
    speech_overlap_attr = None
    speech_overlap_val = None
    bib_struct = None
    sample_size: int = -1
    featured: bool = False
    collator_locale: str = 'en_US'  # this does not apply for Manatee functions
    use_safe_font: bool = False
    citation_info: CitationInfo = field(default_factory=lambda: CitationInfo())
    metadata: CorpusMetadata = field(default_factory=lambda: CorpusMetadata())
    token_connect: TokenConnect = field(default_factory=lambda: TokenConnect())
    kwic_connect: KwicConnect = field(default_factory=lambda: KwicConnect())
    manatee: ManateeCorpusInfo = field(default_factory=lambda: ManateeCorpusInfo())
    default_view_opts: Dict[str, Any] = field(default_factory=dict)
    query_suggest: QuerySuggest = field(default_factory=lambda: QuerySuggest())
    simple_query_default_attrs: List[str] = field(default_factory=list)

    def localized_desc(self, lang) -> str:
        if lang.split('_')[0] == 'cs':
            return self._description_cs
        else:
            return self._description_en


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
