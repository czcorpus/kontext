"""
Note: this is UCNK specific functionality

A simple script for (repeated) importing/updating of user data (including their allowed
corpora) from MySQL/MariaDB database to Redis storage.

The script requires Python Redis client (http://redis-py.readthedocs.org/) and
SQLAlchemy library (http://www.sqlalchemy.org/).
"""

import redis
import json
import datetime
import argparse

from sqlalchemy import create_engine


def mysql_connection(user, passwd, hostname, dbname, params=None):
    """
    Creates a SQLAlchemy engine instance.
    """
    if params is None:
        params = {}
    conn_url = 'mysql://%(user)s:%(passwd)s@%(hostname)s/%(dbname)s?%(params)s' % {
        'user': user, 'passwd': passwd,
        'hostname': hostname, 'dbname': dbname,
        'params': '&'.join(['%s=%s' % (k, v) for k, v in params.items()])}
    return create_engine(conn_url, pool_size=2, max_overflow=0, encoding='utf-8')


def redis_connection(host, port, db_id):
    """
    Crates an instance of Redis connection.

    Note: db identifiers are from set {0, 1, ...}
    """
    return redis.StrictRedis(host=host, port=port, db=db_id)


def get_user_cols(as_map=False):
    """
    Returns either list of columns from 'user' table or mapping from these names to integers
    (depending on the 'as_map' parameter).
    """
    cols = (
        'id',
        'user',
        'pass',
        'context_limit',
        'corplist',
        'firstName',
        'surname',
        'email',
        'regist',
        'expire',
        'active',
        'sketches',
        'affiliation',
        'affiliation_country',
        'category',
        'address',
        'country',
        'never_expire',
        'recovery_hash',
        'recovery_until'
    )
    if as_map:
        return dict([(x[1], x[0]) for x in enumerate(cols)])
    return cols


def create_user_dict(colmap, data):
    """
    Creates a key-value data structure representing user credentials to be stored in Redis

    arguments:
    colmap -- column_name -> column_idx map
    data -- original tuple as obtained from respective sql query
    """
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
    """
    Object for exporting user data from MySQL/MariaDB
    """

    def __init__(self, mysqldb, default_corpora=None):
        """
        arguments:
        mysqldb -- a SQLAlchemy engine instance
        """
        self._mysql = mysqldb
        self._default_corpora = default_corpora if default_corpora is not None else ()

    def get_user_corpora(self, username):
        """
        Returns a list of corpora the user has access to.

        arguments:
        username -- user's username (i.e. no ID here!)
        """
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
            ans = self._default_corpora
        return ans

    def run(self, user_id=None):
        """
        Performs the export

        arguments:
        user_id -- if specified then only this user is exported (otherwise, all the users are exported)
        """
        sql = "SELECT %s FROM user" % ','.join(get_user_cols())
        if user_id is None:
            rows = self._mysql.execute('%s ORDER BY id' % sql).fetchall()
        else:
            rows = self._mysql.execute(('%s WHERE id = %%s' % sql), (user_id,)).fetchall()
        colmap = get_user_cols(as_map=True)
        ans = []
        for row in rows:
            user_data = create_user_dict(colmap, row)
            user_data['corpora'] = self.get_user_corpora(row[colmap['user']])
            ans.append(user_data)
        return ans


class DummyRedis(object):
    """
    Redis client replacement for the 'dry run' mode.
    It prints required commands instead of performing them.
    """

    def set(self, k, v):
        print('\nredis.set(%s, %s)' % (k, v))

    def hset(self, k, hk, v):
        print('\nredis.hset(%s, %s, %s)' % (k, hk, v))

    def rpush(self, k, *v):
        print('\nredis.rpush(%s, %s)' % (k, v))


class Import(object):
    """
    Imports data into a target (Redis compatible) database.
    """

    def __init__(self, redisdb):
        """
        arguments:
        redisdb -- redis connection object
        """
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
    parser = argparse.ArgumentParser(description='Synchronize data from mysql db to redis')
    parser.add_argument('conf_file', metavar='CONF_FILE', help='operation configuration in JSON')
    parser.add_argument('-u', '--user', type=int, help='update only this user (otherwise, all the users are updated)')
    parser.add_argument('-d', '--dry-run', action='store_true', help='allows running without affecting storage data')
    args = parser.parse_args()

    conf = json.load(open(args.conf_file))
    mysql_conn = mysql_connection(user=conf['mysql']['user'],
                                  passwd=conf['mysql']['passwd'],
                                  hostname=conf['mysql']['hostname'],
                                  dbname=conf['mysql']['dbname'])
    export_obj = Export(mysqldb=mysql_conn, default_corpora=conf.get('default_corpora', None))
    ans = export_obj.run(args.user)
    print('Finished loading source data')

    if args.dry_run:
        import_obj = Import(DummyRedis())
    else:
        import_obj = Import(redis_connection(host=conf['redis']['hostname'],
                                             port=conf['redis']['port'],
                                             db_id=conf['redis']['id']))
    import_obj.run(ans)
    print('Sync done.')