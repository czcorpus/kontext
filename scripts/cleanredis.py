import argparse
import redis

def clean_settings(db):
    for pref in ('settings:user:', 'corpus_settings:user:'):
        keys = db.keys(f'{pref}*')
        for k in keys:
            print(k)

def clean_users(db):
    pass


if __name__ == '__main__':
    argparser = argparse.ArgumentParser(description='RedisDB clean-up utility (2)')
    argparser.add_argument(
        'clean_what', metavar='ACTION',
        help='what item group should be cleaned (session, settings)')
    argparser.add_argument('--redis-host', type=str, default='localhost')
    argparser.add_argument('--redis-port', type=int, default=6379)
    argparser.add_argument('--redis-db', type=int)
    argparser.add_argument('--dry-run', action='store_true')
    args = argparser.parse_args()
    db = redis.from_url(f'redis://{args.redis_host}:{args.redis_port}', db=args.redis_db)
    print(db)
    if args.clean_what == 'settings':
        clean_settings(db)


