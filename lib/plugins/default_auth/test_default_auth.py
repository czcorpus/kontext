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

"""
Unittests for the ucnk_conc_persistence3 plugin
"""

import unittest
import os
from plugins.default_auth import mk_pwd_hash_default, mk_pwd_hash, split_pwd_hash
from plugins.default_auth.mock_redis import MockRedisPlugin, MockRedisCommon


class AuthTest(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(AuthTest, self).__init__(*args, **kwargs)
        self.mckRdsCmn = MockRedisCommon()
        self.mockRedisPlugin = MockRedisPlugin(self.mckRdsCmn.users)

    # ---------------------
    # test package methods:
    # ---------------------

    def test_make_and_split_default_hash(self):
        hashed_def = mk_pwd_hash_default('password')
        split_def = split_pwd_hash(hashed_def)
        keys = ['algo', 'salt', 'iterations', 'data', 'keylen']
        for key in keys:
            self.assertTrue(key in split_def)

    def test_make_and_split_hash(self):
        orig_keys = {'algo': 'sha512', 'iterations': 1000, 'keylen': 64}
        salt = os.urandom(orig_keys['keylen']).encode('hex')
        hashed = mk_pwd_hash('password', salt, orig_keys['iterations'], orig_keys['keylen'], orig_keys['algo'])
        split = split_pwd_hash(hashed)
        for key in orig_keys:
            self.assertEqual(orig_keys[key], split[key], "key values for hashed and unhashed pwd do not match")
        self.assertTrue(len(split['salt']) == len(split['data']) == 2 * split['keylen'], "length of salt or data does "
                                                                                         "not match the keylen value")

    def test_split_legacy_hash(self):
        pwd = "legacyHash"
        split_legacy = split_pwd_hash(pwd)
        self.assertEquals(split_legacy['data'], pwd, "returned wrong value as legacy hash")
        self.assertFalse('salt' in split_legacy, "split legacy hash must not contain salt value")

    def test_add_user(self):
        self.mockRedisPlugin.add_user(1, 'Joe', 'pwd')
        print self.mockRedisPlugin.hash_get('user_index','Joe')
        print self.mockRedisPlugin.get(1)
        # -------------------
        # test class methods:
        # -------------------




if __name__ == '__main__':
    unittest.main()
