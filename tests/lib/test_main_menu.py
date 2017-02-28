# Copyright (c) 2015 Institute of the Czech National Corpus
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

import unittest

from main_menu import MainMenuItemId, MainMenu


class MainMenuTest(unittest.TestCase):

    def test_menu_block_init_test(self):
        """
        """
        m = MainMenu.NEW_QUERY()
        self.assertTrue(m.matches(MainMenuItemId('menu-new-query')))

        m = MainMenu.VIEW()
        self.assertTrue(m.matches(MainMenuItemId('menu-view')))

        m = MainMenu.SAVE()
        self.assertTrue(m.matches(MainMenuItemId('menu-save')))

        m = MainMenu.CORPORA()
        self.assertTrue(m.matches(MainMenuItemId('menu-corpora')))

        m = MainMenu.CONCORDANCE()
        self.assertTrue(m.matches(MainMenuItemId('menu-concordance')))

        m = MainMenu.FILTER()
        self.assertTrue(m.matches(MainMenuItemId('menu-filter')))

        m = MainMenu.FREQUENCY()
        self.assertTrue(m.matches(MainMenuItemId('menu-frequency')))

        m = MainMenu.COLLOCATIONS()
        self.assertTrue(m.matches(MainMenuItemId('menu-collocations')))

        m = MainMenu.HELP()
        self.assertTrue(m.matches(MainMenuItemId('menu-help')))

    def test_menu_item_init_and_match(self):
        m = MainMenuItemId('menu-frequency')('foo', 'bar')
        self.assertTrue(MainMenuItemId('menu-frequency')('foo').matches(m))
        self.assertFalse(m.matches(MainMenuItemId('menu-frequency')('foo')))
        self.assertTrue(MainMenuItemId('menu-frequency')('bar').matches(m))
        self.assertFalse(m.matches(MainMenuItemId('menu-frequency')('bar')))

        self.assertFalse(m.matches(MainMenuItemId('menu-frequency')))  # 'm' does not represent whole menu block
        self.assertFalse(MainMenuItemId('menu-frequency').matches(m))
        self.assertFalse(MainMenuItemId('menu-frequency')('xxx').matches(m))  # non-existing sub-menu
        self.assertFalse(m.matches(MainMenuItemId('menu-frequency')('xxx')))

    def test_item_name(self):
        m = MainMenuItemId('menu-frequency')('foo')
        self.assertEqual(m.name, 'menu-frequency')
