"""
The archive directory must only contain archive database files - ok?
Otherwise file names must be checked for the required pattern - would be nice to have
If the archive directory does not exist, it gets created
The required format of the db names is:
conc_archive.yyyy-mm-ddTHH:MM:ss.db
"""

import os
import datetime
import sqlite3
import time
import json
import redis

import settings
from archive import ARCHIVE_PREFIX

# for the time being, let's create the archives in a subdirectory of the current working dir
# in production, this will be replaced by a config value
# db_path = os.getcwd() + '/test_dbs/'
import sys

db_path = '/tmp/test_dbs/'
archive_size_limit = 20

# in case the test directory does not exist, create it:
if not os.path.exists(db_path):
    os.makedirs(db_path)


# an array to read db file names into
# db_list_name = "db_list"

# declare auxiliary methods
def print_directory_contents(path):
    print 'directory path: ', path
    print 'directory contents: '
    for f in sorted(os.listdir(path), reverse=True):
        print f


def clear_directory(path):
    for f in sorted(os.listdir(path)):
        print "deleting file: ", f
        os.remove(path + f)


def print_db_rows(path):
    for f in sorted(os.listdir(path), reverse=True):
        full_db_path = path + f
        conn = sqlite3.connect(full_db_path)
        print "trying to read from db name: ", full_db_path
        c = conn.cursor()
        for row in c.execute("SELECT * FROM archive"):
            print row


def is_dir_empty(path):
    """
    check whether the archive directory is empty
    """
    return len(sorted(os.listdir(path))) == 0



def get_curr_arch_size(path):
    conn = connect_to_curr_arch(path)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM archive")
    res = c.fetchone()[0]
    conn.close()
    return res


def get_arch_size(path, filename):
    conn = connect_to_archive(path, filename)
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM archive")
    res = c.fetchone()[0]
    conn.close()
    return res


def get_archives_list(path):
    file_list = sorted(os.listdir(path), reverse=True)
    if len(file_list):
        return file_list
    else:
        raise NameError('No db file exists in the specified archive location')


def get_curr_arch_name(path):
    return get_archives_list(path)[0]


def save_record(path, key, data):
    if get_curr_arch_size(path) >= archive_size_limit:
        create_new_db(path)
    conn = connect_to_curr_arch(path)
    c = conn.cursor()
    datajson = json.dumps(data)
    c.execute("INSERT INTO archive (id, data, created) VALUES (?, ?, ?)",
              (key, datajson, int(time.time())))
    conn.commit()
    conn.close()


def connect_to_curr_arch(path):
    curr_db = get_curr_arch_name(path)
    return connect_to_archive(path, curr_db)


def connect_to_archive(path, archive_name):
    full_db_path = path + archive_name
    # print "connecting to database: ", full_db_path
    # create the dbfile by trying to access it
    conn = sqlite3.connect(full_db_path)
    return conn


def search_archive(path, archive_name, key):
    conn = connect_to_archive(path, archive_name)
    c = conn.cursor()
    c.execute("SELECT data FROM archive WHERE id = ?", (key,))
    res = c.fetchone()
    if res is not None:
        # TO-DO: try in case db is locked, sql error?
        c.execute("UPDATE archive SET num_access = num_access + 1, last_access = ? WHERE id = ?",
                  (int(time.time()), key))
        conn.commit()
        return res[0]
    else:
        return None


def search_archives(path, key):
    archives = get_archives_list(path)
    for i in range(0, len(archives)):
        res = search_archive(path, archives[i], key)
        if res is not None:
            return res
    return None


"""
# start execution
print "clear archive directory:"
clear_directory(db_path)
print "-----"
print "check whether archive dir is empty: ", is_dir_empty(db_path)
print "if empty, create first db file:"
if is_dir_empty(db_path):
    create_new_db(db_path)
print "-----"
print "create another 3 db files by inserting 11 values"
for i in range(0, 10):
    save_record(db_path, "key" + str(i), "value" + str(i))
print "-----"
print "current archive name (should be the last one created): ", get_curr_arch_name(db_path)
print "current archive size (should be 2): ", get_curr_arch_size(db_path)
print "-----"
print "search for key5, should return value5"
print search_archives(db_path, "key5")
print "-----"
print "print all archives contents (key5 should have num_access = 1 and last_access = some time value, not None:"
print_db_rows(db_path)

"""


# -----------------
# new methods
# -----------------
"""
def create_named_db(path, db_name):
    # the path param should be replaced by the config value
    # time_string = datetime.datetime.now().replace(microsecond=0).isoformat()
    full_db_path = path + db_name
    print "creating database: ", db_name
    # create the dbfile by trying to access it
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
    conn.commit()
    conn.close()
"""

def print_archives_list(path):
    file_list = sorted(os.listdir(path), reverse=True)
    if len(file_list):
        for archive in file_list:
            print "filename: ", archive, ", no. of records: ", get_arch_size(path, archive)




def _is_archive_correct(path, filename):
    conn = connect_to_archive(path, filename)
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
        error = "the archive table does not have the correct structure"
        error += "\ncorrect structure: " + required
        error += "\narchive structure: " + structure
        raise TypeError(error)
    return True


def get_oldest_row_time(path, filename):
    """
    returns the epoch time of the oldest row in the provided filename db archive
    """
    conn = connect_to_archive(path, filename)
    cur = conn.cursor()
    sql = 'SELECT created FROM archive ORDER BY created DESC LIMIT 1;'
    return cur.execute(sql).fetchone()[0]


os.remove(db_path + "conc_archive.2017-10-10T11:02:47.db")
print "current archives in the path:"
print_archives_list(db_path)
print "-------"
# print_db_rows(db_path)
original = "test_orig.db"
print "_is_archive_correct:", _is_archive_correct(db_path, original)
oldest = get_oldest_row_time(db_path, original)
isoDate = datetime.datetime.fromtimestamp(oldest).strftime('%Y-%m-%dT%H:%M:%S');
newFilename = ARCHIVE_PREFIX + isoDate + '.db'
print "date of oldest row:", isoDate, ", new filename:", newFilename




number_of_archives = 3
path = db_path
filename = original
print "splitting archive: ", path, filename
if not _is_archive_correct:
    print "the file does not seem to be a valid archive db file"

orig_size = get_arch_size(path, filename)
print "original archive size: ", orig_size
split_size = int(orig_size / number_of_archives)
print "split archives size: ", split_size
old_conn = connect_to_archive(db_path, original)
new_conn = connect_to_archive(db_path, create_new_db(oldest))
move_rows_to_new_archive(old_conn, new_conn, 10)
print "----- new archive ------"
for new_row in new_conn.execute("SELECT * FROM archive ORDER BY id DESC;"):
    print new_row
