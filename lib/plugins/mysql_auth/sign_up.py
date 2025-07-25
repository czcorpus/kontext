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

import datetime
import hashlib
import uuid

from mysql.connector.aio.abstracts import MySQLConnectionAbstract
from plugin_types.auth.sign_up import AbstractSignUpToken
from plugins.common.sqldb import DatabaseAdapter


class SignUpToken(AbstractSignUpToken[MySQLConnectionAbstract]):
    """
    Note: the class methods do not handle transactions - it's up to the calling method
    """

    def __init__(self, value=None, user_data=None, label=None, ttl=3600):
        self.value = value if value is not None else hashlib.sha1(
            uuid.uuid4().bytes).hexdigest()
        if user_data is None:
            user_data = {}
        self.username = user_data.get('username')
        self.firstname = user_data.get('firstname')
        self.lastname = user_data.get('lastname')
        self.pwd_hash = user_data.get('pwd_hash')
        self.email = user_data.get('email')
        self.affiliation = user_data.get('affiliation')
        self.label = label
        self.created = datetime.datetime.now().isoformat()
        self.ttl = ttl
        self.bound = False

    async def save(self, db: DatabaseAdapter):
        async with db.cursor() as cursor:
            await cursor.execute(
                'INSERT INTO kontext_sign_up_token '
                '(token_value, label, created, ttl, username, firstname, lastname, pwd_hash, email, affiliation) '
                'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
                (self.value, self.label, self.created, self.ttl, self.username, self.firstname, self.lastname,
                 self.pwd_hash, self.email, self.affiliation))
            self.bound = True

    async def load(self, db: DatabaseAdapter):
        async with db.cursor() as cursor:
            await cursor.execute(
                'DELETE FROM kontext_sign_up_token '
                'WHERE  TIMESTAMPDIFF(SECOND, created, NOW()) > %s ', (self.ttl, ))
            await cursor.execute(
                'SELECT token_value, label, created, ttl, username, firstname, lastname, pwd_hash, email, affiliation '
                'FROM kontext_sign_up_token '
                'WHERE token_value = %s '
                'AND TIMESTAMPDIFF(SECOND, created, NOW()) <= %s ', (self.value, self.ttl))
            row = await cursor.fetchone()
        if row:
            self.bound = True
            self.created = row['created']
            self.label = row['label']
            self.ttl = row['ttl']
            self.username = row.get('username')
            self.firstname = row.get('firstname')
            self.lastname = row.get('lastname')
            self.pwd_hash = row.get('pwd_hash')
            self.email = row.get('email')
            self.affiliation = row.get('affiliation')

    async def delete(self, db: DatabaseAdapter):
        async with db.cursor() as cursor:
            await cursor.execute('DELETE FROM kontext_sign_up_token WHERE token_value = %s', (self.value,))
        self.bound = False

    async def is_valid(self, db: DatabaseAdapter):
        async with db.cursor() as cursor:
            await cursor.execute(
                'SELECT value '
                'FROM kontext_sign_up_token '
                'WHERE  TIMESTAMPDIFF(SECOND, created, NOW()) > %s AND token_value = %s ', (self.ttl, self.value))

    def is_stored(self):
        return self.bound
