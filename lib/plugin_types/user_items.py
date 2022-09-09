# Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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
A plug-in template for managing items (corpora, subcorpora, aligned corpora)
user can access via fast access widget. This is a generalization of
user corpus list.

Expected factory method signature: create_instance(config, db)
"""

import abc
from dataclasses import dataclass, field, InitVar
from typing import Dict, Any, Optional, List, TypedDict

import l10n
from action.errors import UserReadableException


class UserItemException(UserReadableException):
    """
    General error related to
    the plug-in
    """
    pass


class CorpusItem(TypedDict):
    id: str
    name: str


@dataclass
class FavoriteItem:

    name: Optional[str] = None
    ident: Optional[str] = None
    id: InitVar[str] = None
    data: Optional[Dict[str, Any]] = field(default_factory=dict)
    corpora: Optional[List[CorpusItem]] = field(default_factory=list)
    size: Optional[int] = None
    sizes: InitVar[List[Any]] = None
    size_info: Optional[str] = None
    subcorpus_id: Optional[str] = None
    subcorpus_orig_id: Optional[str] = None

    def __post_init__(self, id, sizes):
        if self.ident is None:
            self.ident = id
        if self.size is None:
            self.size = sizes
        self.size_info = l10n.simplify_num(self.size) if self.size else None

    @property
    def is_single_corpus(self):
        return not self.subcorpus_id and len(self.corpora) == 1

    @property
    def main_corpus_id(self):
        return self.corpora[0]['id']

    @property
    def sort_key(self):
        return '{0} {1}'.format(' '.join(x['name'] for x in self.corpora), self.subcorpus_id)

    def to_dict(self):
        return dict(
            id=self.ident,
            name=self.name,
            size=self.size,
            size_info=self.size_info,
            corpora=self.corpora,
            subcorpus_id=self.subcorpus_id,
            subcorpus_orig_id=self.subcorpus_orig_id
        )


class AbstractUserItems(abc.ABC):
    """
    A 'user_items' (= favorite corpora, subcorpora, aligned corpora)
    plug-in interface.

    Please note that to initiate the plug-in with request-specific
    data the 'setup(controller)' method must be implemented. The controller
    detects it automatically and calls it for all active plug-ins implementing
    it.
    """

    @abc.abstractmethod
    def serialize(self, obj):
        """
        Exports a GeneralItem instance or a list of GeneralItem instances (both variants
         must be supported) to JSON used for internal storage (i.e. no client-side stuff)
        """

    @abc.abstractmethod
    async def get_user_items(self, plugin_ctx):
        """
        Returns a list of user items (GeneralItem implementations)

        arguments:
        plugin_ctx --

        return:
        a list or a compatible structure containing GeneralItem objects
        """

    @abc.abstractmethod
    async def add_user_item(self, plugin_ctx, item):
        """
        Adds (persistently) an item to user's list.

        arguments:
        plugin_ctx --
        item -- an instance of GeneralItem implementation
        """

    @abc.abstractmethod
    async def delete_user_item(self, plugin_ctx, item_id):
        """
        Removes (in a persistent way) an item from user's list.

        arguments:
        plugin_ctx --
        item_id -- an ID of GeneralItem instance
        """
