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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import abc
from typing import Dict, Any, List, Optional, Union, Tuple
from manatee import Corpus


QueryType = Union[List[str], Tuple[str]]


class CalcStatus(object):

    task_id:str
    pid:int
    created:int
    last_upd:int
    curr_wait:int
    concsize:int
    fullsize:int
    relconcsize:int
    error:BaseException
    finished:bool

    def __init__(self, task_id=None): ...

    def to_dict(self) -> Dict[str, Any]: ...

    def test_error(self): ...


    def has_some_result(self, minsize:int) -> bool: ...

    def update(self, data:Dict[str, Any]) -> CalcStatus: ...



class AbstractConcCache(abc.ABC):

    def get_stored_size(self, subchash:str, q:QueryType) -> int: ...

    def get_calc_status(self, subchash:str, query:QueryType) -> CalcStatus: ...

    def refresh_map(self): ...

    def cache_file_path(self, subchash:str, q:QueryType) -> str: ...

    def add_to_map(self, subchash:str, query:QueryType, size:int, calc_status:Optional[CalcStatus] = None): ...

    def del_entry(self, subchash:str, q:QueryType): ...

    def del_full_entry(self, subchash:str, q:QueryType): ...


class AbstractCacheMappingFactory(abc.ABC):
    """
    A factory which provides AbstractConcCache instances. Please note
    that your module's 'create_instance' should return this factory and
    not the cache itself.
    """
    def get_mapping(self, corpus:Corpus) -> AbstractConcCache: ...

    def fork(self) -> AbstractCacheMappingFactory: ...
