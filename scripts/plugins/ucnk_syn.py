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
It extracts information from SYN* vertical files and creates a database
of respective meta-data.
"""

import sys
import os
import sqlite3

import vertparser as vp

vp.ENCODING = 'iso-8859-2'

SCHEMA = (

    """CREATE TABLE cache (
    key string PRIMARY KEY,
    value string
    )""",

    """create table opus (
        id integer PRIMARY KEY AUTOINCREMENT,
        opus_id TEXT,
        opus_autor TEXT,
        opus_nazev TEXT,
        opus_nakladatel TEXT,
        opus_mistovyd TEXT,
        opus_rokvyd TEXT,
        opus_isbnissn TEXT,
        opus_preklad TEXT,
        opus_srclang TEXT,
        opus_txtype_group TEXT,
        opus_txtype TEXT,
        opus_genre TEXT,
        opus_med TEXT,
        opus_poscount INTEGER,
        opus_wordcount INTEGER
    )""",
    "CREATE INDEX opus_txtype_group_idx ON opus(opus_txtype_group)",
    "CREATE INDEX opus_txtype_idx ON opus(opus_txtype)",
    "CREATE INDEX opus_med_idx ON opus(opus_med)"
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


def create_schema(db):
    """
    Creates database schema and inserts some initial data (corpora names).
    Operations are not committed.

    arguments:
    db -- database connection
    """
    cursor = db.cursor()
    for sql in SCHEMA:
        cursor.execute(sql)


def insert_record(db, rec):
    """
    Inserts a "div" record (along with its parent "doc" record) into a database.
    Operation is not committed.

    arguments:
    db -- a database connection
    corpus_id -- identifier of a corpus where the record belongs
    rec -- a dictionary containing record data
    """
    cursor = db.cursor()
    cursor.execute("INSERT INTO opus "
                   "(opus_id, opus_autor, opus_nazev, opus_nakladatel, opus_mistovyd, opus_rokvyd, opus_isbnissn, "
                   "opus_preklad, opus_srclang, opus_txtype_group, opus_txtype, opus_genre, opus_med, opus_wordcount,"
                   "opus_poscount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                   (rec.get('id'), rec.get('author'), rec.get('nazev'), rec.get('nakladatel'), rec.get('mistovyd'),
                   rec.get('rokvyd', ''), rec.get('isbnissn', ''), rec.get('preklad'),
                   rec.get('srclang', ''), rec.get('txtype_group', ''), rec.get('txtype', ''), rec.get('genre', ''),
                   rec.get('med', ''), rec.get('wordcount', ''), rec.get('poscount', '')))


def parse_file(f):
    """
    Parses a corpus vertical file (or its stripped version containing only tags)

    arguments:
    f -- a file to be parsed

    returns:
    a tuple containing parsed div tags
    """
    opus_list = []
    metadata = {}

    words = []

    for line in f:
        tag, start, attrs = vp.parse_line(line)
        if start is True:
            if tag == 'opus':
                print('t = %s, start: %s, attrs: %s' % (tag, start, attrs))
                metadata.update(attrs)
        elif start is False:
            if tag == 'opus':
                metadata['wordcount'] = len(set(words))
                metadata['poscount'] = len(words)
                opus_list.append(metadata)
                metadata = {}
                words = []
        else:
            words.append(vp.parse_word(line))
    return tuple(opus_list)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Two arguments are required: 1) a path to a corpus vertical file, 2) a database file')
        sys.exit(1)

    db_path = sys.argv[2]
    db = open_db(db_path)
    create_schema(db)

    corpus_path = sys.argv[1]
    if not corpus_path[0] == '/':
        corpus_path = os.path.abspath(corpus_path)

    print('\nProcessing file %s' % corpus_path)

    with open(corpus_path, 'r') as f:
        opus_list = parse_file(f)
        print('\tOPUS objects found: %s' % len(opus_list))
        for opus in opus_list:
            insert_record(db, opus)
    db.commit()