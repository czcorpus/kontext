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

import logging
import time
import unittest

from plugins.default_token_connect import DefaultTokenConnect, init_provider
from plugins.default_token_connect.backends.cache import mk_token_connect_cache_key
from plugins.default_token_connect.cache_man import CacheMan

logging.basicConfig()


CACHE_DB_PATH = '/tmp/kontext_mock_tckc.sqlite3'


class MockAttr(object):

    def __init__(self, attr_mapping):
        self._attr_mapping = attr_mapping

    def pos2str(self, posid):
        return self._attr_mapping.get(posid, '')


class MockCorpus(object):

    def __init__(self, attr_mapping=None):
        self._attr_mapping = attr_mapping if attr_mapping is not None else {}

    def get_attr(self, attr):
        return MockAttr(self._attr_mapping)

    def get_conf(self, v):
        if v == 'ENCODING':
            return 'UTF-8'
        return None


class CacheTest(unittest.TestCase):
    def __init__(self, *args, **kwargs):
        super(CacheTest, self).__init__(*args, **kwargs)
        corparch = None

        mocked_json = [{
            'ident': 'wiktionary_for_ic_9_en',
            'heading': {'en_US': 'Wiktionary', 'cs_CZ': 'Wiktionary'},
            'backend': 'plugins.default_token_connect.mock_http_backend.MockHTTPBackend',
            'frontend': 'plugins.default_token_connect.frontends.RawHtmlFrontend',
            'conf':
                {
                    'server': 'en.wiktionary.org',
                    'path': '/w/index.php?title={lemma}&action=render',
                    'ssl': True,
                    'port': 443,
                    'posAttrs': ['lemma']
            }
        }]

        providers_conf = mocked_json
        self.tok_det = DefaultTokenConnect(dict((b['ident'], init_provider(b, b['ident'])) for b in providers_conf),
                                           corparch)
        self.cache_path = CACHE_DB_PATH
        self.cache_man = CacheMan(self.cache_path)
        self.tok_det.set_cache_path(self.cache_path)

    def setUp(self):
        """
        create an empty cache db file with properly structured table
        """
        self.cache_man.prepare_cache()

    def tearDown(self):
        self.cache_man.close()

    def raise_exc(self):
        self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], 'corpora',
                                dict(lemma=u"exception"), 1, 1, 'lang')

    def test_get_path(self):
        """
        check whether the cache path set above using set_cache_path is returned using get_cache_path
        """
        self.assertEqual(self.cache_man.get_cache_path(), self.cache_path)

    def test_cache_item(self):
        """
        fetch two items from http backend, check whether they get stored in cache by checking number of rows
        """
        mc = MockCorpus({1: u'lemma1', 2: u'lemma2'})
        self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 1, 1, 'lang')
        self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 2, 1, 'lang')
        self.assertEqual(self.cache_man.get_numrows(), 2)

    def test_retrieve_cached_item(self):
        """
        fetch two items from http backend, they should be cached
        then fetch the same two items again and check whether they are retrieved correctly from cache
        and that the cache contains only two items
        """
        mc = MockCorpus({1: u'lemma1', 2: u'lemma2'})
        orig1 = self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 1, 1, 'lang')
        orig2 = self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 2, 1, 'lang')

        cached1 = self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 1, 1, 'lang')
        cached2 = self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 2, 1, 'lang')
        self.assertEqual(self.cache_man.get_numrows(), 2)
        self.assertEqual(orig1, cached1)
        self.assertEqual(orig2, cached2)

    def test_last_access(self):
        """
        fetch two items from http backend to cache them, get their last access value from cache
        then fetch the same two items again after a time interval and check whether the last access values changed
        """
        mc = MockCorpus({237: u'lemma1', 238: u'lemma2'})
        key1 = mk_token_connect_cache_key('wiktionary_for_ic_9_en', ['corpora'], 237, 1, dict(lemma=u'lemma1'), 'lang')
        key2 = mk_token_connect_cache_key("wiktionary_for_ic_9_en", ['corpora'], 238, 1, dict(lemma=u'lemma2'), 'lang')
        self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 237, 1, 'lang')
        self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 238, 1, 'lang')
        la1bef = self.get_last_access(key1)
        la2bef = self.get_last_access(key2)
        time.sleep(1)
        self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 237, 1, 'lang')
        time.sleep(1)
        self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 238, 1, 'lang')
        la1aft = self.get_last_access(key1)
        la2aft = self.get_last_access(key2)
        self.assertNotEqual(la1bef, la1aft)
        self.assertNotEqual(la2bef, la2aft)

    def test_clear_cache(self):
        """
        fill the cache db with excessive number of rows, run cache maintenance, check whether size was decreased
        to the limit
        """
        limit = 5
        self.fill_cache(limit + 10)
        self.cache_man.clear_extra_rows(limit)
        self.assertEqual(self.cache_man.get_numrows(), limit)

    def test_unicode(self):
        """
        cache a unicode encoded string, check whether it gets returned correctly
        the unicode-encoded result is returned from the mocked backend when searching for lemma "unicode"
        """
        mc = MockCorpus({1: u'unicode'})
        orig1 = self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 1, 1, 'lang')

        cached1 = self.tok_det.fetch_data([('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 1, 1, 'lang')
        self.assertEqual(orig1, cached1)

    def test_status_true_false(self):
        """
        cache a "found" and a "not-found" result returned by the mocked backend, check whether
        the "found" / "not-found" information gets cached and retrieved correctly
        """
        mc = MockCorpus()
        _, orig1 = self.tok_det.fetch_data(
            [('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 1, 1, 'lang')
        _, cached1 = self.tok_det.fetch_data(
            [('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 1, 1, 'lang')
        _, orig2 = self.tok_det.fetch_data(
            [('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 2, 1, 'lang')
        _, cached2 = self.tok_det.fetch_data(
            [('wiktionary_for_ic_9_en', False)], mc, ['corpora'], 2, 1, 'lang')
        self.assertEqual(orig1[0].get('contents')[0][1][1],
                         cached1[0].get('contents')[0][1][1], False)
        self.assertEqual(orig2[0].get('contents')[0][1][1],
                         cached2[0].get('contents')[0][1][1], True)

    def test_backend_exception(self):
        self.assertRaises(Exception, self.raise_exc)

    # -----------
    # aux methods
    # -----------
    def list_cached(self):
        print "--- cache contents: ---"
        conn = self.cache_man.conn
        c = conn.cursor()
        for row in c.execute("SELECT * FROM cache"):
            print row
        print "------"

    def fill_cache(self, numrows=10):
        conn = self.cache_man.conn
        c = conn.cursor()
        for i in range(0, numrows):
            c.execute("INSERT INTO cache VALUES (?, ?, ?, ?, ?)", (i, 'some-provider', i, True, i))
        conn.commit()

    def get_specific_row(self, key):
        conn = self.cache_man.conn
        c = conn.cursor()
        res = c.execute("SELECT data FROM cache WHERE key = ?", (key,)).fetchone()
        return res

    def get_last_access(self, key):
        conn = self.cache_man.conn
        c = conn.cursor()
        last_access = c.execute("SELECT last_access FROM cache WHERE key = ?", (key,)).fetchone()
        if last_access:
            return last_access[0]
        else:
            return 0


if __name__ == '__main__':
    unittest.main()
