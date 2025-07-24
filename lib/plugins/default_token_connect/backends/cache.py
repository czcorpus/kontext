# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

from functools import wraps
from hashlib import md5

from plugin_types.general_storage import KeyValueStorage


def mk_token_connect_hash(corpora, token_id, num_tokens, query_args, lang, context=None, cookies=None):
    """
    Returns a hashed cache key based on the passed parameters.
    """
    args = []
    for x, y in sorted(list(query_args.items()), key=lambda x: x[0]):
        if type(y) is dict:
            args.append((x, sorted([(x2, y2) for x2, y2 in list(y.items())], key=lambda x: x[0])))
        else:
            args.append((x, y))
    return md5(f'{corpora}{token_id}{num_tokens}{args}{lang}{context}{cookies}'.encode('utf-8')).hexdigest()


def mk_token_connect_cache_key(provider_id, corpora, token_id, num_tokens, query_args, lang, context=None):
    """
    Returns a cache key based on the passed parameters.
    """
    return f'token_connect_cache:{provider_id}:{mk_token_connect_hash(corpora, token_id, num_tokens, query_args, lang, context)}'


def cached(fn):
    """
    A decorator which tries to look for a key in cache before
    actual storage is invoked. If cache miss in encountered
    then the value is stored to the cache to be available next
    time.
    """

    @wraps(fn)
    async def wrapper(self, plugin_ctx, corpora, maincorp, token_id, num_tokens, query_args, lang, is_anonymous, context, cookies):
        """
        get cache db using a method defined in the abstract class
        """
        cache_db: KeyValueStorage = self.get_cache_db()
        key = mk_token_connect_cache_key(
            self.provider_id, corpora, token_id, num_tokens, query_args, lang, context)

        cached_data = await cache_db.get(key)
        # if no result is found in the cache, call the backend function
        if cached_data is None:
            res = await fn(self, plugin_ctx, corpora, maincorp, token_id, num_tokens, query_args, lang, is_anonymous, context, cookies)
            # if a result is returned by the backend function, encode and zip its data part and store it in
            # the cache along with the "found" parameter
            await cache_db.set(key, {'data': res[0], 'found': res[1]})
        else:
            res = [cached_data['data'], cached_data['found']]

        await cache_db.set_ttl(key, self.cache_ttl)
        return res if res else ('', False)

    return wrapper
