# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

"""
The methods necessary to mock the connection to the redis_db plugin for the needs of default_auth plug-in testing
"""
import hashlib
import json

from plugin_types.auth.hash import mk_pwd_hash_default


class MockRedisCommon:
    def __init__(self):
        # self.concordances = []
        # self.arch_queue = []
        self.users = []


class MockRedisDirect(object):
    """
    mock the methods of direct connection to redis necessary to test the DefaultAuthHandler class
    """

    def __init__(self, users):
        self.users = users

    def set(self, key, data):
        found = False
        for t in self.users:
            if t[0] == key:
                t[1] = data
                found = True
                break
        if not found:
            self.users.append([key, data])

    def get(self, key, default=None):
        res = default
        for t in self.users:
            if t[0] == key:
                res = t[1]
                break
        return res


class MockRedisPlugin(MockRedisDirect):
    """
    mock the methods of the redis plugin connection necessary to test the DefaultAuthHandler class
    """

    def __init__(self, *args, **kwargs):
        super(MockRedisPlugin, self).__init__(*args, **kwargs)
        self.user_index = {}
        self.mck_rds_cmn = MockRedisCommon()

    def get(self, key, default=None):
        data = super(MockRedisPlugin, self).get(key)
        if data:
            return json.loads(data)
        return default

    def set(self, key, data):
        super(MockRedisPlugin, self).set(key, json.dumps(data))

    def hash_get(self, key, value):
        if key == 'user_index':
            return self.user_index.get(value, None)
        return None

    def add_user(self, idx, username, pwd, firstname, lastname, email=None):
        self.user_index[username] = "user:" + str(idx)
        self.set("user:" + str(idx), dict(
            id=idx,
            username=username,
            firstname=firstname,
            lastname=lastname,
            email=email,
            pwd_hash=mk_pwd_hash_default(pwd)))

    def add_user_old_hashing(self, idx, username, pwd, firstname, lastname, email=None):
        self.user_index[username] = "user:" + str(idx)
        self.set("user:" + str(idx), dict(
            id=idx,
            username=username,
            firstname=firstname,
            lastname=lastname,
            email=email,
            pwd_hash=hashlib.md5(pwd.encode()).hexdigest()))

    def add_user_dict(self, user):
        self.user_index[user.get('username')] = "user:" + str(user.get('id'))
        if user.get('pwd') is not None:
            password = mk_pwd_hash_default(user.get('pwd'))
        else:
            password = None
        self.set("user:" + str(user.get('id')), dict(
            id="user:" + str(user.get('id')),
            username=user.get('username'),
            firstname=user.get('firstname'),
            lastname=user.get('lastname'),
            email=user.get('email'),
            pwd_hash=password))

    def print_users(self):
        for user in self.users:
            print(user)

    def clear(self):
        del self.users[:]
        self.user_index = {}
