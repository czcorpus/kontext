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

"""
A session handler compatible with general_storage.KeyValueStorage implementations
(currently default_db and redis_db modules).

required config.xml entries:

<sessions>
    <module>default_sessions</module>
    <ttl>14400</ttl>
    <cleanup_probability>[a value from 0 to 1]</cleanup_probability>
</sessions>

Please note that if you use redis_db storage plug-in then <cleanup_probability> setting
has no effect as RedisDB removes keys with set TTL automatically.
"""

import uuid
import time
from datetime import datetime
import random

from abstract.sessions import AbstractSessions


class DefaultSessions(AbstractSessions):

    DEFAULT_TTL = 7200

    DEFAULT_CLEANUP_PROBABILITY = 0.5

    def __init__(self, settings, db):
        """
        Initialization according to the 'settings' object/module
        """
        self.db = db
        self.ttl = int(settings.get('plugins', 'sessions').get('ttl', DefaultSessions.DEFAULT_TTL))
        self.cleanup_probability = settings.get('plugins', 'sessions').get('cleanup_probability',
                                                                           DefaultSessions.DEFAULT_CLEANUP_PROBABILITY)

    def get_actual_timestamp(self):
        """
        Returns current UNIX time
        """
        return time.mktime(datetime.now().timetuple())

    def _mk_key(self, session_id):
        return 'session:%s' % (session_id, )

    def _set_ttl(self, key):
        if hasattr(self.db, 'set_ttl'):
            self.db.set_ttl(key, self.ttl)

    def start_new(self, data=None):
        """
        Writes a new session record to the storage
        """
        session_id = str(uuid.uuid1())
        if data is None:
            data = {}

        sess_key = self._mk_key(session_id)
        data['__timestamp__'] = self.get_actual_timestamp()
        self.db.set(sess_key, data)
        self._set_ttl(sess_key)
        return {'id': session_id, 'data': data}

    def delete(self, session_id):
        """
        Deletes a session record from the storage
        """
        self.db.remove(self._mk_key(session_id))

    def load(self, session_id, data=None):
        """
        Loads a session record identified by session_id. If no such record exists
        then a new record is created. Method always returns valid session_id. I.e.
        you should take that session_id and write it to cookies if you call this
        method.

        Parameters
        ----------
        session_id : str
            identifier of the session

        data : dict
            data to be used and written in case the session does not exist
        """
        if random.random() < DefaultSessions.DEFAULT_CLEANUP_PROBABILITY:
            self.delete_old_sessions()

        session_data = self.db.get(self._mk_key(session_id))
        if session_data is not None:
            return {'id': session_id, 'data': session_data}
        else:
            return self.start_new(data)

    def save(self, session_id, data):
        """
        Saves session data and updates last update information for a row  identified by session_id.
        If no such record exists then nothing is done and no error is thrown.
        """
        sess_key = self._mk_key(session_id)
        data['__timestamp__'] = self.get_actual_timestamp()
        self.db.set(sess_key, data)
        self._set_ttl(sess_key)

    def delete_old_sessions(self):
        """
        Removes sessions with last update older than current time minus self.ttl.
        This method is called automatically (with probability self.cleanup_probability)
        when load() is called.
        """
        if not hasattr(self.db, 'set_ttl'):
            old_records = self.db.all_with_key_prefix('session:', oldest_first=True, limit=100)
            limit_time = self.get_actual_timestamp() - self.ttl
            for item in old_records:
                if item['__timestamp__'] < limit_time:
                    self.db.remove(item['__key__'])


def create_instance(config, db):
    """
    This is an expected plugin module method to create instance of the service
    """
    return DefaultSessions(config, db)
