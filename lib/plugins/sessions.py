import uuid
import json
from datetime import datetime
import time
import random


class Sessions(object):
    """
    SQLite-based session persistence implementation
    """

    DEFAULT_TTL = 14400

    DEFAULT_CLEANUP_PROBABILITY = 0.5

    def __init__(self, settings, db):
        """
        Initialization according to the 'settings' object/module
        """
        self.conn = db.get()
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
        cursor = self.conn.cursor()
        session_id = str(uuid.uuid1())
        if data is None:
            data = {}
        cursor.execute('INSERT INTO noske_session (id, updated, data) VALUES (%s, %s, %s)',
                       (session_id, self.get_actual_timestamp(), json.dumps(data)))
        self.conn.commit()
        return {'id': session_id, 'data': data}

    def delete(self, session_id):
        """
        Deletes a session record from the storage
        """
        cursor = self.conn.cursor()
        cursor.execute("DELETE FROM noske_session WHERE id = %s", (session_id, ))
        cursor.close()
        self.conn.commit()

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
        cursor = self.conn.cursor()
        cursor.execute("SELECT data FROM noske_session WHERE id = %s", (session_id, ))
        row = cursor.fetchone()
        cursor.close()
        if row:
            return {'id': session_id, 'data': json.loads(row[0])}
        else:
            return self.start_new(data)

    def save(self, session_id, data):
        """
        Saves session data and updates last update information for a row  identified by session_id.
        If no such record exists then nothing is done and no error is thrown.
        """
        cursor = self.conn.cursor()
        cursor.execute('UPDATE noske_session SET data = %s, updated = %s WHERE id = %s',
                       (json.dumps(data), self.get_actual_timestamp(), session_id))
        cursor.close()
        self.conn.commit()

    def delete_old_sessions(self):
        """
        Removes sessions with last update older than current time minus self.ttl.
        This method is called automatically (with probability self.cleanup_probability)
        when load() is called.
        """
        cursor = self.conn.cursor()
        limit_time = self.get_actual_timestamp() - Sessions.DEFAULT_TTL
        cursor.execute('DELETE FROM noske_session WHERE updated < %s', (limit_time, ))
        cursor.close()
        self.conn.commit()


def create_instance(config, db):
    """
    This is an expected plugin module method to create instance of the service
    """
    return Sessions(config, db)