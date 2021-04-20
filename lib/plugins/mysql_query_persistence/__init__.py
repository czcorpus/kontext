# Copyright (c) 2020 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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
2) secondary storage is a MySQL/MariaDB database.

The concordance keys are generated as idempotent (i.e. the same user with same conc arguments
produces the same conc ID).

The plug-in is able to connect either via its own configuration (see config.rng) or via
an integration_db plugin.


How to create the required data table:

CREATE TABLE kontext_conc_persistence (
    id VARCHAR(191) PRIMARY KEY,
    data TEXT NOT NULL,
    created TIMESTAMP NOT NULL,
    num_access INT NOT NULL DEFAULT 0,
    last_access TIMESTAMP
);

Possible modifications in case the number of records is large:

ALTER TABLE `kontext_conc_persistence`
ENGINE='Aria';

ALTER TABLE `kontext_conc_persistence`
ADD PRIMARY KEY `id_created` (`id`, `created`),
DROP INDEX `PRIMARY`;

ALTER TABLE kontext_conc_persistence
PARTITION BY RANGE (UNIX_TIMESTAMP(created)) (
    PARTITION `to_2016` VALUES LESS THAN (UNIX_TIMESTAMP('2016-12-31 23:59:59')),
    PARTITION `to_2019` VALUES LESS THAN (UNIX_TIMESTAMP('2019-12-31 23:59:59')),
    PARTITION `to_2022` VALUES LESS THAN (UNIX_TIMESTAMP('2022-12-31 23:59:59')),
    PARTITION `to_2025` VALUES LESS THAN (UNIX_TIMESTAMP('2025-12-31 23:59:59')),
    PARTITION `to_2028` VALUES LESS THAN (UNIX_TIMESTAMP('2028-12-31 23:59:59')),
    PARTITION `to_2031` VALUES LESS THAN (UNIX_TIMESTAMP('2031-12-31 23:59:59')),
    PARTITION `to_2034` VALUES LESS THAN (UNIX_TIMESTAMP('2034-12-31 23:59:59')),
    PARTITION `to_2037` VALUES LESS THAN (UNIX_TIMESTAMP('2037-12-31 23:59:59')),
    PARTITION `the_rest` VALUES LESS THAN MAXVALUE
)

"""

import re
import json

import plugins
from plugins.abstract.query_persistence import AbstractQueryPersistence
from plugins.abstract.query_persistence.common import generate_idempotent_id
from plugins import inject
from controller.errors import ForbiddenException, NotFoundException
import logging

from .archive import Archiver, MySQLOps, MySQLConf, get_iso_datetime


PERSIST_LEVEL_KEY = 'persist_level'
USER_ID_KEY = 'user_id'
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


def mk_key(code):
    return 'concordance:%s' % (code, )


class MySqlQueryPersistence(AbstractQueryPersistence):
    """
    This class stores user's queries in their internal form (see Kontext.q attribute).
    """

    DEFAULT_TTL_DAYS = 100

    DEFAULT_ANONYMOUS_USER_TTL_DAYS = 7

    def __init__(self, settings, db, integration_db, auth):
        plugin_conf = settings.get('plugins', 'query_persistence')
        ttl_days = int(plugin_conf.get('ttl_days', MySqlQueryPersistence.DEFAULT_TTL_DAYS))
        self._ttl_days = ttl_days
        self._anonymous_user_ttl_days = int(plugin_conf.get(
            'anonymous_user_ttl_days', MySqlQueryPersistence.DEFAULT_ANONYMOUS_USER_TTL_DAYS))
        self._archive_queue_key = plugin_conf['archive_queue_key']
        self.db = db
        self._auth = auth
        if integration_db.is_active:
            self._archive = integration_db
            logging.getLogger(__name__).info(f'mysql_query_persistence uses integration_db[{integration_db.info}]')
        else:
            self._archive = MySQLOps(MySQLConf(settings))
        self._settings = settings

    def _get_ttl_for(self, user_id):
        if self._auth.is_anonymous(user_id):
            return self.anonymous_user_ttl
        return self.ttl

    def _get_persist_level_for(self, user_id):
        if self._auth.is_anonymous(user_id):
            return 0
        else:
            return 1

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

    def find_used_corpora(self, query_id):
        """
        Because the operations are chained via 'prev_id' and the corpname
        information is not stored for all the steps, for any n-th step > 1
        we have to go backwards and find an actual corpname stored in the
        1st operation.
        """
        data = self._load_query(query_id, save_access=False)
        while data is not None and 'corpname' not in data:
            data = self._load_query(data.get('prev_id', ''), save_access=False)
        return data.get('corpora', []) if data is not None else []

    def open(self, data_id):
        ans = self._load_query(data_id, save_access=True)
        if ans is not None and 'corpora' not in ans:
            ans['corpora'] = self.find_used_corpora(ans.get('prev_id'))
        return ans

    def _load_query(self, data_id: str, save_access: bool):
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
            cursor = self._archive.cursor()
            cursor.execute(
                'SELECT data, num_access FROM kontext_conc_persistence WHERE id = %s', (data_id,))
            tmp = cursor.fetchone()
            if tmp:
                data = json.loads(tmp['data'])
                if save_access:
                    cursor.execute(
                        'UPDATE kontext_conc_persistence '
                        'SET last_access = %s, num_access = num_access + 1 '
                        'WHERE id = %s',
                        (get_iso_datetime(), data_id)
                    )
                    self._archive.commit()
        return data

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
            data_id = generate_idempotent_id(curr_data)
            curr_data[ID_KEY] = data_id
            if prev_data is not None:
                curr_data['prev_id'] = prev_data['id']
            curr_data[PERSIST_LEVEL_KEY] = self._get_persist_level_for(user_id)
            curr_data[USER_ID_KEY] = user_id
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
        cursor = self._archive.cursor()
        cursor.execute(
            'SELECT id, data, created, num_access, last_access FROM kontext_conc_persistence WHERE id = %s LIMIT 1',
            (conc_id,)
        )
        row = cursor.fetchone()
        archived_rec = json.loads(row['data']) if row is not None else None

        if revoke:
            if archived_rec:
                cursor.execute('DELETE FROM kontext_conc_persistence WHERE id = %s', (conc_id,))
                ans = 1
            else:
                raise NotFoundException(
                    'Archive revoke error - concordance {0} not archived'.format(conc_id))
        else:
            cursor = self._archive.cursor()
            data = self.db.get(mk_key(conc_id))
            if data is None and archived_rec is None:
                raise NotFoundException(
                    'Archive store error - concordance {0} not found'.format(conc_id))
            elif archived_rec:
                ans = 0
            else:
                stored_user_id = data.get('user_id', None)
                if user_id != stored_user_id:
                    raise ForbiddenException(
                        'Cannot change status of a concordance belonging to another user')
                cursor.execute(
                    'INSERT IGNORE INTO kontext_conc_persistence (id, data, created, num_access) '
                    'VALUES (%s, %s, %s, %s)',
                    (conc_id, json.dumps(data), get_iso_datetime(), 0))
                archived_rec = data
                ans = 1
        self._archive.commit()
        return ans, archived_rec

    def is_archived(self, conc_id):
        cursor = self._archive.cursor()
        cursor.execute(
            'SELECT id, data, created, num_access, last_access FROM kontext_conc_persistence WHERE id = %s LIMIT 1',
            (conc_id,)
        )
        return cursor.fetchone() is not None

    def export_tasks(self):
        """
        Export tasks for async queue worker(s)
        """
        def archive_concordance(num_proc: int, dry_run: bool):
            from . import archive
            return archive.run(from_db=self.db, to_db=self._archive, archive_queue_key=self._archive_queue_key,
                               dry_run=dry_run, num_proc=num_proc)
        return archive_concordance,


@inject(plugins.runtime.DB, plugins.runtime.INTEGRATION_DB, plugins.runtime.AUTH)
def create_instance(settings, db, integration_db, auth):
    """
    Creates a plugin instance.
    """
    return MySqlQueryPersistence(settings, db, integration_db, auth)
