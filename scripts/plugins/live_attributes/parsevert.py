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
import sys
import re

import sqlite3

import vertparser


SCRIPT_PATH = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
APP_PATH = os.path.realpath('%s/../../..' % SCRIPT_PATH)
sys.path.insert(0, '%s/lib' % APP_PATH)

import corplib
import settings
settings.load('%s/conf/config.xml' % APP_PATH)

if settings.contains('global', 'manatee_path'):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')


def get_registry_attrs(corpus_id):
    """
    Returns all the structures and their attributes of a specified corpus.

    arguments:
    corpus_id -- a corpus identifier

    returns:
    a list of 2-tuples (structure, attribute)
    """
    cm = corplib.CorpusManager()
    corpus = cm.get_Corpus(corpus_id)
    ans = []
    for attr in re.split(r'\s*,\s*', corpus.get_conf('STRUCTATTRLIST')):
        ans.append(tuple(attr.split('.')))
    return ans


def get_attrs_from_conf(conf):
    """
    Returns a list of structural attributes specified in a parsing-configuration dictionary (key 'attrList')

    arguments:
    conf -- a dictionary containing single vertical parsing configuration (i.e. a single array item from conf. json file)

    returns:
    a list of 2-tuples (structure, attribute)
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


def create_tables(attrs, db, uniq_attr=None, reset_existing=False):
    """
    Creates all the required tables for metadata database.

    arguments:
    attrs -- a list of 2-tuples (structure, attribute)
    uniq_attr -- an attribute (and it structure via struct.attr notation) uniquely identifying a bib. record;
                if None is provided then no bibliography db view is created
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

    if uniq_attr is not None:
        view_sql = "CREATE VIEW bibliography AS SELECT %s FROM item" % \
                   (', '.join(['%s AS id' % uniq_attr.replace('.', '_', 1)] + attrs_mod), )

    cursor = db.cursor()
    if reset_existing:
        cursor.execute('DROP TABLE IF EXISTS cache')
        cursor.execute('DROP TABLE IF EXISTS item')
        cursor.execute('DROP VIEW IF EXISTS bibliography')
    cursor.execute(cache_sql)
    cursor.execute(table_sql)
    if uniq_attr is not None:
        cursor.execute(view_sql)
    return attrs_mod


def insert_record(record, corpus_id, db):
    """
    Inserts a single item into the database.

    arguments:
    record -- a dictionary column_name -> column_value
    corpus_id -- id of the corpus (as used in the respective registry file)
    db -- a sqlite3 database connection
    """
    cursor = db.cursor()
    tmp = record.items()
    spec_fields = ['corpus_id', 'poscount', 'wordcount']
    names = ', '.join([v[0] for v in tmp] + spec_fields)
    values_p = ', '.join((len(tmp) + len(spec_fields)) * ['?'])
    sql = "INSERT INTO item (%s) VALUES (%s)" % (names, values_p)
    values = tuple([v[1] for v in tmp] + [corpus_id, record['poscount'], record['wordcount']])
    cursor.execute(sql, values)


def apply_struct_prefix(attrs, prefix, separ='.'):
    """
    Applies a common prefix to provided record keys. If an item has a special name
    (wordcount, poscount, corpus_id) then it is omitted.

    arguments:
    attrs -- a dictionary of the form attribute_name -> attribute_value
    prefix -- a prefix to be appended to all the attribute names
    separ -- a separator to be used to join the two values (default is '.')

    returns:
    a modified dictionary where keys have the form: [prefix][separ][attribute name]
    """
    spec_values = ('wordcount', 'poscount', 'corpus_id')
    ans = {}
    for k, v in attrs.items():
        if k not in spec_values:
            ans['%s%s%s' % (prefix, separ, k)] = v
        else:
            ans[k] = v
    return ans

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
            print('\nskipped [%s]' % conf['id'])
            continue
        attrs = get_attrs_from_conf(conf)
        if len(attrs) == 0:
            attrs = get_registry_attrs(conf['id'])

        db = open_db(conf['dbFile'])
        create_tables(attrs, db, uniq_attr=conf.get('uniqAttr', None), reset_existing=args.reset_existing)
        with open(conf['verticalFile'], 'r') as f:
            data = parse_vert_file(f, conf['encoding'], conf['itemUnit'])
            for row in data:
                row = apply_struct_prefix(row, conf['itemUnit'], separ='_')
                insert_record(row, corpus_id=conf['id'], db=db)
        db.commit()
        db.close()