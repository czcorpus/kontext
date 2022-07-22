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
from typing import Dict, List, Optional, Union

from corplib.subcorpus import SubcorpusRecord
from action.argmapping.subcorpus import (
    CreateSubcorpusArgs, CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs)


class AbstractSubcRestore(abc.ABC):

    @abc.abstractmethod
    async def create(
            self, ident: str, user_id: int, corpname: str, subcname: str, size: int, public_description, data_path: str,
            data: Union[CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs, CreateSubcorpusArgs]):
        """
        Create subcorpus in the database. It is assumed that actual subc. files are created somewhere else and
        the proper path is passed here.
        """

    @abc.abstractmethod
    async def archive(self, user_id: int, corpname: str, subcname: str):
        """
        Archive subcorpus
        """

    @abc.abstractmethod
    async def list(self, user_id: int, filter_args: Dict, from_idx: int, to_idx: int) -> List[SubcorpusRecord]:
        """
        List all user subcorpora from index from_idx to index to_idx
        (including both ends). The method is not expected to support negative
        indices (like e.g. Python does).

        arguments:
        user_id -- int, ID of a user
        from_idx -- values from 0 to num_of_user_queries - 1
        to_idx -- values from 0 to num_of_user_queries - 1

        returns:
        a list/tuple of SubcorpusRecord dataclass
        If nothing is found then an empty list/tuple is returned.
        """

    @abc.abstractmethod
    async def get_info(self, user_id: int, corpname: str, subcname: str) -> Optional[SubcorpusRecord]:
        """
        Returns an information about the most recent record matching provided arguments
        """

    @abc.abstractmethod
    async def get_query(self, query_id: int) -> Optional[SubcorpusRecord]:
        """
        Returns a query with ID == query_id

        returns:
        SubcorpusRecord dataclass
        If nothing is found then None is returned.
        """