# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
A simple implementation of query_persistence plug-in based on KeyValueStorage
as a back-end.

required config.xml entries: please see config.rng
"""

import hashlib
import re
import uuid
import os
import logging
import sqlite3
import json
import time
from typing import Dict, Any, List
from manatee import Corpus

from plugins.abstract.query_persistence import AbstractQueryPersistence
import plugins
from plugins import inject
from controller.errors import ForbiddenException, UserActionException
from settings import import_bool


KEY_ALPHABET = [chr(x) for x in range(ord('a'), ord('z'))] + [chr(x) for x in range(ord('A'), ord('Z'))] + \
               ['%d' % i for i in range(10)]

DEFAULT_CONC_ID_LENGTH = 12

DEFAULT_TTL_DAYS = 100

DEFAULT_ANONYMOUS_USER_TTL_DAYS = 7


def id_exists(id):
    """
    Tests whether passed id exists
    """
    # currently we assume that id (= prefix of md5 hash with 52^12 possible values)
    #  conflicts are very unlikely
    return False


def mk_short_id(s, min_length):
    """
    Generates a hash based on md5 but using [a-zA-Z0-9] characters and with
    limited length.

    arguments:ucnk_op_persistence
    s -- a string to be hashed
    min_length -- minimum length of the output hash
    """
    x = int(hashlib.md5(s).hexdigest(), 16)
    ans = []
    while x > 0:
        p = x % len(KEY_ALPHABET)
        ans.append(KEY_ALPHABET[p])
        x = int(x / len(KEY_ALPHABET))
    ans = ''.join([str(x) for x in ans])
    max_length = len(ans)
    i = min_length
    while id_exists(ans[:i]) and i < max_length:
        i += 1
    return ans[:i]


def generate_uniq_id():
    return mk_short_id(uuid.uuid1().hex.encode(), min_length=DEFAULT_CONC_ID_LENGTH)


class Sqlite3ArchBackend(object):
    """
    A recommended backend for storing persistent concordances.
    It is activated automatically once admin defines a path
    to a directory where the database should be stored.
    """

    def __init__(self, archive_dir):
        self._archive_path = os.path.join(archive_dir, 'conc_archive.db')
        self._db = None

    @property
    def archive_db(self):
        if self._db is None:
            self._db = self._init_archive()
        return self._db

    def _init_archive(self):
        if not os.path.exists(self._archive_path):
            logging.getLogger(__name__).warning(
                'Query persistence archive database does not exist - creating one at {0}'.format(self._archive_path))
            conn = sqlite3.connect(self._archive_path)
            c = conn.cursor()
            c.execute('CREATE TABLE conc_archive ('
                      'id text, '
                      'data text NOT NULL, '
                      'created integer NOT NULL, '
                      'num_access integer NOT NULL DEFAULT 0, '
                      'last_access integer, '
                      'PRIMARY KEY (id)'
                      ')')
            conn.commit()
        else:
            conn = sqlite3.connect(self._archive_path)
        return conn

    def archive(self, data, db_key):
        save_time = int(round(time.time()))
        cursor = self.archive_db.cursor()
        cursor.execute('INSERT OR IGNORE INTO conc_archive (id, data, created, num_access) VALUES (?, ?, ?, ?)',
                       (db_key, json.dumps(data), save_time, 0))
        self.archive_db.commit()

    def revoke(self, db_key):
        cursor = self.archive_db.cursor()
        cursor.execute('DELETE FROM conc_archive WHERE id = ?', (db_key,))
        self.archive_db.commit()

    def load(self, db_key):
        cursor = self.archive_db.cursor()
        cursor.execute('SELECT data FROM conc_archive WHERE id = ?', (db_key,))
        raw_ans = cursor.fetchone()
        if raw_ans is not None:
            return json.loads(raw_ans[0])
        return None

    def is_archived(self, db_key):
        cursor = self.archive_db.cursor()
        cursor.execute('SELECT id FROM conc_archive WHERE id = ?', (db_key,))
        return cursor.fetchone() is not None


class DbPluginArchBackend(object):
    """
    This is an alternative backend for storing persistent concordances.
    Because it uses DB plug-in which may run on Redis (= in RAM db), this
    is not recommended for long term installations with many users as
    the archive will slowly eat the RAM. But if you want to use sqlite3_db
    then this is not an issue.
    """

    def __init__(self, db, ttl, anonymous_ttl):
        self._db = db
        self._ttl = ttl
        self._anonymous_ttl = anonymous_ttl

    def archive(self, data, db_key):
        self._db.clear_ttl(db_key)

    def revoke(self, db_key):
        self._db.set_ttl(db_key, self._ttl)

    def load(self, db_key):
        return None  # can't help here as normal load searches in the very same db

    def is_archived(self, db_key):
        return self._db.get_ttl(db_key) == -1


class DefaultQueryPersistence(AbstractQueryPersistence):
    """
    This class stores user's queries in their internal form (see Kontext.q attribute).
    """

    def __init__(self, db, auth, ttl_days, anonymous_ttl_days, archive_backend):
        self._db = db
        self._auth = auth
        self._ttl_days = ttl_days
        self._anonymous_user_ttl_days = anonymous_ttl_days
        self._archive_backend = archive_backend

    @property
    def ttl(self):
        return self._ttl_days * 24 * 3600

    @property
    def anonymous_user_ttl(self):
        return self._anonymous_user_ttl_days * 24 * 3600

    @staticmethod
    def _mk_key(code):
        return 'concordance:%s' % (code, )

    def _get_ttl_for(self, user_id):
        if self._auth.is_anonymous(user_id):
            return self.anonymous_user_ttl
        return self.ttl

    def is_valid_id(self, data_id):
        """
        Returns True if data_id is a valid data identifier else False is returned

        arguments:
        data_id -- identifier to be tested
        """
        return bool(re.match(r'~[0-9a-zA-Z]+', data_id))

    def get_conc_ttl_days(self, user_id):
        if self._auth.is_anonymous(user_id):
            return self._anonymous_user_ttl_days
        return self._ttl_days

    def open(self, data_id):
        """
        Loads operation data according to the passed data_id argument.
        The data are assumed to be public (as are URL parameters of a query).

        arguments:
        data_id -- an unique ID of operation data

        returns:
        a dictionary containing operation data or None if nothing is found
        """
        key = self._mk_key(data_id)
        ans = self._db.get(key)
        if ans is None:
            ans = self._archive_backend.load(key)
        return ans

    def store(self, user_id, curr_data, prev_data=None):
        """
        Stores current operation (defined in curr_data) into the database. If also prev_date argument is
        provided then a comparison is performed and based on the result, new record is created and new
        ID is returned on nothing is done and current ID is returned.

        arguments:
        user_id -- database ID of the current user
        curr_data -- a dictionary containing operation data to be stored; currently at least 'q' entry must be present
        prev_data -- optional dictionary with previous operation data; again, 'q' entry must be there

        returns:
        1) new operation ID if a new record is created,
        2) current ID if no new operation is defined but there is a previous operation defined
        3) None if neither previous nor new operation is defined
        """
        def records_differ(r1, r2):
            return r1['q'] != r2['q'] or r1.get('lines_groups') != r2.get('lines_groups')

        if len(curr_data.get('q', [])) == 0:
            return None
        if prev_data is None or records_differ(curr_data, prev_data):
            data_id = generate_uniq_id()
            curr_data['id'] = data_id
            curr_data['user_id'] = user_id
            if prev_data is not None:
                curr_data['prev_id'] = prev_data['id']
            data_key = self._mk_key(data_id)

            self._db.set(data_key, curr_data)
            self._db.set_ttl(data_key, self._get_ttl_for(user_id))
            latest_id = curr_data['id']
        else:
            latest_id = prev_data['id']
        return latest_id

    def archive(self, user_id, conc_id, revoke=False):
        key = self._mk_key(conc_id)
        data = self.open(conc_id)
        if data is None:
            raise UserActionException('Concordance key \'%s\' not found.' % (conc_id,))
        stored_user_id = data.get('user_id', None)
        if user_id != stored_user_id:
            raise ForbiddenException(
                'Cannot change status of a concordance belonging to another user')

        if revoke:
            self._db.set(key, data)
            self._archive_backend.revoke(key)
        else:
            self._archive_backend.archive(data, key)

    def is_archived(self, conc_id):
        return self._archive_backend.is_archived(self._mk_key(conc_id))


@inject(plugins.runtime.DB, plugins.runtime.AUTH)
def create_instance(settings, db, auth):
    """
    Creates a plugin instance.
    """
    plugin_conf = settings.get('plugins', 'query_persistence')
    archive_dir = plugin_conf.get('default:archive_dir', None)
    ttl_days = int(plugin_conf.get('default:ttl_days', DEFAULT_TTL_DAYS))
    anonymous_ttl_days = int(plugin_conf.get('default:ttl_days', DEFAULT_ANONYMOUS_USER_TTL_DAYS))

    if archive_dir:
        backend = Sqlite3ArchBackend(archive_dir=archive_dir)
    else:
        logging.getLogger(__name__).warning('Using DB plug-in as archiving storage for concordances. '
                                            'In case you use redis_db then please consider setting archive_dir '
                                            'for default_conc_persistence to prevent filling up RAM with archived '
                                            'concordances.')
        backend = DbPluginArchBackend(db=db, ttl=ttl_days * 24 * 3600,
                                      anonymous_ttl=anonymous_ttl_days * 24 * 3600)

    return DefaultQueryPersistence(db=db, auth=auth,
                                   ttl_days=ttl_days,
                                   anonymous_ttl_days=anonymous_ttl_days,
                                   archive_backend=backend)
