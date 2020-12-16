#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.realpath('%s/../..' % os.path.dirname(__file__)))
import autoconf

import plugins

from plugins import redis_db
plugins.install_plugin('db', redis_db, autoconf.settings)

from plugins import default_query_storage
plugins.install_plugin('query_storage', default_query_storage, autoconf.settings)

if __name__ == '__main__':
    import argparse
    import json
    argparser = argparse.ArgumentParser(description="User data editor")
    argparser.add_argument('source_file', metavar="FILE",
                           help="a file containing JSON-encoded initial data")
    argparser.add_argument('action', metavar="ACTION",
                           help="an action to be performed (add, reset)")
    argparser.add_argument('-s', '--specific-id', type=int,
                           help='add only user with specific ID (even if the source contains a list)')
    argparser.add_argument('-d', '--dry-run', action='store_true',
                           help='allows running without affecting storage data')
    args = argparser.parse_args()

    if not args.dry_run:
        print("==================================================")
    else:
        print("==================== dry run =====================")

    src_data = json.load(open(args.source_file, 'r'))
    if type(src_data) is not list:
        src_data = [src_data]

    if args.specific_id is not None:
        src_data = [x for x in src_data if x.get('id', None) == args.specific_id]

    if len(src_data) > 0:
        query_storage = plugins.runtime.QUERY_STORAGE.instance
        db = plugins.runtime.DB.instance

        for item in src_data:
            user_key = 'user:%d' % item['id']
            corplist_key = 'corplist:user:%d' % item['id']
            corpora = item['corpora']
            del item['corpora']
            if not args.dry_run:
                db.set(user_key, item)
                db.set(corplist_key, corpora)
                db.hash_set('user_index', item['username'], user_key)
            else:
                print(('> set(%s, %s)' % (user_key, item)))
                print(('> set(%s, %s)' % (corplist_key, corpora)))
                print(('> hash_set(%s, %s, %s)' % ('user_index', item['username'], user_key)))
    else:
        print('Nothing to store. Either the source list is empty or the specific-id parameter does not match any item.')
