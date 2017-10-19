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
import unittest

import archive
from archive_tools import ArchTools
from mock_auth import MockAuth
from mock_redis import MockRedis
from plugins.ucnk_conc_persistence3 import ConcPersistence


def redis_connection(host, port, db_id):
    """
    Creates a connection to a Redis instance
    """
    return MockRedis()


archive.redis_connection = redis_connection


class ConcTest(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(ConcTest, self).__init__(*args, **kwargs)

        self.mockRedis = MockRedis()
        self.mockAuth = MockAuth()
        self.conc = ConcPersistence(None, self.mockRedis, self.mockAuth, '/tmp/test_dbs/', 100, 7, 10)
        self.tools = ArchTools('/tmp/test_dbs/')

    def setUp(self):
        self.mockRedis.clear()
        self.tools.clear_directory()

    # ----------------------------
    # test Archive Manager methods
    # ----------------------------

    def test_file_name(self):
        """
        test whether the filename creation and validation method
        """
        filename = self.conc.archMan.make_arch_name(1508234400)
        self.assertTrue(filename == 'conc_archive.2017-10-17T12:00:00.db'
                        and self.conc.archMan.is_db_filename_valid(filename))

    def test_archive_creation(self):
        pass

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
        stored_val = (json.loads(self.conc.open(data_id))).get('q')
        self.assertEqual(test_val, stored_val)

    def test_db_store_auth_user(self):
        """
        operations for anonymous users should not be added to the archive queue
        """
        test_val = "testvalue123"
        self.conc.store(0, dict(q=test_val))  # anonymous
        data_id_authenticated = self.conc.store(1, dict(q=test_val))  # authenticated
        arch_queue = self.mockRedis.get_arch_queue()
        # strip the 'concordance:' prefix that is hardcoded in the mk_key method:
        archived_key = arch_queue[0].get('key')[12:]
        self.assertTrue(len(arch_queue) == 1 and archived_key == data_id_authenticated)

    def test_archivation(self):
        """
        store 20 operations as authenticated user and 20 operations as anonymous user
        run archivation
        check whether the operations got moved from the db to the archive
        """

        for i in range(0, 20):
            test_val = "auth_user" + str(i)
            self.conc.store(1, dict(q=test_val))
            test_val = "anonymous_user" + str(i)
            self.conc.store(0, dict(q=test_val))
        archive._run(self.mockRedis, '/tmp/test_dbs/', 11, False)
        archive._run(self.mockRedis, '/tmp/test_dbs/', 5, False)
        curr_arch_size = self.tools.get_arch_numrows(self.conc.archMan.get_current_archive_name())
        arch_queue_size = len(self.mockRedis.arch_queue)
        self.assertTrue(arch_queue_size == 4 and curr_arch_size == 5)


    def test_creating_new_archive(self):
        """
        exceed the limit for creating a new archive, check whether a new one is created after archivation
        """
        pass

    def test_export_actions(self):
        """
        TO-DO: definitely test the concPers.export_actions method
        """
        pass


if __name__ == '__main__':
    unittest.main()
