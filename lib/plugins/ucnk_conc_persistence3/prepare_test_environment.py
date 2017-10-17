import json
import time

# from archive import ArchMan

from archive_tools import ArchTools
#from tooling import EmulateDb
from mock_redis import MockRedis
from mock_auth import MockAuth

from archive import DB_SOURCE_ARCH_PATH
from archive import DB_SOURCE_ARCH_NAME
from plugins.ucnk_conc_persistence3 import ConcPersistence
from plugins.ucnk_conc_persistence3 import mk_key

ArchTools.delete_source_archive()
ArchTools.clear_directory()
# ArchTools.create_source_archive(20)
myTools = ArchTools()
"""
myTools.copy_archive_file()
myTools.split_archive(DB_SOURCE_ARCH_PATH, DB_SOURCE_ARCH_NAME, 3)
"""


#myDb = EmulateDb()
mockRedis = MockRedis()
mockAuth = MockAuth()
myConc = ConcPersistence(None, mockRedis, mockAuth, '/tmp/test_dbs/')
queryIds = []
for i in range(0,10):
    queryIds.append(myConc.store(1, dict(q='value'+str(i))))
#print myConc.open("key9")

myTools.print_all_archives()
mockRedis.print_concordances()
mockRedis.print_arch_queue()
firstKey=mockRedis.get_first_key()
print firstKey
print firstKey[12:]
print myConc.open(firstKey[12:])

print ("queryIds:")
for id in queryIds:
    print id
    val= (json.loads(myConc.open(id))).get('q')
    print val