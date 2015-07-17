# Copyright 2014 Institute of the Czech National Corpus
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
A simple script to control metadata cache.
"""

import sys
import os
import argparse

sys.path.insert(0, '%s/../..' % os.path.realpath(os.path.dirname(__file__)))
import autoconf
from plugins import corparch
from plugins import ucnk_live_attributes


def get_corplist(corpus_tree):
    return tuple([x['id'] for x in corpus_tree.get()])


def _get_num_cache_items(db):
    return db.execute('SELECT COUNT(*) FROM cache').fetchone()


def _clear_cache_in_db(db):
    if db:
        try:
            db.execute('DELETE FROM cache')
            return 'OK'
        except Exception as e:
            return 'ERROR (%s)' % e
    else:
        return 'no DB defined'


def get_status(corplist, live_attrs):
    ans = {}
    for corp in corplist:
        db = live_attrs.db(corp)
        if db:
            ans[corp] = _get_num_cache_items(db)[0]
        else:
            ans[corp] = None
    return ans


def print_status(corplist, live_attrs):
    print('+-------------------------------+')
    print('|     reading cache status      |')
    print('+-------------------------------+')
    items = sorted(get_status(corplist, live_attrs).items(), key=lambda x: x[0])
    max_len = max([len(x) for x in corplist])

    for k, v in items:
        if v is not None:
            print('%s%s -> %s item(s)' % (k, ' ' * (max_len - len(k)), v))
        else:
            print('%s%s -> [no database]' % (k, ' ' * (max_len - len(k))))


def clear_cache(corplist, live_attrs):
    print('+-------------------------------+')
    print('|     removing cache data       |')
    print('+-------------------------------+')
    max_len = max([len(x) for x in corplist])
    for corp in sorted(corplist):
        db = live_attrs.db(corp)
        result = _clear_cache_in_db(db)
        print('%s%s -> %s' % (corp, ' ' * (max_len - len(corp)), result))

ACTION_MAP = {
    'status': print_status,
    'clear': clear_cache
}

if __name__ == '__main__':
    autoconf.setup_logger(logger_name='conc_archive')

    parser = argparse.ArgumentParser(description='A script to control UCNK metadata cache')
    parser.add_argument('action', metavar='ACTION', help='one of {status, clear}')
    args = parser.parse_args()

    ctree = corparch.create_instance(autoconf.settings)
    ctree.setup(lang='en')
    live_attrs = ucnk_live_attributes.create_instance(ctree, autoconf.settings)
    corplist = get_corplist(ctree)

    try:
        ACTION_MAP[args.action](corplist, live_attrs)
    except KeyError:
        print('Unknown action "%s"' % args.action)
        sys.exit(1)