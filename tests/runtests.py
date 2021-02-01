#!/usr/bin/env python3

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
import unittest
import argparse
from typing import Any, List
sys.path.insert(0, os.path.realpath('%s/../lib' %
                                    os.path.dirname(os.path.realpath(__file__))))  # application libraries

PLUGIN_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', 'lib', 'plugins')
PLUGINS_TESTS_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'plugins_tests')
CORE_TEST_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'lib')
VERBOSITY = 2


def find_recursive(ts: unittest.TestSuite, name: str) -> List[Any]:
    ans = []
    for item in ts:
        if isinstance(item, unittest.TestSuite):
            ans += find_recursive(item, name)
        elif name in item.id():
            ans.append(item)
    return ans


if __name__ == '__main__':
    import translation
    translation.activate('en_US')
    root_suite = unittest.TestSuite()
    root_suite.addTest(unittest.TestLoader().discover(start_dir=CORE_TEST_PATH, ))
    root_suite.addTest(unittest.TestLoader().discover(start_dir=PLUGIN_PATH, ))
    root_suite.addTest(unittest.TestLoader().discover(start_dir=PLUGINS_TESTS_PATH, ))

    parser = argparse.ArgumentParser(description='A script to run Python-based unit tests')
    parser.add_argument('--specific-test', '-t', type=str, help='Run the specified test only')
    args = parser.parse_args()

    if args.specific_test:
        selection_suite = unittest.TestSuite()
        tests = find_recursive(root_suite, args.specific_test)
        selection_suite.addTests(tests)
        print(f'Found {len(tests)} matching tests. Starting the suite...')
        ans = unittest.TextTestRunner(verbosity=VERBOSITY).run(selection_suite)
    else:
        ans = unittest.TextTestRunner(verbosity=VERBOSITY).run(root_suite)
    if len(ans.failures) + len(ans.errors) > 0:
        sys.exit(1)
    else:
        sys.exit(0)
