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
from mysql.connector.connection import MySQLConnection
import hashlib
import uuid
import datetime


class SignUpToken(AbstractSignUpToken[MySQLConnection]):
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

    def save(self, db):
        cursor = db.cursor()
        cursor.execute(
            'INSERT INTO kontext_sign_up_token '
            '(token_value, label, created, ttl, username, firstname, lastname, pwd_hash, email, affiliation) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
            (self.value, self.label, self.created, self.ttl, self.username, self.firstname, self.lastname,
             self.pwd_hash, self.email, self.affiliation))
        self.bound = True

    def load(self, db):
        cursor = db.cursor()
        cursor.execute(
            'DELETE FROM kontext_sign_up_token '
            'WHERE  TIMESTAMPDIFF(SECOND, created, NOW()) > %s ', (self.ttl, ))
        cursor.execute(
            'SELECT token_value, label, created, ttl, username, firstname, lastname, pwd_hash, email, affiliation '
            'FROM kontext_sign_up_token '
            'WHERE token_value = %s '
            'AND TIMESTAMPDIFF(SECOND, created, NOW()) <= %s ', (self.value, self.ttl))
        row = cursor.fetchone()
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

    def delete(self, db):
        cursor = db.cursor()
        cursor.execute('DELETE FROM kontext_sign_up_token WHERE token_value = %s', (self.value,))
        self.bound = False

    def is_valid(self, db):
        cursor = db.cursor()
        cursor.execute(
            'SELECT value '
            'FROM kontext_sign_up_token '
            'WHERE  TIMESTAMPDIFF(SECOND, created, NOW()) > %s AND token_value = %s ', (self.ttl, self.value))

    def is_stored(self):
        return self.bound
