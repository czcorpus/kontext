#!/usr/bin/python
# -*- Python -*-
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

import os
from optparse import OptionParser


DEFAULT_OUTPUT_FILE = 'config.new.xml'

parser = OptionParser(usage='usage: %prog [options] corpus_directory')
(options, args) = parser.parse_args()

try:
    if len(args) < 1:
        raise Exception('A corpus root directory must be specified')
    corpus_root = args[0].rstrip('/')

    if not os.path.exists(corpus_root):
        print('WARNING: provided path "%s" does not appear to be existing' % corpus_root)

    conf = ''
    sample_path = '%s/config.sample.xml' % os.path.dirname(__file__)
    with open(sample_path) as f:
        conf = f.read()
        conf = conf % { 'corpus_root' : corpus_root }
    with open(DEFAULT_OUTPUT_FILE, 'w') as f:
        f.write(conf)
    print('File %s successfully written' % DEFAULT_OUTPUT_FILE)
except Exception, e:
    print('ERROR: %s' % e)