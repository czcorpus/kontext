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
It extracts information from InterCorp vertical files and creates a database
of respective meta-data.
"""

import sys
import os
import re
import sqlite3

CORPORA = ('intercorp_ar', 'intercorp_be', 'intercorp_bg', 'intercorp_ca', 'intercorp_cs', 'intercorp_da',
           'intercorp_de', 'intercorp_el', 'intercorp_en', 'intercorp_es', 'intercorp_et', 'intercorp_fi',
           'intercorp_fr', 'intercorp_hi', 'intercorp_hr', 'intercorp_hu', 'intercorp_it', 'intercorp_lt',
           'intercorp_lv', 'intercorp_mk', 'intercorp_mt', 'intercorp_nl', 'intercorp_no', 'intercorp_pl',
           'intercorp_pt', 'intercorp_ro', 'intercorp_ru', 'intercorp_sk', 'intercorp_sl', 'intercorp_sr',
           'intercorp_sv', 'intercorp_sy', 'intercorp_uk')

SCHEMA = (
    """CREATE TABLE corpus (
    id string PRIMARY KEY
    )""",

    """CREATE TABLE cache (
    key string PRIMARY KEY,
    value string
    )""",

    """create table div (
    id integer PRIMARY KEY AUTOINCREMENT,
    div_id string,
    corpus_id string,
    doc_id string,
    doc_group string,
    doc_lang string,
    doc_version string,
    doc_txtype string,
    doc_pubyear integer,
    doc_wordcount integer,
    author string,
    title string,
    publisher string,
    pubplace string,
    pubyear integer,
    pubmonth integer,
    origyear integer,
    isbn string,
    txtype string,
    comment string,
    original string,
    srclang string,
    translator string,
    transsex string,
    authsex string,
    transcomment string,
    collectionauthor string,
    collectiontitle string,
    volume string,
    pages integer,
    wordcount integer,
    FOREIGN KEY(corpus_id) REFERENCES corpus(id)
    );""",

    "CREATE INDEX doc_id_idx ON div(doc_id);"
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
    for corp in CORPORA:
        cursor.execute("INSERT INTO corpus (id) VALUES (?)", (corp,))


def parse_corpname(filename):
    """
    Extracts a corpus name from a respective metadata file. It expects
    that a substring intercorp_[a-z]{2} is present in the file name.

    arguments:
    filename -- name/path of a file

    returns:
    extracted corpus name or None if nothing is found
    """
    ans = re.search(r'(intercorp_[a-z]{2})', filename)
    if ans:
        return ans.group(1)
    return None


def insert_record(db, corpus_id, rec):
    """
    Inserts a "div" record (along with its parent "doc" record) into a database.
    Operation is not committed.

    arguments:
    db -- a database connection
    corpus_id -- identifier of a corpus where the record belongs
    rec -- a dictionary containing record data
    """
    doc = rec['__doc__']
    cursor = db.cursor()
    cursor.execute("INSERT INTO div (div_id, corpus_id, doc_id, doc_group, doc_lang, doc_version, doc_txtype, "
                   "doc_pubyear, doc_wordcount, author, title, publisher, pubplace, pubyear, pubmonth, origyear, isbn, "
                   "txtype, comment, original, srclang, translator, transsex, authsex, transcomment, "
                   "collectionauthor, collectiontitle, volume, pages, wordcount) "
                   "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  (rec.get('id'), corpus_id,
                   doc.get('id'), doc.get('group'), doc.get('lang'), doc.get('version'), doc.get('txtype', ''),
                   doc.get('pubyear', ''), doc.get('wordcount'),
                   rec.get('author', ''), rec.get('title', ''), rec.get('publisher', ''), rec.get('pubplace', ''),
                   rec.get('pubyear', ''), rec.get('pubmonth', ''), rec.get('origyear', ''),  rec.get('isbn', ''),
                   rec.get('txtype', ''), rec.get('comment', ''), rec.get('original', ''), rec.get('srclang', ''),
                   rec.get('translator', ''), rec.get('transsex', ''), rec.get('authsex', ''),
                   rec.get('transcomment', ''), rec.get('collectionauthor', ''), rec.get('collectiontitle', ''),
                   rec.get('volume', ''), rec.get('pages', ''), rec.get('wordcount', ''),))


def parse_tag(s):
    """
    Parses SGML tag's attributes.

    arguments:
    s -- tag string representation

    returns:
    a dictionary attribute_name => attribute_value
    """
    return dict([(x, y.decode('utf-8')) for x, y in re.findall(r'(\w+)="([^"]+)"', s)])


def parse_line(s):
    """
    Parses a line from a corpus vertical file

    arguments:
    s -- a string representing line content

    returns:
    2-tuple (tag_name, attr_dict)
    """
    s = s.strip()
    if s.startswith('<doc'):
        ans = parse_tag(s)
        name = 'doc'
    elif s.startswith('<div'):
        ans = parse_tag(s)
        name = 'div'
    else:
        ans = None
        name = None
    return name, ans


def parse_file(f):
    """
    Parses a corpus vertical file (or its stripped version containing only tags)

    arguments:
    f -- a file to be parsed

    returns:
    a tuple containing parsed div tags
    """
    curr_doc = None
    div_list = []
    for line in f:
        tag, data = parse_line(line)
        if tag == 'doc':
            curr_doc = data
        elif tag == 'div':
            data['__doc__'] = curr_doc
            div_list.append(data)
    return tuple(div_list)


def find_files(root_path):
    """
    arguments:
    root_path -- path to a directory where corpora vertical files (or their stripped versions) are located

    returns:
    a tuple containing list of found files
    """
    ans = []
    for item in os.listdir(root_path):
        if item.startswith('intercorp_'):
            ans.append('%s/%s' % (root_path, item))
    return tuple(ans)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Two arguments are required: 1) a path to corpora metadata directory, 2) a database file')
        sys.exit(1)

    db_path = sys.argv[2]
    db = open_db(db_path)
    create_schema(db)

    root_path = sys.argv[1]
    if not root_path[0] == '/':
        root_path = os.path.abspath(root_path)

    for file_path in find_files(root_path):
        print('\nProcessing file %s' % file_path)
        corpname = parse_corpname(os.path.basename(file_path))
        print('\tcorpus: %s' % corpname)

        with open(file_path, 'r') as f:
            div_list = parse_file(f)
            print('\tDIV objects found: %s' % len(div_list))
            for div in div_list:
                insert_record(db, corpname, div)
    db.commit()