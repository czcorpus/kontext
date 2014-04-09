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

import vertparser as vp

CORPORA = ('intercorp_ar', 'intercorp_be', 'intercorp_bg', 'intercorp_ca', 'intercorp_cs', 'intercorp_da',
           'intercorp_de', 'intercorp_el', 'intercorp_en', 'intercorp_es', 'intercorp_et', 'intercorp_fi',
           'intercorp_fr', 'intercorp_hi', 'intercorp_hr', 'intercorp_hu', 'intercorp_it', 'intercorp_lt',
           'intercorp_lv', 'intercorp_mk', 'intercorp_mt', 'intercorp_nl', 'intercorp_no', 'intercorp_pl',
           'intercorp_pt', 'intercorp_ro', 'intercorp_ru', 'intercorp_sk', 'intercorp_sl', 'intercorp_sr',
           'intercorp_sv', 'intercorp_sy', 'intercorp_uk')

SCHEMA = (
    """CREATE TABLE cache (
    key string PRIMARY KEY,
    value string
    )""",

    """create table item (
    id integer PRIMARY KEY AUTOINCREMENT,
    corpus_id string,
    div_id string,
    doc_id string,
    doc_group string,
    div_group string,
    doc_lang string,
    doc_version string,
    doc_txtype string,
    doc_pubyear integer,
    doc_wordcount integer,
    div_author string,
    div_title string,
    div_publisher string,
    div_pubplace string,
    div_pubyear integer,
    div_pubmonth integer,
    div_origyear integer,
    div_isbn string,
    div_txtype string,
    div_comment string,
    div_original string,
    div_srclang string,
    div_translator string,
    div_transsex string,
    div_authsex string,
    div_transcomment string,
    div_collectionauthor string,
    div_collectiontitle string,
    div_volume string,
    div_pages integer,
    wordcount integer,
    poscount integer
    );""",

    "CREATE INDEX doc_id_idx ON item(doc_id)",
    "CREATE INDEX div_group_idx ON item(div_group)",
    "CREATE INDEX div_txtype_idx ON item(div_txtype)"
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
    cursor.execute("INSERT INTO item (div_id, corpus_id, doc_id, doc_group, doc_lang, doc_version, doc_txtype, "
                   "doc_pubyear, doc_wordcount, div_author, div_title, div_publisher, div_pubplace, div_pubyear, "
                   "div_pubmonth, div_origyear, div_isbn, div_txtype, div_comment, div_original, div_srclang, "
                   "div_translator, div_transsex, div_authsex, div_transcomment, div_collectionauthor, "
                   "div_collectiontitle, div_volume, div_pages, wordcount, poscount) "
                   "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                  (rec.get('id'), corpus_id,
                   doc.get('id'), doc.get('group'), doc.get('lang'), doc.get('version'), doc.get('txtype', ''),
                   doc.get('pubyear', ''), doc.get('wordcount'),
                   rec.get('author', ''), rec.get('title', ''), rec.get('publisher', ''), rec.get('pubplace', ''),
                   rec.get('pubyear', ''), rec.get('pubmonth', ''), rec.get('origyear', ''),  rec.get('isbn', ''),
                   rec.get('txtype', ''), rec.get('comment', ''), rec.get('original', ''), rec.get('srclang', ''),
                   rec.get('translator', ''), rec.get('transsex', ''), rec.get('authsex', ''),
                   rec.get('transcomment', ''), rec.get('collectionauthor', ''), rec.get('collectiontitle', ''),
                   rec.get('volume', ''), rec.get('pages', ''), rec.get('div_wordcount', 0), rec.get('poscount', 0)))


def normalize_div_id(id):
    return ':'.join(id.split(':')[1:-1])


def parse_file(f):
    """
    Parses a corpus vertical file (or its stripped version containing only tags)

    arguments:
    f -- a file to be parsed

    returns:
    a tuple containing parsed div tags
    """
    curr_doc = {}
    div_list = []
    metadata = {}

    pos_count = 0

    for line in f:
        tag, start, attrs = vp.parse_line(line)

        if start is True:
            if tag == 'doc':
                curr_doc.update(attrs)
            elif tag == 'div':
                attrs['__doc__'] = curr_doc
                attrs['group'] = curr_doc.get('group')
                attrs['id'] = normalize_div_id(attrs['id'])
                metadata.update(attrs)
        elif start is False:
            if tag == 'div':
                metadata['poscount'] = pos_count
                div_list.append(metadata)
                metadata = {}
                pos_count = 0
            elif tag == 'doc':
                curr_doc = {}
        else:
            pos_count += 1
    return tuple(div_list)


def find_files(root_path):
    """
    arguments:
    root_path -- path to a directory where corpora vertical files (or their stripped versions) are located
                 or a path to a specific vertical file

    returns:
    a tuple containing list of found files
    """
    ans = []
    if os.path.isfile(root_path):
        ans.append(root_path)
    elif os.path.isdir(root_path):
        for item in os.listdir(root_path):
            if re.match(r'^intercorp_[a-z]{2}$', item):
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