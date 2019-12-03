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
A custom implementation of conc_persistence where:

1) primary storage is in Redis with different TTL for public and registered users
2) secondary storage is a list of SQLite3 databases. The config.xml contains only the current
   database file and all the other (readonly) archives are searched within the same directory.
   The order of a search is the following:
     - the current archive file always comes first
     - other files are sorted in a reversed alphabetical order; i.e. e.g. the following naming convention
       works well: 'conc.db', 'conc.20180801.db', 'conc.2017.08.17.db', 'conc.2016.08.30.db'.


For required config.xml entries - please see config.rng (and/or use scripts/validate_xml to check your config)

archive db (can be also created using the 'archive.py' script):

CREATE TABLE archive (
    id text,
    data text NOT NULL,
    created integer NOT NULL,
    num_access integer NOT NULL DEFAULT 0,
    last_access integer,
    PRIMARY KEY (id)
);
"""

import hashlib
import time
import re
import json
import sqlite3
import uuid
import os
import logging

import plugins
from plugins.abstract.conc_persistence import AbstractConcPersistence
from plugins.ucnk_conc_persistence2.archive import Archiver
from plugins import inject
from controller.errors import ForbiddenException, NotFoundException


KEY_ALPHABET = [chr(x) for x in range(ord('a'), ord('z') + 1)] + [chr(x) for x in range(ord('A'), ord('Z') + 1)] + \
               ['%d' % i for i in range(10)]

PERSIST_LEVEL_KEY = 'persist_level'
ID_KEY = 'id'
QUERY_KEY = 'q'
DEFAULT_CONC_ID_LENGTH = 12


def id_exists(id):
    """
    Tests whether passed id exists
    """
    # currently we assume that id (= prefix of md5 hash with 52^6 possible values)
    #  conflicts are very unlikely
    return False


def generate_uniq_id():
    return mk_short_id(uuid.uuid1().hex, min_length=DEFAULT_CONC_ID_LENGTH)


def mk_key(code):
    return 'concordance:%s' % (code, )


def mk_short_id(s, min_length=6):
    """
    Generates a hash based on md5 but using [a-zA-Z0-9] characters and with
    limited length.

    arguments:ucnk_op_persistence
    s -- a string to be hashed
    min_length -- minimum length of the output hash
    """
    x = int('0x' + hashlib.md5(s).hexdigest(), 16)
    ans = []
    while x > 0:
        p = x % len(KEY_ALPHABET)
        ans.append(KEY_ALPHABET[p])
        x /= len(KEY_ALPHABET)
    ans = ''.join([str(x) for x in ans])
    max_length = len(ans)
    i = min_length
    while id_exists(ans[:i]) and i < max_length:
        i += 1
    return ans[:i]


class ConcPersistence(AbstractConcPersistence):
    """
    This class stores user's queries in their internal form (see Kontext.q attribute).
    """

    DEFAULT_TTL_DAYS = 100

    DEFAULT_ANONYMOUS_USER_TTL_DAYS = 7

    def __init__(self, settings, db, auth):
        plugin_conf = settings.get('plugins', 'conc_persistence')
        ttl_days = int(plugin_conf.get('default:ttl_days', ConcPersistence.DEFAULT_TTL_DAYS))
        self._ttl_days = ttl_days
        self._anonymous_user_ttl_days = int(plugin_conf.get(
            'default:anonymous_user_ttl_days', ConcPersistence.DEFAULT_ANONYMOUS_USER_TTL_DAYS))
        self._archive_queue_key = plugin_conf['ucnk:archive_queue_key']
        self.db = db
        self._auth = auth
        self._db_path = plugin_conf['ucnk:archive_db_path']
        self._archives = self._open_archives()
        self._settings = settings

    @property
    def _archive(self):
        return self._archives[0]

    def _get_ttl_for(self, user_id):
        if self._auth.is_anonymous(user_id):
            return self.anonymous_user_ttl
        return self.ttl

    def _get_persist_level_for(self, user_id):
        if self._auth.is_anonymous(user_id):
            return 0
        else:
            return 1

    def _open_archives(self):
        root_dir = os.path.dirname(self._db_path)
        curr_file = os.path.basename(self._db_path)
        curr_db = sqlite3.connect(self._db_path)
        dbs = []
        for item in os.listdir(root_dir):
            if item != curr_file:
                dbs.append((item, sqlite3.connect(os.path.join(root_dir, item))))
        dbs = [(curr_file, curr_db)] + sorted(dbs, reverse=True)
        logging.getLogger(__name__).info(
            'using conc_persistence archives {0}'.format([x[0] for x in dbs]))
        return [x[1] for x in dbs]

    @property
    def ttl(self):
        return self._ttl_days * 24 * 3600

    @property
    def anonymous_user_ttl(self):
        return self._anonymous_user_ttl_days * 24 * 3600

    def is_valid_id(self, data_id):
        """
        Returns True if data_id is a valid data identifier else False is returned

        arguments:
        data_id -- identifier to be tested
        """
        return bool(re.match(r'~[0-9a-zA-Z]+', data_id))

    def get_conc_ttl_days(self, user_id):
        if self._auth.is_anonymous(user_id):
            return self.anonymous_user_ttl
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
        data = self.db.get(mk_key(data_id))
        if data is None:
            for arch_db in self._archives:
                cursor = arch_db.cursor()
                tmp = cursor.execute(
                    'SELECT data, num_access FROM archive WHERE id = ?', (data_id,)).fetchone()
                if tmp:
                    data = json.loads(tmp[0])
                    cursor.execute('UPDATE archive SET last_access = ?, num_access = num_access + 1 WHERE id = ?',
                                   (int(round(time.time())), data_id))
                    arch_db.commit()
                    break
        return data

    def find_key_db(self, data_id):
        for arch_db in self._archives:
            cursor = arch_db.cursor()
            tmp = cursor.execute(
                'SELECT COUNT(*) FROM archive WHERE id = ?', (data_id,)).fetchone()
            if tmp[0] > 0:
                return arch_db
        return None

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
        new operation ID if a new record is created or current ID if no new operation is defined
        """
        def records_differ(r1, r2):
            return (r1[QUERY_KEY] != r2[QUERY_KEY] or
                    r1.get('lines_groups') != r2.get('lines_groups'))

        if prev_data is None or records_differ(curr_data, prev_data):
            data_id = generate_uniq_id()
            curr_data[ID_KEY] = data_id
            if prev_data is not None:
                curr_data['prev_id'] = prev_data['id']
            curr_data[PERSIST_LEVEL_KEY] = self._get_persist_level_for(user_id)
            data_key = mk_key(data_id)
            self.db.set(data_key, curr_data)
            self.db.set_ttl(data_key, self._get_ttl_for(user_id))
            if not self._auth.is_anonymous(user_id):
                self.db.list_append(self._archive_queue_key, dict(key=data_key))
            latest_id = curr_data[ID_KEY]
        else:
            latest_id = prev_data[ID_KEY]

        return latest_id

    def archive(self, user_id, conc_id, revoke=False):
        archive_db = self.find_key_db(conc_id)
        if archive_db:
            cursor = archive_db.cursor()
            cursor.execute(
                'SELECT id, data, created integer, num_access, last_access FROM archive WHERE id = ? LIMIT 1',
                (conc_id,))
            row = cursor.fetchone()
            archived_rec = json.loads(row[1]) if row else None
        else:
            cursor = None
            archived_rec = None

        if revoke:
            if archived_rec:
                cursor.execute('DELETE FROM archive WHERE id = ?', (conc_id,))
                ans = 1
            else:
                raise NotFoundException('Concordance {0} not archived'.format(conc_id))
        else:
            cursor = self._archive.cursor()  # writing to the latest archive
            data = self.db.get(mk_key(conc_id))
            if data is None and archived_rec is None:
                raise NotFoundException('Concordance {0} not found'.format(conc_id))
            elif archived_rec:
                ans = 0
            else:
                stored_user_id = data.get('user_id', None)
                if user_id != stored_user_id:
                    raise ForbiddenException(
                        'Cannot change status of a concordance belonging to another user')
                curr_time = time.time()
                cursor.execute(
                    'INSERT OR IGNORE INTO archive (id, data, created, num_access) VALUES (?, ?, ?, ?)',
                    (conc_id, json.dumps(data), curr_time, 0))
                archived_rec = data
                ans = 1
        self._archive.commit()
        return ans, archived_rec

    def is_archived(self, conc_id):
        return True  # we ignore archiver task delay and say "True" for all the items

    def export_tasks(self):
        """
        Export tasks for Celery worker(s)
        """
        def archive_concordance(num_proc, dry_run):
            from . import archive
            return archive.run(conf=self._settings, num_proc=num_proc, dry_run=dry_run)
        return archive_concordance,


@inject(plugins.runtime.DB, plugins.runtime.AUTH)
def create_instance(settings, db, auth):
    """
    Creates a plugin instance.
    """
    return ConcPersistence(settings, db, auth)
