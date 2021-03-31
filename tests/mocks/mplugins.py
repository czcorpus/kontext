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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

from plugins.abstract.user_items import AbstractUserItems
from plugins.abstract.auth import AbstractAuth


class MockUserItems(AbstractUserItems):

    def __init__(self):
        super(AbstractUserItems, self).__init__()
        self._added_items = []
        self._deleted_items = []

    def from_dict(self, data):
        raise NotImplementedError()

    def serialize(self, obj):
        raise NotImplementedError()

    def get_user_items(self, plugin_ctx):
        raise NotImplementedError()

    def add_user_item(self, plugin_ctx, item):
        self._added_items.append(item)

    def delete_user_item(self, plugin_ctx, item_id):
        self._deleted_items.append(item_id)

    @property
    def added_items(self):
        return self._added_items

    @property
    def deleted_items(self):
        return self._deleted_items


# ################################################################


class MockAuth(AbstractAuth):

    def is_administrator(self, user_id):
        return False

    def permitted_corpora(self, user_dict):
        raise NotImplementedError()

    def get_user_info(self, plugin_ctx):
        raise NotImplementedError()
