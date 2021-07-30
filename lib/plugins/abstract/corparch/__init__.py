# Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
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

"""
This module contains classes representing individual corpus metadata/description.
We try to pack together data from KonText corparch data, Manatee data and possible
other sources. So anytime KonText wants to access individual
corpus information it excepts instances of these classes to be
involved.

Please note that corpus as an item from corparch list is not
represented here as it is solely a problem of individual corparch
implementations where typically we need only a few items when
listing corpora (name, size,...).

The classes are storage-independent which means that
a concrete format of stored corpora information is up to
a concrete 'corparch' plug-in (default_corparch uses XML)

Please note that many of the attributes defined here are
tightly related to respective corpora registry (configuration)
files.
"""

import abc
from typing import Optional, Dict, Any, List, Tuple, TYPE_CHECKING, Union
# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from controller.plg import PluginCtx
import json
from corplib.corpus import KCorpus
from corplib.fallback import EmptyCorpus
import l10n


class DictLike(object):

    def __getitem__(self, item: str):
        return getattr(self, item)

    def __contains__(self, item: str):
        return hasattr(self, item)

    def __repr__(self):
        return 'DictLike {}'.format(self.__dict__)

    def get(self, key: str, default=None):
        return getattr(self, key, default)

    def to_json(self):
        return json.dumps(self, cls=CorpInfoEncoder)

    def to_dict(self):
        return CorpInfoEncoder().default(self)

    def from_dict(self, data: Dict[str, Any]) -> 'DictLike':
        self.__dict__.update(data)
        return self


class CorpusMetadata(DictLike):
    def __init__(self) -> None:
        self.database: Optional[str] = None
        self.label_attr: Optional[str] = None
        self.avg_label_attr_len: Optional[int] = None
        self.id_attr: Optional[str] = None
        self.sort_attrs: bool = False
        self.desc: Dict[str, Any] = {}
        self.keywords: List[Tuple[str, str]] = []
        self.interval_attrs: List[Tuple[str, str]] = []
        self.group_duplicates: bool = False
        self.default_virt_keyboard: Optional[str] = None


class CitationInfo(DictLike):
    def __init__(self) -> None:
        self.default_ref: Optional[str] = None
        self.article_ref: List[str] = []
        self.other_bibliography: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in self.__dict__.items()}


class ManateeCorpusInfo(DictLike):
    """
    Represents a subset of corpus information
    as provided by manatee.Corpus instance
    """

    def __init__(self) -> None:
        self.encoding: Optional[str] = None
        self.name: Optional[str] = None
        self.description: Optional[str] = None
        self.attrs: List[str] = []
        self.size: int = 0
        self.has_lemma: bool = False
        self.tagset_doc: Optional[str] = None
        self.lang: Optional[str] = None


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


class TokenConnect(DictLike):

    def __init__(self) -> None:
        self.providers: List[Any] = []


class KwicConnect(DictLike):

    def __init__(self) -> None:
        self.providers: List[Any] = []


class TagsetInfo(DictLike):

    def __init__(self) -> None:
        self.corpus_name: Optional[str] = None
        self.pos_attr: Optional[str] = None
        self.feat_attr: Optional[str] = None
        self.tagset_type: Optional[str] = None
        self.tagset_name: Optional[str] = None
        self.widget_enabled: bool = False
        self.doc_url_local: Optional[str] = None
        self.doc_url_en: Optional[str] = None

    def from_dict(self, data: Dict[str, Any]) -> 'DictLike':
        self.__dict__.update(data)
        self.widget_enabled = bool(self.widget_enabled)
        return self

    def to_dict(self):
        # Note: the returned type must match client-side's PluginInterfaces.TagHelper.TagsetInfo
        return dict(ident=self.tagset_name, type=self.tagset_type,
                    posAttr=self.pos_attr, featAttr=self.feat_attr,
                    widgetEnabled=self.widget_enabled,
                    docUrlLocal=self.doc_url_local, docUrlEn=self.doc_url_en)


class QuerySuggest(DictLike):

    def __init__(self) -> None:
        self.providers: List[Any] = []


class CorpusListItem(DictLike):

    def __init__(self, id=None, corpus_id=None, name=None, description=None, size=0, path=None,
                 featured=False, keywords=None):
        self.id = id
        self.corpus_id = corpus_id
        self.name = name
        self.description = description
        self.size = size
        self.size_info = l10n.simplify_num(size)
        self.path = path
        self.featured = featured
        self.found_in = []
        self.keywords = [] if keywords is None else keywords

    def __repr__(self):
        return 'CorpusListItem({0})'.format(self.__dict__)


class CorpusInfo(DictLike):
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

    def __init__(self) -> None:
        self.id: Optional[str] = None
        self.name: Optional[str] = None
        self.description: Optional[str] = None  # filled in during localization
        self._description_cs: Optional[str] = None
        self._description_en: Optional[str] = None
        self.path: Optional[str] = None
        self.web: Optional[str] = None
        self.sentence_struct: Optional[str] = None
        self.tagsets: List[TagsetInfo] = []
        self.speech_segment = None
        self.speaker_id_attr = None
        self.speech_overlap_attr = None
        self.speech_overlap_val = None
        self.bib_struct = None
        self.sample_size: int = -1
        self.featured: bool = False
        self.collator_locale: str = 'en_US'  # this does not apply for Manatee functions
        self.use_safe_font: bool = False
        self.citation_info: CitationInfo = CitationInfo()
        self.metadata: CorpusMetadata = CorpusMetadata()
        self.token_connect: TokenConnect = TokenConnect()
        self.kwic_connect: KwicConnect = KwicConnect()
        self.manatee: ManateeCorpusInfo = ManateeCorpusInfo()
        self.default_view_opts: Dict[str, Any] = {}
        self.query_suggest: QuerySuggest = QuerySuggest()
        self.simple_query_default_attrs: List[str] = []

    def localized_desc(self, lang) -> str:
        if lang.split('_')[0] == 'cs':
            return self._description_cs
        else:
            return self._description_en


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
        self.metadata = CorpusMetadata()
        self.manatee = ManateeCorpusInfo()


class CorpInfoEncoder(json.JSONEncoder):
    def default(self, o):
        ans = {}
        for key, val in list(o.__dict__.items()):
            if isinstance(val, DictLike):
                ans[key] = val.__dict__
            else:
                ans[key] = val
        return ans


class AbstractCorporaArchive(abc.ABC):
    """
    A template for the 'corparch' (the quite misleading name stays
    for historical reasons) plug-in.

    Please note that the interface may change in the future as it is
    not defined in a KonText core independent way.
    """

    @abc.abstractmethod
    def get_corpus_info(self, plugin_ctx: 'PluginCtx', corp_id: str) -> CorpusInfo:
        """
        Return a full available corpus information.

        Important note: the method should never raise
        an exception. In case of an error please return
        BrokenCorpusInfo from this package.

        arguments:
        plugin_ctx
        corp_id -- corpus identifier

        returns:
        A dictionary containing corpus information. Expected keys are:
        {id, path, web, sentence_struct, tagset, speech_segment, bib_struct, citation_info,
        metadata} where metadata is a dict with keys {database, label_attr, id_attr, desc, keywords}.
        """

    def mod_corplist_menu(self, plugin_ctx: 'PluginCtx', menu_item):
        """
        The method allows the plug-in to customize main menu link from "Corpora -> Available corpora".
        """


class SimpleCorporaArchive(AbstractCorporaArchive):
    """
    An archive without server-side searching/filtering abilities
    """

    @abc.abstractmethod
    def get_all(self, plugin_ctx: 'PluginCtx'):
        """
        Return all the available corpora (user credentials can be accessed
        via plugin_ctx).
        """


class CorplistProvider(abc.ABC):
    """
    An object providing actual corpus list based on passed arguments.
    """

    @abc.abstractmethod
    def search(self, plugin_ctx: 'PluginCtx', query: str, offset: int = 0, limit: Optional[int] = None, filter_dict: Optional[Dict[str, Any]] = None) -> Any:
        """
        arguments:
        plugin_ctx --
        query -- raw query entered by user (possibly modified by client-side code)
        offset -- zero-based offset specifying returned data
        limit -- number of items to return
        filter_dict -- a dictionary containing additional search parameters
        """


class AbstractSearchableCorporaArchive(AbstractCorporaArchive):
    """
    An extended version supporting search by user query
    """

    def search(self, plugin_ctx: 'PluginCtx', query: str, offset: int = 0, limit: Optional[int] = None, filter_dict: Optional[Dict[str, Any]] = None):
        """
        Returns a subset of corplist matching provided query.

        arguments:
        plugin_ctx -- a controller.PluginCtx instance
        query -- any search query the concrete plug-in implementation can understand
                 (KonText itself just passes it around). If False then default parameters
                 are expected. An empty string is understood as "no query".
        offset -- return a list starting from this index (zero-based; default is 0)
        limit -- a maximum number of items to return (default is None; interpretation of None
                 is up to the plug-in, i.e. it can be "no limit" or "default limit" etc.)
        filter_dict -- a dict or werkzeug.datastructures.MultiDict containing additional
                       arguments of the search request; KonText just passes Request.args here

        returns:
        a JSON-serializable dictionary a concrete plug-in implementation understands
        """
        service = self.create_corplist_provider(plugin_ctx)
        return service.search(plugin_ctx=plugin_ctx, query=query, offset=offset, limit=limit,
                              filter_dict=filter_dict)

    @abc.abstractmethod
    def create_corplist_provider(self, plugin_ctx: 'PluginCtx') -> CorplistProvider:
        """
        A factory function for a configured search service

        arguments:
        plugin_ctx -- a controller.PluginCtx instance

        returns:
        A CorplistProvider instance
        """

    @abc.abstractmethod
    def initial_search_params(self, plugin_ctx: 'PluginCtx', query: str, args: Any) -> Dict[str, Any]:
        """
        Return a dictionary containing initial corpus search parameters.
        (e.g. you typically don't want to display a full list so you can set a page size).
        """

    def custom_filter(self, plugin_ctx: 'PluginCtx', corpus_list_item: Any, permitted_corpora: Dict[str, str]) -> bool:
        """
        An optional custom filter to exclude specific items from results.

        arguments:
        plugin_ctx -- a controller.PluginCtx instance
        corpus_list_item -- a CorpusListItem object
        permitted_corpora -- a dict (corpus_id, corpus_variant) as returned
                             by auth.permitted_corpora
        """
        return True

    def create_corpus_info(self) -> CorpusInfo:
        """
        An optional factory method which returns a CorpusInfo compatible instance.
        Overriding this method allows you to use your own CorpusInfo implementations.
        """
        return CorpusInfo()

    @abc.abstractmethod
    def export_favorite(self, plugin_ctx: 'PluginCtx', favitems: List[Any]):
        """
        """
        pass
