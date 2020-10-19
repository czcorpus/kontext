#!/usr/bin/env python
# Copyright (c) 2015 Czech National Corpus
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

from lxml import etree
import argparse
import os
import sys


APP_PATH = os.path.realpath(os.path.join(os.path.dirname(__file__), '..'))
SCHEMA_PATH = os.path.realpath(os.path.join(APP_PATH, 'conf', 'config.rng'))


def validate_config(schema, conf):
    relax = etree.RelaxNG(schema)
    try:
        relax.assertValid(conf)
        return None
    except etree.DocumentInvalid as e:
        return e


def validate_main_config(conf_obj, schema_path):
    ans = ''
    ans_err = 0
    with open(schema_path, 'rb') as schema_f:
        if hasattr(conf_obj, 'docinfo'):
            ans += 'Validating main configuration file "{0}"...'.format(conf_obj.docinfo.URL)
        else:
            ans += '  {0} ...'.format(os.path.basename(os.path.dirname(schema_path)))
        schema = etree.parse(schema_f)
        err = validate_config(schema, conf_obj)
        if err:
            ans_err = 1
            ans += ' ERROR: {0}'.format(err)
        else:
            ans += ' OK'
    return ans, ans_err


def get_plugin_rng_path(plugin_id):
    return os.path.realpath(os.path.join(APP_PATH, 'lib', 'plugins', plugin_id, 'config.rng'))


def find_plugins(conf):
    ans = []
    items = conf.findall('plugins/*')
    for item in items:
        ident = item.find('module')
        if ident is not None:
            rng_path = get_plugin_rng_path(ident.text)
            if os.path.isfile(rng_path):
                ans.append((ident.getparent(), rng_path))
    return ans


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Validates KonText XML configuration files according to respective RelaxNG schemas')
    parser.add_argument('config_file', metavar='CONF_FILE', type=str,
                        help='a path to a config file to be validated')
    args = parser.parse_args()
    total_errors = 0
    with open(args.config_file, 'rb') as conf_f:
        conf = etree.parse(conf_f)
        ans, err1 = validate_main_config(conf, SCHEMA_PATH)
        total_errors += err1
        print(ans)
        plugins = find_plugins(conf)

    print('Validating plug-in configurations:')
    for elm, schema_path in plugins:
        ans, err2 = validate_main_config(elm, schema_path)
        total_errors += err2
        print(ans)
    print((80 * '='))
    if total_errors > 0:
        print(('Validation finished with {0} error(s)'.format(total_errors)))
    else:
        print('There were no errors')
    sys.exit(1 if total_errors > 0 else 0)
