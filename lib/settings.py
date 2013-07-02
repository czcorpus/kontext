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

_conf = {}  # contains parsed data, it should not be accessed directly (use set, get, get_* functions)

auth = None  # authentication module (this is set by the application)


def get(section, key=None, default=None):
    """
    Gets a configuration value. This function never throws an exception in
    case it cannot find the required value.

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
    """
    Sets configuration value. Please note that this action is neither
    persistent nor shared between users/requests.
    """
    if not section in _conf:
        _conf[section] = {}
    _conf[section][key] = value


def get_bool(section, key):
    """
    The same as get() but returns a bool type
    (True for 'true', '1' values, False for 'false', '0' values)
    """
    return {
        'true': True,
        '1': True,
        'false': False,
        '0': False
    }[get(section, str(key).lower())]


def get_int(section, key):
    """
    The same as get() but returns an int type
    """
    return int(get(section, key))


def parse_corplist(root, data, path='/'):
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
            parse_corplist(item, data, path)
        elif item.tag == 'corpus':
            web_url = item.attrib['web'] if 'web' in item.attrib else None
            sentence_struct = item.attrib['sentence_struct'] if 'sentence_struct' in item.attrib else None
            num_tag_pos = int(item.attrib['num_tag_pos']) if 'num_tag_pos' in item.attrib else 16
            data.append({
                'id': item.attrib['id'].lower(),
                'path': path,
                'web': web_url,
                'sentence_struct': sentence_struct,
                'num_tag_pos': num_tag_pos
            })


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
        if item.tag == 'corplist':
            data = []
            parse_corplist(item, data)
            _conf['corpora_hierarchy'] = data
        elif item.tag == 'default_corpora':
            data = []
            for item in item.findall('item'):
                data.append(item.text)
            _conf['corpora']['default_corpora'] = data
        else:
            _conf['corpora'][item.tag] = item.text


def load(conf_path='../config.xml'):
    """
    Loads application's configuration from provided file

    Parameters
    ----------
    auth_handler : object
    conf_path : str, optional (default is 'config.xml')
      path to the configuration XML file
    """
    parse_config(conf_path)
    os.environ['MANATEE_REGISTRY'] = get('corpora', 'manatee_registry')  # TODO check if already exists
    set('session', 'conf_path', conf_path)


def get_corpus_info(corp_name):
    """
    Returns an information related to provided corpus name and contained within
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
        if item['id'].lower() == corp_name.lower():
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


def is_debug_mode():
    """
    Returns True if the application is in 'debugging mode'
    (which leads to more detailed error messages etc.).
    Otherwise it returns False.
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
        speech_url = speech_url.replace('@SERVER_NAME', '%s') % os.getenv('SERVER_NAME')
    return "%s%s/%s" % (speech_url, corpus_name, speech_id)


def get_root_uri():
    """
    Returns root URL of the application
    """
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
