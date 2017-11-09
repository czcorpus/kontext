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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import os
import sqlite3
import time

import zlib

import settings


class CacheMan(object):
    def __init__(self):
        conf_path = os.path.realpath(os.path.join(os.path.dirname(__file__), '../../../conf/config.xml'))
        settings.load(conf_path)
        conf = settings.get('plugins', 'token_detail')
        self.cache_path = conf.get('default:cache_db_path')
        self.cache_ttl = int(conf.get('default:cache_ttl_days')) * 24 * 60 * 60
        self.cache_rows_limit = int(conf.get('default:cache_rows_limit'))

    def prepare_cache(self):
        db_dir = os.path.dirname(self.cache_path)
        if not os.path.exists(db_dir):
            os.mkdir(db_dir)
        os.remove(self.cache_path )
        conn = sqlite3.connect(self.cache_path )
        c = conn.cursor()
        c.execute("CREATE TABLE IF NOT EXISTS cache ("
                  "key text, "
                  "data text, "
                  "created integer NOT NULL, "
                  "PRIMARY KEY (key))")
        conn.commit()
        conn.close()

    def clear_expired(self):
        """
        delete all items older then ttl
        """
        expired_time = int(time.time()) - self.cache_ttl
        print "ttl: ", self.cache_ttl, "expired: ",expired_time
        conn = sqlite3.connect(self.cache_path)
        c = conn.cursor()
        c.execute("DELETE FROM cache WHERE created <= ?", (str(time.time() - self.cache_ttl),))
        conn.commit()
        conn.close()

    def clear_extra_rows(self):
        """
        delete the oldest rows so that the cache table contains no more than <cache_rows_limit> rows
        """
        print "rows limit: ", self.cache_rows_limit
        conn = sqlite3.connect(self.cache_path)
        c = conn.cursor()
        c.execute("DELETE FROM cache WHERE key NOT IN (SELECT key FROM cache ORDER BY created DESC LIMIT ?)", (self.cache_rows_limit,))
        conn.commit()
        conn.close()

    def get_numrows(self):
        conn = sqlite3.connect(self.cache_path)
        c = conn.cursor()
        res = c.execute("SELECT COUNT(*) AS POCET FROM cache").fetchone()
        conn.close()
        return res

    # -----------
    # aux methods
    # -----------
    def list_cached(self):
        print "--- cache contents: ---"
        conn = sqlite3.connect(self.cache_path)
        c = conn.cursor()
        for row in c.execute("SELECT * FROM cache"):
            print row
        conn.close()
        print "------"

    def fill_cache(self):
        conn = sqlite3.connect(self.cache_path )
        c = conn.cursor()
        for i in range(0,10):
            c.execute("INSERT INTO cache VALUES (?, ?, ?)", (i, i, i))
        conn.commit()
        conn.close()

    def get_specific_row(self, key):
        conn = sqlite3.connect(self.cache_path)
        c = conn.cursor()
        res = c.execute("SELECT data FROM cache WHERE key = ?", (key,)).fetchone()
        conn.close()
        return res
