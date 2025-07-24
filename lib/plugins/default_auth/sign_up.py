# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import hashlib
import time
import uuid

from plugin_types.auth.sign_up import AbstractSignUpToken
from plugin_types.general_storage import KeyValueStorage


class SignUpToken(AbstractSignUpToken[KeyValueStorage]):

    def __init__(self, value=None, user_data=None, label=None, ttl=3600):
        self.value = value if value is not None else hashlib.sha1(
            uuid.uuid4().bytes).hexdigest()
        self.user = user_data if user_data else {}
        self.label = label
        self.created = int(time.time())
        self.ttl = ttl
        self.bound = False

    def _mk_key(self):
        return 'signup:{0}'.format(self.value)

    async def save(self, db: KeyValueStorage):
        rec = dict(value=self.value, user=self.user, created=self.created, label=self.label)
        k = self._mk_key()
        await db.set(k, rec)
        await db.set_ttl(k, self.ttl)
        self.bound = True

    async def load(self, db: KeyValueStorage):
        rec = await db.get(self._mk_key())
        if rec:
            self.user = rec['user']
            self.created = rec['created']
            self.label = rec['label']
            self.bound = True
        self.ttl = await db.get_ttl(self._mk_key())

    async def delete(self, db: KeyValueStorage):
        await db.remove(self._mk_key())
        self.bound = False

    async def is_valid(self, db: KeyValueStorage):
        return await db.get_ttl(self._mk_key()) > 0

    def is_stored(self):
        return self.bound
