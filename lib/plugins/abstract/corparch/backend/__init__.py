# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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
from plugins.abstract.corparch.install import InstallJson
import abc
from collections import OrderedDict


class DatabaseBackend(object):
    """
    An abstract database backend for loading/storing corpus configuration
    data.
    """

    REG_COLS_MAP: Dict[str, str] = OrderedDict(
        NAME='name',
        PATH='path',
        VERTICAL='vertical',
        LANGUAGE='language',
        LOCALE='locale',
        ENCODING='rencoding',
        INFO='info',
        DOCSTRUCTURE='docstructure',
        SHORTREF='shortref',
        FREQTTATTRS='freqttattrs',
        TAGSETDOC='tagsetdoc',
        WPOSLIST='wposlist',
        WSDEF='wsdef',
        WSBASE='wsbase',
        WSTHES='wsthes',
        ALIGNSTRUCT='alignstruct',
        ALIGNDEF='aligndef')

    REG_VAR_COLS_MAP: Dict[str, str] = OrderedDict(
        MAXCONTEXT='maxcontext',
        MAXDETAIL='maxdetail',
        MAXKWIC='maxkwic')

    POS_COLS_MAP: Dict[str, str] = OrderedDict(
        TYPE='type',
        LABEL='label',
        DYNAMIC='dynamic',
        DYNLIB='dynlib',
        ARG1='arg1',
        ARG2='arg2',
        FUNTYPE='funtype',
        DYNTYPE='dyntype',
        TRANSQUERY='transquery',
        MULTIVALUE='multivalue',
        MULTISEP='multisep')

    SATTR_COLS_MAP: Dict[str, str] = OrderedDict(
        TYPE='type',
        LOCALE='locale',
        MULTIVALUE='multivalue',
        DEFAULTVALUE='defaultvalue',
        MAXLISTSIZE='maxlistsize',
        MULTISEP='multisep',
        ATTRDOC='attrdoc',
        ATTRDOCLABEL='attrdoclabel',
        NUMERIC='rnumeric')

    STRUCT_COLS_MAP: Dict[str, str] = OrderedDict(
        TYPE='type',
        DISPLAYTAG='displaytag',
        DISPLAYBEGIN='displaybegin')

    @abc.abstractmethod
    def contains_corpus(self, corpus_id: str):
        pass

    @abc.abstractmethod
    def load_corpus_articles(self, corpus_id: str) -> Dict[str, Any]:
        pass

    @abc.abstractmethod
    def load_all_keywords(self) -> Dict[str, str]:
        """
        expected db cols: id, label_cs, label_en, color
        """
        pass

    @abc.abstractmethod
    def load_ttdesc(self, desc_id: int) -> Dict[str, str]:
        """
        """
        pass

    @abc.abstractmethod
    def load_corpus(self, corp_id: str) -> Dict[str, Any]:
        pass

    @abc.abstractmethod
    def load_all_corpora(self, user_id: int, substrs: Optional[List[str]] = None, keywords: Optional[List[str]] = None,
                         min_size: int = 0, max_size: Optional[int] = None, requestable: bool = False,
                         offset: int = 0, limit: int = -1, favourites: Tuple[str, ...] = ()) -> Dict[str, str]:
        """
        """
        pass

    @abc.abstractmethod
    def load_featured_corpora(self, user_lang: str) -> List[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    def load_registry_table(self, corpus_id: str, variant: str) -> Dict[str, str]:
        pass

    @abc.abstractmethod
    def load_corpus_posattrs(self, corpus_id: str) -> List[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    def load_corpus_posattr_references(self, corpus_id: str, posattr_id: str) -> Tuple[str, str]:
        pass

    @abc.abstractmethod
    def load_corpus_alignments(self, corpus_id: str) -> List[str]:
        pass

    @abc.abstractmethod
    def load_corpus_structures(self, corpus_id: str) -> List[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    def load_subcorpattrs(self, corpus_id: str) -> List[str]:
        pass

    @abc.abstractmethod
    def load_freqttattrs(self, corpus_id: str) -> List[str]:
        pass

    @abc.abstractmethod
    def load_tckc_providers(self, corpus_id: str) -> List[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    def get_permitted_corpora(self, user_id) -> List[str]:
        pass

    @abc.abstractmethod
    def corpus_access(self, user_id: int, corpus_id: str) -> Tuple[bool, bool, str]:
        pass

    @abc.abstractmethod
    def load_corpus_tagsets(self, corpus_id) -> List[Dict[str, Any]]:
        pass

    def load_interval_attrs(self, corpus_id):
        """
        Load structural attributes selectable via
        numeric range (typically - publication date).
        Such attributes are provided with a special
        value selection widget in the text types panel.
        """
        return []

    def load_simple_query_default_attrs(self, corpus_id) -> List[str]:
        raise NotImplementedError()


class DatabaseWritableBackend(DatabaseBackend):

    @abc.abstractmethod
    def commit(self):
        pass

    @abc.abstractmethod
    def remove_corpus(self, corpus_id: str):
        pass

    @abc.abstractmethod
    def save_corpus_config(self, install_json: InstallJson, registry_dir: str, corp_size: int):
        pass

    @abc.abstractmethod
    def save_corpus_article(self, text: str) -> int:
        pass

    @abc.abstractmethod
    def attach_corpus_article(self, corpus_id: str, article_id: int, role: str):
        pass

    @abc.abstractmethod
    def save_registry_table(self, corpus_id: str, variant: str, values: List[Tuple[str, str]]) -> bool:
        """
        returns:
        True if a record has been actually created
        or False if the record already exists (and the method did nothing).
        """
        pass

    @abc.abstractmethod
    def save_corpus_posattr(self, corpus_id: str, name: str, position: int, values: List[Tuple[str, str]]) -> int:
        pass

    @abc.abstractmethod
    def update_corpus_posattr_references(self, corpus_id: str, posattr_id: int, fromattr_id: int, mapto_id: int):
        pass

    @abc.abstractmethod
    def save_corpus_alignments(self, corpus_id: str, aligned_ids: List[str]):
        pass

    @abc.abstractmethod
    def save_corpus_structure(self, corpus_id: str, name: str, values: List[Tuple[str, str]]):
        pass

    @abc.abstractmethod
    def save_corpus_structattr(self, corpus_id: str, struct_id: int, name: str, values: List[Tuple[str, Any]]):
        pass

    @abc.abstractmethod
    def save_subcorpattr(self, corpus_id: str, struct_name: str, attr_name: str, idx: int):
        pass

    @abc.abstractmethod
    def save_freqttattr(self, corpus_id: str, struct_name: str, attr_name: str, idx: int):
        pass
