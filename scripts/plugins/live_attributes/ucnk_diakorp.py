#!/usr/bin/env python
# Copyright (c) 2014 Institute of the Czech National Corpus
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
This is a script specific to the Institute of the Czech National Corpus.
It extracts information from DIAKORP* vertical files and creates a database
of respective meta-data.

task configuration looks like this:

{
    "diakorp_v2": {
        "verticalFile": "/path/to/vertical/file",
        "atomStructure": "sp",
        "encoding": "iso-8859-2",
        "dbFile": "/path/to/sqlite3/database/file",
        "virtualTags": ["e"]
    },
    ... etc...
}
"""

import sys
import os
import sqlite3
import json

import vertparser


ITEM_COLS = [
    ('corpus_id', unicode),
    ('doc_titul', unicode),
    ('doc_autor', unicode),
    ('doc_rok', unicode),
    ('doc_rok_lft', int),
    ('doc_rok_rgt', int),
    ('doc_diakorp', unicode),
    ('wordcount', int),
    ('poscount', int)
]

ITEM_COLS_MAP = dict(ITEM_COLS)


def type_to_sql(t):
    return {unicode: 'text', int: 'integer'}.get(t, None)


SCHEMA = (
    """CREATE TABLE cache (
    key string PRIMARY KEY,
    value string
    )""",

    """create table item (
    id integer PRIMARY KEY AUTOINCREMENT,
    %s
    );""" % (', '.join(['%s %s' % (col, type_to_sql(col_type)) for col, col_type in ITEM_COLS])),

    """CREATE VIEW bibliography as SELECT doc_titul as id, doc_titul, doc_autor, doc_rok,
     doc_diakorp from item"""
)


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


def create_schema(db_conn):
    """
    Creates database schema and inserts some initial data (corpora names).
    Operations are not committed.

    arguments:
    db_conn -- database connection
    """
    cursor = db_conn.cursor()
    for sql in SCHEMA:
        cursor.execute(sql)


def insert_record(db_conn, rec):
    """
    Inserts an atomic record. Operation is not committed.

    arguments:
    db_conn -- a database connection
    rec -- a dictionary containing record data
    """
    type_cast = lambda x: ITEM_COLS_MAP.get(x, unicode)(x) if x is not None else x
    data = tuple([type_cast(rec.get(x[0], None)) for x in ITEM_COLS])
    cursor = db_conn.cursor()
    cursor.execute("INSERT INTO item (%s) VALUES (%s)" % (', '.join([x[0] for x in ITEM_COLS]),
                                                          (', '.join(len(ITEM_COLS) * '?'))),
                   data)


def dump_stack(stack):
    """
    Dumps current structure stack to a dictionary.
    Each entry name contains also its tag name as a prefix
    (e.g. <sp foo="10"> --> {'sp_foo': '10'}

    arguments:
    stack -- a list of 2-tuples (tag_name, tag_attr_dict) used as a stack
    """
    ans = {}
    for item, attrs in stack:
        for k, v in attrs.items():
            ans['%s_%s' % (item, k)] = v
    return ans


def apply_range_attribs(tag_name, attrs, range_attrs):
    for k in attrs.keys():
        if '%s.%s' % (tag_name, k) in range_attrs:
            if '/' in attrs[k]:
                c, r = map(lambda x: int(x), attrs[k].split('/'))

            else:
                c = int(attrs[k])
                r = 0
            attrs['%s_lft' % k] = c - r
            attrs['%s_rgt' % k] = c + r


def parse_file(f, item_tag, virtual_tags, range_attrs, corpname, encoding):
    """
    Parses a corpus vertical file (or its stripped version containing only tags)

    arguments:
    f -- a file to be parsed
    item_tag -- an atomic structure used as a database record (all upper structures are added,
                all children structures are ignored)
    virtual_tags -- a list of tags to be interpreted as common positions
    range_attrs -- a list of attributes with uncertain value (= a center and a range)
    corpname -- a corpus id
    encoding -- vertical file encoding (the identifier must be known to Python)

    yields:
    a dict until all the rows are processed
    """

    pos_count = 0
    parser = vertparser.Parser(encoding=encoding)
    stack = []
    print(virtual_tags)
    for line in f:
        tag, start, attrs = parser.parse_line(line)
        if start is True:
            if tag in virtual_tags:
                pos_count += 1
            else:
                apply_range_attribs(tag, attrs, range_attrs)
                stack.append((tag, attrs))
        elif start is False:
            if tag in virtual_tags:
                pos_count += 1
            else:
                if tag == item_tag:
                    item = dump_stack(stack)
                    item['corpus_id'] = corpname
                    item['poscount'] = pos_count
                    pos_count = 0
                    yield item
                stack.pop()
        else:
            pos_count += 1


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: ucnk_diakorp IMPORT_CONF CORPUS_ID')
        sys.exit(1)

    conf = json.load(open(sys.argv[1], 'rb'))
    corpus_id = sys.argv[2]
    try:
        conf = conf[corpus_id]
    except KeyError:
        print('Failed to find configuration for %s' % corpus_id)
        sys.exit(1)
    print('-------------------------')
    print('\n'.join(['%s: %s' % (k, v) for k, v in conf.items()]))

    db = open_db(conf['dbFile'])
    create_schema(db)

    vert_path = conf['verticalFile']
    if not vert_path[0] == '/':
        vert_path = os.path.abspath(vert_path)

    with open(vert_path, 'r') as f:
        item_gen = parse_file(f, item_tag=conf['atomStructure'], corpname=corpus_id,
                              encoding=conf['encoding'], virtual_tags=conf.get('virtualTags', []),
                              range_attrs=conf.get('rangeAttrs', []))
        i = 0
        for div in item_gen:
            insert_record(db, div)
            i += 1
        print('-------------------------')
        print('>>> Processed %d <%s> element(s)' % (i, conf['atomStructure']))
    db.commit()