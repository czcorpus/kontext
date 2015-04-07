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

import unittest

from templating.filters import Shortener


class FiltersTest(unittest.TestCase):

    def test_shortener_non_nice(self):
        sh = Shortener()
        s = 'loremipsumdolorsitamet'
        length = 12
        self.assertEqual(sh.filter('loremipsumdolorsitamet', length=length), '%s...' % s[:12])

    def test_shortener_non_nice_custom_suffix(self):
        sh = Shortener()
        s = 'loremipsumdolorsitamet'
        length = 12
        suffix = 'the_suffix'
        self.assertEqual(sh.filter('loremipsumdolorsitamet', length=length, suffix=suffix), '%s%s' % (s[:12], suffix))

    def test_shortener_nice(self):
        sh = Shortener()
        s = 'lorem ipsum dolor sit amet'
        length = 14
        self.assertEqual(sh.filter(s, length=length, nice=True), 'lorem ipsum...')

    def test_shortener_nice_zero_length(self):
        sh = Shortener()
        s = 'lorem ipsum dolor sit amet'
        length = 0
        self.assertEqual(sh.filter(s, length=length, nice=True), '...')

    def test_shortener_nice_unsplittable_string(self):
        sh = Shortener()
        s = 'loremipsumdolorsitamet'
        length = 12
        self.assertEqual(sh.filter(s, length=length, nice=True), '%s...' % s[:length])

    def test_shortener_nice_no_shortening_expected(self):
        sh = Shortener()
        s = 'lorem ipsum dolor sit amet'
        length = 100
        self.assertEqual(sh.filter(s, length=length, nice=True), s)

    def test_shortener_non_nice_no_shortening_expected(self):
        sh = Shortener()
        s = 'lorem ipsum dolor sit amet'
        length = 100
        self.assertEqual(sh.filter(s, length=length, nice=False), s)