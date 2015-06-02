"""
Note:
This script was created for specific needs of the Institute of the Czech National Corpus
and it is not needed for default KonText installation.

The script is expected to be run either by cron in regular intervals or manually in
special cases.

It is possible to specify extra parameters using syncdb.json file located in the
root of the KonText application.
{
   "default_corpora" : ["corp1", "corp2"],
   "logging" : {
        "path" : "/path/to/a/log/file",
        "file_size" : 8000000,
        "num_files" : 5
   }

"""
import argparse
import os
import sys
import logging
from logging import handlers
import json
from datetime import datetime

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
    """
    Loads an optional syncdb script configuration
    """
    conf_file = '%s/syncdb.json' % APP_PATH
    if os.path.isfile(conf_file):
        return json.load(open(conf_file, 'r'))
    else:
        return {}


def setup_logger(conf=None):
    """
    Configures logging parameters. If an emtpy conf is provided then
    logging to the standard output is configured. Otherwise, file rotating
    logger is instantiated.

    arguments:
    conf -- a dictionary containing syncdb configuration ('logging' key is searched here)
    """
    if conf is not None and 'logging' in conf:
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
    """
    A class which handles MySQL -> RedisDB synchronization.
    The object is callable - by calling it, a single "check and update" action is run.
    """

    def __init__(self, mysql_conn, redis_params, check_interval, db_name):
        """
        arguments:
        mysql_conn -- a MySQLdb connection object
        redis_params -- a dictionary containing redis connection information (host, db, port)
        check_interval -- how old (in minutes) changes should syncdb script consider; this
            applies only for mass changes as user_changelog is always read without any restriction
        db_name -- a name of respective MySQL/MariaDB database
        """
        self._mysql = mysql_conn
        self._redis_params = redis_params
        self._check_interval = check_interval
        self._db_name = db_name

    def _current_dbtime(self):
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    def query(self, sql, params=None):
        """
        Runs a query.

        arguments:
        sql -- a SQL query
        params -- parameters to be bound to the query (optional)

        returns:
        DB cursor
        """
        cursor = self._mysql.cursor()
        if params:
            cursor.execute(sql, params)
        else:
            cursor.execute(sql)
        return cursor

    def get_logged_changes(self):
        """
        Returns a list of records from user_changelog.
        """
        cursor = self.query("SELECT DISTINCT user_id FROM user_changelog ORDER BY created ASC")
        return cursor.fetchall()

    def log_user_updates(self):
        """
        Searches for "real" user updates (cannot use trigger on 'user' here because each request to
        UCNK's application produces update of user.expire which is quite an overhead here). Luckily,
        user database in UCNK makes automatic backups of changed user credentials.
        """
        now = self._current_dbtime()
        self.query('INSERT INTO user_changelog (user_id, created) '
                   'SELECT DISTINCT id, %s FROM user_version '
                   'where used_until > (%s - INTERVAL %s MINUTE)', (now, now, self._check_interval))
        self._mysql.commit()

    def find_mass_changes(self):
        """
        Searches for changes in tables related to the 'user' table and concerning potentially
        all the users (e.g. a new corpus is added). There are certainly more effective
       (and also more complicated) solutions but this should be OK in our case.

        returns:
        a list of tuples (user_id, last_change_datetime)
        """
        now = self._current_dbtime()
        sql = "SELECT table_name, update_time " \
              "FROM information_schema.tables " \
              "WHERE update_time > (%s - INTERVAL %s MINUTE) " \
              "AND table_schema = %s" \
              "AND table_name IN ('corplist', 'corpora', 'relation')"
        cursor = self.query(sql, (now, self._check_interval, self._db_name))
        return cursor.fetchall()

    def log_mass_change(self):
        """
        Writes a change flag to user_changelog for all users. Any previous
        records are deleted first because all the users will be updated anyway.
        """
        now = self._current_dbtime()
        self.query("DELETE FROM user_changelog")  # we do not need this as each user will be there in a moment
        self.query("INSERT INTO user_changelog (user_id, created) SELECT id, %s FROM user", (now,))
        self._mysql.commit()

    def delete_log(self, user_id):
        """
        Removes all records from user_changelog related to the user user_id

        arguments:
        user_id -- a DB ID of the user
        """
        self.query("DELETE FROM user_changelog WHERE user_id = %s", (user_id,))
        self._mysql.commit()

    def __call__(self, dry_run=False):
        """
        Performs an action containing search for changes and updating affected records
        in RedisDB.
        """
        mass_ch = self.find_mass_changes()
        if len(mass_ch) > 0:
            self.log_mass_change()
        self.log_user_updates()

        export = m2r.Export(mysqldb=self._mysql, default_corpora=conf.get('default_corpora', ('susanne',)))
        import_obj = m2r.create_import_instance(self._redis_params, dry_run=dry_run)

        changed_users = 0
        for changed_user in self.get_logged_changes():
            try:
                data = export.run(changed_user[0])
                if len(data) == 1:
                    import_obj.run(data)
                    if not dry_run:
                        self.delete_log(changed_user[0])
                    changed_users += 1
            except Exception as e:
                logger.error(e)
        return changed_users


if __name__ == '__main__':
    import time

    settings.load('%s/conf/config.xml' % APP_PATH)
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