#!/usr/bin/env python
import sys
import os

app_path = os.path.realpath('%s/../../..' % os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '%s/lib' % app_path)

import settings
from plugins import default_db
from plugins import default_query_storage

if __name__ == '__main__':
    import argparse
    import json
    argparser = argparse.ArgumentParser(description="User data editor")
    argparser.add_argument('source_file', metavar="FILE", help="a file containing JSON-encoded initial data")
    argparser.add_argument('action', metavar="ACTION", help="an action to be performed (add, reset)")
    argparser.add_argument('-s', '--specific-id', type=int, help='add only user with specific ID (even if the '
                                                                 'source contains a list)')
    args = argparser.parse_args()
    print(args)
    print("---------------------")

    src_data = json.load(open(args.source_file, 'r'))
    if type(src_data) is not list:
        src_data = [src_data]

    if args.specific_id is not None:
        src_data = filter(lambda x: x.get('id', None) == args.specific_id, src_data)

    if len(src_data) > 0:
        settings.load('%s/config.xml' % app_path)
        db = default_db.create_instance(settings.get('plugins', 'db'))
        query_storage = default_query_storage.create_instance(settings, db)
        for item in src_data:
            db.save(item, 'user-%04d' % item['id'])

        print(src_data)
    else:
        print('Nothing to store. Either the source list is empty or the specific-id parameter does not match any item.')