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
A simple session handler which writes data to a filesystem.
Please note that this has not been tested under heavy load.

required config.xml entries:
<sessions>
    <module>default_sessions</module>
    <ttl>14400</ttl>
    <cleanup_probability>[a value from 0 to 1]</cleanup_probability>
    <data_path extension-by="default">[ a DIRECTORY where individual session files will be stored]</data_path>
</sessions>
"""

import uuid
import time
from datetime import datetime
import json
import os
import random

from abstract.sessions import AbstractSessions


class DefaultSessions(AbstractSessions):

    DEFAULT_TTL = 14400

    DEFAULT_CLEANUP_PROBABILITY = 0.5

    def __init__(self, settings):
        """
        Initialization according to the 'settings' object/module
        """
        self.data_path = settings.get('plugins', 'sessions').get('default:data_path')
        self.ttl = settings.get('plugins', 'sessions').get('ttl', DefaultSessions.DEFAULT_TTL)
        self.cleanup_probability = settings.get('plugins', 'sessions').get('cleanup_probability',
                                                                           DefaultSessions.DEFAULT_CLEANUP_PROBABILITY)

    def get_actual_timestamp(self):
        """
        Returns current UNIX time
        """
        return time.mktime(datetime.now().timetuple())

    def make_path(self, session_id):
        return '%s/%s' % (self.data_path, session_id)

    def start_new(self, data=None):
        """
        Writes a new session record to the storage
        """
        session_id = str(uuid.uuid1())
        if data is None:
            data = {}

        with open(self.make_path(session_id), 'w') as f:
            json.dump(data, f)
        return {'id': session_id, 'data': data}

    def delete(self, session_id):
        """
        Deletes a session record from the storage
        """
        os.unlink(self.make_path(session_id))

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

        file_path = self.make_path(session_id)
        if os.path.exists(file_path):
            with open(self.make_path(session_id)) as f:
                data = json.load(f)
                return {'id': session_id, 'data': data}
        else:
            return self.start_new(data)

    def save(self, session_id, data):
        """
        Saves session data and updates last update information for a row  identified by session_id.
        If no such record exists then nothing is done and no error is thrown.
        """
        file_path = self.make_path(session_id)
        with open(file_path, 'w') as f:
            json.dump(data, f)

    def delete_old_sessions(self):
        """
        Removes sessions with last update older than current time minus self.ttl.
        This method is called automatically (with probability self.cleanup_probability)
        when load() is called.
        """
        limit_time = self.get_actual_timestamp() - DefaultSessions.DEFAULT_TTL
        for item in os.listdir(self.data_path):
            p = '%s/%s' % (self.data_path, item)
            if os.path.getmtime(p) < limit_time:
                os.unlink(p)


def create_instance(config, *args):
    """
    This is an expected plugin module method to create instance of the service
    """
    return DefaultSessions(config)
