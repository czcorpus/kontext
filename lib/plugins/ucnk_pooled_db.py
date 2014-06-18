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
from sqlalchemy import create_engine


class DbConnectionProvider(object):
    """
    A callable object which provides a pooled connections. Object is thread-safe.
    """

    def __init__(self, conf):
        """
        Arguments:
        conf -- a dictionary containing imported XML configuration of the plugin
        """
        self.conf = conf
        conn_url = 'mysql://%(user)s:%(passwd)s@%(hostname)s/%(dbname)s' % {'user': self.conf['ucnk:username'],
                                                                            'passwd': self.conf['ucnk:password'],
                                                                            'hostname': self.conf['ucnk:host'],
                                                                            'dbname': self.conf['ucnk:name']}
        self.engine = create_engine(conn_url,
                                    pool_size=int(self.conf['ucnk:pool_size']),
                                    max_overflow=int(self.conf['ucnk:max_overflow']),
                                    pool_recycle=int(self.conf['ucnk:pool_recycle']),
                                    encoding='utf-8'
                                    )

    def __call__(self):
        """
        Gets a connection from the pool
        """
        return self.engine.connect()


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return DbConnectionProvider(conf)
