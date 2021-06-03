import sys
import os
import sqlite3
import re
import json

sys.path.insert(0, os.path.realpath('%s/..' % os.path.dirname(__file__)))
import autoconf
import plugins

from plugins import redis_db
plugins.install_plugin('db', redis_db, autoconf.settings)


DB_CONF_ENTRY = 'archive_db_path'


def fix_new_lines(data):
    if 'q' in data:
        new_q = []
        for item in data['q']:
            new_q.append(re.sub(r'[\n\r]+', ' ', item).strip())
        data['q'] = new_q
    else:
        raise ValueError('"q" not found in the record')


def get_sqlite_conn():
    conf = autoconf.settings.get('plugins', 'query_persistence')
    db_path = conf.get(DB_CONF_ENTRY, None)
    if db_path:
        return sqlite3.connect(db_path)
    return None


if __name__ == '__main__':
    rec_id = sys.argv[1]
    db = plugins.runtime.DB.instance
    rec = db.get('concordance:{0}'.format(rec_id))
    if rec is not None:
        print('Record found in Redis, fixing new lines...')
        fix_new_lines(rec)
        db.set('concordance:{0}'.format(rec_id), rec)

    sqldb = get_sqlite_conn()
    if sqldb:
        cur = sqldb.cursor()
        cur.execute('SELECT data FROM archive WHERE id = ?', [rec_id])
        row = cur.fetchone()
        if row:
            print('Record found in SQLite3 archive, fixing new lines...')
            data = json.loads(row[0])
            fix_new_lines(data)
            cur.execute('UPDATE archive SET data = ? WHERE id = ?', [json.dumps(data), rec_id])
            sqldb.commit()
    else:
        print('No archive database found, skipping.')
