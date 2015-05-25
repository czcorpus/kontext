#!/usr/bin/env python

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

import sys
import os

sys.path.insert(0, os.path.realpath('%s/../lib' % os.path.dirname(os.path.realpath(__file__))))  # application libraries


def print_separ():
    print('\n>>> test block end <<<\n')

suites = []

# ############# kwiclib

from lib.kwiclib_test import *
suites.append(unittest.TestLoader().loadTestsFromTestCase(Tokens2StrClassTest))

# ############# structures
from lib.structures_test import *
suites.append(unittest.TestLoader().loadTestsFromTestCase(FixedDictTest))

# ############# plugins
from plugins_tests import default_user_items_test
suites.append(unittest.TestLoader().loadTestsFromModule(default_user_items_test))

# ############# templating/filters
from templating_tests.filters_test import FiltersTest
suites.append(unittest.TestLoader().loadTestsFromTestCase(FiltersTest))

# ############# main_menu
from lib import main_menu_test
suites.append(unittest.TestLoader().loadTestsFromModule(main_menu_test))

if __name__ == '__main__':
    verbosity = 2  # TODO

    for suite in suites:
        unittest.TextTestRunner(verbosity=verbosity).run(suite)
        print_separ()
