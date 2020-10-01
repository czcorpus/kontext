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
This module wraps application's configuration (as specified in config.xml) and
provides some additional helper methods.
"""

from typing import Any, Dict

import os
from lxml import etree
import json


class ConfState(object):
    conf_path = None


# contains parsed data, it should not be accessed directly (use set, get, get_*)
_conf: Dict[str, Any] = {}
# contains data of attributes of XML elements representing configuration values
_meta: Dict[str, Any] = {}
_help_links: Dict[str, Any] = {}
_state: ConfState = ConfState()

SECTIONS = (
    'theme', 'global', 'calc_backend', 'job_scheduler', 'mailing', 'logging', 'corpora', 'fcs', 'plugins')

DEFAULT_DATETIME_FORMAT = '%Y-%m-%d %H:%M:%S'


def contains(section, key=None):
    """
    Tests whether the config contains a section or a section+key (if a key provided is not None)
    """
    return (key is None and section in _conf) or (key is not None and section in _conf and key in _conf[section])


def get(section, key=None, default=None):
    """
    Gets a configuration value. This function never throws an exception in
    case it cannot find the required value.

    arguments:
    section -- name of the section (global, database,...)
    key -- (optional) name of the configuration value; if omitted then whole section is returned
    """
    if key is None and section in _conf:
        return _conf[section]
    elif section in _conf and key in _conf[section]:
        return _conf[section][key]
    return default


def get_str(section, key, default=''):
    """
    Instead of possible None the method returns an empty string.
    Everything else is just like regular get().
    """
    ans = get(section, key, default)
    if ans is None:
        ans = ''
    return ans


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

    returns:
    2-tuple (primary_value, metadata_dict)
    """
    m = get_meta(section, key)
    d = get(section, key)
    if type(m) in (list, tuple) and type(d) in (list, tuple):
        return list(zip(d, m))
    else:
        return d, m


def import_bool(v):
    if not isinstance(v, str):
        return bool(v)
    return {
        'true': True,
        '1': True,
        'false': False,
        '0': False
    }[v]


def get_bool(section, key, default=None):
    """
    The same as get() but returns a bool type
    (True for 'true', '1' values, False for 'false', '0' values)
    The 'default' can be of any type where non-string values
    are converted in a standard way. For best readability use
    just bool values there.
    """
    return import_bool(get(section, str(key).lower(), default))


def get_int(section, key, default=-1):
    """
    arguments:
    section -- configuration section (global, corpora,...)
    key -- configuration key
    default -- default value to be returned in case nothing is found

    The same as get() but returns an int type. In case a value
    is not found, -1 is returned.
    """
    return int(get(section, key, default))


def get_list(section, key):
    """
    Returns a list of values stored within a (section, key) pair. In case
    a concrete value is a scalar, a list of size 1 is returned. Empty
    value is represented by an empty list.
    """
    tmp = get(section, key)
    if not tmp:
        return []
    elif type(tmp) in (list, tuple):
        return [x for x in tmp]
    else:
        return [tmp]


def set(section, key, value):
    """
    Sets a configuration value. Please note that this action is neither
    persistent nor shared between users/requests.
    """
    if section not in _conf:
        _conf[section] = {}
    _conf[section][key] = value


def get_plugin_custom_conf(plg_name) -> Dict[str, Any]:
    """
    Load an optional plug-in configuration stored in a file
    specified by a JSON path in a respective "conf_path" element.

    In case there is no such configuration, None is returned.
    """
    pconf = get('plugins', plg_name)
    if pconf is None:
        raise ValueError('Plug-in {} does not exist'.format(plg_name))
    return pconf.get('__conf__')


def custom_prefix(elm):
    return '' if 'extension-by' not in elm.attrib else '{}:'.format(elm.attrib['extension-by'])


def parse_config_section(section):
    """
    Parses a single level config section:
      <section>
        <item_name_1>item_value_1</item_name_1>
        <item_name_2>item_value_2</item_name_2>
        ...
        <item_name_M>item_value_M</item_name_M>
      </section>

    Value can be also a list:
    <section>
      <item_name>
        <item>value 1</item>
        <item>value 2</item>
        ...
        <item>value N</item>
      </item_name>
    </section>
    """
    ans = {}
    meta = {}
    for item in section:
        if item.tag is etree.Comment:
            continue
        else:
            item_id = f'{custom_prefix(item)}{item.tag}'
            if len(item.getchildren()) == 0:
                ans[item_id] = item.text
                meta[item_id] = dict(item.attrib)
            else:
                item_list = []
                meta_list = []
                for sub_item in item:
                    if sub_item.tag is not etree.Comment:
                        item_list.append(sub_item.text)
                        meta_list.append(dict(sub_item.attrib))
                ans[item_id] = tuple(item_list)
                meta[item_id] = tuple(meta_list)
    return ans, meta


def parse_config(path):
    """
    Parses application configuration XML file. A two-level structure is expected where
    first level represents sections and second level key->value pairs. It is also possible
    to have values of list type (e.g. <my_conf_value><item>v1</item><item>v2</item></my_conf_value>)

    arguments:
    path -- a file system path to the configuration file
    """
    xml = etree.parse(open(path))
    root = xml.getroot()

    _conf['plugins'] = {}
    _meta['plugins'] = {}

    for section in root:
        if section.tag in SECTIONS:
            if section.tag != 'plugins':
                section_id = f'{custom_prefix(section)}{section.tag}'
                _conf[section_id], _meta[section_id] = parse_config_section(section)
            else:
                for item in section:
                    _conf['plugins'][item.tag], _meta['plugins'][item.tag] = parse_config_section(
                        item)
                    if 'conf_path' in _conf['plugins'][item.tag]:
                        with open(_conf['plugins'][item.tag]['conf_path']) as fr:
                            _conf['plugins'][item.tag]['__conf__'] = json.load(fr)


def _load_help_links():
    hlpath = get('global', 'help_links_path', None)
    if hlpath is not None:
        with open(hlpath, 'rb') as fr:
            _help_links.update(json.load(fr))


def get_help_links(lang_id):
    return dict((k, v.get(lang_id, None)) for k, v in list(_help_links.items()))


def load(path):
    """
    Loads application's configuration from a provided file

    arguments:
      conf_path -- path to a configuration XML file
    """
    _state.conf_path = path
    parse_config(_state.conf_path)
    _load_version()
    _load_help_links()


def conf_path():
    return _state.conf_path


def get_default_corpus(allowed_corpora):
    """
    Returns name of the default corpus to be offered to a user. Select first
    corpus from the list which is conform with user's access rights

    arguments:
    allowed_corpora -- list of corpora names

    returns:
    name of a corpus to be used as a default
    """
    default_corp_list = get('corpora', 'default_corpora')
    try:
        return next(item for item in default_corp_list if item in allowed_corpora)
    except StopIteration:
        return ''   # '' is 'empty corpus' (None cannot be used here)


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
