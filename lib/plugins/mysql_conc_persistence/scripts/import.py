import sys
import os

sys.path.insert(0, os.path.realpath('%s/../' % os.path.dirname(os.path.realpath(__file__))))
sys.path.insert(0, os.path.realpath('%s/../../../../scripts/' %
                                    os.path.dirname(os.path.realpath(__file__))))

import sqlite3
import autoconf
import archive
import argparse
import datetime


def import_sqlite_db(db_path, chunk_size):
    ucnk_db = sqlite3.connect(db_path)

    cursor = ucnk_db.cursor()
    mysql_db = archive.MySQLOps(archive.MySQLConf(autoconf.settings))

    cursor.execute('SELECT id, data, created, num_access, last_access FROM archive')
    while True:
        data = cursor.fetchmany(chunk_size)
        if len(data):
            mysql_db.executemany(
                'INSERT IGNORE INTO kontext_conc_persistence (id, data, created, num_access, last_access) '
                'VALUES (%s, %s, %s, %s, %s)',
                [(
                    d[0],
                    d[1],
                    datetime.datetime.fromtimestamp(d[2]).isoformat(),
                    d[3],
                    datetime.datetime.fromtimestamp(d[4]).isoformat() if d[4] else None
                ) for d in data]
            )
            mysql_db.commit()
        else:
            break

    cursor.close()
    ucnk_db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Import conc persistence from sqlite3 to mysql')
    parser.add_argument('path', metavar='PATH', type=str, help='Path to sqlite3 db')
    parser.add_argument('-c', '--chunk_size', type=int, default=1000,
                        help='Chunk size for import cycle. Default is 1000')
    args = parser.parse_args()
    try:
        import_sqlite_db(args.path, args.chunk_size)
        print('Data imported')
    except Exception as ex:
        print(('{0}: {1}'.format(ex.__class__.__name__, ex)))
        sys.exit(1)
