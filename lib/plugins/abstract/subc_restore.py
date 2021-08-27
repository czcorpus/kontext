# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
A plug-in template for storing Subcorpus parameters to be able to restore
it if needed. This plug-in is optional.

Expected factory method signature: create_instance(config, db)
"""

import abc
from typing import Any, Dict, List, Optional
from controller.plg import PluginCtx
from dataclasses import asdict, dataclass
import datetime


@dataclass
class SubcRestoreRow:
    id: str
    user_id: int
    corpname: str
    subcname: str
    cql: str
    timestamp: datetime.datetime

    def to_dict(self) -> Dict[str, Any]:
        """
        Method to get json serializable dict
        """
        res = asdict(self)
        res['timestamp'] = self.timestamp.timestamp()
        return res


class AbstractSubcRestore(abc.ABC):

    @abc.abstractmethod
    def store_query(self, user_id: int, corpname: str, subcname: str, cql: str):
        """
        Store user's subcorpus query. Please note that the method should
        also:
        1. store a current UNIX timestamp
        2. generate and store unique (on its own, i.e. even without user_id) string ID for the record

        arguments:
        user_id -- int, ID of a user
        corpname -- a name of a corpus
        subcname -- a name of a subcorpus
        cql -- a query used to define the subcorpus
        returns:
        None
        """

    @abc.abstractmethod
    def delete_query(self, user_id: int, corpname: str, subcname: str):
        """
        Remove a query from archive

        arguments:
        user_id -- int, ID of a user
        corpname -- a name of a corpus
        subcname -- a name of a subcorpus

        returns:
        None
        """

    @abc.abstractmethod
    def list_queries(self, user_id: int, from_idx: int, to_idx: int) -> List[SubcRestoreRow]:
        """
        List all user subcorpus queries from index from_idx to index to_idx
        (including both ends). The method is not expected to support negative
        indices (like e.g. Python does).

        arguments:
        user_id -- int, ID of a user
        from_idx -- values from 0 to num_of_user_queries - 1
        to_idx -- values from 0 to num_of_user_queries - 1

        returns:
        a list/tuple of SubcRestoreRow dataclass
        If nothing is found then an empty list/tuple is returned.
        """

    @abc.abstractmethod
    def get_info(self, user_id: int, corpname: str, subcname: str) -> Optional[SubcRestoreRow]:
        """
        Returns an information about the most recent record matching provided arguments
        """

    @abc.abstractmethod
    def get_query(self, query_id: int) -> Optional[SubcRestoreRow]:
        """
        Returns a query with ID == query_id

        returns:
        SubcRestoreRow dataclass
        If nothing is found then None is returned.
        """

    @abc.abstractmethod
    def extend_subc_list(self, plugin_ctx: PluginCtx, subc_list: List[Dict[str, Any]], filter_args: Dict[str, Any], from_idx: int, to_idx: int, include_cql: bool=False) -> List[Dict[str, Any]]:
        pass
