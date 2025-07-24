# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

"""
Unittests for the default_auth_plugin plugin
"""

import json
import os
import unittest

from mocks.request import PluginCtx
from plugin_types.auth.hash import (
    mk_pwd_hash, mk_pwd_hash_default, split_pwd_hash)
from plugins.default_auth import DefaultAuthHandler
from plugins.default_auth.mock_redis import MockRedisCommon, MockRedisPlugin


class AuthTest(unittest.IsolatedAsyncioTestCase):
    def __init__(self, *args, **kwargs):
        super(AuthTest, self).__init__(*args, **kwargs)
        self.mck_rds_cmn = MockRedisCommon()
        self.mock_redis_plugin = MockRedisPlugin(self.mck_rds_cmn.users)
        self.auth_handler = DefaultAuthHandler(db=self.mock_redis_plugin, sessions=None, anonymous_user_id=0,
                                               login_url=None, logout_url=None, smtp_server=None, mail_sender=None,
                                               confirmation_token_ttl=None, on_register_get_corpora=None,
                                               case_sensitive_corpora_names=False)
        self.dummy_plugin_ctx = PluginCtx()

    def setUp(self):
        self.mock_redis_plugin.clear()

    async def load_users(self):
        """
        loads users from the test_users.json file
        """
        with open(os.path.join(os.path.dirname(os.path.realpath(__file__)), 'test_users.json')) as data_file:
            data = json.load(data_file)
        for user in data:
            await self.mock_redis_plugin.add_user_dict(user)

    # -----------------
    # test aux methods:
    # -----------------

    async def test_add_user(self):
        """
        test the auxiliary method to add a user to the mocked redis db, both using the old and the new hashing
        """
        await self.mock_redis_plugin.add_user(2, 'mary', 'maryspassword',
                                              'Mary', 'White', 'mary.white@localhost')
        await self.mock_redis_plugin.add_user_old_hashing(
            3, 'ann', 'annspassword', 'Ann', 'Rose', 'ann.rose@localhost')
        self.assertEqual('user:2', await self.mock_redis_plugin.hash_get('user_index', 'mary'))
        self.assertEqual('mary', (await self.mock_redis_plugin.get('user:2')).get('username'))
        self.assertEqual('user:3', await self.mock_redis_plugin.hash_get('user_index', 'ann'))
        self.assertEqual('ann', (await self.mock_redis_plugin.get('user:3')).get('username'))

    async def test_load_users(self):
        """
        test loading users from the sample file to the mocked redis db, your_user's id in the sample file is 1
        """
        await self.load_users()
        self.assertEqual('user:1', await self.mock_redis_plugin.hash_get('user_index', 'your_user'))
        self.assertEqual('your_user', (await self.mock_redis_plugin.get('user:1')).get('username'))

    # ---------------------
    # test package methods:
    # ---------------------

    def test_make_and_split_default_hash(self):
        """
        hash a password using the default values, then split the returned hash string and check whether correct
        information is present
        """
        hashed_def = mk_pwd_hash_default('password')
        split_def = split_pwd_hash(hashed_def)
        keys = ['algo', 'salt', 'iterations', 'data', 'keylen']
        for key in keys:
            self.assertTrue(key in split_def)

    def test_make_and_split_hash(self):
        """
        hash a password using the specified values, then split the returned hash string and check whether correct
        information is present
        """
        orig_keys = {'algo': 'sha512', 'iterations': 1000, 'keylen': 64}
        salt = os.urandom(orig_keys['keylen']).hex()
        hashed = mk_pwd_hash(
            'password', salt, orig_keys['iterations'], orig_keys['keylen'], orig_keys['algo'])
        split = split_pwd_hash(hashed)
        for key in orig_keys:
            self.assertEqual(orig_keys[key], split[key],
                             "key values for hashed and unhashed pwd do not match")
        self.assertTrue(len(split['salt']) == len(split['data']) == 2 * split['keylen'], "length of salt or data does "
                                                                                         "not match the keylen value")

    def test_split_legacy_hash(self):
        """
        try to split the legacy hash, it must contain the 'data' value only
        """
        pwd = "legacyHash"
        split_legacy = split_pwd_hash(pwd)
        self.assertEqual(split_legacy['data'], pwd, "returned wrong value as legacy hash")
        self.assertFalse('salt' in split_legacy, "split legacy hash must not contain salt value")

        # -------------------
        # test class methods:
        # -------------------

    async def test_find_user(self):
        """
        load users from the sample file, try to find user 'your_user'
        """
        await self.load_users()
        self.assertEqual('your_user', (await self.auth_handler._find_user('your_user')).get('username'))

    async def test_validate_user(self):
        """
        load users from sample file, try to authenticate user 'your_user' using his sample password, then try to
        authenticate as a non-existing user, which should return anonymous user
        """
        await self.load_users()
        msg = "failed to authenticate as sample user your_user"
        self.assertEqual('your_user', (await self.auth_handler.validate_user(
            self.dummy_plugin_ctx, 'your_user', 'yourpwd')).get('user'), msg)

        msg = "validation failed to return anonymous user for a non-existing user"
        self.assertEqual(0, (await self.auth_handler.validate_user(
            self.dummy_plugin_ctx, 'jimmy', 'doesNotExist')).get('id'), msg)

    async def test_validate_user_old_hashing_and_update_password(self):
        """
        save user 'mary' with her password hashed using the legacy algorithm (hashlib.md5), try to authenticate her,
        update her password using the new default method, check whether the new hash has proper format, try to
        authenticate using the new password
        """
        await self.mock_redis_plugin.add_user_old_hashing(
            2, 'mary', 'maryspassword', 'Mary', 'White', 'mary.white@localhost')
        msg = "wrong length of pwd_hash created using the legacy method"
        self.assertEqual(len((await self.auth_handler._find_user('mary')).get('pwd_hash')), 32, msg)

        msg = "failed to authenticate using the old hashing method"
        self.assertEqual('mary', (await self.auth_handler.validate_user(
            self.dummy_plugin_ctx, 'mary', 'maryspassword')).get('user'), msg)

        await self.auth_handler.update_user_password(self.dummy_plugin_ctx, 2, 'marysnewpassword')
        split_new = split_pwd_hash((await self.auth_handler._find_user('mary')).get('pwd_hash'))
        msg = "the password update method failed"
        self.assertTrue(len(split_new['salt']) > 0)
        self.assertTrue(len(split_new['data']) == 2 * split_new['keylen'], msg)

        msg = "failed to authenticate using the new hashing method"
        self.assertEqual('mary', (await self.auth_handler.validate_user(
            self.dummy_plugin_ctx, 'mary', 'marysnewpassword')).get('user'), msg)


if __name__ == '__main__':
    unittest.main()
