#!/usr/bin/env python3
# Copyright (c) 2014 Institute of the Czech National Corpus
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

from structures import FixedDict


class SampleDict(FixedDict):
    foo = None
    bar = 'name'


class FixedDictTest(unittest.TestCase):

    def setUp(self):
        self.d = SampleDict()
        self.v1 = 'value 1'
        self.v2 = 'value 2'

    def test_init(self):
        self.assertTrue(hasattr(self.d, 'foo'))
        self.assertTrue(hasattr(self.d, 'bar'))

    def test_set_value(self):
        self.d.foo = self.v1
        self.d.bar = self.v2
        self.assertEqual(self.d.foo, self.v1)
        self.assertEqual(self.d.bar, self.v2)

    def test_non_existing_attr(self):
        with self.assertRaises(AttributeError):
            self.d.test = 'value'

    def test_default_values(self):
        self.assertEqual(self.d.foo, None)
        self.assertEqual(self.d.bar, 'name')

    def test_dict_conversion(self):
        class XDict(FixedDict):
            a = ()
            b = None

        d = XDict()
        d.a = 'test'
        d.b = 'hit'
        x = dict(d)

        self.assertEqual(x['a'], 'test')
        self.assertEqual(x['b'], 'hit')
