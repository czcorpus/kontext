import json
import os

from archive_tools import ArchTools
from mock_redis import MockRedis
from mock_auth import MockAuth

from archive_tools import DB_SOURCE_ARCH_PATH
from archive_tools import DB_SOURCE_ARCH_NAME
from plugins.ucnk_conc_persistence3 import ConcPersistence

db_path = '/tmp/test_dbs/'
myTools = ArchTools(db_path)
myTools.clear_directory()
myTools.delete_source_archive()
myTools.create_source_archive(20)
source_arch_path = os.path.join(DB_SOURCE_ARCH_PATH, DB_SOURCE_ARCH_NAME)
myTools.copy_archive_file(source_arch_path)
myTools.split_archive(source_arch_path, 3)

mockRedis = MockRedis()
mockAuth = MockAuth()
myConc = ConcPersistence(None, mockRedis, mockAuth, '/tmp/test_dbs/', 100, 7, 10)
queryIds = []
for i in range(0, 10):
    queryIds.append(myConc.store(1, dict(q='value' + str(i))))

myTools.print_all_archives()
mockRedis.print_concordances()
mockRedis.print_arch_queue()
firstKey = mockRedis.get_first_key()
print firstKey
print firstKey[12:]
print myConc.open(firstKey[12:])

print ("queryIds:")
for query in queryIds:
    print query
    val = (json.loads(myConc.open(query))).get('q')
    print val
