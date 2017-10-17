import json
import unittest

import time

from plugins.ucnk_conc_persistence3 import ConcPersistence
from mock_redis import MockRedis
from mock_auth import MockAuth
from archive_tools import ArchTools


class ConcTest(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(ConcTest, self).__init__(*args, **kwargs)

        self.mockRedis = MockRedis()
        self.mockAuth = MockAuth()
        self.conc = ConcPersistence(None, self.mockRedis, self.mockAuth, '/tmp/test_dbs/')
        self.tools = ArchTools()

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
        store 10 operations as authenticated user and 10 operations as anonymous user
        run archivation
        check whether the operations got moved from the db to the archive
        """
        pass

    def test_creating_new_archive(self):
        """
        exceed the limit for creating a new archive, check whether a new one is created after archivation
        """
        pass

if __name__ == '__main__':
    unittest.main()
