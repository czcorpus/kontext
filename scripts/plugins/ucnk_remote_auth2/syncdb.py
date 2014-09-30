"""
Note:
This script was created for specific needs of the Institute of the Czech National Corpus
and it is not needed for default KonText installation.
"""
import argparse
import os
import sys
import logging
from logging import handlers
import json

SCRIPT_PATH = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
APP_PATH = os.path.realpath('%s/../../..' % SCRIPT_PATH)
sys.path.insert(0, '%s/lib' % APP_PATH)
import settings
from plugins import ucnk_remote_auth2 as auth
import mysql2redis as m2r

logger = logging.getLogger('syncdb')

DEFAULT_CHECK_INTERVAL = 5
DEFAULT_LOG_FILE_SIZE = 1000000
DEFAULT_NUM_LOG_FILES = 5


def load_conf():
    conf_file = '%s/syncdb.json' % APP_PATH
    if os.path.isfile(conf_file):
        return json.load(open(conf_file, 'r'))
    else:
        return {}


def setup_logger(conf):
    if 'logging' in conf:
        conf = conf['logging']
        handler = handlers.RotatingFileHandler(conf['path'],
                                               maxBytes=conf.get('file_size', DEFAULT_LOG_FILE_SIZE),
                                               backupCount=conf.get('num_files', DEFAULT_NUM_LOG_FILES))
    else:
        handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)


class DbSync(object):

    def __init__(self, mysql_conn, redis_params, check_interval, db_name):
        self._mysql = mysql_conn
        self._redis_params = redis_params
        self._check_interval = check_interval
        self._db_name = db_name

    def execute(self, sql, params=None):
        cursor = self._mysql.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor

    def get_user_changes(self):
        cursor = self.execute("SELECT DISTINCT user_id FROM user_changelog ORDER BY created ASC")
        return cursor.fetchall()

    def find_mass_changes(self):
        sql = "SELECT table_name, update_time " \
              "FROM information_schema.tables " \
              "WHERE update_time > (NOW() - INTERVAL %s MINUTE) " \
              "AND table_schema = %s" \
              "AND table_name IN ('corplist', 'corpora', 'relation')"
        cursor = self.execute(sql, (self._check_interval, self._db_name))
        return cursor.fetchall()

    def log_mass_change(self):
        self.execute("DELETE FROM user_changelog")  # we do not need this as each user will be there in a moment
        self.execute("INSERT INTO user_changelog (user_id, created) SELECT id, NOW() FROM user")
        self._mysql.commit()

    def delete_log(self, user_id):
        self.execute("DELETE FROM user_changelog WHERE user_id = %s", (user_id,))
        self._mysql.commit()

    def __call__(self, dry_run=False):
        mass_ch = self.find_mass_changes()
        export = m2r.Export(mysqldb=self._mysql, default_corpora=('susanne',))
        import_obj = m2r.create_import_instance(self._redis_params, dry_run=dry_run)
        if len(mass_ch) > 0:
            self.log_mass_change()
        changed_users = 0
        for changed_user in self.get_user_changes():
            try:
                data = export.run(changed_user[0])
                if len(data) == 1:
                    import_obj.run(data)
                    self.delete_log(changed_user[0])
                    changed_users += 1
            except Exception as e:
                logger.error(e)
        return changed_users


if __name__ == '__main__':
    import time

    settings.load('%s/config.xml' % APP_PATH)
    conf = load_conf()
    setup_logger(conf)
    parser = argparse.ArgumentParser(description='Check for changes in UCNK database and synchronize with KonText')
    parser.add_argument('-t', '--interval', type=int, default=DEFAULT_CHECK_INTERVAL,
                        help='how often (in minutes) script runs (default=%d)' % DEFAULT_CHECK_INTERVAL)
    parser.add_argument('-d', '--dry-run', action='store_true', help='allows running without affecting storage data')
    args = parser.parse_args()

    mysql_params = auth.create_auth_db_params(settings.get('plugins', 'auth'))
    mysql_params.update(dict(charset='utf8', use_unicode=True))
    redis_params = settings.get('plugins', 'db')
    redis_params = dict(host=redis_params['default:host'],
                        port=redis_params['default:port'],
                        db_id=redis_params['default:id'])
    w = DbSync(mysql_conn=auth.connect_auth_db(**mysql_params),
               redis_params=redis_params,
               check_interval=args.interval,
               db_name=mysql_params['db'])
    t = time.time()
    changed = w(dry_run=args.dry_run)
    t = time.time() - t
    if changed > 0:
        logger.info('Synchronized %d users in %01.1f sec.' % (changed, t))