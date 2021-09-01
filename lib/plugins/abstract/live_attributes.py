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
from typing import Dict, List, NamedTuple, Optional, Union

from controller.plg import PluginCtx
from plugins.abstract import CorpusDependentPlugin
from corplib.corpus import KCorpus
from dataclasses import dataclass
from dataclasses_json import dataclass_json


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
    def get_attr_values(self, plugin_ctx: PluginCtx, corpus: KCorpus, attr_map: Dict[str, str], aligned_corpora: Optional[List[str]]=None, autocomplete_attr: Optional[str]=None,
                        limit_lists: bool=True) -> AttrValuesResponse:
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

    # TODO missing raise NotImplementedError ?
    @abc.abstractmethod
    def get_subc_size(self, plugin_ctx: PluginCtx, corpus: KCorpus, attr_map: Dict[str, str]) -> int:
        """
        Return a size (in tokens) of a subcorpus defined by selected attributes

        plugin_ctx --
        corpus --
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
