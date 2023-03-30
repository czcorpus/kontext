# Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

"""
A simple settings storage which relies on default_db plug-in.
"""

import logging
from collections import defaultdict
from typing import Any, Dict, List, Optional

import plugins
import ujson as json
from plugin_types.common import Serializable
from plugin_types.settings_storage import AbstractSettingsStorage
from plugins import inject
from plugins.mysql_integration_db import MySqlIntegrationDb


class SettingsStorage(AbstractSettingsStorage):

    def __init__(self, db: MySqlIntegrationDb, excluded_users: List[int]):
        """
        arguments:
        conf -- the 'settings' module (or a compatible object)
        db -- the default_db plug-in
        excluded_users -- a list of user IDs to be excluded from storing settings
        """
        self._db = db
        self._excluded_users = excluded_users

    async def save(self, user_id: int, corpus_id: Optional[str], data: Dict[str, Serializable]):
        if corpus_id:
            async with self._db.cursor() as cursor:
                await cursor.execute('''
                    INSERT INTO kontext_corpus_settings (user_id, corpus_name, data)
                    VALUES (%s, %s, %s)
                    ON DUPLICATE KEY UPDATE
                    data = VALUES(data)
                ''', (user_id, corpus_id, json.dumps(data)))
                await cursor.connection.commit()

        else:
            async with self._db.cursor() as cursor:
                await cursor.execute('''
                    INSERT INTO kontext_settings (user_id, data)
                    VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE
                    data = VALUES(data)
                ''', (user_id, json.dumps(data)))
                await cursor.connection.commit()

    async def _upgrade_general_settings(self, data: Dict[str, Serializable], user_id: int) -> Dict[str, Serializable]:
        corp_set = defaultdict(lambda: {})
        gen = {}
        for k, v in data.items():
            tmp = k.split(':')
            if len(tmp) > 1:
                corp_set[tmp[0]][tmp[1]] = v
            else:
                gen[k] = v
        for corp, data in corp_set.items():
            await self.save(user_id, corp, data)

        if len(gen) < len(data):
            logging.getLogger(__name__).warning(
                f'Upgraded legacy format settings for user {user_id}')
            await self.save(user_id, None, gen)

        return gen

    async def load(self, user_id: int, corpus_id: Dict[str, Serializable] = None):
        if corpus_id:
            async with self._db.cursor() as cursor:
                await cursor.execute('''
                    SELECT data FROM kontext_corpus_settings
                    WHERE user_id = %s AND corpus_name = %s
                ''', (user_id, corpus_id))
                row = await cursor.fetchone()

            if row is not None and row['data']:
                return json.loads(row['data'])

        else:
            async with self._db.cursor() as cursor:
                await cursor.execute('''
                    SELECT data FROM kontext_settings
                    WHERE user_id = %s
                ''', (user_id,))
                row = await cursor.fetchone()

            if row is not None:
                return await self._upgrade_general_settings(json.loads(row['data']), user_id)

        return {}

    def get_excluded_users(self):
        return self._excluded_users


@inject(plugins.runtime.INTEGRATION_DB)
def create_instance(conf, db: MySqlIntegrationDb):
    conf = conf.get('plugins', 'settings_storage')
    excluded_users = conf.get('excluded_users', None)
    if excluded_users is None:
        excluded_users = []
    else:
        excluded_users = [int(x) for x in excluded_users]
    return SettingsStorage(db, excluded_users=excluded_users)
