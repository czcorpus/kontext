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


class DatabaseBackend(object):

    REG_COLS_MAP:Dict[str, str]

    POS_COLS_MAP:Dict[str, str]

    SATTR_COLS_MAP:Dict[str, str]

    STRUCT_COLS_MAP:Dict[str, str]

    def commit(self): ...

    def contains_corpus(self, corpus_id:basestring): ...

    def remove_corpus(self, corpus_id:basestring): ...

    def save_corpus_config(self, install_json:InstallJson): ...

    def save_corpus_article(self, text:basestring) -> int: ...

    def attach_corpus_article(self, corpus_id:str, article_id:int, role:str): ...

    def load_corpus_articles(self, corpus_id:str) -> Dict[str, Any]: ...

    def load_all_keywords(self) -> Dict[str, unicode]: ...

    def load_description(self, desc_id:int) -> Dict[str, unicode]: ...

    def load_corpus(self, corp_id:str) -> Dict[str, Any]: ...

    def load_all_corpora(self, substrs:Optional[List[basestring]], keywords:Optional[List[basestring]],
                         min_size:Optional[int], max_size:Optional[int], offset:Optional[int],
                         limit:Optional[int]) -> Dict[str, unicode]: ...

    def save_registry_table(self, corpus_id:basestring, variant:str, values:List[Tuple[str, unicode]]) -> int: ...

    def load_registry_table(self, corpus_id:basestring, variant:str) -> Dict[str, unicode]: ...

    def save_registry_posattr(self, registry_id:basestring, name:basestring, position:int, values:List[Tuple[str, unicode]]) -> int: ...

    def load_registry_posattrs(self, registry_id:basestring) -> List[Dict[str, Any]]: ...

    def update_registry_posattr_references(self, posattr_id:int, fromattr_id:int, mapto_id:int): ...

    def load_registry_posattr_references(self, posattr_id:int) -> Tuple[str, str]: ...

    def save_registry_alignments(self, registry_id:int, aligned_ids:List[int]): ...

    def load_registry_alignments(self, registry_id:int) -> List[int]: ...

    def save_registry_structure(self, registry_id:int, name:str, type:str, update_existing:Optional[bool]) -> int: ...

    def load_registry_structures(self, registry_id:int) -> List[Dict[str, Any]]: ...

    def save_registry_structattr(self, struct_id:int, name:str, values:List[Tuple[str, Any]]) -> int: ...

    def save_subcorpattr(self, struct_id:int, idx:int): ...

    def load_subcorpattrs(self, registry_id:int) -> List[str]: ...

    def save_freqttattr(self, struct_id:int, idx:int): ...

    def load_freqttattrs(self, registry_id:int) -> List[str]: ...

    def load_tckc_providers(self, corpus_id:str) -> List[Dict[str, Any]]: ...
