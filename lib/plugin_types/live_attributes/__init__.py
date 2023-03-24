# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

import abc
from dataclasses import dataclass
from functools import wraps
from hashlib import md5
from typing import Any, Dict, List, NamedTuple, Optional, Union, Tuple

from action.plugin.ctx import AbstractCorpusPluginCtx
from corplib.corpus import AbstractKCorpus
from dataclasses_json import dataclass_json
from plugin_types import CorpusDependentPlugin
from plugin_types.general_storage import KeyValueStorage


class LiveAttrsException(Exception):
    pass


class BibTitle(NamedTuple):
    id: str
    label: str


class StructAttrValuePair(NamedTuple):
    struct_attr: str
    value: str


class AttrValue(NamedTuple):
    short_name: str
    ident: str
    full_name: str
    group: int
    poscount: int


@dataclass_json
@dataclass
class AttrValuesResponse:
    attr_values: Optional[Dict[str, Union[AttrValue, Dict[str, int], int]]] = None
    aligned: Optional[List[str]] = None
    poscount: Optional[int] = None
    error: Optional[str] = None
    details: Optional[List[str]] = None


class AbstractLiveAttributes(CorpusDependentPlugin):

    @abc.abstractmethod
    async def is_enabled_for(self, plugin_ctx: AbstractCorpusPluginCtx, corpora: List[str]) -> bool:
        """
        Return True if live attributes are enabled for selected corpora
        else return False. The 'corpora' list can be also empty - in such
        case is makes sense to return False
        """

    @abc.abstractmethod
    async def get_attr_values(
            self, plugin_ctx: AbstractCorpusPluginCtx, corpus: AbstractKCorpus, attr_map: Dict[str, Union[str, List[str]]],
            aligned_corpora: Optional[List[str]] = None, autocomplete_attr: Optional[str] = None,
            limit_lists: bool = True) -> AttrValuesResponse:
        """
        Find all the available values of remaining attributes according to the
        provided attr_map and aligned_corpora

        arguments:
        plugin_ctx --
        corpus --
        attr_map -- a dictionary of attributes and values as selected by a user
        aligned_corpora -- a list/tuple of corpora names aligned to base one (the 'corpus' argument)
        autocomplete_attr -- such attribute will be also part of selection even if it is a part 'WHERE ...' condition
        limit_lists -- if False then configured max length of returned lists is ignored and full attr lists are
                       provided

        returns:
        a dictionary containing matching attributes and values
        """

    @abc.abstractmethod
    async def get_subc_size(
            self, plugin_ctx: AbstractCorpusPluginCtx, corpora: List[str], attr_map: Dict[str, str]) -> int:
        """
        Return a size (in tokens) of a subcorpus defined by selected attributes

        plugin_ctx --
        corpora -- aligned corpora
        attr_map -- a dict containing selected attributes and respective values
        """

    @abc.abstractmethod
    async def get_supported_structures(self, plugin_ctx: AbstractCorpusPluginCtx, corpname: str) -> List[str]:
        """
        Return a list of structure names the plug-in
        and its data support for the 'corpname' corpus.

        arguments:
        plugin_ctx --
        corpname -- a corpus identifier

        returns:
        a list of structures (e.g. ['doc', 'p'])
        """

    @abc.abstractmethod
    async def get_bibliography(
            self,
            plugin_ctx: AbstractCorpusPluginCtx,
            corpus: AbstractKCorpus,
            item_id: str) -> List[StructAttrValuePair]:
        """
        Returns a list of 2-tuples (attr_name, attr_value).
        """

    @abc.abstractmethod
    async def find_bib_titles(
            self, plugin_ctx: AbstractCorpusPluginCtx, corpus_id: str, id_list: List[str]) -> List[BibTitle]:
        """
        For a list of bibliography item IDs (= typically unique document IDs)
        find respective titles.

        Returns a list of pairs (bib_id, bib_title) where bib_id is the original
        provided ID
        """

    @abc.abstractmethod
    async def fill_attrs(
            self, corpus_id: str, search: str, values: List[str], fill: List[str]) -> Dict[str, Dict[str, str]]:
        """
        For a structattr and its values find values structattrs specified in fill list

        Returns a dict of dicts {search_attr_value: {attr: value}}
        """

    @abc.abstractmethod
    async def document_list(
            self,
            plugin_ctx: AbstractCorpusPluginCtx,
            corpus_id: str,
            view_attrs: List[str],
            attr_map: Dict[str, Union[str, List[str]]],
            aligned_corpora: List[str],
            save_format: str) -> Tuple[str, str]:
        """
        In case bib_id (and bib_label) is defined, create a list of documents
        from corpus matching provided attr_map. Return path to a file containing
        the data in the required format.
        """

    @abc.abstractmethod
    async def num_matching_documents(
            self,
            plugin_ctx: AbstractCorpusPluginCtx,
            corpus_id: str,
            attr_map: Dict[str, Union[str, List[str]]],
            aligned_corpora: List[str]) -> int:
        """
        In case bib_id (and bib_label) is defined, return number of
        documents from corpus matching provided attr_map.
        """


CACHE_MAIN_KEY = 'liveattrs_cache:{}'

# here we store all the cached corpora liveattrs so we can handle them as a set
CACHE_REG_CORPORA_KEY = 'liveattrs_cached_corpora'

CACHE_MAX_TTL = 3600 * 24 * 10


def create_cache_key(attr_map, max_attr_list_size, aligned_corpora, autocomplete_attr, limit_lists):
    """
    Generates a cache key based on the relevant parameters.
    Returned value is hashed.
    """
    return md5(f'{attr_map}{max_attr_list_size}{aligned_corpora}{autocomplete_attr}{limit_lists}'.encode('utf-8')).hexdigest()


def cached(f):
    """
    A decorator which tries to look for a key in cache before
    actual storage is invoked. If cache miss in encountered
    then the value is stored to the cache to be available next
    time.
    """
    @wraps(f)
    async def wrapper(
            self: CachedLiveAttributes, plugin_ctx, corpus, attr_map, aligned_corpora=None, autocomplete_attr=None,
            limit_lists=True):
        if len(attr_map) < 2:
            key = create_cache_key(attr_map, self.max_attr_list_size, aligned_corpora,
                                   autocomplete_attr, limit_lists)
            ans = await self.from_cache(corpus.corpname, key)
            if ans:
                return AttrValuesResponse.from_dict(ans)
        ans = await f(self, plugin_ctx, corpus, attr_map, aligned_corpora, autocomplete_attr, limit_lists)
        if len(attr_map) < 2:
            key = create_cache_key(attr_map, self.max_attr_list_size,
                                   aligned_corpora, autocomplete_attr, limit_lists)
            await self.to_cache(corpus.corpname, key, ans.to_dict())
        return self.export_num_strings(ans)
    return wrapper


class CachedLiveAttributes(AbstractLiveAttributes, abc.ABC):

    def __init__(self, db: KeyValueStorage):
        self._kvdb = db

    @staticmethod
    def export_num_strings(data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform strings representing integer numbers to ints
        """
        if type(data) is dict:
            for k in list(data.keys()):
                if type(data[k]) is str and data[k].isdigit():
                    data[k] = int(data[k])
        return data

    async def from_cache(self, corpname: str, key: str) -> Optional[Dict[str, Any]]:
        """
        Loads a value from cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        key -- a cache key

        returns:
        a stored value matching provided argument or None if nothing is found
        """
        v = await self._kvdb.hash_get(CACHE_MAIN_KEY.format(corpname), key)
        await self._kvdb.set_ttl(CACHE_MAIN_KEY.format(corpname), CACHE_MAX_TTL)
        return CachedLiveAttributes.export_num_strings(v) if v else None

    async def to_cache(self, corpname: str, key: str, values: str):
        """
        Stores a data object "values" into the cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        key -- a cache key
        values -- a dictionary with arbitrary nesting level
        """
        await self._kvdb.hash_set(CACHE_MAIN_KEY.format(corpname), key, values)
        await self._kvdb.hash_set(CACHE_REG_CORPORA_KEY, corpname, True)
        await self._kvdb.set_ttl(CACHE_MAIN_KEY.format(corpname), CACHE_MAX_TTL)

    async def clear_cache(self):
        """
        Remove all the cached liveattrs
        """
        corpora = (await self._kvdb.hash_get_all(CACHE_REG_CORPORA_KEY)).keys()
        # now other workers may set values again and we don't care much
        await self._kvdb.remove(CACHE_REG_CORPORA_KEY)
        for corp in corpora:
            await self._kvdb.remove(CACHE_MAIN_KEY.format(corp))
