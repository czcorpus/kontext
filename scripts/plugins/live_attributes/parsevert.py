# Copyright 2014 Institute of the Czech National Corpus
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import os
import argparse
import json

import sqlite3

import vertparser
from registry.parser import reg_grammarParser
from registry import confparsing


def get_registry_attrs(path, encoding):
    """
    Extracts structural attributes from a specified registry file.

    arguments:
    path -- path to a registry file
    encoding -- python-supported character encoding

    returns:
    a list of 2-tuples (structure, attribute)
    """
    startrule = 'conf'

    with open(path) as f:
        text = f.read().decode(encoding).encode('utf-8').decode('ascii', 'ignore')
    parser = reg_grammarParser(parseinfo=False)
    ast = parser.parse(
        text,
        startrule,
        filename=path,
        semantics=confparsing.ConfigSemantics())
    tree_walker = confparsing.TreeWalker(ast)
    ans = tree_walker.run()
    return ans.get_structattrs()


def get_attrs_from_conf(conf):
    """
    Returns a list of structural attributes specified in a parsing-configuration dictionary (key 'attrList')

    arguments:
    conf -- a dictionary containing single vertical parsing configuration (i.e. a single array item from conf. json file)

    returns:
    a list of strings of the following form: "struct.attribute"
    """
    if 'attrList' in conf:
        return [tuple(x.split('.')) for x in conf['attrList']]
    return []


def open_db(db_path):
    """
    Opens a sqlite3 database

    arguments:
    db_path -- path to a database file

    returns:
    a database connection object
    """
    if os.path.exists(db_path):
        os.rename(db_path, '%s.bak' % db_path)
    return sqlite3.connect(db_path)


def create_tables(attrs, db, reset_existing=False):
    """
    Creates all the required tables for metadata database.

    arguments:
    attrs -- a list of 2-tuples (structure, attribute)
    db -- a sqlite3 database connection
    reset_existing -- if True then all the needed existing tables will be removed first

    returns:
    a list of modified attribute names of the form: "structure_attribute" (to be SQL compliant)
    """
    attrs_mod = ['_'.join(x) for x in attrs]

    cache_sql = """CREATE TABLE cache (key string PRIMARY KEY, value string)"""

    attrs_sql = ['id integer PRIMARY KEY AUTOINCREMENT', 'corpus_id TEXT']
    attrs_sql += ['%s TEXT' % attr for attr in attrs_mod]
    attrs_sql += ['poscount INTEGER', 'wordcount INTEGER']
    table_sql = """CREATE TABLE item (%s)""" % ', '.join(attrs_sql)

    view_sql = "CREATE VIEW bibliography AS SELECT %s FROM item" % (', '.join(attrs_mod), )

    cursor = db.cursor()
    if reset_existing:
        cursor.execute('DROP TABLE IF EXISTS cache')
        cursor.execute('DROP TABLE IF EXISTS item')
        cursor.execute('DROP VIEW IF EXISTS bibliography')
    cursor.execute(cache_sql)
    cursor.execute(table_sql)
    cursor.execute(view_sql)
    return attrs_mod


def insert_record(record, db):
    """
    Inserts a single item into the database.

    arguments:
    record -- a dictionary column_name -> column_value
    db -- a sqlite3 database connection
    """
    cursor = db.cursor()
    tmp = record.items()
    names = ', '.join([v[0] for v in tmp])
    values_p = ', '.join(len(tmp) * ['?'])
    values = tuple([v[1] for v in tmp])
    sql = "INSERT INTO item (%s) VALUES (%s)" % (names, values_p)
    cursor.execute(sql, values)


def apply_struct_prefix(attrs, prefix, separ='.'):
    """
    Applies a common prefix to provided record keys. If an item has a special name
    (wordcount, poscount, id. corpus_id) then it is omitted.

    arguments:
    attrs -- a dictionary of the form attribute_name -> attribute_value
    prefix -- a prefix to be appended to all the attribute names
    separ -- a separator to be used to join the two values (default is '.')

    returns:
    a modified dictionary where keys have the form: [prefix][separ][attribute name]
    """
    spec_values = ('wordcount', 'poscount', 'id', 'corpus_id')
    return dict([('%s%s%s' % (prefix, separ, k), v) for k, v in attrs.items() if k not in spec_values])


def parse_vert_file(f, encoding, bib_struct):
    """
    Parses a corpus vertical file (or its stripped version containing only tags)
    and stores found metadata (= the data found in structures) and counts positions and words
    (if available).

    arguments:
    f -- a file to be parsed
    encoding -- a python-supported encoding the vertical is encoded in
    bib_struct -- a structure considered as a bibliography item (e.g. opus, doc,...)

    returns:
    a tuple containing parsed "bib_struct" tags (= dictionaries)
    """
    opus_list = []
    metadata = {}
    words = []
    parser = vertparser.Parser(encoding)

    for line in f:
        tag, start, attrs = parser.parse_line(line)
        if start is True:
            if tag == bib_struct:
                metadata.update(attrs)
        elif start is False:
            if tag == bib_struct:
                metadata['wordcount'] = len(set(words))
                metadata['poscount'] = len(words)
                opus_list.append(metadata)
                metadata = {}
                words = []
        else:
            words.append(parser.parse_word(line))
    return tuple(opus_list)


if __name__ == '__main__':
    argparser = argparse.ArgumentParser(description="Vertical file metadata extractor")
    argparser.add_argument('conf_file', metavar="FILE", help="a configuration file")
    argparser.add_argument('-c', '--corpus-id', type=str, help='concrete corpus to be processed '
                           '(if not specified then all the items from the config are used)')
    argparser.add_argument('-r', '--reset-existing', action='store_const', const=True)
    args = argparser.parse_args()
    all_conf = json.load(open(args.conf_file, 'r'))

    for conf in all_conf:
        if args.corpus_id and args.corpus_id != conf['id']:
            print('\nskipping [%s]' % conf['id'])
            continue
        attrs = get_attrs_from_conf(conf)
        if len(attrs) == 0:
            attrs = get_registry_attrs(conf['registryFile'], conf['encoding'])

        db = open_db(conf['dbFile'])
        create_tables(attrs, db, reset_existing=args.reset_existing)
        with open(conf['verticalFile'], 'r') as f:
            data = parse_vert_file(f, conf['encoding'], conf['itemUnit'])
            for row in data:
                row = apply_struct_prefix(row, conf['itemUnit'], separ='_')
                insert_record(row, db)
        db.commit()
        db.close()