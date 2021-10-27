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
from typing import Dict, List, NamedTuple, Optional, Union, Any
from functools import wraps
from hashlib import md5

from controller.plg import PluginCtx
from plugins.abstract import CorpusDependentPlugin
from corplib.corpus import KCorpus
from dataclasses import dataclass
from dataclasses_json import dataclass_json
from plugins.abstract.general_storage import KeyValueStorage


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
    attr_values: Dict[str, Union[AttrValue, Dict[str, int], int]]
    aligned: List[str]
    poscount: int


class AbstractLiveAttributes(CorpusDependentPlugin):

    @abc.abstractmethod
    def is_enabled_for(self, plugin_ctx: PluginCtx, corpname: str) -> bool:
        """
        Return True if live attributes are enabled for selected corpus
        else return False
        """

    @abc.abstractmethod
    def get_attr_values(
            self, plugin_ctx: PluginCtx, corpus: KCorpus, attr_map: Dict[str, str],
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
    def get_subc_size(self, plugin_ctx: PluginCtx, corpora: List[str], attr_map: Dict[str, str]) -> int:
        """
        Return a size (in tokens) of a subcorpus defined by selected attributes

        plugin_ctx --
        corpora -- aligned corpora
        attr_map -- a dict containing selected attributes and respective values
        """

    @abc.abstractmethod
    def get_supported_structures(self, plugin_ctx: PluginCtx, corpname: str) -> List[str]:
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
    def get_bibliography(self, plugin_ctx: PluginCtx, corpus: KCorpus, item_id: str) -> List[StructAttrValuePair]:
        """
        Returns a list of 2-tuples (attr_name, attr_value).
        """

    @abc.abstractmethod
    def find_bib_titles(self, plugin_ctx: PluginCtx, corpus_id: str, id_list: List[str]) -> List[BibTitle]:
        """
        For a list of bibliography item IDs (= typically unique document IDs)
        find respective titles.

        Returns a list of pairs (bib_id, bib_title) where bib_id is the original
        provided ID
        """

    @abc.abstractmethod
    def fill_attrs(self, corpus_id: str, search: str, values: List[str], fill: List[str]) -> Dict[str, Dict[str, str]]:
        """
        For a structattr and its values find values structattrs specified in fill list

        Returns a dict of dicts {search_attr_value: {attr: value}}
        """


CACHE_MAIN_KEY = 'liveattrs_cache:{}'


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
    def wrapper(self, plugin_ctx, corpus, attr_map, aligned_corpora=None, autocomplete_attr=None, limit_lists=True):
        if len(attr_map) < 2:
            key = create_cache_key(attr_map, self.max_attr_list_size, aligned_corpora,
                                   autocomplete_attr, limit_lists)
            ans = self.from_cache(corpus.corpname, key)
            if ans:
                return AttrValuesResponse.from_dict(ans)
        ans = f(self, plugin_ctx, corpus, attr_map, aligned_corpora, autocomplete_attr, limit_lists)
        if len(attr_map) < 2:
            key = create_cache_key(attr_map, self.max_attr_list_size,
                                   aligned_corpora, autocomplete_attr, limit_lists)
            self.to_cache(corpus.corpname, key, ans.to_dict())
        return self.export_num_strings(ans)
    return wrapper


class CachedLiveAttributes(AbstractLiveAttributes):

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

    def from_cache(self, corpname: str, key: str) -> Optional[Dict[str, Any]]:
        """
        Loads a value from cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        key -- a cache key

        returns:
        a stored value matching provided argument or None if nothing is found
        """
        v = self._kvdb.hash_get(CACHE_MAIN_KEY.format(corpname), key)
        import logging
        logging.getLogger(__name__).debug('from cache: {}'.format(v))
        return CachedLiveAttributes.export_num_strings(v) if v else None

    def to_cache(self, corpname: str, key: str, values: str):
        """
        Stores a data object "values" into the cache. The key is whole attribute_map as selected
        by a user. But there is no guarantee that all the keys and values will be
        used as a key.

        arguments:
        key -- a cache key
        values -- a dictionary with arbitrary nesting level
        """
        self._kvdb.hash_set(CACHE_MAIN_KEY.format(corpname), key, values)
