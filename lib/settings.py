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
        'mysql': q % { 'p' : '%s' },
        'sqlite': q % { 'p' : '?' }
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
        'true' : True,
        '1' : True,
        'false' : False,
        '0' : False
    }[get(section, str(key).lower())]

def get_int(section, key):
    """
    """
    return int(get(section, key))

def parse_corplist(root, path='/', data=[]):
    """
    """
    if not hasattr(root, 'tag') or not root.tag == 'corplist':
        return data
    if root.attrib['title']:
        path = "%s%s/" % (path, root.attrib['title'])
    for item in root:
        if not hasattr(item, 'tag'):
            continue
        elif item.tag == 'corplist':
            parse_corplist(item, path, data)
        elif item.tag == 'corpus':
            web_url = item.attrib['web'] if 'web' in item.attrib else None
            sentence_struct = item.attrib['sentence_struct'] if 'sentence_struct' in item.attrib else None
            num_tag_pos = int(item.attrib['num_tag_pos']) if 'num_tag_pos' in item.attrib else 16
            data.append({
                'id' : item.attrib['id'].lower(),
                'path' : path,
                'web' : web_url,
                'sentence_struct' : sentence_struct,
                'num_tag_pos' : num_tag_pos
            })


def parse_config(path):
    """
    """
    xml = etree.parse(open(path))
    _conf['global'] = {}
    for item in xml.find('global'):
        _conf['global'][item.tag] = item.text
    _conf['database'] = {}
    for item in xml.find('database'):
        _conf['database'][item.tag] = item.text
    _conf['cache'] = {}
    for item in xml.find('cache'):
        _conf['cache'][item.tag] = item.text
    _conf['corpora'] = {}
    for item in xml.find('corpora'):
        if item.tag == 'corplist':
            data = []
            parse_corplist(item, data=data)
            _conf['corpora_hierarchy'] = data
        elif item.tag == 'default_corpora':
            data = []
            for item in item.findall('item'):
                data.append(item.text)
            _conf['corpora']['default_corpora'] = data
        else:
            _conf['corpora'][item.tag] = item.text

def load(user, conf_path='config.xml'):
    """
    Loads application's configuration from provided file

    Parameters
    ----------
    user : str
    conf_path : str, optional (default is 'config.xml')
      path to the configuration XML file
    """
    global _user

    _user = user
    parse_config(conf_path)
    os.environ['MANATEE_REGISTRY'] = get('corpora', 'manatee_registry')
    set('session', 'conf_path', conf_path)

def get_corpus_info(corp_name):
    """
    Returns information related to provided corpus name and contained within
    the configuration XML file (i.e. not the data from the registry file). It is
    able to handle names containing the '/' character.

    Parameters
    ----------
    corp_name : str, name of the corpus

    Returns
    -------
    a dictionary containing following keys:
    path, web
    or None if no such item is found
    """
    tmp = corp_name.split('/')
    if len(tmp) > 1:
        corp_name = tmp[1]
    else:
        corp_name = tmp[0]
    for item in _conf['corpora_hierarchy']:
        if item['id'] == corp_name:
            return item
    return None

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
        cursor.execute(fq("SELECT corplist, sketches FROM user WHERE user LIKE %(p)s"),  (_user, ))
        row = cursor.fetchone()

        c = row[0].split()
        corpora = []

        for i in c:
            if i[0] == '@':
                i = i[1:len(i)]
                cursor.execute(fq("""SELECT corpora.name
                FROM corplist,relation,corpora
                WHERE corplist.id=relation.corplist
                  AND relation.corpora=corpora.id
                  AND corplist.name=%(p)s"""), i)
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
        _corplist = corpora
    return _corplist

def user_has_access_to(corpname):
    """
    Tests whether the current user has access to provided corpus name
    """
    return corpname in get_corplist() or not get_bool('corpora', 'use_db_whitelist')

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
    if speech_url[-1] <> '/':
        speech_url += '/'
    if '@SERVER_NAME' in speech_url:
        speech_url = speech_url.replace('@SERVER_NAME', '%s')
        speech_url = speech_url % os.getenv('SERVER_NAME')
    return "%s%s/%s" % (speech_url, corpus_name, speech_id)

def get_root_uri():
    return 'http://%s%s' % (os.getenv('SERVER_NAME'), os.getenv('REQUEST_URI').replace('user_password', 'first_form'))

if __name__ == '__main__':
    import sys

    if len(sys.argv) > 1:
        parse_config(sys.argv[1])
        corplist = _conf['corpora_hierarchy']
        del(_conf['corpora_hierarchy'])
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
        for item in corplist:
            print('%s%s' % (item['path'], item['id']))
    else:
        print('No config XML specified')
