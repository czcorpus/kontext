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

import datetime
import logging

import ujson as json
from mysql.connector.aio.abstracts import MySQLCursorAbstract
from plugin_types.general_storage import KeyValueStorage
from plugins.common.mysql import MySQLOps


def get_iso_datetime():
    return datetime.datetime.now().isoformat()


async def is_archived(cursor: MySQLCursorAbstract, conc_id):
    await cursor.execute(
        'SELECT id FROM kontext_conc_persistence WHERE id = %s LIMIT 1',
        (conc_id,)
    )
    return (await cursor.fetchone()) is not None


class Archiver(object):
    """
    A class which actually performs the process of archiving records
    from fast database (Redis) to a slow one (SQLite3)
    """

    def __init__(self, from_db: KeyValueStorage, to_db: MySQLOps, archive_queue_key: str):
        """
        arguments:
        from_db -- a Redis connection
        to_db -- a SQLite3 connection
        archive_queue_key -- a Redis key used to access archive queue
        """
        self._from_db: KeyValueStorage = from_db
        self._to_db: MySQLOps = to_db
        self._archive_queue_key = archive_queue_key

    async def _get_queue_size(self):
        return await self._from_db.list_len(self._archive_queue_key)

    async def run(self, num_proc, dry_run):
        """
        Performs actual archiving process according to the parameters passed
        in constructor.

        Please note that dry-run is not 100% error-prone as it also pops the items
        from the queue and then inserts them again.

        arguments:
        num_proc -- how many items per run should be processed
        dry_run -- if True then no writing operations are performed

        returns:
        a dict containing some information about processed data (num_processed,
        error, dry_run, queue_size)
        """

        curr_time = get_iso_datetime()
        conc_prefix = 'concordance:'
        inserts = []
        deletes = []
        i = 0
        try:
            async with self._to_db.connection() as connection:
                async with connection.cursor() as cursor:
                    proc_keys = {}
                    while i < num_proc:
                        qitem = await self._from_db.list_pop(self._archive_queue_key)
                        if qitem is None:
                            break
                        key = qitem['key']
                        already_archived = await is_archived(cursor, key)
                        latest_proc = proc_keys.get(key)
                        # there are possible duplicates in the queue
                        if latest_proc and latest_proc.get('revoke') == qitem.get('revoke'):
                            continue
                        proc_keys[key] = qitem
                    for key, qitem in proc_keys.items():
                        if qitem.get('revoke', False):
                            deletes.append(key[len(conc_prefix):])
                            i += 1
                        elif not already_archived:
                            data = await self._from_db.get(key)
                            inserts.append((key[len(conc_prefix):], json.dumps(data), curr_time, 0))
                            i += 1
                    if not dry_run:
                        if len(deletes) > 0:
                            await cursor.executemany(
                                'DELETE FROM kontext_conc_persistence WHERE id = %s',
                                deletes
                            )
                        if len(inserts) > 0:
                            await cursor.executemany(
                                'INSERT IGNORE INTO kontext_conc_persistence (id, data, created, num_access) '
                                'VALUES (%s, %s, %s, %s)',
                                inserts
                            )
                        await connection.commit()
                    else:
                        for ins in reversed(inserts):
                            await self._from_db.list_append(
                                self._archive_queue_key, dict(key=conc_prefix + ins[0]))
                        for rm in reversed(deletes):
                            await self._from_db.list_append(
                                self._archive_queue_key, dict(key=conc_prefix + rm, revoke=True))
        except Exception as ex:
            logging.getLogger(__name__).error('Failed to archive items: %s', ex,  exc_info=ex)
            for item in inserts:
                await self._from_db.list_append(self._archive_queue_key, dict(key=conc_prefix + item[0]))
            return dict(
                num_processed=i,
                error=str(ex),
                dry_run=dry_run,
                queue_size=await self._get_queue_size())
        return dict(
            num_processed=i,
            error=None,
            dry_run=dry_run,
            queue_size=await self._get_queue_size())


async def run(from_db, to_db, archive_queue_key: str, num_proc: int, dry_run: bool):
    archiver = Archiver(from_db=from_db, to_db=to_db, archive_queue_key=archive_queue_key)
    return await archiver.run(num_proc, dry_run)
