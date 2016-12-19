# Copyright (c) 2014 Institute of the Czech National Corpus
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
A simple implementation of conc_persistence plug-in based on KeyValueStorage
as a back-end.

required config.xml entries:

element conc_persistence {
  element module { "default_conc_persistence" }
}
"""

import hashlib
import time
import re

from abstract.conc_persistence import AbstractConcPersistence
from plugins import inject


KEY_ALPHABET = [chr(x) for x in range(ord('a'), ord('z'))] + [chr(x) for x in range(ord('A'), ord('Z'))] + \
               ['%d' % i for i in range(10)]


def id_exists(id):
    """
    Tests whether passed id exists
    """
    # currently we assume that id (= prefix of md5 hash with 52^6 possible values)
    #  conflicts are very unlikely
    return False


def mk_short_id(s, min_length=6):
    """
    Generates a hash based on md5 but using [a-zA-Z0-9] characters and with
    limited length.

    arguments:ucnk_op_persistence
    s -- a string to be hashed
    min_length -- minimum length of the output hash
    """
    x = long('0x' + hashlib.md5(s).hexdigest(), 16)
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

    DEFAULT_CONC_ID_LENGTH = 8

    def __init__(self, settings, db, auth):
        plugin_conf = settings.get('plugins', 'conc_persistence')
        ttl_days = int(plugin_conf.get('default:ttl_days', ConcPersistence.DEFAULT_TTL_DAYS))
        self.ttl = ttl_days * 24 * 3600
        anonymous_user_ttl_days = int(plugin_conf.get('default:ttl_days', ConcPersistence.DEFAULT_ANONYMOUS_USER_TTL_DAYS))
        self.anonymous_user_ttl = anonymous_user_ttl_days * 24 * 3600

        self.db = db
        self._auth = auth

    def _mk_key(self, code):
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

    def open(self, data_id):
        """
        Loads operation data according to the passed data_id argument.
        The data are assumed to be public (as are URL parameters of a query).

        arguments:
        data_id -- an unique ID of operation data

        returns:
        a dictionary containing operation data or None if nothing is found
        """
        return self.db.get(self._mk_key(data_id))

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
            return (r1['q'] != r2['q'] or r1.get('lines_groups') != r2.get('lines_groups'))

        if prev_data is None or records_differ(curr_data, prev_data):
            time_created = time.time()
            data_id = mk_short_id('%s' % time_created, min_length=self.DEFAULT_CONC_ID_LENGTH)
            curr_data['id'] = data_id
            if prev_data is not None:
                import logging
                logging.getLogger(__name__).debug('================== store prev ID: %s' % (prev_data['id'],))
                curr_data['prev_id'] = prev_data['id']
            data_key = self._mk_key(data_id)

            self.db.set(data_key, curr_data)
            self.db.set_ttl(data_key, self._get_ttl_for(user_id))
            latest_id = curr_data['id']
        else:
            latest_id = prev_data['id']

        return latest_id


@inject('db', 'auth')
def create_instance(settings, db, auth):
    """
    Creates a plugin instance.
    """
    return ConcPersistence(settings, db, auth)
