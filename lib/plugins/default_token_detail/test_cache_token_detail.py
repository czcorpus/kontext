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

import sqlite3
import unittest

from plugins.default_token_detail import DefaultTokenDetail, init_provider
from plugins.default_token_detail.cache_man import CacheMan


class CacheTest(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(CacheTest, self).__init__(*args, **kwargs)
        corparch = None

        mocked_json = [{"ident": "wiktionary_for_ic_9_en", "heading": {"en_US": "Wiktionary", "cs_CZ": "Wiktionary"},
                        "backend": "plugins.default_token_detail.mock_http_backend.HTTPBackend",
                        "frontend": "plugins.default_token_detail.frontends.RawHtmlFrontend",
                        "conf": {"server": "en.wiktionary.org", "path": "/w/index.php?title={lemma}&action=render",
                                 "ssl": True, "port": 443}}]

        providers_conf = mocked_json

        self.tok_det = DefaultTokenDetail(dict((b['ident'], init_provider(b)) for b in providers_conf), corparch)
        self.cache_path = '/tmp/token_cache/token_detail_cache.db'
        cache_rows_limit = 10
        cache_ttl_days = 7
        self.cacheMan = CacheMan(self.cache_path, cache_rows_limit, cache_ttl_days)
        self.tok_det.set_cache_path(self.cache_path)

    def setUp(self):
        """
        create an empty cache db file with properly structured table
        """
        self.cacheMan.prepare_cache()

    def test_get_path(self):
        """
        check whether the cache path set above using set_cache_path is returned using get_cache_path
        """
        self.assertEqual(self.cacheMan.get_cache_path(), self.cache_path)

    def test_cache_an_item(self):
        """
        fetch two items from http backend, check whether they get stored in cache by checking number of rows
        """
        self.tok_det.fetch_data(['wiktionary_for_ic_9_en'], "word", "lemma", "pos", "aligned_corpora", "lang")
        self.tok_det.fetch_data(['wiktionary_for_ic_9_en'], "word", "position", "pos", "aligned_corpora", "lang")
        self.assertEqual(self.cacheMan.get_numrows(), 2)

    def test_clear_cache(self):
        """
        fill the cache db with excessive number of rows, run cache maintenance, check whether size was decreased
        to the limit
        """
        limit = self.cacheMan.get_rows_limit()
        self.fill_cache(limit + 10)
        self.cacheMan.clear_extra_rows()
        self.assertEqual(self.cacheMan.get_numrows(), limit)

    # -----------
    # aux methods
    # -----------
    def list_cached(self):
        print "--- cache contents: ---"
        conn = sqlite3.connect(self.cacheMan.get_cache_path())
        c = conn.cursor()
        for row in c.execute("SELECT * FROM cache"):
            print row
        conn.close()
        print "------"

    def fill_cache(self, numrows=10):
        conn = sqlite3.connect(self.cacheMan.get_cache_path())
        c = conn.cursor()
        for i in range(0, numrows):
            c.execute("INSERT INTO cache VALUES (?, ?, ?)", (i, i, i))
        conn.commit()
        conn.close()

    def get_specific_row(self, key):
        conn = sqlite3.connect(self.cacheMan.get_cache_path())
        c = conn.cursor()
        res = c.execute("SELECT data FROM cache WHERE key = ?", (key,)).fetchone()
        conn.close()
        return res


if __name__ == '__main__':
    unittest.main()
