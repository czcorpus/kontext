# Copyright (c) 2019 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2019 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Dict, Any, List, Optional
from controller.plg import PluginApi

class DictLike(object): ...


class CorpusMetadata(DictLike):
    database:str
    label_attr:str
    avg_label_attr_len:int
    id_attr:str
    sort_attrs:str # TODO ??? type
    desc:Dict[str, Any]
    keywords:Dict[str, Any]
    interval_attrs:List[str]
    group_duplicates:bool


class CitationInfo(DictLike):
    default_ref:str
    article_ref:List[str]
    other_bibliography:str

    def to_dict(self) -> Dict[str, Any]: ...


class ManateeCorpusInfo(DictLike):
    encoding:str
    name:str
    description:str
    attrs:List[str]
    size:int
    has_lemma:bool
    tagset_doc:str
    lang:str


class DefaultManateeCorpusInfo(ManateeCorpusInfo):
    encoding:str
    import_string:Any
    name:str
    description:str
    attrs:List[str]
    size:int
    attrlist:List[str]
    has_lemma:bool
    tagset_doc:str
    lang:str


class TokenConnect(DictLike):

    providers:List[Any]  # TODO


class KwicConnect(DictLike):

    providers:List[Any]


class TagsetInfo(DictLike):
    corpus_name:str
    pos_attr:str
    feat_attr:str
    tagset_type:str
    tagset_name:str


class CorpusInfo(DictLike):
    id:str
    name:str
    path:str
    web:str
    sentence_struct:str
    tagsets:List[str] = []
    speech_segment = None
    speaker_id_attr = None
    speech_overlap_attr = None
    speech_overlap_val = None
    bib_struct = None
    sample_size = -1
    featured = False
    collator_locale = 'en_US'  # this does not apply for Manatee functions
    use_safe_font = False
    citation_info = CitationInfo()
    metadata = CorpusMetadata()
    token_connect = TokenConnect()
    kwic_connect = KwicConnect()
    manatee = ManateeCorpusInfo()


class BrokenCorpusInfo(CorpusInfo): ...


class AbstractCorporaArchive(object):

    def get_corpus_info(self, user_lang:str, corp_id:str) -> CorpusInfo: ...

    def mod_corplist_menu(self, plugin_api:PluginApi, menu_item:Any) -> Any: ...  # TODO


class AbstractSearchableCorporaArchive(AbstractCorporaArchive):

    def search(self, plugin_api: PluginApi, query:str, offset:int, limit:Optional[int], filter_dict=Dict[str, Any]) -> Any: ...

    def create_corplist_provider(self, plugin_api: PluginApi) -> CorplistProvider: ...

    def initial_search_params(self, plugin_api: PluginApi, query: str, args: Any) -> Dict[str, Any]: ...

    def custom_filter(self, plugin_api: PluginApi, corpus_list_item: Any, permitted_corpora: Dict[str, str]) -> bool: ...  # TODO CorpusListItem object

    def create_corpus_info(self) -> CorpusInfo: ...


class CorplistProvider(object):

    def search(self, plugin_api: PluginApi, query:str, offset:int, limit:Optional[int], filter_dict=Dict[str, Any]) -> Any: ...
