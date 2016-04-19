"""
Note:
This script was created for specific needs of the Institute of the Czech National Corpus
and it is not needed for default KonText installation.

The script is expected to be run either by cron in regular intervals or manually in
special cases.

A simple config is required:
{
   "default_corpora" : ["corp1", "corp2"], <--- optional
   "logging" : {
        "path" : "/path/to/a/log/file"
   }

"""
import argparse
import logging
import json
from datetime import datetime
import time

import MySQLdb

import mysql2redis as m2r
import mysqlops


DEFAULT_CHECK_INTERVAL = 5


class DbSync(mysqlops.Db):
    """
    A class which handles MySQL -> RedisDB synchronization.
    The object is callable - by calling it, a single "check and update" action is run.
    """

    def __init__(self, conf, mysql_conn, check_interval, default_user_corpora):
        """
        arguments:
        conf -- parsed script configuration
        check_interval -- how old (in minutes) changes should syncdb script consider; this
            applies only for mass changes as user_changelog is always read without any restriction
        default_user_corpora -- a list of corpora user gets in case nothing is found for her
        """
        super(DbSync, self).__init__(mysql_conn)
        self._conf = conf
        self._redis_params = conf['redis']
        self._check_interval = check_interval
        self._db_name = conf['mysql']['dbname']
        self._default_user_corpora = default_user_corpora

    def _current_dbtime(self):
        return datetime.now().strftime('%Y-%m-%d %H:%M:%S')

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

    def __call__(self, version, dry_run=False):
        """
        Performs an action containing search for changes and updating affected records
        in RedisDB.
        """
        mass_ch = self.find_mass_changes()
        if len(mass_ch) > 0:
            self.log_mass_change()
        self.log_user_updates()
        export = m2r.Export(mysqldb=self._mysql, default_corpora=self._default_user_corpora, version=version)
        import_obj = m2r.create_import_instance(self._redis_params, dry_run=dry_run)

        changed_users = 0
        for changed_user in self.get_logged_changes():
            try:
                data = export.run(self._conf, changed_user[0])
                if len(data) == 1:
                    import_obj.run(data)
                    if not dry_run:
                        self.delete_log(changed_user[0])
                    changed_users += 1
            except Exception as e:
                logging.getLogger('syncdb').error(e)
        return changed_users


def run(conf, interval, dry_run, version):
    mysql_conf = conf['mysql']
    mysql_conn = MySQLdb.connect(host=mysql_conf['hostname'], user=mysql_conf['user'],
                                 passwd=mysql_conf['passwd'], db=mysql_conf['dbname'],
                                 use_unicode=mysql_conf['use_unicode'], charset=mysql_conf['charset'])
    w = DbSync(conf=conf,
               mysql_conn=mysql_conn,
               check_interval=interval,
               default_user_corpora=[])
    t = time.time()
    changed = w(version=version, dry_run=dry_run)
    t = time.time() - t
    if changed > 0:
        logging.getLogger('syncdb').info('Synchronized %d users in %01.1f sec.' % (changed, t))
        return {'synced_users': changed}
    else:
        return {'synced_users': 0}


if __name__ == '__main__':
    logging.basicConfig()

    parser = argparse.ArgumentParser(description='Check for changes in UCNK database and'
                                     'synchronize with KonText')
    parser.add_argument('conf_path', metavar='CONF_PATH', type=str, help='Path to a config file')
    parser.add_argument('-t', '--interval', type=int, default=DEFAULT_CHECK_INTERVAL,
                        help='how often (in minutes) script runs (default=%d)' % DEFAULT_CHECK_INTERVAL)
    parser.add_argument('-d', '--dry-run', action='store_true',
                        help='allows running without affecting storage data')
    parser.add_argument('-v', '--version', type=int, default=1, help='export version (default is 1)')
    args = parser.parse_args()
    conf = json.load(open(args.conf_path))
    run(conf, interval=args.interval, dry_run=args.dry_run, version=args.version)
