# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import os
import uuid
import hashlib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Awaitable, List, Optional, Union

import aiofiles
from dataclasses_json import dataclass_json
from manatee import Corpus
from util import int2chash


@dataclass_json
@dataclass
class SubcorpusIdent:
    """
    SubcorpusIdent is a base subcorpus identification dataclass. It contains all the
    necessary data for opening a Manatee subcorpus (but without some enhanced information
    as provided by SubcorpusRecord)

    Attributes:
        id: a URL identifier of the subcoprus (typically with name 'usesubcorp' in URL)
        corpus_name: an identifier of the corpus (registry file name)
    """
    id: str
    corpus_name: str

    @property
    def data_path(self):
        """
        provide a relative (to a globally configured directory for subcorpora) data path of the subcorpus
        """
        return SubcorpusIdent.mk_relative_data_path(self.id)

    @property
    def data_dir(self):
        """
        provide a relative path of a directory where all the subcorpus data are stored
        (the subc. itself, auxiliary freq data etc.)
        """
        return os.path.join(self.id[:2], self.id)

    @staticmethod
    def mk_relative_data_path(ident: str):
        return os.path.join(ident[:2], ident, 'data.subc')


async def create_new_subc_ident(subc_root: str, corpus_name: str) -> SubcorpusIdent:
    """
    create_new_subc_ident generates a new instance of SubcorpusIdent and also
    ensures that a target data directory exists.
    """
    ans = SubcorpusIdent(
        id=int2chash(int(hashlib.sha1(uuid.uuid1().hex.encode()).hexdigest(), 16), 8),
        corpus_name=corpus_name)
    full_dir_path = os.path.join(subc_root, ans.data_dir)
    if not await aiofiles.os.path.isdir(full_dir_path):
        await aiofiles.os.makedirs(full_dir_path)
    return ans


class AbstractKCorpus(ABC):
    """
    AbstractKCorpus is a generalization of any (sub)corpus.
    """

    @property
    @abstractmethod
    def corpname(self) -> str:
        """
        Provide a corpus ID (= registry file name).
        For historical reasons, the name is a bit misleading.
        """
        pass

    @property
    @abstractmethod
    def human_readable_corpname(self) -> str:
        """
        Provide a more human-readable name of the corpus (if possible).
        For Manatee corpora, this usually means the 'NAME' value from
        corpus' registry file.
        """
        pass

    @property
    @abstractmethod
    def portable_ident(self) -> Union[str, SubcorpusIdent]:
        """
        portable_ident defines an identification value/object we are able to fully instantiate
        a corpus/subcorpus from. For a regular corpus, this means just a corpus ID (registry file name).
        For a subcorpus, we need some more data (SubcorpusIdent) to provide full information for
        a respective instance.

        This property is e.g. used when passing corpus between web server and worker where
        we cannot pass direct corpus instances, and we need easily serializable representations instead.
        """
        pass

    @property
    @abstractmethod
    def cache_key(self) -> str:
        """
        provide a key which is used as part (along with a key generated from
        the query itself) of concordance cache keys for the corpus
        """
        pass

    @property
    @abstractmethod
    def created(self) -> Union[datetime, None]:
        pass

    @property
    @abstractmethod
    def author(self) -> str:
        """
        Provide a full name of an author of the subcorpus

        TODO: this should be probably 'subcorpus_author'
        """
        pass

    @property
    @abstractmethod
    def author_id(self) -> str:
        """
        Provide an ID an author of the subcorpus

        TODO: this should be probably 'subcorpus_author_id'
        """
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        pass

    @abstractmethod
    def get_conf(self, key: str) -> Any:
        pass

    @abstractmethod
    def get_confpath(self, *args, **kwargs):
        pass

    @abstractmethod
    def get_conffile(self, *args, **kwargs):
        pass

    @abstractmethod
    def set_default_attr(self, *args, **kwargs):
        pass

    @property
    @abstractmethod
    def size(self) -> int:
        pass

    @property
    @abstractmethod
    def search_size(self) -> int:
        """
        Actual searchable size. This matters mainly in case of
        a subcorpus where the 'size' reports parent corpus size
        while 'search_size' gives actual size of the subcorpus.
        """
        pass

    @abstractmethod
    def get_struct(self, *args, **kwargs):
        pass

    @abstractmethod
    def get_attr(self, *args, **kwargs):
        pass

    @abstractmethod
    def get_info(self, *args, **kwargs):
        pass

    @abstractmethod
    def unwrap(self) -> Corpus:
        pass

    @abstractmethod
    def freq_dist(self, rs, crit, limit, words, freqs, norms):
        pass

    @abstractmethod
    def filter_query(self, *args, **kwargs):
        pass

    @property
    @abstractmethod
    def subcorpus_id(self) -> Optional[str]:
        """
        Get a globally unique ID of the subcorpus. For a regular corpus,
        this should return None.
        """
        pass

    @property
    @abstractmethod
    def preflight_warn_ipm(self) -> int:
        """
        Specify a rounded instances per million (i.p.m.) threshold at which
        a preflight search query should be deemed a warning, indicating that
        the resulting computation may be excessively lengthy.

        In case the calculation cannot be performed due to corpus size
        issues (e.g. size == 0), the 1,000,000 (i.e. all tokens match)
        should be returned.
        """
        pass

    @property
    @abstractmethod
    def subcorpus_name(self) -> Optional[str]:
        pass

    @abstractmethod
    def compile_arf(self, attr):
        pass

    @abstractmethod
    def freq_precalc_file(self, attrname: str, ftype: str):
        pass

    @property
    @abstractmethod
    def corp_mtime(self) -> Awaitable[float]:
        pass

    @abstractmethod
    def get_posattrs(self) -> List[str]:
        pass

    @abstractmethod
    def get_structattrs(self) -> List[str]:
        pass

    @abstractmethod
    def get_structs(self) -> List[str]:
        pass
