# Copyright (c) 2012 Czech National Corpus
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

"""
This module wraps application's configuration (as specified in config.xml) and provides some additional helper
methods.
"""
import os
from lxml import etree

_conf = {}
_user = None
_corplist = None

CONFIG_PATH = '../config.xml'


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
    }[_conf['database']['adapter']]


def create_db_connection():
    """
    Opens database connection according to the application setup.
    MySQL and SQLite database adapters are supported.

    Returns
    -------
    connection : object
                 connection object as provided by selected module
    """
    db_adapter = _conf['database']['adapter'].lower()
    if db_adapter == 'mysql':
        import MySQLdb
        return MySQLdb.connect(host=get('database', 'host'), user=get('database', 'username'),
            passwd=get('database', 'password'), db=get('database', 'name'))
    elif db_adapter == 'sqlite':
        import sqlite3
        return sqlite3.connect(get('database', 'name'))


def get(section, key=None, default=None):
    """
    Gets a configuration value.

    Parameters
    ----------
    section : str
              name of the section (global, database,...)
    key : str (optional)
          name of the configuration value; if omitted then whole section is returned
    """
    if key is None and section in _conf:
        return _conf[section]
    elif section in _conf and key in _conf[section]:
        return _conf[section][key]
    return default


def set(section, key, value):
    if not section in _conf:
        _conf[section] = {}
    _conf[section][key] = value


def get_bool(section, key):
    """
    """
    return {
        'true': True,
        '1': True,
        'false': False,
        '0': False
    }[get(section, str(key).lower())]


def get_int(section, key):
    """
    """
    return int(get(section, key))


def parse_config(path):
    """
    """
    xml = etree.parse(open(path))
    _conf['global'] = {}
    for item in xml.find('global'):
        if item.tag == 'administrators':
            tmp = tuple([x.text for x in item])
            _conf['global'][item.tag] = tmp if tmp is not None else ()
        else:
            _conf['global'][item.tag] = item.text
    if not 'administrators' in _conf['global']:
        _conf['global']['administrators'] = ()
    _conf['database'] = {}
    for item in xml.find('database'):
        _conf['database'][item.tag] = item.text
    _conf['cache'] = {}
    for item in xml.find('cache'):
        _conf['cache'][item.tag] = item.text
    _conf['corpora'] = {}
    for item in xml.find('corpora'):
        if item.tag == 'default_corpora':
            data = []
            for item in item.findall('item'):
                data.append(item.text)
            _conf['corpora']['default_corpora'] = data
        else:
            _conf['corpora'][item.tag] = item.text


def load(user, conf_path=CONFIG_PATH):
    """
    Loads application's configuration from provided file

    Parameters
    ----------
    user : str
    conf_path : str, optional (default is CONFIG_PATH)
      path to the configuration XML file
    """
    global _user

    _user = user
    parse_config(conf_path)
    os.environ['MANATEE_REGISTRY'] = get('corpora', 'manatee_registry')
    set('session', 'conf_path', conf_path)


def get_default_corpus(corplist):
    """
    Returns name of the default corpus to be offered to a user. Select first
    corpus from the list which is conform with user's access rights

    Parameters
    ----------
    corplist : list or tuple of str
      list of corpora names

    Returns
    -------
    str
      name of the corpus to be used as a default one
    """
    default_corp_list = get('corpora', 'default_corpora')
    if get_bool('corpora', 'use_db_whitelist'):
        for item in default_corp_list:
            if item in corplist:
                return item
        return None
    else:
        return get('corpora', 'default_corpora')[0]


def create_salt(length=2):
    """
    """
    import random
    salt_chars = "qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM"
    return ''.join([salt_chars[random.randint(0, len(salt_chars) - 1)] for i in range(length)])


def get_user_data():
    """
    """
    cols = ('pass', 'corplist')
    conn = create_db_connection()
    cursor = conn.cursor()
    cursor.execute(fq("SELECT %s FROM user WHERE user = %%(p)s" % ','.join(cols)), (_user,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return dict(zip(cols, row))


def update_user_password(password):
    """
    Updates current (see the _user variable) user's password.
    There is no need to hash/encrypt the password - function does it automatically.
    """
    import crypt

    hashed_pass = crypt.crypt(password, create_salt())
    conn = create_db_connection()
    cursor = conn.cursor()
    ans = cursor.execute(fq("UPDATE user SET pass = %(p)s WHERE user = %(p)s"), (hashed_pass, _user,))
    cursor.close()
    conn.commit()
    conn.close()
    return ans


def get_corplist():
    """
    Fetches list of available corpora according to provided user

    Returns
    -------
    list
      list of corpora names (sorted alphabetically) available to current user (specified in the _user variable)
    """
    global _corplist

    if _corplist is None:
        conn = create_db_connection()
        cursor = conn.cursor()
        cursor.execute(fq("SELECT uc.name FROM user_corpus AS uc JOIN user AS un ON uc.user_id = un.id "
                          " WHERE un.user = %(p)s"),  (_user, ))
        rows = cursor.fetchall()
        if len(rows) > 0:
            cursor.close()
            conn.close()
            corpora = [row[0] for row in rows]
        else:
            corpora = []

        #!!!
        corpora += ['intercorp_cs', 'intercorp_en']

        corpora.sort()
        _corplist = corpora
    return _corplist


def user_has_access_to(corpname):
    """
    Tests whether the current user has access to provided corpus name
    """
    return corpname in get_corplist() or not get_bool('corpora', 'use_db_whitelist')


def user_is_administrator():
    """
    Tests whether the current user's name belongs to the 'administrators' group
    """
    return _user in get('global', 'administrators')


def is_debug_mode():
    """
    Returns true if the application is in 'debugging mode'
    (which leads to more detailed error messages etc.).
    Else returns false.
    """
    value = get('global', 'debug')
    return value is not None and value.lower() in ('true', '1')


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
    return get('corpora', 'speech_segment_struct_attr') in corpus.get_conf('STRUCTATTRLIST').split(',')


def get_speech_structure():
    """
    Returns name of the structure configured as a 'speech' delimiter
    """
    return get('corpora', 'speech_segment_struct_attr').split('.')[0]


def create_speech_url(corpus_name, speech_id):
    """
    Builds a URL string to the provided speech_id and corpus_name
    """
    speech_url = get('corpora', 'speech_data_url')
    if speech_url[-1] != '/':
        speech_url += '/'
    if '@SERVER_NAME' in speech_url:
        speech_url = speech_url.replace('@SERVER_NAME', '%s')
        speech_url %= os.getenv('SERVER_NAME')
    return "%s%s/%s" % (speech_url, corpus_name, speech_id)


def get_uri_scheme_name():
    if 'HTTPS' in os.environ:
        return 'https'
    else:
        return 'http'


def get_root_uri():
    """
    Returns root URL of the application
    """
    if 'SCRIPT_URL' in os.environ:
        path = os.getenv('SCRIPT_URL')[:os.getenv('SCRIPT_URL').rindex('/')]
    else:
        path = os.getenv('REQUEST_URI')[:os.getenv('REQUEST_URI').rindex('/')]
    return '%s://%s%s/' % (get_uri_scheme_name(), os.getenv('SERVER_NAME'), path)

if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        parse_config(sys.argv[1])
        for block in _conf:
            print('\n[%s]' % block)
            for key in _conf[block]:
                if type(key) == str:
                    if key.find('passw') == -1:
                        value = _conf[block][key]
                    else:
                        value = '******'
                    print('%s: %s' % (key, value))
        print('\n[corpora hierarchy]')
    else:
        print('No config XML specified')
