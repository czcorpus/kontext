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


class CacheMan(object):
    def __init__(self, cache_path, cache_rows_limit, cache_ttl_days):
        self.cache_path = cache_path
        self.cache_rows_limit = cache_rows_limit
        self.cache_ttl = cache_ttl_days * 24 * 60 * 60

    def prepare_cache(self):
        """
        create cache path directory if it does not exist yet
        delete the existing cache file (if any) and create an empty one with the required table structure
        """
        db_dir = os.path.dirname(self.cache_path)
        if not os.path.exists(db_dir):
            os.mkdir(db_dir)
        if os.path.isfile(self.cache_path):
            os.remove(self.cache_path)
        conn = sqlite3.connect(self.cache_path)
        c = conn.cursor()
        c.execute("CREATE TABLE IF NOT EXISTS cache ("
                  "key text, "
                  "data blob, "
                  "last_access integer NOT NULL, "
                  "PRIMARY KEY (key))")
        conn.commit()
        conn.close()

    def clear_expired(self):
        """
        delete all items older then ttl
        """
        conn = sqlite3.connect(self.cache_path)
        c = conn.cursor()
        c.execute("DELETE FROM cache WHERE last_access <= ?", (time.time() - self.cache_ttl,))
        conn.commit()
        conn.close()

    def clear_extra_rows(self):
        """
        delete the oldest rows so that the cache table contains no more than <cache_rows_limit> rows
        """
        conn = sqlite3.connect(self.cache_path)
        c = conn.cursor()
        c.execute("DELETE FROM cache WHERE key NOT IN (SELECT key FROM cache ORDER BY last_access DESC LIMIT ?)",
                  (self.cache_rows_limit,))
        conn.commit()
        conn.close()

    def get_numrows(self):
        conn = sqlite3.connect(self.cache_path)
        c = conn.cursor()
        res = c.execute("SELECT COUNT(*) FROM cache").fetchone()
        conn.close()
        return res[0]

    def get_rows_limit(self):
        return self.cache_rows_limit

    def get_cache_path(self):
        return self.cache_path
