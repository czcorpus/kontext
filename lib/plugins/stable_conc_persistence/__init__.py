# Copyright (c) 2019 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2019 Tomas Machalek <tomas.machalek@gmail.com>
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
Stable concordance persistence provides a solution where KonText runs mainly as API and
it is desired to have always the same key/hash for the same input data. Although not required,
it is recommended to run this along with API-friendly auth plug-in 'static_auth'.

Keys generated by this plug-in can be read by default_conc_persistence (and ucnk_conc_persistence2).
So it should be possible to mix two instances of KonText - one with stable_conc_persistence and
one with default_conc_persistence on top of the same database and generate working links from
'stable_conc_persistence' instance to the 'default_conc_persistence' (the opposite direction is
not supported).
"""

import json
import hashlib
import re
import time
import os
import sqlite3
import logging

from plugins import inject
import plugins
from plugins.abstract.conc_persistence import AbstractConcPersistence
from controller.errors import ForbiddenException, NotFoundException


QUERY_KEY = 'q'
ID_KEY = 'id'
DEFAULT_TTL_DAYS = 7


def generate_stable_id(data):
    return hashlib.md5(json.dumps(data).encode('utf-8')).hexdigest()


def mk_key(code):
    return 'concordance:%s' % (code, )


class StableConcPersistence(AbstractConcPersistence):

    def __init__(self, db, settings):
        self.db = db
        plugin_conf = settings.get('plugins', 'conc_persistence')
        self._ttl_days = int(plugin_conf.get('default:ttl_days', DEFAULT_TTL_DAYS))
        self._archive_db_path = plugin_conf.get('default:archive_db_path')
        self._archives = self._open_archives() if self._archive_db_path else []
        self._settings = settings

    @property
    def ttl(self):
        return self._ttl_days * 24 * 3600

    def is_valid_id(self, data_id):
        # we intentionally accept non-hex chars here so we can accept also conc keys
        # generated from default_conc_persistence and derived plug-ins.
        return bool(re.match(r'~[0-9a-zA-Z]+', data_id))

    def get_conc_ttl_days(self, user_id):
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
        if data is None and self._archive_db_path is not None:
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
        def records_differ(r1, r2):
            return (r1[QUERY_KEY] != r2[QUERY_KEY] or
                    r1.get('lines_groups') != r2.get('lines_groups'))

        if prev_data is None or records_differ(curr_data, prev_data):
            data_id = generate_stable_id(curr_data)
            curr_data[ID_KEY] = data_id
            if prev_data is not None:
                curr_data['prev_id'] = prev_data['id']
            data_key = mk_key(data_id)
            self.db.set(data_key, curr_data)
            self.db.set_ttl(data_key, self.ttl)
            latest_id = curr_data[ID_KEY]
        else:
            latest_id = prev_data[ID_KEY]

        return latest_id

    @property
    def _latest_archive(self):
        return self._archives[0]

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
            cursor = self._latest_archive.cursor()  # writing to the latest archive
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
        self._latest_archive.commit()
        return ans, archived_rec

    def is_archived(self, conc_id):
        return self.find_key_db(conc_id) is not None

    def export_tasks(self):
        """
        Export tasks for Celery worker(s)
        """
        def archive_concordance(num_proc, dry_run):
            from . import archive
            return archive.run(conf=self._settings, num_proc=num_proc, dry_run=dry_run)
        return archive_concordance,

    def _open_archives(self):
        root_dir = os.path.dirname(self._archive_db_path)
        curr_file = os.path.basename(self._archive_db_path)
        curr_db = sqlite3.connect(self._archive_db_path)
        dbs = []
        for item in os.listdir(root_dir):
            if item != curr_file:
                dbs.append((item, sqlite3.connect(os.path.join(root_dir, item))))
        dbs = [(curr_file, curr_db)] + sorted(dbs, reverse=True)
        logging.getLogger(__name__).info(
            'using conc_persistence archives {0}'.format([x[0] for x in dbs]))
        return [x[1] for x in dbs]


@inject(plugins.runtime.DB)
def create_instance(settings, db):
    return StableConcPersistence(db=db, settings=settings)
