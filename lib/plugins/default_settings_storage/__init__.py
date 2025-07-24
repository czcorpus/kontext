# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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
from typing import List

import plugins
from plugin_types.general_storage import KeyValueStorage
from plugin_types.settings_storage import AbstractSettingsStorage
from plugins import inject


class SettingsStorage(AbstractSettingsStorage):

    def __init__(self, db: KeyValueStorage, excluded_users: List[int]):
        """
        arguments:
        conf -- the 'settings' module (or a compatible object)
        db -- the default_db plug-in
        excluded_users -- a list of user IDs to be excluded from storing settings
        """
        self.db = db
        self._excluded_users = excluded_users

    def _mk_key(self, user_id):
        return f'settings:user:{user_id}'

    def _mk_corp_key(self, user_id):
        return f'corpus_settings:user:{user_id}'

    async def save(self, user_id, corpus_id, data):
        if corpus_id:
            await self.db.hash_set(self._mk_corp_key(user_id), corpus_id, data)
        else:
            await self.db.set(self._mk_key(user_id), data)

    async def _upgrade_general_settings(self, data, user_id):
        if data is None:
            return {}
        corp_set = defaultdict(lambda: {})
        gen = {}
        for k, v in data.items():
            tmp = k.split(':')
            if len(tmp) > 1:
                corp_set[tmp[0]][tmp[1]] = v
            else:
                gen[k] = v
        for corp, cs in corp_set.items():
            await self.db.hash_set(self._mk_corp_key(user_id), corp, cs)
        if len(gen) < len(data):
            logging.getLogger(__name__).warning(
                'Upgraded legacy format settings for user {}'.format(user_id))
            await self.db.set(self._mk_key(user_id), gen)
        return gen

    async def load(self, user_id, corpus_id=None):
        if corpus_id:
            return await self.db.hash_get(self._mk_corp_key(user_id), corpus_id)
        else:
            return await self._upgrade_general_settings(await self.db.get(self._mk_key(user_id)), user_id)

    def get_excluded_users(self):
        return self._excluded_users


@inject(plugins.runtime.DB)
def create_instance(conf, db: KeyValueStorage):
    conf = conf.get('plugins', 'settings_storage')
    excluded_users = conf.get('excluded_users', None)
    if excluded_users is None:
        excluded_users = []
    else:
        excluded_users = [int(x) for x in excluded_users]
    return SettingsStorage(db, excluded_users=excluded_users)
