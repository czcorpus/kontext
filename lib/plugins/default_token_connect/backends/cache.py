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

import time
import zlib
import logging
import sqlite3
from functools import wraps
from hashlib import md5


def mk_token_connect_cache_key(provider_id, corpora, lang, query_args):
    """
    Returns a hashed cache key based on the passed parameters.
    """
    args = sorted(query_args.items(), key=lambda x: x[0])
    return md5('%r%r%r%r' % (provider_id, corpora, lang, args)).hexdigest()


def cached(f):
    """
    A decorator which tries to look for a key in cache before
    actual storage is invoked. If cache miss in encountered
    then the value is stored to the cache to be available next
    time.
    """

    @wraps(f)
    def wrapper(self, corpora, lang, query_args):
        """
        get full path to the cache_db_file using a method defined in the abstract class that reads the value from
        kontext's config.xml; if the cache path is not defined, do not use caching:
        """
        cache_path = self.get_cache_path()
        if cache_path:
            key = mk_token_connect_cache_key(self.provider_id, corpora, lang, query_args)
            with sqlite3.connect(cache_path) as conn:
                res = conn.execute('PRAGMA journal_mode=WAL').fetchone()
                imode = res[0] if res else 'undefined'
                if imode != 'wal':
                    logging.getLogger(__name__).warning(
                        'Unable to set WAL mode for SQLite. Actual mode: {0}'.format(imode))
                curs = conn.cursor()
                res = curs.execute("SELECT data, found FROM cache WHERE key = ?", (key,)).fetchone()
                # if no result is found in the cache, call the backend function
                if res is None:
                    res = f(self, corpora, lang, query_args)
                    # if a result is returned by the backend function, encode and zip its data part and store it in
                    # the cache along with the "found" parameter
                    if res:
                        zipped = buffer(zlib.compress(res[0].encode('utf-8')))
                        curs.execute(
                            "INSERT INTO cache (key, provider, data, found, last_access) VALUES (?, ?, ?, ?, ?)",
                            (key, self.provider_id, zipped, 1 if res[1] else 0, int(round(time.time()))))
                else:
                    logging.getLogger(__name__).debug(u'token/kwic_connect cache hit {0} for args {1}'.format(
                        key[:6], query_args))
                    # unzip and decode the cached result, convert the "found" parameter value back to boolean
                    res = [zlib.decompress(res[0]).decode('utf-8'), res[1] == 1]
                    # update last access
                    curs.execute("UPDATE cache SET last_access = ? WHERE key = ?",
                                 (int(round(time.time())), key))
                curs.close()
                # commited automatically via context manager
        else:
            res = f(self, corpora, lang, query_args)
        return res if res else ('', False)

    return wrapper
