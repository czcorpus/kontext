# Copyright (c) 2013 Institute of the Czech National Corpus
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

import uuid
import json
from datetime import datetime
import time
import random

from abstract.sessions import AbstractSessions

"""

External requirements:

* requiers a working database plugin

Required config.xml/plugins entries:

<sessions>
    <module>ucnk_sessions</module>
    <ttl>[time to live for a session record; in seconds]</ttl>
    <cleanup_probability>[a probability that KonText checks for old records; values from 0 to 1]</cleanup_probability>
</sessions>
"""


class Sessions(AbstractSessions):
    """
    SQLite-based session persistence implementation
    """

    DEFAULT_TTL = 14400

    DEFAULT_CLEANUP_PROBABILITY = 0.5

    def __init__(self, settings, db_provider):
        """
        Initialization according to the 'settings' object/module
        """
        self.db_provider = db_provider
        self.ttl = settings.get('plugins', 'sessions').get('ttl', Sessions.DEFAULT_TTL)
        self.cleanup_probability = settings.get('plugins', 'sessions').get('cleanup_probability',
                                                                           Sessions.DEFAULT_CLEANUP_PROBABILITY)

    def get_actual_timestamp(self):
        """
        Returns current UNIX time
        """
        return time.mktime(datetime.now().timetuple())

    def start_new(self, data=None):
        """
        Writes a new session record to the storage
        """
        db = self.db_provider()
        session_id = str(uuid.uuid1())
        if data is None:
            data = {}
        db.execute('INSERT INTO noske_session (id, updated, data) VALUES (%s, %s, %s)',
                   (session_id, self.get_actual_timestamp(), json.dumps(data)))
        db.close()
        return {'id': session_id, 'data': data}

    def delete(self, session_id):
        """
        Deletes a session record from the storage
        """
        db = self.db_provider()
        db.execute("DELETE FROM noske_session WHERE id = %s", (session_id, ))
        db.close()

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
        if random.random() < Sessions.DEFAULT_CLEANUP_PROBABILITY:
            self.delete_old_sessions()
        db = self.db_provider()
        row = db.execute("SELECT data FROM noske_session WHERE id = %s", (session_id, )).fetchone()
        db.close()
        if row:
            return {'id': session_id, 'data': json.loads(row[0])}
        else:
            return self.start_new(data)

    def save(self, session_id, data):
        """
        Saves session data and updates last update information for a row  identified by session_id.
        If no such record exists then nothing is done and no error is thrown.
        """
        db = self.db_provider()
        db.execute('UPDATE noske_session SET data = %s, updated = %s WHERE id = %s',
                   (json.dumps(data), self.get_actual_timestamp(), session_id))
        db.close()

    def delete_old_sessions(self):
        """
        Removes sessions with last update older than current time minus self.ttl.
        This method is called automatically (with probability self.cleanup_probability)
        when load() is called.
        """
        db = self.db_provider()
        limit_time = self.get_actual_timestamp() - Sessions.DEFAULT_TTL
        db.execute('DELETE FROM noske_session WHERE updated < %s', (limit_time, ))
        db.close()


def create_instance(config, db):
    """
    This is an expected plugin module method to create instance of the service
    """
    return Sessions(config, db)