"""
This module is intended to be used with the unit tests.
TODO
"""

class Cursor(object):

    def execute(self, query, params=''):
        pass

    def fetchone(self):
        return [
            ('syn syn2010 omezeni/syn2010 abcd2000')
        ]

    def close(self):
        pass

class Connection(object):

    def cursor(self):
        return Cursor()

    def close(self):
        pass


def connect(**params):
    return Connection()