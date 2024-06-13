import redis
import sys
import json
import re
import mysql.connector

DB_HOST = '127.0.0.1'
DB_NUM = 1

def open_redis_db():
    return redis.StrictRedis(host=DB_HOST, db=DB_NUM)

def update_redis_record(db, key, value):
    db.set(key, value)

def open_mariadb():
    return mysql.connector.connect(
        user='manatee', password='bakelitovu', host='192.168.1.2', database='manatee')

def update_mariadb_record(cur, key, value):
    sql = "UPDATE kontext_conc_persistence SET data = %s WHERE id = %s"
    #print(sql % (value, key))
    cur.execute(sql, (value, key))


def fix_record(db, k, raw_data, upd_fn):
    if raw_data is None:
        print('skipping empty key {}'.format(k))
        return
    data = json.loads(raw_data)
    form = data.get('lastop_form', None)
    if form is None:
        return
    if form.get('form_type', '') == 'filter':
        q = data.get('q', [])
        #print('we have filter at {}: {}'.format(k, q))
        fixed_q = []
        is_broken = False
        for item in q:
            # p-3 4: 1 [pos
            if item[0] in ('p', 'P', 'n', 'N'):
                fixed = re.sub(r'([pPnN]-?\d+ -?\d+):(.+)', '\\1\\2', item)
                if item != fixed:
                    is_broken = True
                    fixed_q.append(fixed)
                else:
                    fixed_q.append(item)
            else:
                fixed_q.append(item)
        if is_broken:
            print("will fix: {}".format(k))
            print(q)
            print(fixed_q)
            data['q'] = fixed_q
            print(data)
            upd_fn(db, k, json.dumps(data))
            #db.set(k, json.dumps(data))

def load_mariadb_records(db):
    cur = db.cursor()
    cur.execute('START TRANSACTION')
    cur.execute("SELECT id, data FROM kontext_conc_persistence WHERE CREATED >= '2024-01-01T00:00:00'")
    i = 0
    for row in cur.fetchall():
        fix_record(cur, row[0], row[1], update_mariadb_record)
        i += 1
    print('total maria data: {}'.format(i))
    db.commit()


def run():
    #db = open_redis_db()
    #for k in db.keys('concordance:*'):
    #    fix_record(db, k, db.get(k))
    db = open_mariadb()
    load_mariadb_records(db)
if __name__ == '__main__':
    run()