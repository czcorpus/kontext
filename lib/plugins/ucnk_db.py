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

"""
A custom database wrapper
"""
import MySQLdb
import time
import logging


class DbConnection(object):

    def __init__(self, conf):
        """
        Arguments:
        conf -- a dictionary containing imported XML configuration of the plugin
        """
        self.conf = conf
        self.conn = None
        self.conn_time = 0
        self.max_conn_time = float(conf['ucnk:connection_timeout'])

    def get(self, force_reconnect=False):
        """
        Gets the connection. If retrieved for the first time or closed before then or
        the connection_timeout has been exceeded then new one is created.
        Please note that this method does not monitor connection's state.
        """
        # please note that conn.open == 0 only in case of explicit call of conn.close()
        # i.e. in case MySQL restarts the value is still 1
        if self.conn is None or self.conn.open < 1 or self._connection_is_old() or force_reconnect:
            self.conn = self._open_connection()
            self.conn_time = time.time()
        return self.conn

    def recover(self):
        """
        This is expected to be called in case some fatal error occurs, when the application cannot finish
        current action but there is a chance that
        """
        logging.getLogger(__name__).warning('calling recover()')
        if self.conn is not None:
            try:
                self.conn.close()
            except MySQLdb.OperationalError:
                pass
        self.get(force_reconnect=True)

    def _open_connection(self):
        conn = MySQLdb.connect(host=self.conf['ucnk:host'], user=self.conf['ucnk:username'],
                               passwd=self.conf['ucnk:password'], db=self.conf['ucnk:name'])
        conn.set_character_set('utf8')
        return conn

    def _connection_is_old(self):
        return time.time() - self.conn_time > self.max_conn_time


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return DbConnection(conf)
