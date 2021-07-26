#!/usr/bin/env python3

import os
import sys

import rejson

app_path = os.path.realpath('%s/../../..' % os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, '%s/lib' % app_path)

import settings


def get_db(conf):
    return rejson.Client(host=conf['host'], port=int(conf['port']), db=int(conf['id']), decode_responses=True)


if __name__ == '__main__':
    import argparse

    argparser = argparse.ArgumentParser(description="RedisDB clean-up utility")
    argparser.add_argument('clean_what', metavar="ACTION",
                           help="what item group should be cleaned (session, concordance)")

    args = argparser.parse_args()
    patterns = {
        'session': 'session:*',
        'concordance': 'concordance:*'
    }

    if not args.clean_what in patterns:
        raise ValueError('Unknown action: %s' % args.clean_what)

    settings.load('%s/conf/config.xml' % app_path)
    db = get_db(settings.get('plugins', 'db'))
    keys = db.keys(patterns[args.clean_what])
    i = 0
    for key in keys:
        db.delete(key)
        print(('deleted: %s' % key))
        i += 1
    print(('Finished deleting %d keys' % i))
