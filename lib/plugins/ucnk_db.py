"""

"""
import MySQLdb


class DbConnection(object):

    def __init__(self, conn):
        self.conn = conn

    def get(self):
        return self.conn


def create_instance(conf):
    """

    """
    conn = MySQLdb.connect(host=conf['ucnk:host'], user=conf['ucnk:username'], passwd=conf['ucnk:password'],
                           db=conf['ucnk:name'])
    return DbConnection(conn)