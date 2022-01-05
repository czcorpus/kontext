# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
A simple script for manual cache clean-up
"""

import os
import sys

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../..')))
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../scripts')))
import autoconf
import plugins
import initializer
initializer.init_plugin('db')
initializer.init_plugin('conc_cache')
from plugins.default_conc_cache import cleanup
from plugins.default_conc_cache import DefaultCacheMapping


if __name__ == '__main__':
    import argparse

    def mk_key(corpus_id):
        return DefaultCacheMapping.KEY_TEMPLATE.format(corpus_id)

    parser = argparse.ArgumentParser(description='A script to control UCNK concordance cache')
    parser.add_argument('--dry-run', '-d', action='store_true',
                        help='Just analyze, do not modify anything')
    parser.add_argument('--exclude', '-x', type=str, default=None,
                        help='Do not analyze/clean specified subdirectories')
    parser.add_argument('--corpus', '-c', type=str, help='A concrete corpus to be processed')
    parser.add_argument('--ttl', '-t', type=int, default=cleanup.DEFAULT_TTL,
                        help='How old files (in minutes) will be preserved yet. Default is %s min.'
                             % cleanup.DEFAULT_TTL)
    parser.add_argument('--subdir', '-s', type=str, default=None,
                        help='Search will be performed in [default:cache_dir]/[subdir]')
    parser.add_argument('--log-level', '-l', type=str, default='info',
                        help='Logging level (%s)' % ', '.join(list(autoconf.LOG_LEVELS.keys())))
    parser.add_argument('--log-path', '-p', type=str, default=None,
                        help='Where to write the log. If omitted then %s is used' %
                             autoconf.DEFAULT_LOG_OUT)
    args = parser.parse_args()

    autoconf.setup_logger(log_path=args.log_path,
                          logger_name='conc_cache_cleanup',
                          logging_level=autoconf.LOG_LEVELS[args.log_level])
    root_dir = autoconf.settings.get('plugins', 'conc_cache')['default:cache_dir']

    cleanup.run(root_dir=root_dir, corpus_id=args.corpus, ttl=args.ttl, subdir=args.subdir,
                dry_run=args.dry_run, db_plugin=plugins.runtime.DB.instance, entry_key_gen=mk_key)
