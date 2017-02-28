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

import query


class CQLDetectWithinTest(unittest.TestCase):

    def setUp(self):
        self.parser = query.CQLDetectWithin()

    def test_get_next_token(self):
        struct = ['foo', 'bar', '[', ' ', 'word', ' ', '!=', ' ', 'hit', ']']
        n = self.parser.get_next_token(struct, 2)
        self.assertEqual(n, 'word')

    def test_get_next_token_empty(self):
        struct = ['foo', 'hit', ' ', '    ']
        n = self.parser.get_next_token(struct, 1)
        self.assertEqual(n, None)

    def test_query_default_attr(self):
        q = '"within"'
        wp = self.parser.get_within_part(q)
        self.assertEqual(wp, None)

    def test_simple_non_matching_query(self):
        q = '[word="within"] [tag="N.+"]'
        wp = self.parser.get_within_part(q)
        self.assertEqual(wp, None)

    def test_simple_matching_query(self):
        q = '[word="within"] [tag="N.+"] within <s />'
        wp = self.parser.get_within_part(q)
        self.assertEqual(wp, 'within <s />')

    def test_matching_query_with_operators(self):
        q = '[word="within"] [tag="N.+"] within <s name="foo" & sex="m" />'
        wp = self.parser.get_within_part(q)
        self.assertEqual(wp, 'within <s name="foo" & sex="m" />')

    def test_query_within_query(self):
        q = '[word="but"] within [word="it"] [word=".+"]+ [word="fault"]'
        wp = self.parser.get_within_part(q)
        self.assertEqual(wp, 'within [word="it"] [word=".+"]+ [word="fault"]')

    def test_double_within_query(self):
        q = '[tag="PR.*"] within [tag="V.*"] [tag="AJ0"]* [tag="(PR.?|N.*)"] [tag="PR.*"] within <s/>'
        wp = self.parser.get_within_part(q)
        self.assertEqual(wp, 'within [tag="V.*"] [tag="AJ0"]* [tag="(PR.?|N.*)"] [tag="PR.*"] within <s/>')

    def test_aligned_corpus_within(self):
        q = '[word="car"] within europarl5_de: [word="Auto"]'
        wp = self.parser.get_within_part(q)
        self.assertEqual(wp, None)
