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
import threading


_local = threading.local()


class DbConnection(object):
    """
    Wraps MySQLdb connection with some additional functionality.

    arguments:
    db_conn -- MySQLdb database connection
    conn_timeout -- how many seconds should the connection live
    """
    def __init__(self, db_conn, conn_timeout):
        self.db_conn = db_conn
        self.conn_time = time.time()
        self.max_conn_time = conn_timeout

    def is_old(self):
        return time.time() - self.conn_time > self.max_conn_time

    def open_status(self):
        return self.db_conn.open

    def is_usable(self):
        try:
            logging.getLogger(__name__).debug('Pinging the database.')
            self.db_conn.ping()
        except MySQLdb.Error:
            return False
        else:
            return True

    def try_close(self):
        try:
            self.db_conn.close()
        except Exception as e:
            logging.getLogger(__name__).warning(e)


class DbConnectionProvider(object):

    def __init__(self, conf):
        """
        Arguments:
        conf -- a dictionary containing imported XML configuration of the plugin
        """
        self.conf = conf

    def get(self):
        """
        Gets the connection. If retrieved for the first time or closed before then or
        the connection_timeout has been exceeded then new one is created.
        Please note that this method does not monitor connection's state.
        """
        logging.getLogger(__name__).debug('db.get(), age: %01.3fs, old_flag: %s'
                                          % ((time.time() - _local.connection.conn_time),
                                             _local.connection.is_old()))
        if hasattr(_local, 'connection') and _local.connection.is_old():
            logging.getLogger(__name__).debug('Detected old db connection.')
            self.close()
        if not hasattr(_local, 'connection'):
            logging.getLogger(__name__).debug('Opening new database connection.')
            _local.connection = self._open_connection()
        return _local.connection.db_conn

    def close(self):
        """
        Forces closing of current (thread local) connection.
        """
        logging.getLogger(__name__).debug('Closing database connection.')
        _local.connection.try_close()
        del _local.connection

    def refresh(self):
        logging.getLogger(__name__).debug('Refreshing database connection.')
        self.get()

    def _open_connection(self):
        conn = MySQLdb.connect(host=self.conf['ucnk:host'], user=self.conf['ucnk:username'],
                               passwd=self.conf['ucnk:password'], db=self.conf['ucnk:name'])
        conn.set_character_set('utf8')
        conn_timeout = float(self.conf['ucnk:connection_timeout'])
        return DbConnection(conn, conn_timeout)


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return DbConnectionProvider(conf)
