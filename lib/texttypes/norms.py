# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2016 Charles University, Faculty of Arts,
#                    Department of Linguistics
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import collections
from functools import partial

from corplib.corpus import AbstractKCorpus

from .cache import TextTypesCache


class StructNormsCalc(object):
    """
    Adds a size information of texts related to respective attribute values.
    An instance is always bound to a concrete structure and required value type.
    """

    def __init__(self, corpus: AbstractKCorpus, structname: str, subcnorm: str):
        """
        arguments:
        corpus --
        structname -- a name of a corpus structure
        subcnorm -- a type of value to be collected (allowed values: freq, tokens)
        """
        self._corp = corpus
        self._structname = structname
        self._struct = self._corp.get_struct(structname)
        self._subcnorm = subcnorm
        self._normvals = None

    @property
    def normvals(self):
        if self._normvals is None:
            self._normvals = self._calc_normvals()
        return self._normvals

    def _calc_normvals(self):
        if self._subcnorm == 'freq':
            normvals = dict((self._struct.beg(i), 1) for i in range(self._struct.size()))
        elif self._subcnorm == 'tokens':
            normvals = dict((self._struct.beg(i), self._struct.end(i) - self._struct.beg(i))
                            for i in range(self._struct.size()))
        else:
            nas = self._struct.get_attr(self._subcnorm).pos2str
            normvals = dict((self._struct.beg(i), self._safe_int(nas(i)))
                            for i in range(self._struct.size()))
        return normvals

    @staticmethod
    def _safe_int(s):
        try:
            return int(s)
        except ValueError:
            return 0

    async def compute_norm(self, attrname, value):
        attr = self._struct.get_attr(attrname)
        valid = attr.str2id(value)
        r = self._corp.filter_query(self._struct.attr_val(attrname, valid))
        cnt = 0
        while not r.end():
            cnt += self.normvals[r.peek_beg()]
            r.next()
        return cnt


class CachedStructNormsCalc(StructNormsCalc):
    """
    A caching variant of StructNormsCalc. Uses 'db' key=>value plug-in to
    store values.
    """

    def __init__(self, corpus: AbstractKCorpus, structname: str, subcnorm: str, tt_cache: TextTypesCache):
        """
        arguments:
        corpus --
        structname -- a name of a corpus structure
        subcnorm -- a type of value to be collected (allowed values: freq, tokens)
        db -- a 'db' plug-in instance
        """
        super().__init__(corpus, structname, subcnorm)
        self._tt_cache = tt_cache
        self._data = None

    async def _init_data(self):
        mkdict = partial(collections.defaultdict, lambda: {})
        try:
            self._data = mkdict(await self._tt_cache.get_attr_values(self._corp.corpname, self._structname, self._subcnorm))
        except (IOError, TypeError):
            self._data = mkdict()

    async def compute_norm(self, attrname, value):
        if self._data is None:
            await self._init_data()
        if attrname not in self._data or value not in self._data[attrname]:
            self._data[attrname][value] = await super(
                CachedStructNormsCalc, self).compute_norm(attrname, value)
            await self._tt_cache.set_attr_values(self._corp.corpname, self._structname, self._subcnorm, self._data)
        return self._data[attrname][value]
