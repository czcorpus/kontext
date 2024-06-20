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

import abc
from contextlib import asynccontextmanager
from typing import (
    Any, Dict, Generator, Generic, Iterable, List, Optional, Tuple, TypeVar)

from plugin_types.auth import CorpusAccess
from plugin_types.corparch.corpus import TagsetInfo
from plugin_types.corparch.install import InstallJson

CursorType = TypeVar('CursorType')


class DatabaseBackend(Generic[CursorType], abc.ABC):
    """
    An abstract database backend for loading corpus configuration
    data.
    """

    @asynccontextmanager
    async def cursor(self, dictionary=True) -> Generator[CursorType, None, None]:
        pass

    @abc.abstractmethod
    async def contains_corpus(self, cursor: CursorType, corpus_id: str) -> bool:
        pass

    @abc.abstractmethod
    async def load_corpus_articles(self, cursor: CursorType, corpus_id: str) -> Iterable[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    async def load_corpus_as_source_info(self, cursor: CursorType, corpus_id: str) -> str:
        pass

    @abc.abstractmethod
    async def load_all_keywords(self, cursor: CursorType) -> Iterable[Dict[str, str]]:
        """
        expected db cols: id, label_cs, label_en, color
        """
        pass

    @abc.abstractmethod
    async def load_ttdesc(self, cursor: CursorType, desc_id: int) -> Iterable[Dict[str, str]]:
        """
        """
        pass

    @abc.abstractmethod
    async def load_corpora_descriptions(
            self, cursor: CursorType, corp_ids: List[str], user_lang: str) -> Dict[str, str]:
        """
        """
        pass

    @abc.abstractmethod
    async def load_corpus(self, cursor: CursorType, corp_id: str) -> Dict[str, Any]:
        pass

    @abc.abstractmethod
    async def list_corpora(
            self, cursor: CursorType, user_id: int, substrs: Optional[List[str]] = None,
            keywords: Optional[List[str]] = None, min_size: int = 0, max_size: Optional[int] = None,
            requestable: bool = False, offset: int = 0, limit: int = -1,
            favourites: Tuple[str, ...] = ()
    ) -> Iterable[Dict[str, Any]]:
        """
        List all the active corpora based on provided arguments
        """
        pass

    @abc.abstractmethod
    async def load_featured_corpora(self, cursor: CursorType, user_id: int, user_lang: str) -> Iterable[Dict[str, str]]:
        """
        load_featured_corpora should load all the featured corpora user_id has access to. It is not required to
        include also "requestable" corpora (i.e. corpora one can view in lists etc. but without access to them)
        as it seems a bit weird to propagate corpora with such a limited access. So it is left to implementers how
        to handle such corpora.
        """
        pass

    @abc.abstractmethod
    async def load_registry_table(self, cursor: CursorType, corpus_id: str, variant: str) -> Dict[str, str]:
        pass

    @abc.abstractmethod
    async def load_corpus_posattrs(self, cursor: CursorType, corpus_id: str) -> Iterable[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    async def load_corpus_posattr_references(self, cursor: CursorType, corpus_id: str, posattr_id: str) -> Tuple[str, str]:
        pass

    @abc.abstractmethod
    async def load_corpus_alignments(self, cursor: CursorType, corpus_id: str) -> List[str]:
        pass

    @abc.abstractmethod
    async def load_corpus_structures(self, cursor: CursorType, corpus_id: str) -> Iterable[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    async def load_corpus_structattrs(
            self, cursor: CursorType, corpus_id: str, structure_id: Optional[str] = None) -> Iterable[Dict[str, Any]]:
        """
        Load rows matching provided corpus and (if provided) structure_id. The order of items can be
        arbitrary so there is no guarantee that items are grouped or ordered in any way.
        """
        pass

    @abc.abstractmethod
    async def load_subcorpattrs(self, cursor: CursorType, corpus_id: str) -> List[str]:
        pass

    @abc.abstractmethod
    async def load_freqttattrs(self, cursor: CursorType, corpus_id: str) -> List[str]:
        pass

    @abc.abstractmethod
    async def load_tckc_providers(self, cursor: CursorType, corpus_id: str) -> Iterable[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    async def get_permitted_corpora(self, cursor: CursorType, user_id: str) -> List[str]:
        pass

    @abc.abstractmethod
    async def corpus_access(self, cursor: CursorType, user_id: int, corpus_id: str) -> CorpusAccess:
        pass

    @abc.abstractmethod
    async def load_corpus_tagsets(self, cursor: CursorType, corpus_id: str) -> List[TagsetInfo]:
        pass

    async def load_interval_attrs(self, cursor: CursorType, corpus_id: str) -> List[Tuple[str, int]]:
        """
        Load structural attributes selectable via
        numeric range (typically - publication date).
        Such attributes are provided with a special
        value selection widget in the text types panel.
        """
        return []

    async def load_simple_query_default_attrs(self, cursor: CursorType, corpus_id: str) -> List[str]:
        raise NotImplementedError()

    async def close(self):
        pass


class DatabaseWriteBackend(Generic[CursorType], abc.ABC):

    @asynccontextmanager
    async def cursor(self, dictionary=True) -> Generator[CursorType, None, None]:
        pass

    @abc.abstractmethod
    async def remove_corpus(self, cursor: CursorType, corpus_id: str):
        pass

    @abc.abstractmethod
    async def save_corpus_article(self, cursor: CursorType, text: str) -> int:
        pass

    @abc.abstractmethod
    async def attach_corpus_article(self, cursor: CursorType, corpus_id: str, article_id: int, role: str):
        pass

    @abc.abstractmethod
    async def save_registry_table(
            self, cursor: CursorType, corpus_id: str, variant: str, values: List[Tuple[str, str]]) -> bool:
        """
        returns:
        True if a record has been actually created
        or False if the record already exists (and the method did nothing).
        """
        pass

    @abc.abstractmethod
    async def save_corpus_posattr(
            self, cursor: CursorType, corpus_id: str, name: str, position: int, values: List[Tuple[str, str]]) -> int:
        pass

    @abc.abstractmethod
    async def update_corpus_posattr_references(
            self, cursor: CursorType, corpus_id: str, posattr_id: int, fromattr_id: Optional[int],
            mapto_id: Optional[int]):
        """
        Define FROMATTR and/or MAPTO. If None is passed for any of the two then NULL is inserted
        to the database.
        """
        pass

    @abc.abstractmethod
    async def save_corpus_alignments(self, cursor: CursorType, corpus_id: str, aligned_ids: List[str]):
        pass

    @abc.abstractmethod
    async def save_corpus_structure(
            self, cursor: CursorType, corpus_id: str, name: str, position: int, values: List[Tuple[str, str]]):
        pass

    @abc.abstractmethod
    async def save_corpus_structattr(
            self, cursor: CursorType, corpus_id: str, struct_id: int, name: str, position: int,
            values: List[Tuple[str, Any]]):
        pass

    @abc.abstractmethod
    async def save_subcorpattr(self, cursor: CursorType, corpus_id: str, struct_name: str, attr_name: str, idx: int):
        pass

    @abc.abstractmethod
    async def save_freqttattr(self, cursor: CursorType, corpus_id: str, struct_name: str, attr_name: str, idx: int):
        pass
