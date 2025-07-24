# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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


import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.realpath('%s/../' % os.path.dirname(os.path.realpath(__file__))))
sys.path.insert(0, os.path.realpath('%s/../../../../scripts/' %
                                    os.path.dirname(os.path.realpath(__file__))))

import autoconf
from action.plugin import initializer

initializer.init_plugin('integration_db')
initializer.init_plugin('db')
import plugins


async def import_settings():
    with plugins.runtime.INTEGRATION_DB as mysql_db, plugins.runtime.DB as kv_db:
        settings_keys = await kv_db.keys('settings:user:*')
        values = [(int(key.split(':')[-1]), json.dumps(await kv_db.get(key))) for key in settings_keys]
        async with mysql_db.connection() as conn:
            async with await conn.cursor() as cursor:
                await mysql_db.begin_tx(cursor)
                for row in values:
                    try:
                        await cursor.execute('INSERT INTO kontext_settings (user_id, data) VALUES (%s, %s)', row)
                    except Exception as ex:
                        print(f'Failed to insert data {row}: {ex}')
                await conn.commit()

        corpus_settings_keys = await kv_db.keys('corpus_settings:user:*')
        for key in corpus_settings_keys:
            user_id = int(key.split(':')[-1])
            data = await kv_db.hash_get_all(key)
            values = []
            for corpus_id, cs in data.items():
                if corpus_id.startswith('omezeni/'):
                    corpus_id = corpus_id[len('omezeni/'):]
                values.append((user_id, corpus_id, json.dumps(cs)))
            async with mysql_db.connection() as conn:
                async with await conn.cursor() as cursor:
                    await mysql_db.begin_tx(cursor)
                    for row in values:
                        try:
                            await cursor.execute(
                                'INSERT INTO kontext_corpus_settings (user_id, corpus_name, data) VALUES (%s, %s, %s)', row)
                        except Exception as ex:
                            print(f'Failed to insert data {row}: {ex}')
                    await conn.commit()

    print('Data imported')


if __name__ == "__main__":
    asyncio.run(import_settings())
