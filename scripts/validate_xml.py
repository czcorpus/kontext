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


def validate_corplist(schema, conf):
    relax = etree.RelaxNG(schema)
    try:
        relax.assertValid(conf)
        print('\nOK. The file conforms the schema.')
    except etree.DocumentInvalid as e:
        print(e)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Validates KonText XML configuration files against RelaxNG schemas')
    parser.add_argument('config_file', metavar='CONF_FILE', type=str,
                        help='a path to a config file to be validated')
    parser.add_argument('schema_file', metavar='SCHEMA_FILE', type=str,
                        help='a path to a RelaxNG schema file')
    args = parser.parse_args()
    with open(args.schema_file, 'rb') as schema_f, open(args.config_file, 'rb') as conf_f:
        print('Testing file "%s" against schema "%s"...' % (os.path.basename(args.config_file),
                                                            os.path.basename(args.schema_file)))
        schema = etree.parse(schema_f)
        conf = etree.parse(conf_f)
        validate_corplist(schema, conf)
        print(80 * '=')
