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
import unittest

sys.path.insert(0, os.path.realpath('%s/../lib' %
                                    os.path.dirname(os.path.realpath(__file__))))  # application libraries

PLUGIN_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), '..', 'lib', 'plugins')
PLUGINS_TESTS_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'plugins_tests')
CORE_TEST_PATH = os.path.join(os.path.dirname(os.path.realpath(__file__)), 'lib')
VERBOSITY = 2

if __name__ == '__main__':
    import translation
    translation.activate('en_US')
    root_suite = unittest.TestSuite()
    root_suite.addTest(unittest.TestLoader().discover(start_dir=CORE_TEST_PATH, ))
    root_suite.addTest(unittest.TestLoader().discover(start_dir=PLUGIN_PATH, ))
    root_suite.addTest(unittest.TestLoader().discover(start_dir=PLUGINS_TESTS_PATH, ))
    ans = unittest.TextTestRunner(verbosity=VERBOSITY).run(root_suite)
    if len(ans.failures) + len(ans.errors) > 0:
        sys.exit(1)
    else:
        sys.exit(0)
