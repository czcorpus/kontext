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

from typing import List
from corplib.abstract import AbstractKCorpus
from manatee import Corpus


class EmptyCorpus(AbstractKCorpus):
    """
    EmptyCorpus serves as kind of a fake corpus to keep KonText operational
    in some special cases (= cases where we do not need any corpus to be
    instantiated which is a situation original Bonito code probably never
    count with).
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
    def corpname(self):
        return self._corpname

    @property
    def spath(self):
        return None

    @property
    def subcname(self):
        return None

    @property
    def subchash(self):
        return None

    @property
    def created(self):
        return None

    @property
    def is_published(self):
        return False

    @property
    def orig_spath(self):
        return None

    @property
    def orig_subcname(self):
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

    def get_conf(self, param):
        return self._conf.get(param, '')

    def get_confpath(self, *args, **kwargs):
        return None

    def get_conffile(self, *args, **kwargs):
        return None

    def set_default_attr(self, *args, **kwargs):
        pass

    @property
    def size(self):
        return 0

    @property
    def search_size(self):
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

    def is_subcorpus(self):
        return False

    def save_subc_description(self, desc: str):
        pass

    def freq_precalc_file(self, attrname: str):
        return None

    @property
    def corp_mtime(self):
        return -1

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

    def __init__(self, err):
        """
        arguments:
        err -- an error which caused that the original corpus failed to initialize
        """
        super(ErrorCorpus, self).__init__()
        self._error = err

    def get_error(self):
        """
        returns original error
        """
        return self._error

    def is_subcorpus(self):
        return False
