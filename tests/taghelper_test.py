# -*- coding: utf-8 -*-
#
# Copyright (c) 2012 Czech National Corpus
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import unittest

import conf
conf.init()
from taghelper import *


class TestTagVariantLoader(unittest.TestCase):
    """
    """

    def test_path_generator(self):
        path = create_tag_variants_file_path('foo')
        self.assertEqual('../test-data/tags/foo', path)
        self.assertRaises(TagGeneratorException, create_tag_variants_file_path, '')
        self.assertRaises(TagGeneratorException, create_tag_variants_file_path, None)

    def test_path_tester(self):
        self.assertTrue(tag_variants_file_exists('susanne'))
        self.assertFalse(tag_variants_file_exists('asbas5r3'))
        self.assertRaises(TagGeneratorException, tag_variants_file_exists, '')
        self.assertRaises(TagGeneratorException, tag_variants_file_exists, None)

    def test_tagsets_load(self):
        data, labels = load_tag_descriptions('config.test.xml', 'cs')
        self.assertEqual(2, len(data))
        self.assertEqual(2, len(data[0]))
        self.assertEqual(('A', 'adjective'),  data[0][0])
        self.assertEqual(('R', 'preposition'),  data[0][1])
        self.assertEqual(1, len(data[1]))
        self.assertEqual(('X', 'experimental item'), data[1][0])
        self.assertEqual(['Part of Speech', 'just a stuff'], labels)