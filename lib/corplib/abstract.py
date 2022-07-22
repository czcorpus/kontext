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


from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any, Awaitable, List, Union, Optional
from corplib.subcorpus import SubcorpusRecord

from manatee import Corpus


class AbstractKCorpus(ABC):

    @property
    @abstractmethod
    def corpname(self) -> str:
        pass

    @property
    @abstractmethod
    def human_readable_corpname(self) -> str:
        pass

    @property
    @abstractmethod
    def system_ident(self) -> Union[str, SubcorpusRecord]:
        pass

    @property
    @abstractmethod
    def cache_key(self) -> str:
        pass

    @property
    @abstractmethod
    def created(self) -> Union[datetime, None]:
        pass

    @property
    @abstractmethod
    def author(self) -> str:
        pass

    @property
    @abstractmethod
    def author_id(self) -> str:
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
        pass

    @property
    @abstractmethod
    def subcorpus_name(self) -> Optional[str]:
        pass

    @abstractmethod
    def freq_precalc_file(self, attrname: str):
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
