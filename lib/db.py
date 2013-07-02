_adapter = None
_conn = None


def fq(q):
    """
    Transforms a query containing db independent '%(p)s' placeholders
    according to the selected adapter type.

    Parameters
    ----------
    q : str
        input query

    Returns
    -------
    query : string
            formatted query
    """
    return {
        'mysql': q % {'p': '%s'},
        'sqlite': q % {'p': '?'}
    }[_adapter]


def open(db_conf):
    """
    If called for the first time then opens new database connection according to provided database connection
    data. The connection is kept open until explicitly closed. If the function is called again then already opened
    connection is returned.

    MySQL and SQLite database adapters are supported.

    Parameters
    ----------
    db_conf : dict
        a dict containing following keys: adapter, host, username, password, name (in some cases, like e.g. in case
          of sqlite there is no need to provide username, password and host)


    Returns
    -------
    connection : object
                 connection object as provided by selected module
    """
    global _conn, _adapter

    if _conn is None:
        _adapter = db_conf['adapter'].lower()
        if _adapter == 'mysql':
            import MySQLdb
            _conn = MySQLdb.connect(host=db_conf['host'], user=db_conf['username'],
                passwd=db_conf['password'], db=db_conf['name'])
        elif _adapter == 'sqlite':
            import sqlite3
            _conn = sqlite3.connect(db_conf['name'])
    return _conn


def connection():
    return _conn