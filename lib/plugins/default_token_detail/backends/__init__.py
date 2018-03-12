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

import httplib
import sqlite3
import time
import zlib
from functools import wraps
from hashlib import md5

from plugins.abstract.token_detail import AbstractBackend


def mk_token_detail_cache_key(word, lemma, pos, aligned_corpora, lang, backend_cls):
    """
    Returns a hashed cache key based on the passed parameters.
    """
    return md5('%r%r%r%r%r%r' % (word, lemma, pos, aligned_corpora, lang, backend_cls)).hexdigest()


def cached(f):
    """
    A decorator which tries to look for a key in cache before
    actual storage is invoked. If cache miss in encountered
    then the value is stored to the cache to be available next
    time.
    """

    @wraps(f)
    def wrapper(self, word, lemma, pos, aligned_corpora, lang):
        """
        get full path to the cache_db_file using a method defined in the abstract class that reads the value from
        kontext's config.xml; if the cache path is not defined, do not use caching:
        """
        cache_path = self.get_cache_path()
        if cache_path:
            key = mk_token_detail_cache_key(
                word, lemma, pos, aligned_corpora, lang, self.get_provider_id())
            conn = sqlite3.connect(cache_path)
            curs = conn.cursor()
            res = curs.execute("SELECT data, found FROM cache WHERE key = ?", (key,)).fetchone()
            # if no result is found in the cache, call the backend function
            if res is None:
                res = f(self, word, lemma, pos, aligned_corpora, lang)
                # if a result is returned by the backend function, encode and zip its data part and store it in
                # the cache along with the "found" parameter
                if res:
                    zipped = buffer(zlib.compress(res[0].encode('utf-8')))
                    curs.execute("INSERT INTO cache (key, data, found, last_access) VALUES (?,?,?,?)",
                                 (key, zipped, 1 if res[1] else 0, int(round(time.time()))))
            else:
                # unzip and decode the cached result, convert the "found" parameter value back to boolean
                res = [zlib.decompress(res[0]).decode('utf-8'), res[1] == 1]
                # update last access
                curs.execute("UPDATE cache SET last_access = ? WHERE key = ?",
                             (int(round(time.time())), key))
            conn.commit()
            conn.close()
        else:
            res = f(self, word, lemma, pos, aligned_corpora, lang)
        return res if res else ('', False)

    return wrapper


class SQLite3Backend(AbstractBackend):
    def __init__(self, conf, ident):
        super(SQLite3Backend, self).__init__(ident)
        self._db = sqlite3.connect(conf['path'])
        self._query_tpl = conf['query']

    @cached
    def fetch_data(self, word, lemma, pos, aligned_corpora, lang):
        cur = self._db.cursor()
        cur.execute(self._query_tpl, (word, lemma, pos))
        ans = cur.fetchone()
        if ans:
            return ans[0], True
        else:
            return '', False


class HTTPBackend(AbstractBackend):
    def __init__(self, conf, ident):
        super(HTTPBackend, self).__init__(ident)
        self._conf = conf

    @staticmethod
    def _is_valid_response(response):
        return response and (200 <= response.status < 300 or 400 <= response.status < 500)

    @staticmethod
    def _is_found(response):
        return 200 <= response.status < 300

    @cached
    def fetch_data(self, word, lemma, pos, aligned_corpora, lang):
        if self._conf['ssl']:
            connection = httplib.HTTPSConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)
        else:
            connection = httplib.HTTPConnection(
                self._conf['server'], port=self._conf['port'], timeout=15)
        try:
            al_corpus = aligned_corpora[0] if len(aligned_corpora) > 0 else ''
            args = dict(word=word, lemma=lemma, pos=pos, ui_lang=lang, other_lang=al_corpus)
            connection.request('GET', self._conf['path'].encode('utf-8').format(**args))
            response = connection.getresponse()
            if self._is_valid_response(response):
                return response.read().decode('utf-8'), self._is_found(response)
            else:
                raise Exception('Failed to load the data - error {0}'.format(response.status))
        finally:
            connection.close()
