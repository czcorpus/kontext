# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import TypeVar, Generic
from werkzeug.wrappers import Request

T = TypeVar('T')  # data format returned by a loader
U = TypeVar('U')  # user selection format

class AbstractValueSelectionFetcher(Generic[U]):

    def fetch(self, request:Request) -> U: ...

    def is_empty(self, val:U) -> bool: ...


class AbstractTagsetInfoLoader(Generic[T, U]):

    def is_enabled(self) -> bool: ...

    def get_initial_values(self, lang:basestring) -> T: ...

    def get_variant(self, user_selection:U, lang:basestring) -> T: ...


class AbstractTaghelper(Generic[T, U]):

    def tags_enabled_for(self, corpus_id:str) -> bool: ...

    def loader(self, corpus_name:str) -> AbstractTagsetInfoLoader[T, U]: ...

    def fetcher(self, corpus_name:str) -> AbstractValueSelectionFetcher[U]: ...