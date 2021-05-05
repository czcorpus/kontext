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
from .input import InstallJson

import os
import logging
from collections import OrderedDict
from plugins.abstract.corparch import DefaultManateeCorpusInfo
from corplib.fallback import EmptyCorpus
import manatee


class InstallCorpusInfo(object):
    """
    Provides specific information required
    when installing a new corpus to a corparch
    database.
    """

    def __init__(self, reg_path: str) -> None:
        self._reg_path: str = reg_path

    def get_corpus_size(self, corp_id: str) -> int:
        c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
        return c.size()

    def get_corpus_name(self, corp_id: str) -> Optional[str]:
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('NAME').decode(self.get_corpus_encoding(corp_id))
        except:
            return None

    def get_corpus_description(self, corp_id: str) -> Optional[str]:
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('INFO').decode(self.get_corpus_encoding(corp_id))
        except:
            return None

    def get_corpus_encoding(self, corp_id: str) -> Optional[str]:
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('ENCODING')
        except:
            return None

    def get_data_path(self, corp_id: str) -> Optional[str]:
        try:
            c = manatee.Corpus(os.path.join(self._reg_path, corp_id))
            return c.get_conf('PATH').rstrip('/')
        except Exception as ex:
            logging.getLogger(__name__).warning(ex)
            return None


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

    def contains_corpus(self, corpus_id: str):
        raise NotImplementedError()

    def load_corpus_articles(self, corpus_id: str) -> Dict[str, Any]:
        raise NotImplementedError()

    def load_all_keywords(self) -> Dict[str, str]:
        """
        expected db cols: id, label_cs, label_en, color
        """
        raise NotImplementedError()

    def load_ttdesc(self, desc_id: int) -> Dict[str, str]:
        """
        """
        raise NotImplementedError()

    def load_corpus(self, corp_id: str) -> Dict[str, Any]:
        raise NotImplementedError()

    def load_all_corpora(self, user_id: int, substrs: Optional[List[str]] = None, keywords: Optional[List[str]] = None, min_size: int = 0, max_size: Optional[int] = None, requestable: bool = False,
                         offset: int = 0, limit: int = -1, favourites: Tuple[str, ...] = ()) -> Dict[str, str]:
        """
        """
        raise NotImplementedError()

    def load_featured_corpora(self, user_lang: str) -> List[Dict[str, Any]]:
        raise NotImplementedError()

    def load_registry_table(self, corpus_id: str, variant: str) -> Dict[str, str]:
        raise NotImplementedError()

    def load_corpus_posattrs(self, corpus_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError()

    def load_corpus_posattr_references(self, corpus_id: str, posattr_id: str) -> Tuple[str, str]:
        raise NotImplementedError()

    def load_corpus_alignments(self, corpus_id: str) -> List[str]:
        raise NotImplementedError()

    def load_corpus_structures(self, corpus_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError()

    def load_subcorpattrs(self, corpus_id: str) -> List[str]:
        raise NotImplementedError()

    def load_freqttattrs(self, corpus_id: str) -> List[str]:
        raise NotImplementedError()

    def load_tckc_providers(self, corpus_id: str) -> List[Dict[str, Any]]:
        raise NotImplementedError()

    def get_permitted_corpora(self, user_id) -> List[str]:
        raise NotImplementedError()

    def corpus_access(self, user_id: int, corpus_id: str) -> Tuple[bool, bool, str]:
        raise NotImplementedError()

    def load_corpus_tagsets(self, corpus_id) -> List[Dict[str, Any]]:
        raise NotImplementedError()

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

    def commit(self):
        raise NotImplementedError()

    def remove_corpus(self, corpus_id: str):
        raise NotImplementedError()

    def save_corpus_config(self, install_json: InstallJson, registry_dir: str, corp_size: int):
        raise NotImplementedError()

    def save_corpus_article(self, text: str) -> int:
        raise NotImplementedError()

    def attach_corpus_article(self, corpus_id: str, article_id: int, role: str):
        raise NotImplementedError()

    def save_registry_table(self, corpus_id: str, variant: str, values: List[Tuple[str, str]]) -> bool:
        """
        returns:
        True if a record has been actually created
        or False if the record already exists (and the method did nothing).
        """
        raise NotImplementedError()

    def save_corpus_posattr(self, corpus_id: str, name: str, position: int, values: List[Tuple[str, str]]) -> int:
        raise NotImplementedError()

    def update_corpus_posattr_references(self, corpus_id: str, posattr_id: int, fromattr_id: int, mapto_id: int):
        raise NotImplementedError()

    def save_corpus_alignments(self, corpus_id: str, aligned_ids: List[str]):
        raise NotImplementedError()

    def save_corpus_structure(self, corpus_id: str, name: str, values: List[Tuple[str, str]]):
        raise NotImplementedError()

    def save_corpus_structattr(self, corpus_id: str, struct_id: int, name: str, values: List[Tuple[str, Any]]):
        raise NotImplementedError()

    def save_subcorpattr(self, corpus_id: str, struct_name: str, attr_name: str, idx: int):
        raise NotImplementedError()

    def save_freqttattr(self, corpus_id: str, struct_name: str, attr_name: str, idx: int):
        raise NotImplementedError()
