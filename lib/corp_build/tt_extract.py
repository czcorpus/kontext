# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
This is a script specific to the Institute of the Czech National Corpus.
It extracts information from DIAKORP* vertical files and creates a database
of respective meta-data.

task configuration looks like this:

{
    "syn2015": {
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
import gzip
import functools

import vertparser


class DatabaseOps(object):

    def __init__(self, db, atom_structure, uniq_attr):
        self._db = db
        self._as = atom_structure
        self._col_prefix = '%s_' % self._as.name
        self._uniq_col = self._col_prefix + uniq_attr
        self._cols = [(self._col_prefix + item.name, unicode) for item in self._as.attributes]
        self._cols.extend([('wordcount', int), ('poscount', int)])
        self._cols_map = dict(self._cols)

    def execute_sql(self, sql):
        cursor = self._db.cursor()
        cursor.execute(sql)

    @staticmethod
    def type_to_sql(t):
        return {unicode: 'text', int: 'integer'}.get(t, None)

    def insert_record(self, rec):
        """
        Inserts an atomic record. Operation is not committed.

        arguments:
        rec -- a dictionary containing record data
        """
        def type_cast(x):
            return self._cols_map.get(x, unicode)(x) if x is not None else x

        data = tuple([type_cast(rec.get(x[0], None)) for x in self._cols])
        cursor = self._db.cursor()
        cursor.execute('INSERT INTO item (%s) VALUES (%s)' % (', '.join([x[0] for x in self._cols]),
                                                              (', '.join(len(self._cols) * '?'))), data)

    def finish(self):
        self._db.commit()

    def create_cache_table(self):
        self.execute_sql('CREATE TABLE cache ( key string PRIMARY KEY, value string )')

    def create_item_table(self):
        cols_sql = ', '.join(['%s %s' % (col, self.type_to_sql(col_type)) for col, col_type in self._cols])
        self.execute_sql('create table item (id integer PRIMARY KEY AUTOINCREMENT, %s)' % cols_sql)

    def create_view(self):
        sql = 'CREATE VIEW bibliography as SELECT ... FROM item'
        # TODO

    def create_schema(self):
        self.create_cache_table()
        self.create_item_table()
        self.create_view()
        self._db.commit()


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


def parse_file(in_file, item_tag, virtual_tags, corpname, encoding):
    """
    Parses a corpus vertical file (or its stripped version containing only tags)

    arguments:
    f -- a file to be parsed
    item_tag -- an atomic structure used as a database record (all upper structures are added,
                all children structures are ignored)
    virtual_tags -- a list of tags to be interpreted as common positions
    corpname -- a corpus id
    encoding -- vertical file encoding (the identifier must be known to Python)

    yields:
    a dict until all the rows are processed
    """
    pos_count = 0
    parser = vertparser.Parser(encoding=encoding)
    stack = []
    print(virtual_tags)
    for line in in_file:
        tag, start, attrs = parser.parse_line(line)
        if start is True:
            if tag in virtual_tags:
                pos_count += 1
            else:
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
                try:
                    stack.pop()
                except Exception as e:
                    print('ERROR: %s, elm: %s, pos:  %s' % (e, tag, pos_count))
        elif tag == '#SELF':
            pass  # self closing tag has no effect
        else:
            pos_count += 1


def create_interval_char_map(conf):
    ans = {}
    if 'intervalChar' in conf:
        ans[conf['intervalChar']] = 'both'
    if 'rightIntervalChar' in conf:
        ans[conf['rightIntervalChar']] = 'right'
    if 'leftIntervalChar' in conf:
        ans[conf['leftIntervalChar']] = 'left'
    return ans


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: ucnk_syn2015 IMPORT_CONF CORPUS_ID')
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
    db_ops = DatabaseOps(db=db, atom_structure=conf['atomStructure'], uniq_attr=conf['uniqCol'])
    db_ops.create_schema()

    vert_path = conf['verticalFile']
    if not vert_path[0] == '/':
        vert_path = os.path.abspath(vert_path)

    val_lengths = vertparser.ValLengthCalculator(conf)
    if vert_path.endswith('.gz'):
        open_vf = functools.partial(gzip.open, vert_path, 'rb')
    else:
        open_vf = functools.partial(open, vert_path, 'rb')
    with open_vf() as f:
        item_gen = parse_file(f, item_tag=conf['atomStructure'], corpname=corpus_id,
                              encoding=conf['encoding'], virtual_tags=conf.get('virtualTags', []))
        i = 0
        for div in item_gen:
            db_ops.insert_record(div)
            val_lengths.insert(div)
            i += 1
        val_lengths.finish(i)
        print('-------------------------')
        print('>>> Processed %d <%s> element(s)' % (i, conf['atomStructure']))
        print('')
        print(val_lengths.format_result())
    db.commit()