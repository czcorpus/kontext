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
A custom database wrapper of sqlalchemy's connection pool

3rd party dependencies:

* sqlalchemy

Required config.xml/plugins entries:
<db>
    <module>ucnk_pooled_db</module>
    <name extension-by="ucnk"></name>
    <host extension-by="ucnk"></host>
    <password extension-by="ucnk"></password>
    <username extension-by="ucnk"></username>
    <charset extension-by="ucnk"></charset>
    <pool_size extension-by="ucnk">[how many connections are there in the pool]</pool_size>
    <max_overflow extension-by="ucnk">[how many connections to open in addition in case of a peak]</max_overflow>
    <pool_recycle extension-by="ucnk">[lifetime of a connection in seconds]</pool_recycle>
</db>

"""
from sqlalchemy import create_engine


class DbConnectionProvider(object):
    """
    A callable object which provides a pooled connections. Object is thread-safe.
    """

    def __init__(self, conf):
        """
        Arguments:
        conf -- a dictionary containing imported XML configuration of the plugin; see the module documentation
        to become familiar with required/possible keys
        """
        self.conf = conf
        self.conn_params = {}

        if self.conf.get('ucnk:charset', None):
            self.conn_params['charset'] = self.conf['ucnk:charset']

        conn_url = 'mysql://%(user)s:%(passwd)s@%(hostname)s/%(dbname)s?%(params)s' % {
            'user': self.conf['ucnk:username'], 'passwd': self.conf['ucnk:password'],
            'hostname': self.conf['ucnk:host'], 'dbname': self.conf['ucnk:name'],
            'params': '&'.join(['%s=%s' % (k, v) for k, v in self.conn_params.items()])}

        self.engine = create_engine(conn_url,
                                    pool_size=int(self.conf['ucnk:pool_size']),
                                    max_overflow=int(self.conf['ucnk:max_overflow']),
                                    pool_recycle=int(self.conf['ucnk:pool_recycle']),
                                    encoding='utf-8'
                                    )

    def __call__(self):
        """
        Gets a connection from the pool. Please note that it is up to the caller
        to close the connection. It is perfectly OK to get and close the connection
        quite often because the wrapped database connection is typically just returned
        to the pool (and not effectively closed).
        """
        return self.engine.connect()


def create_instance(conf):
    """
    Arguments:
    conf -- a dictionary containing imported XML configuration of the plugin
    """
    return DbConnectionProvider(conf)
