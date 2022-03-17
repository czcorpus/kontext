# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
A corparch database backend for MySQL/MariaDB.

"""
from typing import Union

import aiomysql

from plugin_types.user_items import FavoriteItem
from plugin_types.integration_db import IntegrationDatabase
from plugins.common.mysql import MySQLOps


DFLT_USER_TABLE = 'kontext_user'
DFLT_CORP_TABLE = 'kontext_corpus'
DFLT_GROUP_ACC_TABLE = 'kontext_group_access'
DFLT_GROUP_ACC_CORP_ATTR = 'corpus_name'
DFLT_GROUP_ACC_GROUP_ATTR = 'group_access'
DFLT_USER_ACC_TABLE = 'kontext_user_access'
DFLT_USER_ACC_CORP_ATTR = 'corpus_name'


class Backend:

    def __init__(
            self,
            db: Union[IntegrationDatabase[aiomysql.Connection, aiomysql.Cursor], MySQLOps],
            user_table: str = DFLT_USER_TABLE,
            corp_table: str = DFLT_CORP_TABLE,
            group_acc_table: str = DFLT_GROUP_ACC_TABLE,
            user_acc_table: str = DFLT_USER_ACC_TABLE,
            user_acc_corp_attr: str = DFLT_USER_ACC_CORP_ATTR,
            group_acc_corp_attr: str = DFLT_GROUP_ACC_CORP_ATTR,
            group_acc_group_attr: str = DFLT_GROUP_ACC_GROUP_ATTR):
        self._db = db
        self._user_table = user_table
        self._corp_table = corp_table
        self._group_acc_table = group_acc_table
        self._user_acc_table = user_acc_table
        self._user_acc_corp_attr = user_acc_corp_attr
        self._group_acc_corp_attr = group_acc_corp_attr
        self._group_acc_group_attr = group_acc_group_attr

    async def get_favitems(self, user_id: int):
        async with self._db.cursor() as cursor:
            await cursor.execute(
                'SELECT fav.id as id, fav.name, fav.subcorpus_id, fav.subcorpus_orig_id, '
                " GROUP_CONCAT(t.corpus_name SEPARATOR ',') as corpora, "
                " GROUP_CONCAT(c.size SEPARATOR ',') as sizes "
                'FROM kontext_user_fav_item as fav '
                'JOIN kontext_corpus_user_fav_item AS t ON fav.id = t.user_fav_corpus_id '
                f'JOIN {self._corp_table} AS c ON t.corpus_name = c.name '
                'WHERE user_id = %s '
                'GROUP BY id ', (user_id,))

            ans = []
            async for item in cursor:
                item['corpora'] = [{'name': corp, 'id': corp}
                                   for corp in item['corpora'].split(',')]
                item['size'] = int(item['sizes'].split(',')[0])
                ans.append(FavoriteItem(item))

        return ans

    async def count_favitems(self, user_id: int) -> int:
        async with self._db.cursor() as cursor:
            await cursor.execute(
                'SELECT COUNT(*) AS count '
                'FROM kontext_user_fav_item '
                'WHERE user_id = %s ', (user_id,))
            return await cursor.fetchone()

    async def insert_favitem(self, user_id: int, item: FavoriteItem):
        async with self._db.cursor() as cursor:
            await cursor.execute(
                'INSERT INTO kontext_user_fav_item (name, subcorpus_id, subcorpus_orig_id, user_id) '
                'VALUES (%s, %s, %s, %s) ', (item.name, item.subcorpus_id, item.subcorpus_orig_id, user_id))

            favitem_id: int = cursor.lastrowid
            await cursor.executemany(
                'INSERT INTO kontext_corpus_user_fav_item (user_fav_corpus_id, corpus_name) '
                'VALUES (%s, %s) ', [(favitem_id, corp['id']) for corp in item.corpora])

        await self._db.commit()
        item.ident = str(favitem_id)  # need to update new id

    async def delete_favitem(self, item_id: int):
        async with self._db.cursor() as cursor:
            await cursor.execute(
                'DELETE FROM kontext_corpus_user_fav_item WHERE user_fav_corpus_id = %s', (item_id,))
            await cursor.execute('DELETE FROM kontext_user_fav_item WHERE id = %s', (item_id,))
        await self._db.commit()
