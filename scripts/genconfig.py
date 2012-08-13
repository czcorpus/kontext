#!/usr/bin/python
# -*- Python -*-

import os
from optparse import OptionParser


DEFAULT_OUTPUT_FILE = 'config.new.ini'

parser = OptionParser(usage='usage: %prog [options] corpus_directory')
(options, args) = parser.parse_args()

try:
    if len(args) < 1:
        raise Exception('A corpus root directory must be specified')
    corpus_root = args[0].rstrip('/')

    if not os.path.exists(corpus_root):
        print('WARNING: provided path "%s" does not appear to be existing' % corpus_root)

    conf = ''
    sample_path = '%s/config.sample.ini' % os.path.dirname(__file__)
    with open(sample_path) as f:
        conf = f.read()
        conf = conf % { 'corpus_root' : corpus_root }
    with open(DEFAULT_OUTPUT_FILE, 'w') as f:
        f.write(conf)
    print('File %s successfully written' % DEFAULT_OUTPUT_FILE)
except Exception, e:
    print('ERROR: %s' % e)