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
All the custom sessions plug-ins should inherit from AbstractSessions
"""


class AbstractSessions(object):

    def get_actual_timestamp(self):
        """
        Returns current UNIX time
        """
        raise NotImplementedError()

    def start_new(self, data=None):
        """
        Writes a new session record to the storage
        """
        raise NotImplementedError()

    def delete(self, session_id):
        """
        Deletes a session record from the storage
        """
        raise NotImplementedError()

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
        raise NotImplementedError()

    def save(self, session_id, data):
        """
        Saves session data and updates last update information for a row  identified by session_id.
        If no such record exists then nothing is done and no error is thrown.
        """
        raise NotImplementedError()

    def delete_old_sessions(self):
        """
        Removes sessions with last update older than current time minus self.ttl.
        This method is called automatically (with probability self.cleanup_probability)
        when load() is called.
        """
        raise NotImplementedError()
