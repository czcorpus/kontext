import json
import redis


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser('Run step')
    parser.add_argument('--redis-host', type=str, default='0.0.0.0', help='Redis host')
    parser.add_argument('--redis-port', type=int, default=6379, help='Redis port')
    parser.add_argument('--redis-db', type=int, default=1, help='Redis database')
    parser.add_argument('--max-user-id', type=int, default=1, help='Max user id to process')
    parser.add_argument('--dry-run', action='store_true',
                        default=False, help='Only print broken entries')
    args = parser.parse_args()

    redis_client = redis.Redis(host=args.redis_host, port=args.redis_port, db=args.redis_db)
    found_items = 0
    for key in redis_client.scan_iter('favitems:user:*'):
        user = int(key.decode().split(':')[-1])
        if user <= args.max_user_id:
            entries = redis_client.hgetall(key)
            for hash, data in entries.items():
                data = json.loads(data)

                names = data['name'].split(' || ')
                unique_names = set(names)

                for corp in list(unique_names):
                    subcorp = f'{corp} / '
                    if any(corp2.startswith(subcorp) for corp2 in unique_names):
                        unique_names.remove(corp)

                corpora = data['corpora']
                unique_corpora = set(tuple(corp.items()) for corp in corpora)

                if len(names) > len(unique_names) or len(corpora) > len(unique_corpora):
                    found_items += 1
                    if args.dry_run:
                        print(f'Found broken align corpora for user {user}')
                        print(f'    name: {data["name"]}')
                        print(f'    corpora: {data["corpora"]}')
                    else:
                        data['name'] = ' || '.join(unique_names)
                        data['corpora'] = [dict(corp) for corp in unique_corpora]
                        redis_client.hset(key, hash, json.dumps(data))

    if args.dry_run:
        print(f'Found {found_items} broken entries')
    else:
        print(f'Fixed {found_items} broken entries')
