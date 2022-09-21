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
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Optional, Union

from action.argmapping.action import IntOpt, StrOpt
from action.argmapping.subcorpus import (
    CreateSubcorpusArgs, CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs)
from corplib.subcorpus import SubcorpusRecord
from plugin_types.auth import UserInfo


class SubcArchiveException(Exception):
    pass


@dataclass
class SubcListFilterArgs:
    """
    SubcListFilterArgs defines filtering args for listing subcorpora via subc_storage plug-in.
    Please note that the arguments do not contain neither paging information nor filtering by
    corpus name. This is due to the fact that we need to collect subcorpora for all the matching
    corpora first to be able to fill in client-side corpus selection element.

    Attributes:
        active_only: list only non-archived, non-deleted items (mutually exclusive with 'archived_only')
        archived_only: list only archived items (i.e. no deleted or active ones; mutually exclusive with 'active_only')
        published_only: list only items with public description (and thus searchable; please note that
            any subcorpus is publicly accessible once a user has a URL)
        ia_query: ID or author name prefix for published subcorpora listing

    Raises:
        Exception in case both active_only and archived_only are True
    """
    active_only: IntOpt = 1
    archived_only: IntOpt = 0
    published_only: IntOpt = 0
    pattern: StrOpt = None
    ia_query: StrOpt = None


@dataclass
class SubcListFilterClientArgs(SubcListFilterArgs):
    """
    SubcListFilterClientArgs is an extension of SubcListFilterArgs which is used
    as a source of arguments for the client-side.

    Attributes:
        corpname: if defined then display only subcorpora of that corpus
    """
    page: IntOpt = 1
    pagesize: IntOpt = None
    corpname: StrOpt = None


class AbstractSubcArchive(abc.ABC):

    @abc.abstractmethod
    async def create(
            self, ident: str, author: UserInfo, size: int, public_description,
            data: Union[CreateSubcorpusRawCQLArgs, CreateSubcorpusWithinArgs, CreateSubcorpusArgs], is_draft: bool = False):
        """
        Create subcorpus in the database. It is assumed that actual subc. files are created somewhere else and
        the proper path is passed here.
        """

    @abc.abstractmethod
    async def archive(self, user_id: int, corpname: str, subc_id: str) -> datetime:
        """
        Archive subcorpus
        """

    @abc.abstractmethod
    async def restore(self, user_id: int, corpname: str, subc_id: str):
        """
        Restore archived subcorpus
        """

    @abc.abstractmethod
    async def list_corpora(
            self,
            user_id: int,
    ) -> List[str]:
        """
        List corpora that have some subcorpora
        """

    @abc.abstractmethod
    async def list(
            self,
            user_id: int,
            filter_args: SubcListFilterArgs,
            corpname: Optional[str] = None,
            offset: int = 0,
            limit: Optional[int] = None) -> List[SubcorpusRecord]:
        """
        List all user subcorpora based on provided filter_args and with optional offset and limit (for pagination)
        """

    @abc.abstractmethod
    async def get_info(self, subc_id: str) -> Optional[SubcorpusRecord]:
        """
        Returns an information about the most recent record matching provided ID
        """

    @abc.abstractmethod
    async def get_names(self, subc_ids: List[str]) -> Dict[str, str]:
        """
        For a list of subc IDs provide a dict mapping those IDs to original names
        authors gave them
        """

    @abc.abstractmethod
    async def get_query(self, query_id: int) -> Optional[SubcorpusRecord]:
        """
        Returns a query with ID == query_id

        returns:
        SubcorpusRecord dataclass
        If nothing is found then None is returned.
        """

    @abc.abstractmethod
    async def delete_query(self, user_id: int, corpname: str, subc_id: str) -> None:
        """
        Makes sure subcorpus can not be used, restored and found anymore
        """

    @abc.abstractmethod
    async def update_name_and_description(self, user_id: int, subc_id: str, subcname: str, description: str, preview_only: bool) -> str:
        """
        Update public description and return decode version (Markdown -> HTML) for preview
        """
        pass
