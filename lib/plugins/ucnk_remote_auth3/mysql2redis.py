"""
Note: this is UCNK specific functionality

A simple script for (repeated) importing/updating of user data (including their allowed
corpora) from MySQL/MariaDB database to Redis storage.

It is also used by the syncdb.py script.

The script requires Python Redis client (http://redis-py.readthedocs.org/) and
MySQL-python library (https://pypi.python.org/pypi/MySQL-python).
"""

import redis
import json
import datetime
import argparse

import MySQLdb


def mysql_connection(**kwargs):
    return MySQLdb.connect(**kwargs)


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
        'firstName',
        'surname',
        'email',
        'regist',
        'expire',
        'active',
        'corplist',
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

    def __init__(self, mysqldb, version, default_corpora=None):
        self._mysql = mysqldb
        self._version = version
        self._default_corpora = default_corpora if default_corpora is not None else ()

    def get_user_corpora(self, username):
        """
        Returns a list of corpora the user has access to.

        arguments:
        username -- user's username (i.e. no ID here!)
        """
        cursor = self._mysql.cursor()
        cursor.execute("""SELECT corpora.name, limited FROM (
            SELECT ucr.corpus_id AS corpus_id, ucr.limited AS limited
            FROM user_corpus_relation AS ucr JOIN user AS u1 ON ucr.user_id = u1.id AND u1.user = %s
            UNION
            SELECT r2.corpora AS corpus_id, r2.limited AS limited
            FROM user AS u2
            JOIN relation AS r2 on r2.corplist = u2.corplist AND u2.user = %s) AS ucn
            JOIN corpora on corpora.id = ucn.corpus_id ORDER BY corpora.name""", (username, username))
        rows = cursor.fetchall()
        ans = []
        for row in rows:
            if row[1]:
                ans.append('omezeni/%s' % row[0])
            else:
                ans.append(row[0])
        if len(ans) == 0:
            ans = self._default_corpora
        return ans

    def get_user_individual_corpora(self, user_id):
        cursor = self._mysql.cursor()
        cursor.execute("SELECT c.name, ucr.limited FROM user_corpus_relation ucr " +
                       "JOIN corpora c ON ucr.corpus_id = c.id WHERE ucr.user_id = %s", user_id)
        rows = cursor.fetchall()
        ans = []
        for row in rows:
            if row[1]:
                ans.append('omezeni/%s' % row[0])
            else:
                ans.append(row[0])
        return ans

    def run(self, conf, user_id=None):
        """
        Performs the export

        arguments:
        user_id -- if specified then only this user is exported (otherwise, all the users are exported)
        """
        sql = "SELECT %s FROM user" % ','.join(get_user_cols())
        cursor = self._mysql.cursor()
        if user_id is None:
            cursor.execute('%s ORDER BY id' % sql)
        else:
            cursor.execute(('%s WHERE id = %%s' % sql), (user_id,))
        rows = cursor.fetchall()
        colmap = get_user_cols(as_map=True)
        corplists = dict((int(k), v) for k, v in conf.get('corplists', {}).items())
        ans = []
        for row in rows:
            user_data = create_user_dict(colmap, row)
            if self._version == 1:
                user_data['corpora'] = self.get_user_corpora(row[colmap['user']])
            elif self._version == 2:
                user_data['corpora'] = self.get_user_individual_corpora(row[colmap['id']])
                user_data['corplist'] = corplists.get(row[colmap['corplist']], None)
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


def create_import_instance(conf, dry_run=False):
    if dry_run:
        import_obj = Import(DummyRedis())
    else:
        import_obj = Import(redis_connection(**conf))
    return import_obj


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Synchronize data from mysql db to redis')
    parser.add_argument('conf_file', metavar='CONF_FILE', help='operation configuration in JSON')
    parser.add_argument('-u', '--user', type=int, help='update only this user (otherwise, all the users are updated)')
    parser.add_argument('-v', '--version', type=int, default=1, help='export version (default is 1)')
    parser.add_argument('-d', '--dry-run', action='store_true', help='allows running without affecting storage data')
    args = parser.parse_args()

    conf = json.load(open(args.conf_file))
    mysql_conn = mysql_connection(user=conf['mysql']['user'],
                                  passwd=conf['mysql']['passwd'],
                                  host=conf['mysql']['hostname'],
                                  db=conf['mysql']['dbname'],
                                  charset=conf['mysql'].get('charset', 'latin1'),
                                  use_unicode=conf['mysql'].get('use_unicode', False))

    print('Export/import mode: version %d' % (args.version,))
    export_obj = Export(mysqldb=mysql_conn, version=args.version,
                        default_corpora=conf.get('default_corpora', None))
    ans = export_obj.run(conf, args.user)
    print('Finished loading source data')
    redis_conf = dict(host=conf['redis']['hostname'], port=conf['redis']['port'], db_id=conf['redis']['id'])
    create_import_instance(redis_conf, dry_run=args.dry_run).run(ans)
    print('Sync done.')
