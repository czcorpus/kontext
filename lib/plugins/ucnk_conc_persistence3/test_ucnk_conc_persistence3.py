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

"""
Unittests for the ucnk_conc_persistence3 plugin
"""
import json
import sqlite3
import unittest
import time

import os

import archive
from mock_auth import MockAuth
from mock_redis import MockRedisCommon
from mock_redis import MockRedisDirect
from mock_redis import MockRedisPlugin
from plugins.ucnk_conc_persistence3 import ConcPersistence
from archive import ARCHIVE_PREFIX


class ConcTest(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(ConcTest, self).__init__(*args, **kwargs)

        self.mck_rds_cmn = MockRedisCommon()
        self.mock_redis_direct = MockRedisDirect(
            self.mck_rds_cmn.concordances, self.mck_rds_cmn.arch_queue)
        self.mock_redis_plugin = MockRedisPlugin(
            self.mck_rds_cmn.concordances, self.mck_rds_cmn.arch_queue)
        self.mock_auth = MockAuth()
        self.conc = ConcPersistence(None, self.mock_redis_plugin,
                                    self.mock_auth, '/tmp/test_dbs/', 100, 7, 10)
        self.source_arch_path = '/tmp/test_source/'  # used just for the aux methods for testing

    def setUp(self):
        self.mock_redis_direct.clear()
        self.conc.arch_man.clear_directory()

    # ----------------------------
    # test Archive Manager methods
    # ----------------------------

    def test_file_name(self):
        """
        test whether the filename creation and validation method
        """
        creation_time = 1508234400
        filename = self.conc.arch_man.make_arch_name(creation_time)
        correct = ARCHIVE_PREFIX + "." + \
            time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(creation_time)) + ".db"
        self.assertTrue(filename == correct and self.conc.arch_man.is_db_filename_valid(filename))

    # ----------------------------
    # test ConcPersistence methods
    # ----------------------------

    def test_db_store_open(self):
        """
        test the following scenario:
        store a value to the db and then search for it using the ConcPersistence store & open methods
        """
        test_val = "testvalue123"
        data_id = self.conc.store(1, dict(q=test_val))
        stored_val = self.conc.open(data_id).get('q')
        self.assertEqual(test_val, stored_val)

    def test_db_store_auth_user(self):
        """
        operations for anonymous users should not be added to the archive queue
        """
        test_val = "testvalue123"
        self.conc.store(0, dict(q=test_val))  # anonymous
        data_id_authenticated = self.conc.store(1, dict(q=test_val))  # authenticated
        arch_queue = self.mock_redis_direct.get_arch_queue()
        # strip the 'concordance:' prefix that is hardcoded in the mk_key method:
        archived_key = json.loads(arch_queue[0]).get('key')[12:]
        self.assertTrue(len(arch_queue) == 1 and archived_key == data_id_authenticated)

    def test_archivation(self):
        """
        store 20 operations as authenticated user and 20 operations as anonymous user
        run archivation
        check whether the operations got copied from the db to the archive
        """
        for i in range(0, 20):
            test_val = "auth_user" + str(i)
            self.conc.store(1, dict(q=test_val))
            test_val = "anonymous_user" + str(i)
            self.conc.store(0, dict(q=test_val))
        arch_rows_limit = 10
        # exceed the limit by archiving 11 rows, new archive is created afterwards
        archive._run(self.mock_redis_direct, '/tmp/test_dbs/', 11, False, arch_rows_limit, 1)
        # archive another 5 rows to the newly created archive
        archive._run(self.mock_redis_direct, '/tmp/test_dbs/', 5, False, arch_rows_limit, 1)
        curr_arch_size = self.conc.arch_man.get_arch_numrows(
            self.conc.arch_man.get_current_archive_name())
        arch_queue_size = len(self.mock_redis_direct.arch_queue)
        self.assertTrue(arch_queue_size == 4 and curr_arch_size == 5)

    def test_split_archive(self):
        """
        in an external directory, create a source archive containing 20 rows, split it into 3 archives
        check whether 3 archives exist in the working directory and contain correct total number of 20 rows
        and whether the "youngest" archive contains 8 rows
        """
        self.delete_source_archive()
        self.create_source_archive(20)
        full_source_path = self.source_arch_path + self.conc.arch_man.DEFAULT_SOURCE_ARCH_FILENAME
        self.conc.arch_man.split_archive(full_source_path, 3)
        arch_list = self.conc.arch_man.get_archives_list(self)
        total_files = 0
        total_rows = 0
        current_rows = 0
        for arch in reversed(arch_list):
            total_files += 1
            current_rows = self.conc.arch_man.get_arch_numrows(arch)
            total_rows += current_rows
        self.assertTrue(total_files == 3 and total_rows == 20 and current_rows == 8)

    def test_search_in_archive(self):
        """
        store 10 operations as auth user, archive them, delete them from "redis"
        check whether they can be found in the archives
        """
        key_val = []
        for i in range(0, 10):
            test_val = "value" + str(i)
            key_val.append([self.conc.store(1, dict(q=test_val)), test_val])

        arch_rows_limit = 30  # do not exceed archive rows limit
        archive._run(self.mock_redis_direct, '/tmp/test_dbs/', 10, False, arch_rows_limit)
        self.mock_redis_direct.clear()
        correct = True
        for i in key_val:
            if i[1] != self.conc.open(i[0]).get('q'):
                correct = False
        self.assertTrue(correct)

    def test_num_access(self):
        """
        store 10 operations as auth user, archive them, delete them from "redis" access the third row three times,
        access the fifth row five times check the num_access and last_access values (since the last_access can differ
        by 1 sec, only check that 8 rows contain NULL, i.e. do not check specific time value)
        """
        keys = []
        for i in range(0, 10):
            test_dict = {"q": "value" + str(i)}
            keys.append([self.conc.store(1, test_dict)])

        arch_rows_limit = 30  # do not exceed archive rows limit
        archive._run(self.mock_redis_direct, '/tmp/test_dbs/', 10, False, arch_rows_limit)
        self.mock_redis_direct.clear()

        for i in range(0, 3):
            self.conc.open(keys[2][0])
        for i in range(0, 5):
            self.conc.open(keys[4][0])
        conn = self.conc.arch_man.get_current_archive_conn()
        c = conn.cursor()
        res1 = c.execute("SELECT num_access, last_access FROM archive where id = ?",
                         (keys[2][0],)).fetchone()
        res2 = c.execute("SELECT num_access, last_access FROM archive where id = ?",
                         (keys[4][0],)).fetchone()
        res3 = c.execute("SELECT COUNT(*) FROM archive WHERE last_access IS NULL").fetchone()
        msg = ""
        if res1[0] != 3 or res2[0] != 5:
            msg += "incorrect num_access value "
        if res3[0] != 8:
            msg += "incorrect number of last_access values"
        self.assertTrue(res1[0] == 3 and res2[0] == 5 and res3[0] == 8, msg)

    def test_archiver_dry_run(self):
        """
        store 10 operations as auth user, try to archive them in dry run mode
        check the archive_queue, must contain the archived items
        """
        keys = []
        for i in range(0, 10):
            test_dict = {"q": "value" + str(i)}
            keys.append([self.conc.store(1, test_dict)])
        q_before = list(self.mock_redis_direct.get_arch_queue())  # ref by value
        c_before = list(self.mock_redis_direct.get_concordances())
        arch_rows_limit = 30  # do not exceed archive rows limit
        archive._run(self.mock_redis_direct, '/tmp/test_dbs/', 10, True, arch_rows_limit)
        q_after = self.mock_redis_direct.get_arch_queue()
        c_after = self.mock_redis_direct.get_concordances()
        self.assertTrue(q_before == q_after, "archive queues before and after dry run do not match")
        self.assertTrue(c_before == c_after, "concordances before and after dry run do not match")

    # -------------
    # aux methods
    # -------------
    def print_all_archives(self):
        files = self.conc.arch_man.get_archives_list()
        for f in files:
            self.print_archive(f)

    def delete_source_archive(self):
        if os.path.exists(self.source_arch_path):
            import shutil
            shutil.rmtree(self.source_arch_path)

    def create_source_archive(self, num_rows=20):
        """
        create a sample source file containing an "archive" table with the given number of rows
        """
        if not os.path.exists(self.source_arch_path):
            os.makedirs(self.source_arch_path)

        full_db_path = self.source_arch_path + self.conc.arch_man.DEFAULT_SOURCE_ARCH_FILENAME
        if not os.path.exists(full_db_path):
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
            start_time = int(time.time()) - 1000000
            for i in range(0, num_rows):
                datajson = json.dumps('value' + str(i))
                c.execute("INSERT INTO archive (id, data, created) VALUES (?, ?, ?)",
                          ('key' + str(i), datajson, start_time + i))
            conn.commit()
            conn.close()

    def print_archive(self, archive_name):
        """
        prints all the rows in the specified archive file
        """
        print "-----"
        print "contents of archive: ", archive_name
        curs = self.conc.arch_man.connect_to_archive(archive_name).cursor()
        for row in curs.execute("SELECT * FROM archive ORDER BY created DESC"):
            print row


if __name__ == '__main__':
    unittest.main()
