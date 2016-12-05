# Copyright (c) 2015 Institute of the Czech National Corpus
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

from plugins.abstract.locking import AbstractLock, LockTimeout
from plugins import inject


class RedisLock(AbstractLock):
    def __init__(self, db, key, ttl=30, num_attempts=5):
        """
        A Redis-based locking inspired by:
        https://chris-lamb.co.uk/posts/distributing-locking-python-and-redis
        and
        http://redis.io/commands/setnx

        arguments:
        db -- a plugins.redis_db.RedisDb compatible adapter
        key -- lock ID
        ttl -- lock is considered valid for this number of seconds
        num_attempts  -- how many times should the object try to acquire lock before
                         raising LockTimeout exception
        """
        self._db = db
        self._key = key
        self._db_key = 'lock:%s' % key
        self._num_attempts = num_attempts
        self._ttl = ttl

    @staticmethod
    def _lock_expired(lk):
        return lk and float(lk) < time.time()

    def __enter__(self):
        for i in range(self._num_attempts):
            expires = time.time() + self._ttl + 1
            if self._db.setnx(self._db_key, expires):  # success entering critical section
                return self._key
            curr_lock = self._db.get(self._db_key)
            if self._lock_expired(curr_lock) and self._db.getset(self._db_key, expires) == curr_lock:
                # if lock is expired and we succeeded to acquire new one we can enter crit. sec.
                return self._key
            time.sleep(1.1 ** i)  # exponential backoff
        raise LockTimeout('Failed to acquire lock %s due to timeout' % self._db_key)

    def __exit__(self, exc_type, exc_value, traceback):
        self._db.remove(self._db_key)


class LockFactory(object):
    """
    This is the actual plug-in.
    """
    def __init__(self, db, ttl, num_attempts):
        self._db = db
        self._ttl = ttl
        self._num_attempts = num_attempts

    def create(self, key):
        return RedisLock(self._db, key, ttl=self._ttl, num_attempts=self._num_attempts)


@inject('db')
def create_instance(settings, db):
    if not hasattr(db, 'setnx') or not hasattr(db, 'getset'):
        from plugins.abstract import PluginDependencyException
        raise PluginDependencyException(
            'redis_locking requires a key-value storage with "setnx" and "getset" methods')
    ttl = int(settings.get('plugins', 'locking').get('default:ttl', 20))
    num_attempts = int(settings.get('plugins', 'locking').get('default:num_attempts', 10))
    return LockFactory(db=db, ttl=ttl, num_attempts=num_attempts)