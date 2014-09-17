import redis
import json
import datetime
import argparse

from sqlalchemy import create_engine


def mysql_connection(user, passwd, hostname, dbname, params=None):
    if params is None:
        params = {}
    conn_url = 'mysql://%(user)s:%(passwd)s@%(hostname)s/%(dbname)s?%(params)s' % {
        'user': user, 'passwd': passwd,
        'hostname': hostname, 'dbname': dbname,
        'params': '&'.join(['%s=%s' % (k, v) for k, v in params])}
    return create_engine(conn_url, pool_size=2, max_overflow=0, encoding='utf-8')


def redis_connection(host, port, id):
    return redis.StrictRedis(host=host, port=port, db=id)


def get_user_cols(as_map=False):
    cols = ('id', 'user', 'pass', 'context_limit', 'corplist', 'firstName', 'surname', 'email',
            'regist', 'expire', 'active', 'sketches', 'affiliation', 'affiliation_country', 'category',
            'address', 'country', 'never_expire', 'recovery_hash', 'recovery_until')
    if as_map:
        return dict([(x[1], x[0]) for x in enumerate(cols)])
    return cols


def create_user_dict(colmap, data):
    ans = {'settings': {}}
    for k, v in colmap.items():
        if type(data[v]) is datetime.date:
            v2 = '%s' % data[v]
        elif k in ('sketches', 'never_expire', 'active'):
            v2 = bool(data[v])
        elif data[v] == '':
            v2 = None
        elif k == 'firstName':
            v2 = data[v]
            k = 'firstname'
        elif k == 'surname':
            v2 = data[v]
            k = 'lastname'
        elif k == 'user':
            v2 = data[v]
            k = 'username'
        elif k == 'pass':
            v2 = data[v]
            k = 'pwd_hash'
        elif k == 'corplist':
            continue
        else:
            v2 = data[v]
        ans[k] = v2
    return ans


class Export(object):

    def __init__(self, mysqldb):
        self._mysql = mysqldb

    def get_user_corpora(self, username):
        rows = self._mysql.execute("""SELECT corpora.name, limited FROM (
            SELECT ucr.corpus_id AS corpus_id, ucr.limited AS limited
            FROM user_corpus_relation AS ucr JOIN user AS u1 ON ucr.user_id = u1.id AND u1.user = %s
            UNION
            SELECT r2.corpora AS corpus_id, r2.limited AS limited
            FROM user AS u2
            JOIN relation AS r2 on r2.corplist = u2.corplist AND u2.user = %s) AS ucn
            JOIN corpora on corpora.id = ucn.corpus_id ORDER BY corpora.name""", (username, username)).fetchall()
        ans = []
        for row in rows:
            if row[1]:
                ans.append('omezeni/%s' % row[0])
            else:
                ans.append(row[0])
        if len(ans) == 0:
            ans = ['susanne', 'syn2010'] # TODO
        return ans

    def run(self):
        rows = self._mysql.execute("SELECT %s FROM user ORDER BY id" % ','.join(get_user_cols())).fetchall()
        colmap = get_user_cols(as_map=True)
        ans = []
        for row in rows:
            user_data = create_user_dict(colmap, row)
            user_data['corpora'] = self.get_user_corpora(row[colmap['user']])
            ans.append(user_data)
        return ans


class FakeRedis(object):

    def set(self, k, v):
        print('\nredis.set(%s, %s)' % (k, v))

    def hset(self, k, hk, v):
        print('\nredis.hset(%s, %s, %s)' % (k, hk, v))

    def rpush(self, k, *v):
        print('\nredis.rpush(%s, %s)' % (k, v))


class Import(object):

    def __init__(self, redisdb):
        self._redis = redisdb

    def _mk_key(self, user):
        return 'user:%d' % user['id']

    def run(self, data):
        for item in data:
            k = self._mk_key(item)
            corplist = item['corpora'][:]
            del item['corpora']
            self._redis.set(k, json.dumps(item))
            self._redis.hset('user_index', item['username'], k)
            self._redis.set('corplist:%s' % k, json.dumps(corplist))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Synchronize data from mysql db to redis")
    parser.add_argument("conf_file", metavar="CONF_FILE", help="operation configuration in JSON")
    parser.add_argument('-d', '--dry-run', action='store_true', help="allows running without affecting storage data")
    args = parser.parse_args()

    conf = json.load(open(args.conf_file))
    proc = Export(mysql_connection(user=conf['mysql']['user'],
                                   passwd=conf['mysql']['passwd'],
                                   hostname=conf['mysql']['hostname'],
                                   dbname=conf['mysql']['dbname']))
    ans = proc.run()

    if args.dry_run:
        proc2 = Import(FakeRedis())
    else:
        proc2 = Import(redis_connection(host=conf['redis']['hostname'],
                                        port=conf['redis']['port'],
                                        id=conf['redis']['id']))

    proc2.run(ans)