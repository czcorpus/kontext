# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

import sys
import os
import unittest
import tempfile

sys.path.insert(0, os.path.realpath('%s/../../lib/plugins/default_taghelper/scripts' %
                                    os.path.dirname(os.path.realpath(__file__))))  # application libraries

import prepare_ud


class DbTest(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(DbTest, self).__init__(*args, **kwargs)
        self.temp = tempfile.NamedTemporaryFile('w', delete=True)

    def setUp(self):
        self.temp.write('pos1|pos2|pos3	a=1|b=2|c=3||a=4|b=5|c=6||a=7|b=8|c=9')
        self.temp.flush()

    def tearDown(self):
        self.temp.close()

    def test_pairing_pos_and_feats(self):
        variations = prepare_ud.load_variations(self.temp.name, 0, 1)
        self.assertIn((('POS', 'pos1'), ('a', '1'), ('b', '2'), ('c', '3')), variations)
        self.assertIn((('POS', 'pos2'), ('a', '4'), ('b', '5'), ('c', '6')), variations)
        self.assertIn((('POS', 'pos3'), ('a', '7'), ('b', '8'), ('c', '9')), variations)
