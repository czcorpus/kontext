import unittest

from plugins.default_auth import mk_pwd_hash_default, mk_pwd_hash, split_pwd_hash


class AuthTest(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(AuthTest, self).__init__(*args, **kwargs)

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
        hashed = mk_pwd_hash('password', orig_keys['iterations'], orig_keys['keylen'], orig_keys['algo'])
        split = split_pwd_hash(hashed)
        for key in orig_keys:
            self.assertEqual(orig_keys[key], split[key], "key values for hashed and unhashed pwd do not match")
        self.assertTrue(len(split['salt']) == len(split['data']) == 2 * split['keylen'], "length of salt or data does "
                                                                                         "not match the keylen value")

    def test_split_legacy_hash(self):
        split_legacy = split_pwd_hash("legacyHash")
        self.assertTrue('data' in split_legacy)
        self.assertFalse('algo' in split_legacy)

        # -------------------
        # test class methods:
        # -------------------


if __name__ == '__main__':
    unittest.main()
