# Copyright (c) 2013 Institute of the Czech National Corpus
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

from typing import Any, Awaitable, List

from corplib import SubcorpusIdent
from corplib.abstract import AbstractKCorpus
from manatee import Corpus


class EmptyCorpus(AbstractKCorpus):
    """
    EmptyCorpus serves as an error-replacement corpus to keep
    request processing logic operational in some cases.
    """

    def __init__(self, corpname: str = ''):
        self._corpname = corpname
        self._conf = {
            'ENCODING': 'UTF-8',
            'NAME': self.corpname,
            'ATTRLIST': '',
            'STRUCTLIST': ''
        }

    @property
    def subcorpus_name(self):
        return None

    @property
    def portable_ident(self):
        return self._corpname

    @property
    def corpname(self):
        return self._corpname

    @property
    def human_readable_corpname(self):
        return self._corpname

    @property
    def spath(self):
        return None

    @property
    def subcname(self):
        return None

    @property
    def cache_key(self):
        return None

    @property
    def created(self):
        return None

    @property
    def orig_spath(self):
        return None

    @property
    def author(self):
        return None

    @property
    def author_id(self):
        return -1

    @property
    def description(self):
        return None

    def get_conf(self, key: str) -> Any:
        return self._conf.get(key, '')

    def get_confpath(self, *args, **kwargs):
        return None

    def get_conffile(self, *args, **kwargs):
        return None

    def set_default_attr(self, *args, **kwargs):
        pass

    @property
    def size(self) -> int:
        return 0

    @property
    def search_size(self) -> int:
        return 0

    def get_struct(self, *args, **kwargs):
        pass

    def get_attr(self, *args, **kwargs):
        pass

    def get_info(self, *args, **kwargs):
        pass

    def unwrap(self) -> Corpus:
        return None

    def freq_dist(self, rs, crit, limit, words, freqs, norms):
        pass

    def filter_query(self, *args, **kwargs):
        pass

    def subcorpus_id(self):
        return None

    def compile_arf(self, attr):
        pass

    def freq_precalc_file(self, attrname: str, ftype: str):
        pass

    @property
    def corp_mtime(self) -> Awaitable[float]:
        async def awaitable():
            return -1.0
        return awaitable()

    def get_posattrs(self) -> List[str]:
        return []

    def get_structattrs(self) -> List[str]:
        return []

    def get_structs(self) -> List[str]:
        return []


class ErrorCorpus(EmptyCorpus):
    """
    This type is used in case we encounter a corpus-initialization error
    and yet we still need proper template/etc. variables initialized
    (e.g. user visits URL containing non-existing sub-corpus)
    """

    def __init__(self, err: Exception, corpname: str = '', usesubcorp: str = None):
        """
        arguments:
        err -- an error which caused that the original corpus failed to initialize
        """
        super().__init__(corpname)
        self._error = err
        self._usesubcorp = usesubcorp

    def get_error(self):
        """
        returns original error
        """
        return self._error

    @property
    def subcorpus_id(self):
        return self._usesubcorp

    @property
    def subcorpus_name(self):
        return self._usesubcorp

    @property
    def portable_ident(self):
        return SubcorpusIdent(id=self.subcorpus_id, corpus_name=self._corpname) if self._usesubcorp else self._corpname
