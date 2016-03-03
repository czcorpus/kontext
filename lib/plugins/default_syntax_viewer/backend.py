# Copyright (c) 2016 Czech National Corpus
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

import os
import json
import sqlite3

from plugins.abstract.syntax_viewer import SearchBackend


class Sqlite3SearchBackend(SearchBackend):
    """
    Required database table:
    CREATE TABLE data ( id text primary key, json text );
    """

    def __init__(self, conf):
        self._conf = conf

    def _open_db(self, name):
        return sqlite3.connect(self._conf[name]['path'])

    def get_data(self, corpus_id, sentence_id):
        import logging
        logging.getLogger(__name__).debug('Backend search, corp: %s, id: %s' % (corpus_id, sentence_id,))
        db = self._open_db(corpus_id)
        cursor = db.cursor()
        cursor.execute('SELECT json FROM data WHERE id = ?', (sentence_id,))
        ans = cursor.fetchone()
        logging.getLogger(__name__).debug('db ans: %s' % (ans,))
        path = os.path.join(os.path.dirname(__file__), 'test.json')
        with open(path, 'rb') as f:
            return json.load(f)

