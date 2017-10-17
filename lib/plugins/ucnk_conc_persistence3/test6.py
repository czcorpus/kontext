import json
import sqlite3
import time

from archive import ArchMan
from plugins.ucnk_conc_persistence3.archive_tools import ArchTools
from archive import DB_PATH

ar = ArchMan()
file_name = ar.get_current_archive_name()

full_path = DB_PATH+file_name
conn = sqlite3.connect(full_path)
curs = conn.cursor()
inserts = []

for i in range(0,5):
    inserts.append(('bkey'+str(i), json.dumps('val'+str(i)), time.time(),0))
conn.executemany('INSERT INTO archive (id, data, created, num_access) VALUES (?, ?, ?, ?)', inserts)
conn.commit()

for row in curs.execute("SELECT * FROM archive"):
    print row



