# Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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
A script to archive outdated concordance queries from Redis to a MySQL database.
"""

from plugins.common.sqldb import DatabaseAdapter
from plugin_types.general_storage import KeyValueStorage
import ujson
import logging
import datetime
import time



class ArchiveCleaner:
    """
    A class which actually performs the process of archiving records
    from fast database (Redis) to a slow one (SQLite3)
    """

    def __init__(
            self,
            kvdb: KeyValueStorage,
            db: DatabaseAdapter,
            status_key: str,
            anonymous_user_id: int,
            anonymous_rec_max_age_days: int):
        self.kvdb: KeyValueStorage = kvdb
        self.db: DatabaseAdapter = db
        self.status_key = status_key
        self.anonymous_user_id = anonymous_user_id
        self.anonymous_rec_max_age_days = anonymous_rec_max_age_days




    async def run(self, num_proc, dry_run):
        where_args = [self.anonymous_rec_max_age_days]
        where_sql = [
            'permanent = 0',
            'created > (SELECT min(created) FROM kontext_conc_persistence WHERE permanent = 0)',
            'created <= NOW() - INTERVAL %s DAYS'
        ]
        # last_check_date is kind of a hook for the partitioned
        # archive database where giving 'WHERE permanent = 0 AND last_check_date >= ?'
        # allows for more performant search
        # But even with `last_check_date` empty, we are still able
        # to operate (typically, this includes the first run of the cleanup procedure).
        last_checked_item_date = await self.kvdb.get(self.status_key)
        now = datetime.datetime.now()
        min_age = now - datetime.timedelta(days=self.anonymous_rec_max_age_days)
        if last_checked_item_date:
            lchckdt = datetime.datetime(*time.strptime(last_checked_item_date, '%Y-%m-%dT%H:%M:%Sz')[:6])
            if lchckdt > min_age:
                logging.getLogger(__name__).info(
                    'No need to check for archived conc. records - last check too recent (last check: {}, min age: {}'.format(
                        lchckdt, min_age))
                return
            where_args.append(last_checked_item_date)
            where_sql.append('created >= %s')
        async with self.db.connection() as conn:
            async with await conn.cursor() as cursor:
                await cursor.execute(
                    'SELECT id, created, data, num_access FROM kontext_conc_persistence WHERE {} ORDER BY created LIMIT %s '.format(" AND ".join(where_sql)),
                    where_args + [num_proc]
                )
                for item in await cursor.fetchall():
                    try:
                        data = ujson.loads(item[2])
                        user_id = data.get('user_id')
                        if user_id != self.anonymous_user_id:
                            await cursor.execute(
                                'UPDATE kontext_conc_persistence SET permanent = 1 WHERE id = %s', (data.get('id'),))
                        elif item[3] == 0:
                            await cursor.execute('DELETE FROM kontext_conc_persistence WHERE id = %s', (data.get('id'),))
                    except Exception as ex:
                        logging.getLogger(__name__).error(
                            'Failed to check status of archived item {}: {}'.format(item[0], ex))


async def run(
        kvdb, db, status_key: str, num_proc: int, anonymous_user_id: int, anonymous_rec_max_age_days: int,  dry_run: bool):
    archiver = ArchiveCleaner(
        kvdb=kvdb,
        db=db,
        status_key=status_key,
        anonymous_user_id=anonymous_user_id,
        anonymous_rec_max_age_days=anonymous_rec_max_age_days)
    return await archiver.run(num_proc, dry_run)
