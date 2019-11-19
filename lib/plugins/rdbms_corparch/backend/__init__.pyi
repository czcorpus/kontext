# Copyright(c) 2018 Charles University, Faculty of Arts,
#                   Institute of the Czech National Corpus
# Copyright(c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import List, Any, Tuple, Dict, Optional

from plugins.abstract.corpora import DefaultManateeCorpusInfo
from plugins.rdbms_corparch.backend.input import InstallJson


class ManateeCorpora(object):

    _cache:Dict[str, DefaultManateeCorpusInfo]

    def get_info(self, corpus_id) -> DefaultManateeCorpusInfo: ...


class InstallCorpusInfo(object):

    _reg_path:str

    def __init__(self, reg_path:str): ...

    def get_corpus_size(self, corp_id:str) -> int: ...

    def get_corpus_name(self, corp_id:str) -> str: ...

    def get_corpus_description(self, corp_id:str) -> str: ...

    def get_corpus_encoding(self, corp_id:str) -> str: ...

    def get_data_path(self, corp_id:str) -> str: ...


class DatabaseBackend(object):

    REG_COLS_MAP:Dict[str, str]

    REG_VAR_COLS_MAP:Dict[str, str]

    POS_COLS_MAP:Dict[str, str]

    SATTR_COLS_MAP:Dict[str, str]

    STRUCT_COLS_MAP:Dict[str, str]

    def contains_corpus(self, corpus_id:str): ...

    def load_corpus_articles(self, corpus_id:str) -> Dict[str, Any]: ...

    def load_all_keywords(self) -> Dict[str, unicode]: ...

    def load_ttdesc(self, desc_id:int) -> Dict[str, unicode]: ...

    def load_corpus(self, corp_id:str) -> Dict[str, Any]: ...

    def load_all_corpora(self, substrs:Optional[List[basestring]], keywords:Optional[List[basestring]],
                         min_size:Optional[int], max_size:Optional[int], offset:Optional[int],
                         limit:Optional[int], favourites:Tuple[str, ...]) -> Dict[str, unicode]: ...

    def load_featured_corpora(self, user_lang:str) -> List[Dict[str, Any]]: ...

    def load_registry_table(self, corpus_id:str, variant:str) -> Dict[str, unicode]: ...

    def load_corpus_posattrs(self, corpus_id:str) -> List[Dict[str, Any]]: ...

    def load_corpus_posattr_references(self, corpus_id:str, posattr_id:str) -> Tuple[str, str]: ...

    def load_corpus_alignments(self, corpus_id:str) -> List[str]: ...

    def load_corpus_structures(self, corpus_id:str) -> List[Dict[str, Any]]: ...

    def load_subcorpattrs(self, corpus_id:str) -> List[str]: ...

    def load_freqttattrs(self, corpus_id:str) -> List[str]: ...

    def load_tckc_providers(self, corpus_id:str) -> List[Dict[str, Any]]: ...

    def load_corpus_tagsets(self, corpus_id:str) -> List[Dict[str, Any]]: ...


class DatabaseWritableBackend(DatabaseBackend):

    def commit(self): ...

    def remove_corpus(self, corpus_id:str): ...

    def save_corpus_config(self, install_json:InstallJson, registry_dir:str, corp_size:int): ...

    def save_corpus_article(self, text:basestring) -> int: ...

    def attach_corpus_article(self, corpus_id:str, article_id:int, role:str): ...

    def save_registry_table(self, corpus_id:str, variant:str, values:List[Tuple[str, unicode]]) -> bool: ...

    def save_corpus_posattr(self, corpus_id:str, name:str, position:int, values:List[Tuple[str, unicode]]) -> int: ...

    def update_corpus_posattr_references(self, corpus_id:str, posattr_id:int, fromattr_id:int, mapto_id:int): ...

    def save_corpus_alignments(self, corpus_id:str, aligned_ids:List[str]): ...

    def save_corpus_structattr(self, corpus_id:str, struct_id:int, name:str, values:List[Tuple[str, Any]]): ...

    def save_subcorpattr(self, corpus_id:str, struct_name:str, attr_name:str, idx:int): ...

    def save_corpus_structure(self, corpus_id:str, name:str, type:str): ...

    def save_freqttattr(self, corpus_id:str, struct_name:str, attr_name:str, idx:int): ...
