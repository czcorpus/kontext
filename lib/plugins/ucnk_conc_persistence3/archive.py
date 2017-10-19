# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

"""
Note: this is UCNK specific functionality

A script to archive outdated concordance queries from Redis to a SQLite3 database.
"""

import argparse
import json
import os
import sqlite3
import sys
import time

import redis

ARCHIVE_PREFIX = "conc_archive"  # the prefix required for a db file to be considered an archive file
ARCHIVE_QUEUE_KEY = 'conc_arch_queue'


def redis_connection(host, port, db_id):
    """
    Creates a connection to a Redis instance
    """
    return redis.StrictRedis(host=host, port=port, db=db_id)


class Archiver(object):
    """
    A class which actually performs the process of archiving records
    from fast database (Redis) to a slow one (SQLite3)
    """

    def __init__(self, from_db, to_db, archive_queue_key):
        """
        arguments:
        from_db -- a Redis connection
        to_db -- a SQLite3 connection
        archive_queue_key -- a Redis key used to access archive queue
        """
        self._from_db = from_db
        self._to_db = to_db
        self._archive_queue_key = archive_queue_key

    def _get_queue_size(self):
        return self._from_db.llen(self._archive_queue_key)

    def run(self, num_proc, dry_run):
        """
        Performs actual archiving process according to the parameters passed
        in constructor.

        Please note that dry-run is not 100% error-prone as it also pops the items
        from the queue and then inserts them again.

        arguments:
        num_proc -- how many items per run should be processed
        dry_run -- if True then no writing operations are performed

        returns:
        a dict containing some information about processed data (num_processed,
        error, dry_run, queue_size)
        """
        curr_time = int(time.time())
        conc_prefix = 'concordance:'
        inserts = []
        i = 0
        try:
            while i < num_proc:
                qitem = self._from_db.lpop(self._archive_queue_key)
                if qitem is None:
                    break
                qitem = json.loads(qitem)
                data = self._from_db.get(qitem['key'])
                inserts.append((qitem['key'][len(conc_prefix):], json.dumps(data), curr_time, 0))
                i += 1

            if not dry_run:
                self._to_db.executemany(
                    'INSERT OR IGNORE INTO archive (id, data, created, num_access) VALUES (?, ?, ?, ?)', inserts)
                self._to_db.commit()
            else:
                for ins in reversed(inserts):
                    self._from_db.lpush(self._archive_queue_key, json.dumps(dict(key=conc_prefix + ins[0])))
        except Exception as ex:
            for item in inserts:
                self._from_db.rpush(self._archive_queue_key, json.dumps(dict(key=conc_prefix + item[0])))
            return dict(
                num_processed=i,
                error=ex,
                dry_run=dry_run,
                queue_size=self._get_queue_size())
        return dict(
            num_processed=i,
            error=None,
            dry_run=dry_run,
            queue_size=self._get_queue_size())


def run(conf, num_proc, dry_run):
    from_db = redis_connection(conf.get('plugins', 'db')['default:host'],
                               conf.get('plugins', 'db')['default:port'],
                               conf.get('plugins', 'db')['default:id'])
    db_path = conf.get('plugins')['conc_persistence']['ucnk:archive_db_path']
    arch_rows_limit = conf.get('plugins')['conc_persistence3']['ucnk:archive_rows_limit']
    arch_man = ArchMan(db_path, arch_rows_limit)
    to_db = arch_man.get_current_archive_conn()
    # if archive size exceeded?
    curr_size = to_db.execute("SELECT COUNT(*) FROM archive").fetchone()[0]
    if curr_size > arch_man.arch_rows_limit:
        creation_time = int(time.time())
        if not arch_man.archive_name_exists(arch_man.make_arch_name(creation_time)):
            arch_man.create_new_arch(creation_time)

    archiver = Archiver(from_db=from_db, to_db=to_db, archive_queue_key=ARCHIVE_QUEUE_KEY)
    response = archiver.run(num_proc, dry_run)
    return response


def _run(from_db, db_path, num_proc, dry_run, arch_rows_limit):
    """
    a copy of the above, used for unittests
    """
    arch_man = ArchMan(db_path, arch_rows_limit)
    to_db = arch_man.get_current_archive_conn()

    archiver = Archiver(from_db=from_db, to_db=to_db, archive_queue_key=ARCHIVE_QUEUE_KEY)

    response = archiver.run(num_proc, dry_run)
    curr_size = to_db.execute("SELECT COUNT(*) FROM archive").fetchone()[0]
    if curr_size > arch_man.arch_rows_limit:
        time.sleep(1) # stop here for testing purposes
        creation_time = int(time.time())
        if not arch_man.archive_name_exists(arch_man.make_arch_name(creation_time)):
            arch_man.create_new_arch(creation_time)
    return response


if __name__ == '__main__':
    sys.path.insert(0, os.path.realpath('%s/../..' % os.path.dirname(os.path.realpath(__file__))))
    sys.path.insert(0, os.path.realpath('%s/../../../scripts/' % os.path.dirname(os.path.realpath(__file__))))
    import autoconf
    import initializer

    settings = autoconf.settings
    logger = autoconf.logger

    initializer.init_plugin('db')
    initializer.init_plugin('sessions')
    initializer.init_plugin('auth')

    parser = argparse.ArgumentParser(description='Archive old records from Synchronize data from mysql db to redis')
    parser.add_argument('num_proc', metavar='NUM_PROC', type=int)
    parser.add_argument('-d', '--dry-run', action='store_true',
                        help='allows running without affecting storage data (not 100% error prone as it reads/writes '
                             'to Redis)')
    args = parser.parse_args()
    ans = run(conf=settings, num_proc=args.num_proc, dry_run=args.dry_run)
    print(ans)


# ------------------------
# PD
# ------------------------
class ArchMan(object):
    """
    Class to manage archives and connections to archives in the archive directories
    """
    DEFAULT_SOURCE_ARCH_FILENAME = 'source_arch.db'  # used for temp copy of source arch in working dir

    def __init__(self, db_path, arch_rows_limit):
        self.archive_dir_path = db_path
        self.archive_dict = {}
        self.arch_connections = []
        self.check_archive_dir_exists()
        self.update_archives()
        self.arch_rows_limit = arch_rows_limit
        self.source_arch_name = ArchMan.DEFAULT_SOURCE_ARCH_FILENAME

    # ------------------------------
    # directory manipulation methods
    # ------------------------------
    def check_archive_dir_exists(self):
        if not os.path.exists(self.archive_dir_path):
            os.makedirs(self.archive_dir_path)

    def archive_name_exists(self, filename):
        return os.path.isfile(os.path.join(self.archive_dir_path,filename))

    def clear_directory(self):
        """
        clear the archive db files directory
        """
        for f in sorted(os.listdir(self.archive_dir_path)):
            os.remove(self.archive_dir_path + f)

    def copy_archive_file(self, source_arch_full_path):
        """
        copy an external archive file to working archive directory
        """
        from shutil import copyfile
        copyfile(source_arch_full_path, self.archive_dir_path + self.source_arch_name)

    # -------------------------------------
    # archive files and connections methods
    # -------------------------------------
    @staticmethod
    def is_db_filename_valid(filename):
        """
        checks whether the provided filename has the required format, i.e. "conc_archive.any_user_text_w/o_dots.db"
        returns True if it is a valid archive db filename, otherwise False
        """
        parted = filename.split(".", 2)
        return len(parted) == 3 and parted[0] == ARCHIVE_PREFIX and parted[2] == "db"

    @staticmethod
    def make_arch_name(creation_time):
        """
        Returns a properly formatted db filename, e.g. conc_archive.2017-10-11T00:00:00.db
        """
        time_string = time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(creation_time))
        return ARCHIVE_PREFIX + "." + time_string + ".db"

    def create_new_arch(self, creation_time):
        """
        Create a new archive db file containing the properly formatted "archive" table
        The creationTime optional parameter may be used to specify the epoch time that will
        be converted to iso date and used in the new filename. If the creationTime parameter
        is not provided, the current time is used to name the new file.
        If creationTime is provided and an archive file with such creation datetime already exists,
        a NameError is thrown.
        The method returns the name of the newly created archive file
        -----
        TO-DOs:
        Is it correct to halt execution to prevent filename collision when creating
        currently active archive?
        Should be renamed to create_new_archive?
        Should be verbose?
        """
        db_name = self.make_arch_name(creation_time)
        full_db_path = os.path.join(self.archive_dir_path, db_name)
        if os.path.isfile(full_db_path):
            raise NameError("archive db file {0} already exists".format(full_db_path))
        conn = sqlite3.connect(full_db_path)
        c = conn.cursor()
        c.execute("CREATE TABLE archive ("
                  "id text, "
                  "data text NOT NULL, "
                  "created integer NOT NULL, "
                  "num_access integer NOT NULL DEFAULT 0, "
                  "last_access integer, "
                  "PRIMARY KEY (id))")
        conn.commit()
        conn.close()
        return db_name

    def connect_to_archive(self, filename, create_new=False):
        """
        TO-DO: is this method necessary?
        returns connection to specified archive
        if the archive does not exist:
        if the createNew param is True, new archive is created, otherwise error is thrown

        """
        full_db_path = os.path.join(self.archive_dir_path, filename)
        if not os.path.isfile(full_db_path) and not create_new:
            raise NameError("the specified archive file does not exist in the archive directory")
        else:
            conn = sqlite3.connect(full_db_path)
            return conn

    def is_archive_correct(self, filename):
        """
        checks whether the specified archive is a valid archive
        """
        conn = self.connect_to_archive(filename)
        c = conn.cursor()
        # archive must contain single table
        sql = 'SELECT COUNT(*) FROM sqlite_master WHERE type="table";'
        count = c.execute(sql).fetchone()[0]
        if count != 1:
            raise TypeError("the archive db file must contain a single table")

        # archive table must be named "archive"
        sql = 'SELECT name FROM sqlite_master WHERE type="table";'
        name = c.execute(sql).fetchone()[0]
        if name != "archive":
            raise NameError("the archive table must be named 'archive'")

        # archive table must have correct structure
        sql = 'SELECT sql FROM sqlite_master WHERE name="archive";'
        structure = c.execute(sql).fetchone()[0]
        required = "CREATE TABLE archive (id text, data text NOT NULL, created integer NOT NULL, num_access integer " \
                   "NOT NULL DEFAULT 0, last_access integer, PRIMARY KEY (id))"
        conn.close()
        if structure != required:
            raise TypeError("the archive table does not have the required structure")
        return True

    def get_archives_list(self, strict=False):
        file_list = []
        # select only valid archive db files from the specified directory
        # the list of archive dbs will be sorted starting from the latest one
        for f in sorted(os.listdir(self.archive_dir_path), reverse=True):
            if self.is_db_filename_valid(f):
                file_list.append(f)
        if strict and not len(file_list):
            raise NameError('No valid db file exists in the specified archive location')
        else:
            return file_list

    def get_archives_connections(self):
        arch_list = self.get_archives_list()
        connections = []
        for arch in arch_list:
            full_path = os.path.join(self.archive_dir_path, arch)
            connections.append(sqlite3.connect(full_path))
        return connections

    def get_current_archive_name(self):
        """
        returns the name of the currently active db_file
        """
        return self.get_archives_list()[0]

    def get_current_archive_conn(self):
        """
        returns the connection to the currently active db_file. if no archive exists, creates one
        """
        arch_list = self.get_archives_list()
        if len(arch_list) == 0:
            arch_list.append(self.create_new_arch(int(time.time())))
        full_path = self.archive_dir_path + arch_list[0]
        return sqlite3.connect(full_path)

    def update_archives(self):
        """
        get open connections from the dict, add new connections, close unused connections
        """
        arch_list = self.get_archives_list()
        connections = []
        for arch in arch_list:
            if arch in self.archive_dict:
                conn = self.archive_dict.get(arch)
            else:
                full_path = self.archive_dir_path + arch
                conn = sqlite3.connect(full_path)
                self.archive_dict.update({arch: conn})
            connections.append(conn)
        self.arch_connections = connections
        # close and pop obsolete connections (in case a previously used archive is removed from the dir)
        adepts = []
        for arch, conn in self.archive_dict.iteritems():
            if arch not in arch_list:
                adepts.append(arch)
                conn.close()
        for arch in adepts:
            self.archive_dict.pop(arch)
        return True

    # --------------------------------
    # source archive splitting methods
    # --------------------------------
    def get_arch_numrows(self, filename):
        full_path = self.archive_dir_path + filename
        conn = sqlite3.connect(full_path)
        c = conn.cursor()
        numrows = c.execute("SELECT COUNT(*) FROM archive").fetchone()[0]
        conn.close()
        return numrows

    def get_oldest_row_time(self, filename):
        """
        returns the epoch time of the oldest row in the archive
        """
        conn = self.connect_to_archive(filename)
        return conn.execute("SELECT created FROM archive ORDER BY created LIMIT 1;").fetchone()[0]

    def move_rows_to_new_archive(self, old_file, new_file, rows):
        old_conn = self.connect_to_archive(old_file)
        new_conn = self.connect_to_archive(new_file)
        for old_row in old_conn.execute("SELECT * FROM archive ORDER BY created LIMIT " + str(rows)):
            new_conn.execute("INSERT INTO archive VALUES (?,?,?,?,?);", old_row)
        new_conn.commit()
        old_conn.execute("DELETE FROM archive ORDER BY created LIMIT " + str(rows))
        old_conn.commit()

    def split_archive(self, source_arch_full_path, number_of_archives):
        """
        splits the source archive into specified number of archive files named using isodate naming convention
        using the datetime of the oldest row in the respected created archive
        finally, the last remaining rows are left in the source file and this file is renamed
        the source archive file must be placed outside the working directory, the method takes its path and filename
        as parameters and makes a copy of the source file in the working dir
        """
        path, filename = os.path.split(source_arch_full_path)
        self.copy_archive_file(source_arch_full_path)
        self.is_archive_correct(filename)
        orig_size = self.get_arch_numrows(self.source_arch_name)
        split_size = int(orig_size / number_of_archives)
        for i in range(0, number_of_archives - 1):
            oldest_time = self.get_oldest_row_time(self.source_arch_name)
            new_archive = self.create_new_arch(oldest_time)
            self.move_rows_to_new_archive(self.source_arch_name, new_archive, split_size)
        oldest_time = self.get_oldest_row_time(self.source_arch_name)
        last_arch_name = self.make_arch_name(oldest_time)
        os.rename(self.archive_dir_path + self.source_arch_name, self.archive_dir_path + last_arch_name)
