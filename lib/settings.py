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

import sys
import os
from lxml import etree
import json

_conf = {}  # contains parsed data, it should not be accessed directly (use set, get, get_* functions)
_conf_path = None
_meta = {}  # contains data of attributes of XML elements representing configuration values
auth = None  # authentication module (this is set from the outside)

# This dict defines special parsing of quoted sections. Sections not mentioned there
# are considered to be lists of key->value pairs (i.e. no complex types).
conf_parsers = {
    'corplist': None,
    'plugins': 'parse_plugins',
    'tagsets': None
}


def contains(section, key=None):
    """
    Tests whether the config contains a section or a section+key (if a key provided is not None)
    """
    return (key is None and section in _conf) or (key is not None and section in _conf and key in _conf[section])


def get(section, key=None, default=None):
    """
    Gets a configuration value. This function never throws an exception in
    case it cannot find the required value.

    Parameters.
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


def get_meta(section, key):
    """
    Returns metadata (= XML element attributes) attached to a respective element
    """
    if section in _meta and key in _meta[section]:
        return _meta[section][key]
    return {}


def get_full(section, key):
    """
    Returns both value and metadata of a respective configuration element
    """
    m = get_meta(section, key)
    d = get(section, key)
    if hasattr(m, '__iter__') and hasattr(d, '__iter__'):
        return zip(d, m)
    else:
        return d, m


def get_bool(section, key, default=None):
    """
    The same as get() but returnparse_pluginss a bool type
    (True for 'true', '1' values, False for 'false', '0' values)
    """
    fixed_key = str(get(section, str(key).lower(), default)).lower()
    return {
        'true': True,
        '1': True,
        'false': False,
        '0': False
    }[fixed_key]


def get_int(section, key):
    """
    The same as get() but returns an int type
    """
    return int(get(section, key))


def set(section, key, value):
    """
    Sets a configuration value. Please note that this action is neither
    persistent nor shared between users/requests.
    """
    if not section in _conf:
        _conf[section] = {}
    _conf[section][key] = value


def custom_prefix(elm):
    return '' if 'extension-by' not in elm.attrib else '%s:' % elm.attrib['extension-by']


def parse_general_tree(section):
    ans = {}
    meta = {}
    for item in section:
        if item.tag is etree.Comment:
            continue
        elif item.tag in conf_parsers:
            node_processor = conf_parsers[item.tag]
            if node_processor is not None:
                getattr(sys.modules[__name__], conf_parsers[item.tag])(item)
            else:
                pass  # we ign.ore items with None processor deliberately
        else:
            item_id = '%s%s' % (custom_prefix(item), item.tag)
            if len(item.getchildren()) == 0:
                ans[item_id] = item.text
                meta[item_id] = dict(item.attrib)
            else:
                item_list = []
                meta_list = []
                for sub_item in item:
                    item_list.append(sub_item.text)
                    meta_list.append(dict(sub_item.attrib))
                ans[item_id] = tuple(item_list)
                meta[item_id] = tuple(meta_list)
    return ans, meta


def parse_plugins(root):
    _conf['plugins'] = {}
    _meta['plugins'] = {}
    for item in root:
        _conf['plugins'][item.tag], _meta['plugins'][item.tag] = parse_general_tree(item)


def parse_config(path):
    """
    Parses application configuration XML file. A two-level structure is expected where
    first level represents sections and second level key->value pairs. It is also possible
    to have values of list type (e.g. <my_conf_value><item>v1</item><item>v2</item></my_conf_value>)

    There are also specific sections which can be processed by an assigned function (see variable conf_parsers).
    This can be used to omit some sections too (you just define empty function or set None value in conf_parsers
    for such section).

    Parameters
    ----------
    path : str
      a file system path to the configuration file
    """
    xml = etree.parse(open(path))
    root = xml.getroot()

    for section in root:
        if section.tag in conf_parsers:
            getattr(sys.modules[__name__], conf_parsers[section.tag])(section)
        else:
            section_id = '%s%s' % (custom_prefix(section), section.tag)
            _conf[section_id], _meta[section_id] = parse_general_tree(section)


def load(conf_path):
    """
    Loads application's configuration from a provided file

    Arguments:
    conf_path -- path to a configuration XML file
    """
    global _conf_path

    _conf_path = conf_path
    parse_config(_conf_path)
    _load_version()


def conf_path():
    return _conf_path


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
        return ''   # '' is 'empty corpus' (None cannot be used here)
    else:
        return get('corpora', 'default_corpora')[0]


DEBUG_OFF = 0
DEBUG_ON = 1
DEBUG_AND_PROFILE = 2


def debug_level():
    """
    Returns one of {0, 1, 2}, where
    0: no debugging
    1: debugging enabled (log.debug is recorded etc.)
    2: debugging enabled and profiling enabled
    """
    value = get('global', 'debug', '0').lower()
    return {'false': DEBUG_OFF, '0': DEBUG_OFF, 'true': DEBUG_ON, '1': DEBUG_ON, '2': DEBUG_AND_PROFILE}.get(value, DEBUG_OFF)


def is_debug_mode():
    """
    Returns True if the application is in 'debugging mode'
    (which leads to more detailed error messages etc.).
    Otherwise it returns False.
    """
    return debug_level() > DEBUG_OFF


def _load_version():
    with open('%s/../package.json' % os.path.abspath(os.path.dirname(__file__))) as f:
        d = json.load(f)
        set('global', '__version__', d.get('version', '??'))