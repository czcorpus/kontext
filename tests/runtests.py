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
    print('\n')


class Suites(object):
    def __init__(self):
        self._suites = []
        self._i = 0

    def append(self, suite, label=None):
        self._suites.append((suite, label))

    def print_heading(self, label):
        LL = 80
        num_items = (LL - len(label) - 4) / 2
        print('+{0}+'.format(LL * '-'))
        print('| %s %s %s |' % ((num_items + len(label) % 2) * ' ', label, num_items * ' '))
        print('+{0}+'.format(LL * '-'))

    def __iter__(self):
        for suite in self._suites:
            self.print_heading(suite[1])
            yield suite[0]

suites = Suites()

# ############# kwiclib

from lib.kwiclib_test import *
suites.append(unittest.TestLoader().loadTestsFromTestCase(Tokens2StrClassTest), 'Tokens2StrClassTest')

# ############# structures
from lib.structures_test import *
suites.append(unittest.TestLoader().loadTestsFromTestCase(FixedDictTest), 'FixedDictTest')

# ############# plugins
from plugins_tests import default_user_items_test
suites.append(unittest.TestLoader().loadTestsFromModule(default_user_items_test), 'default_user_items_test')

# ############# templating/filters
from templating_tests.filters_test import FiltersTest
suites.append(unittest.TestLoader().loadTestsFromTestCase(FiltersTest), 'FiltersTest (templating)')

# ############# main_menu
from lib import main_menu_test
suites.append(unittest.TestLoader().loadTestsFromModule(main_menu_test), 'main_menu_test')

# ############# butils
from lib import butils_test
suites.append(unittest.TestLoader().loadTestsFromModule(butils_test), 'butils_test')

if __name__ == '__main__':
    verbosity = 2  # TODO
    total_tests = 0
    total_failures = 0
    total_errors = 0

    for suite in suites:
        ans = unittest.TextTestRunner(verbosity=verbosity).run(suite)
        total_tests += ans.testsRun
        total_failures += len(ans.failures)
        total_errors += len(ans.errors)
        print_separ()

    print('Total tests: {0}, total errors: {1}, total failures: {2}\n'.format(
        total_tests, total_failures, total_errors))
    if total_errors + total_failures > 0:
        print('#################################### FAILED #####################################\n')
    else:
        print('************************************ PASSED *************************************\n')


