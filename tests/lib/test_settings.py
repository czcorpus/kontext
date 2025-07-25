# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

import importlib
import os
import unittest

import settings

conf_path = os.path.join(os.path.dirname(__file__), '..', '..', 'conf', 'config.default.xml')


class SettingsMockedDataTest(unittest.TestCase):

    def setUp(self):
        importlib.reload(settings)
        settings._conf = {
            'global': {
                'foo': 'bar',
                'height': '1000',
                'weight': '37.828',
                'empty': None,
                'visible': 'true',
                'invisible': 'false',
                'forbidden': '0',
                'permitted': '1',
                'items': ['a', 'b', 'c']
            }
        }
        settings._meta = {
            'global': {
                'foo': {'private': 'true'}
            }
        }

    def test_no_conf_path_before_load(self):
        v = settings.CONF_PATH
        self.assertIsNone(v)

    def test_get(self):
        v = settings.get('global', 'foo')
        self.assertEqual(v, 'bar')

    def test_get_not_present(self):
        v = settings.get('global', 'boo')
        self.assertIsNone(v)

    def test_get_not_present_pass_default(self):
        v = settings.get('global', 'boo', 'bar')
        self.assertEqual(v, 'bar')

    def test_get_int(self):
        v = settings.get_int('global', 'height')
        self.assertEqual(v, 1000)

    def test_get_int_float_val(self):
        with self.assertRaises(ValueError):
            settings.get_int('global', 'weight')

    def test_get_int_non_parseable_str_val(self):
        with self.assertRaises(ValueError):
            settings.get_int('global', 'foo')

    def test_get_int_default(self):
        v = settings.get_int('global', 'zzz', 10)
        self.assertEqual(v, 10)

    def test_get_int_default_type_any(self):
        v = settings.get_int('global', 'zzz', '10')
        self.assertEqual(v, 10)

    def test_get_str(self):
        v = settings.get_str('global', 'emtpy')
        self.assertEqual(v, '')

    def test_get_bool(self):
        self.assertEqual(settings.get_bool('global', 'visible'), True)
        self.assertEqual(settings.get_bool('global', 'invisible'), False)
        self.assertEqual(settings.get_bool('global', 'forbidden'), False)
        self.assertEqual(settings.get_bool('global', 'permitted'), True)

    def test_get_meta(self):
        v = settings.get_meta('global', 'foo')
        self.assertIs(type(v), dict)
        self.assertEqual(v['private'], 'true')

    def test_get_full(self):
        v = settings.get_full('global', 'foo')
        self.assertIs(type(v), tuple)
        self.assertEqual(len(v), 2)

    def test_get_list(self):
        v = settings.get_list('global', 'items')
        self.assertListEqual(v, ['a', 'b', 'c'])

    def test_get_list_non_existing(self):
        v = settings.get_list('global', 'zzz')
        self.assertListEqual(v, [])

    def test_get_list_scalar_val(self):
        v = settings.get_list('global', 'foo')
        self.assertListEqual(v, ['bar'])

    def test_set(self):
        settings.set('local', 'test', '1')
        self.assertTrue(settings.contains('local'))
        self.assertEqual(settings.get('local', 'test'), '1')

    def test_set_overwrite(self):
        settings.set('global', 'foo', 'xxx')
        self.assertEqual(settings.get('global', 'foo'), 'xxx')


class SettingsSampleTest(unittest.IsolatedAsyncioTestCase):

    def test_has_set_path(self):
        v = settings.CONF_PATH
        self.assertEqual(v, conf_path)

    async def test_get_default_corpus_permitted(self):
        async def test_access_fn(item):
            return item == 'susanne'

        v = await settings.get_default_corpus(test_access_fn)
        self.assertEqual(v, 'susanne')

    async def test_get_default_corpus_not_permitted(self):
        async def test_access_fn(item):
            return item == 'other'

        v = await settings.get_default_corpus(test_access_fn)
        self.assertEqual(v, '')  # yes, it returns an empty string...

    def test_debug_level(self):
        self.assertEqual(settings.debug_level(), 0)

    def test_debug_mode(self):
        self.assertFalse(settings.is_debug_mode())

    def test_sections(self):
        self.assertTrue(settings.contains('theme'))
        self.assertTrue(settings.contains('global'))
        self.assertTrue(settings.contains('sessions'))
        self.assertTrue(settings.contains('logging'))
        self.assertTrue(settings.contains('corpora'))
        self.assertTrue(settings.contains('plugins'))
        self.assertTrue(settings.contains('plugins', 'application_bar'))
        self.assertTrue(settings.contains('plugins', 'auth'))
        self.assertTrue(settings.contains('plugins', 'conc_cache'))
        self.assertTrue(settings.contains('plugins', 'query_persistence'))
        self.assertTrue(settings.contains('plugins', 'corparch'))
        self.assertTrue(settings.contains('plugins', 'db'))
        self.assertTrue(settings.contains('plugins', 'export'))
        self.assertTrue(settings.contains('plugins', 'footer_bar'))
        self.assertTrue(settings.contains('plugins', 'getlang'))
        self.assertTrue(settings.contains('plugins', 'live_attributes'))
        self.assertTrue(settings.contains('plugins', 'menu_items'))
        self.assertTrue(settings.contains('plugins', 'query_history'))
        self.assertTrue(settings.contains('plugins', 'settings_storage'))
        self.assertTrue(settings.contains('plugins', 'subcmixer'))
        self.assertTrue(settings.contains('plugins', 'subc_storage'))
        self.assertTrue(settings.contains('plugins', 'syntax_viewer'))
        self.assertTrue(settings.contains('plugins', 'taghelper'))
        self.assertTrue(settings.contains('plugins', 'user_items'))
