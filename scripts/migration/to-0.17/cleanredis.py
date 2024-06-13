import redis


def open_db():
    r1 = redis.Redis(host='192.168.1.193', port=6379, db=1)
    r2 = redis.Redis(host='localhost', port=6379, db=1)
    return r1, r2


def load_items(db1, db2):
    print(db1)
    keys = db1.keys('favitems:user:*')
    for k in keys:
        items = db1.hgetall(k)
        for kx, vx in items.items():
            # print(f'{kx} => {vx}')
            db2.hset(k, kx, vx)
        # print('-----------------------------')


if __name__ == '__main__':
    db1, db2 = open_db()
    items = load_items(db1, db2)