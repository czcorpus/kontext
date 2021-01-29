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

from kwiclib_common import tokens2strclass


class Tokens2StrClassTest(unittest.TestCase):

    def test_tokens2strclass(self):
        # notes: class1..class2 (2 whitespaces), 'bar  ' (trailing whitespace)
        data = ('foo', '{class1  class2}', 'bar  ', '{class3 class4}', 'last one', '{class5}')
        output = tokens2strclass(data)

        self.assertEqual(len(output), 3)
        self.assertEqual(output[0].get('str'), 'foo')
        self.assertEqual(output[0].get('class'), 'class1  class2')
        self.assertEqual(output[1].get('str'), 'bar  ')
        self.assertEqual(output[1].get('class'), 'class3 class4')
        self.assertEqual(output[2].get('str'), 'last one')
        self.assertEqual(output[2].get('class'), 'class5')
