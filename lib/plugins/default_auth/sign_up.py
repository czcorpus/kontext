# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

from plugins.abstract.auth.sign_up import AbstractSignUpToken
from plugins.abstract.general_storage import KeyValueStorage
import hashlib
import uuid
import time


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

    def save(self, db):
        rec = dict(value=self.value, user=self.user, created=self.created, label=self.label)
        k = self._mk_key()
        db.set(k, rec)
        db.set_ttl(k, self.ttl)
        self.bound = True

    def load(self, db):
        rec = db.get(self._mk_key())
        if rec:
            self.user = rec['user']
            self.created = rec['created']
            self.label = rec['label']
            self.bound = True
        self.ttl = db.get_ttl(self._mk_key())

    def delete(self, db):
        db.remove(self._mk_key())
        self.bound = False

    def is_valid(self, db):
        return db.get_ttl(self._mk_key()) > 0

    def is_stored(self):
        return self.bound
