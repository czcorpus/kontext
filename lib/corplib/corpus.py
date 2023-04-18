# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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
from typing import Any, Awaitable, List, Union

import aiofiles
import aiofiles.os
from corplib.abstract import AbstractKCorpus
from corplib.subcorpus import SubcorpusIdent
from manatee import Corpus


PREFLIGHT_THRESHOLD_FREQ = 10_000_000
"""
Specifies a minimum preflight frequency (after it is recalculated
to the original corpus size) we consider too comp. demanding
and offer users an alternative corpus
"""


class KCorpus(AbstractKCorpus):
    """
    KCorpus is an abstraction of a corpus/subcorpus used by KonText.

    Due to incomplete abstraction of other involved functions (e.g. creating
    of a concordance), sometimes when the actual internal Corpus instance
    is needed the unwrap() function can be used.
    """

    _corpname: str
    _corp: Corpus

    def __init__(self, corp: Corpus, corpname: str):
        self._corp = corp
        self._corpname = corpname

    def __str__(self):
        return f'KCorpus(corpname={self.corpname})'

    @property
    def corp(self):
        return self._corp

    @property
    def corpname(self):
        return self._corpname

    @property
    def human_readable_corpname(self):
        if self.corp.get_conf('NAME'):
            return self.corp.get_conf('NAME')
        return self.corp.get_conffile()

    @property
    def portable_ident(self) -> Union[str, SubcorpusIdent]:
        return self.corpname

    @property
    def cache_key(self):
        return self._corpname.lower()

    @property
    def created(self):
        return None

    @property
    def author(self):
        return None

    @property
    def author_id(self):
        return None

    @property
    def description(self):
        return None

    def get_conf(self, key: str) -> Any:
        """
        Get corpus configuration entry from its configuration registry file
        """
        return self._corp.get_conf(key)

    def get_confpath(self):
        return self._corp.get_confpath()

    def get_conffile(self):
        return self._corp.get_conffile()

    def set_default_attr(self, attr: str):
        return self._corp.set_default_attr(attr)

    @property
    def size(self) -> int:
        """
        Return size of the whole corpus
        (even for a subcorpus). For actual
        search size, use search_size().
        """
        return self._corp.size()

    @property
    def search_size(self) -> int:
        return self._corp.search_size()

    def get_struct(self, struct: str):
        return self._corp.get_struct(struct)

    def get_attr(self, attr: str):
        return self._corp.get_attr(attr)

    def get_info(self):
        return self._corp.get_info()

    def unwrap(self) -> Corpus:
        return self._corp

    def freq_dist(self, rs, crit, limit, words, freqs, norms):
        return self._corp.freq_dist(rs, crit, limit, words, freqs, norms)

    def filter_query(self, attr: str):
        return self._corp.filter_query(attr)

    def compile_frq(self, attr):
        return self._corp.compile_frq(attr)

    def compile_arf(self, attr):
        return self._corp.compile_arf(attr)

    def compile_docf(self, attr, doc_attr):
        return self._corp.compile_docf(attr, doc_attr)

    def preflight_warn_ipm(self):
        if self.corp.size > 0:
            return round(PREFLIGHT_THRESHOLD_FREQ / self.corp.size * 1_000_000)
        return 1_000_000

    @property
    def subcorpus_id(self):
        return None

    @property
    def subcorpus_name(self):
        return None

    def freq_precalc_file(self, attrname: str, ftype: str) -> str:
        return self._corp.get_conf('PATH') + attrname + '.' + ftype

    @property
    def corp_mtime(self) -> Awaitable[float]:
        async def awaitable():
            reg_mtime = await aiofiles.os.path.getmtime(self._corp.get_confpath())
            data_path = self._corp.get_conf('PATH')
            data_dir = os.path.dirname(data_path) if data_path.endswith('/') else data_path
            data_mtime = await aiofiles.os.path.getmtime(data_dir)
            return max(reg_mtime, data_mtime)
        return awaitable()

    def get_posattrs(self) -> List[str]:
        items = self._corp.get_conf('ATTRLIST')
        return items.split(',') if items else []

    def get_structattrs(self) -> List[str]:
        items = self._corp.get_conf('STRUCTATTRLIST')
        return items.split(',') if items else []

    def get_structs(self) -> List[str]:
        items = self._corp.get_conf('STRUCTLIST')
        return items.split(',') if items else []

