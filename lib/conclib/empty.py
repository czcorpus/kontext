# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Optional
import manatee


class EmptyConc:

    def __init__(self, corp: manatee.Corpus, cache_path: Optional[str] = None, finished: bool = False):
        self._corp = corp
        self._cache_path = cache_path
        self._finished = finished

    def corp(self):
        return self._corp

    @property
    def orig_corp(self):
        return self._corp

    def get_conc_file(self):
        return self._cache_path

    def size(self):
        return 0

    def fullsize(self):
        return 0

    def switch_aligned(self, *args, **kw):
        pass

    def add_aligned(self, *args, **kw):
        pass

    def get_aligned(self, corps_with_colls):
        pass

    def compute_ARF(self):
        return 0

    def finished(self):
        return self._finished
