# Copyright (c) 2017 Charles University, Faculty of Arts,
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

from typing import Union, List, Dict

Serializable = Union[int, float, str, unicode, bool, list, dict, None]


class KeyValueStorage(object):

    def rename(self, key:str, new_key:str) -> None: ...

    def list_get(self, key:str, from_idx=int, to_idx=int) -> List[Serializable]: ...

    def list_append(self, key:str, value:Serializable): ...

    def list_pop(self, key:str) -> Serializable: ...

    def list_len(self, key:str) -> Serializable: ...

    def list_set(self, key:str, idx:int, value:Serializable): ...

    def list_trim(self, key:str, keep_left:int, keep_right:int): ...

    def hash_get(self, key:str, field:str) -> Serializable: ...

    def hash_set(self, key:str, field:str, value:Serializable): ...

    def hash_del(self, key:str, field:str): ...

    def hash_get_all(self, key:str) -> Dict[str, Serializable]: ...

    def get(self, key:str, default:Serializable=None) -> Serializable: ...

    def set(self, key:str, data:Serializable): ...

    def remove(self, key:str): ...

    def exists(self, key:str) -> bool: ...

    def set_ttl(self, key:str, ttl:int): ...

    def clear_ttl(self, key:str): ...

    def fork(self) -> KeyValueStorage: ...
