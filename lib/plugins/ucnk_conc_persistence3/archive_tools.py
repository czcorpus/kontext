import os
import time
import sqlite3
import json

from archive import ARCHIVE_PREFIX
from archive import ArchMan

DB_SOURCE_ARCH_PATH = '/tmp/test_source/'
DB_SOURCE_ARCH_NAME = 'source_arch.db'


class ArchTools:
    def __init__(self, db_path):
        self.archMan = ArchMan(db_path, 10)
        self.db_path = self.archMan.archive_dir_path

    # directory manipulation methods
    def clear_directory(self):
        """
        clear the archive db files directory
        """
        for f in sorted(os.listdir(self.db_path)):
            os.remove(self.db_path + f)

    def copy_archive_file(self, source_arch_full_path):
        """
        copy an external archive file to working archive directory
        """
        path, filename = os.path.split(source_arch_full_path)
        from shutil import copyfile
        copyfile(source_arch_full_path, self.db_path + filename)

    # archive file manipulation methods

    def is_archive_correct(self, filename):
        """
        checks whether the specified archive is a valid archive
        """
        conn = self.connect_to_archive(filename)
        cur = conn.cursor()
        # archive must contain single table
        sql = 'SELECT COUNT(*) FROM sqlite_master WHERE type="table";'
        count = cur.execute(sql).fetchone()[0]
        if count <> 1:
            raise TypeError("the archive db file must contain a single table")

        # archive table must be named "archive"
        sql = 'SELECT name FROM sqlite_master WHERE type="table";'
        name = cur.execute(sql).fetchone()[0]
        if name <> "archive":
            raise NameError("the archive table must be named 'archive'")

        # archive table must have correct structure
        sql = 'SELECT sql FROM sqlite_master WHERE name="archive";'
        structure = cur.execute(sql).fetchone()[0]
        required = "CREATE TABLE archive (id text, data text NOT NULL, created integer NOT NULL, num_access integer NOT NULL DEFAULT 0, last_access integer, PRIMARY KEY (id))"
        if structure <> required:
            raise TypeError("the archive table does not have the required structure")
        return True

    def get_arch_size(self, path, filename):
        conn = self.connect_to_archive(path, filename)
        c = conn.cursor()
        c.execute("SELECT COUNT(*) FROM archive")
        res = c.fetchone()[0]
        conn.close()
        return res

    @staticmethod
    def save_record(conn, key, data):
        c = conn.cursor()
        datajson = json.dumps(data)
        c.execute("INSERT INTO archive (id, data, created) VALUES (?, ?, ?)",
                  (key, datajson, int(time.time())))
        conn.commit()

    # source archive splitting methods:
    def get_arch_numrows(self, filename):
        full_path = self.db_path + filename
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
        print "moving", rows, "rows from ", old_file, "to", new_file
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
        if not str.endswith(filename, ".db"):
            print "the source file does not seem to be an archive db file"
        print "copying the following source archive into working directory: ", source_arch_full_path
        self.copy_archive_file(source_arch_full_path)
        print "starting to split archive: ", source_arch_full_path

        orig_size = self.get_arch_numrows(DB_SOURCE_ARCH_NAME)
        print "original archive size: ", orig_size
        split_size = int(orig_size / number_of_archives)
        print "split archives size: ", split_size
        for i in range(0, number_of_archives - 1):
            oldest_time = self.get_oldest_row_time(DB_SOURCE_ARCH_NAME)
            print "oldest_time", oldest_time
            new_archive = self.archMan.create_new_arch(oldest_time)
            self.move_rows_to_new_archive(DB_SOURCE_ARCH_NAME, new_archive, split_size)
        oldest_time = self.get_oldest_row_time(DB_SOURCE_ARCH_NAME)
        last_arch_name = self.archMan.make_arch_name(oldest_time)
        os.rename(self.db_path + DB_SOURCE_ARCH_NAME, self.db_path + last_arch_name)

    # --------------
    # aux methods
    # --------------

    def print_all_archives(self):
        files = self.archMan.get_archives_list()
        for f in files:
            self.print_archive(f)

    @staticmethod
    def is_db_filename_valid(filename):
        """
        checks whether the provided filename has the required format, i.e. "conc_archive.any_user_text_w/o_dots.db"
        returns True if it is a valid archive db filename, otherwise False
        """
        parted = filename.split(".", 2)
        return len(parted) == 3 and parted[0] == ARCHIVE_PREFIX and parted[2] == "db"

    @staticmethod
    def delete_source_archive():
        if os.path.exists(DB_SOURCE_ARCH_PATH):
            print "deleting archive directory"
            import shutil
            shutil.rmtree(DB_SOURCE_ARCH_PATH)

    @staticmethod
    def create_source_archive(num_rows=20):
        """
        create a sample source file containing an "archive" table with the given number of rows
        """
        if not os.path.exists(DB_SOURCE_ARCH_PATH):
            os.makedirs(DB_SOURCE_ARCH_PATH)
            print "creating working directory:", DB_SOURCE_ARCH_PATH

        full_db_path = DB_SOURCE_ARCH_PATH + DB_SOURCE_ARCH_NAME
        if os.path.exists(full_db_path):
            print "source archive already exists: ", full_db_path
        else:
            print "creating database: ", full_db_path
            conn = sqlite3.connect(full_db_path)
            c = conn.cursor()
            # create the sqlite3 table called "archive" with the correct structure
            c.execute("CREATE TABLE archive ("
                      "id text, "
                      "data text NOT NULL, "
                      "created integer NOT NULL, "
                      "num_access integer NOT NULL DEFAULT 0, "
                      "last_access integer, "
                      "PRIMARY KEY (id))")
            startTime = int(time.time())
            for i in range(0, num_rows):
                datajson = json.dumps('value' + str(i))
                c.execute("INSERT INTO archive (id, data, created) VALUES (?, ?, ?)",
                          ('key' + str(i), datajson, startTime + i))
            conn.commit()
            conn.close()

    def connect_to_archive(self, archive_name):
        """
        returns connection to specified archive
        """
        full_db_path = self.db_path + archive_name
        conn = sqlite3.connect(full_db_path)
        return conn

    def print_archive(self, archive_name):
        """
        prints all the rows in the specified archive file
        """
        print "-----"
        print "contents of archive: ", archive_name
        curs = self.connect_to_archive(archive_name).cursor()
        for row in curs.execute("SELECT * FROM archive ORDER BY created DESC"):
            print row
