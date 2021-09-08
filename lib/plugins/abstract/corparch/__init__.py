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
from typing import Optional, Dict, Any, List, TYPE_CHECKING
# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from controller.plg import PluginCtx
import l10n
from dataclasses import dataclass, field
from dataclasses_json import dataclass_json
from .corpus import CorpusInfo


@dataclass_json
@dataclass
class CorpusListItem:
    id: str = None
    corpus_id: str = None
    name: str = None
    description: str = None
    size: int = 0
    size_info: str = field(init=False)
    path: str = None
    featured: bool = False
    found_in: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    fav_id: int = None

    def __post_init__(self):
        self.size_info = l10n.simplify_num(self.size)


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
    def search(
            self, plugin_ctx: 'PluginCtx', query: str, offset: int = 0, limit: Optional[int] = None,
            filter_dict: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
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

    def search(
            self, plugin_ctx: 'PluginCtx', query: str, offset: int = 0, limit: Optional[int] = None,
            filter_dict: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
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
