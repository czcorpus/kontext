"""
This module contains UCNK's specific functionality.
"""
import os
import MySQLdb
import ConfigParser

config = ConfigParser.ConfigParser()
config.read('config.ini')

def get_default_corpus(corplist):
    """
    Returns name of the default corpus to be offered to a user

    Parameters
    ----------
    corplist : list or tuple of str
      list of corpora names

    Returns
    -------
    str
      name of the corpus to be used as a default one
    """
    # set default corpus
    if config.get('corpora', 'default_corpus') in corplist:
        return config.get('corpora', 'default_corpus')
    else:
        return config.get('corpora', 'alternative_corpus')

def get_corplist (user, config, registry_name):
    """
    Fetches list of available corpora according to provided user

    Parameters
    ----------
    user : str
      username to be used
    config : ConfigParser.ConfigParser
      application's configuration
    registry_name : str
      name of the registry file

    Returns
    -------
    list
      list of corpora names (sorted alphabetically)
    """
    conn = MySQLdb.connect (host=config.get('database', 'host'), user=config.get('database', 'username'),
        passwd=config.get('database', 'password'), db=config.get('database', 'name'))
    cursor = conn.cursor ()
    cursor.execute ("SELECT corplist, sketches FROM user WHERE user LIKE '%s'" % user)
    row = cursor.fetchone()

    if row is not None and row[1] == 1:
        os.environ['MANATEE_REGISTRY'] = registry_name
    else:
        os.environ['MANATEE_REGISTRY'] = '%s/no_sketches' % registry_name

    c = row[0].split()
    corpora = []

    for i in c:
        if i[0] == '@':
            i = i[1:len(i)]
            cursor.execute("""SELECT corpora.name
            FROM corplist,relation,corpora
            WHERE corplist.id=relation.corplist
              AND relation.corpora=corpora.id
              AND corplist.name='""" + i + "'")
            row = cursor.fetchall()

            for y in row:
                corpora.append(y[0])
        else:
            corpora.append(i)
    cursor.close()
    conn.close()
    path_info =  os.getenv('PATH_INFO')

    if path_info in ('/wsketch_form', '/wsketch', '/thes_form', '/thes', '/wsdiff_form', '/wsdiff'):
        r = []
        for ws in range(len(corpora)):
            c = manatee.Corpus(corpora[ws]).get_conf('WSBASE')
            if c == 'none':
                r.append(corpora[ws])
        for x in r:
            corpora.remove(x)
    corpora.sort()
    return corpora

def has_configured_speech(corpus):
    """
    Tests whether the provided corpus contains
    structural attributes compatible with current application's configuration
    (e.g. corpus contains structural attribute seg.id and the configuration INI
    file contains line speech_segment_struct_attr = seg.id).

    Parameters
    ----------
    corpus : manatee.Corpus
      corpus object we want to test
    """
    return config.get('corpora', 'speech_segment_struct_attr') in corpus.get_conf('STRUCTATTRLIST').split(',')

def get_speech_structure():
    return config.get('corpora', 'speech_segment_struct_attr').split('.')[0]