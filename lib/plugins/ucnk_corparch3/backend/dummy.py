# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

from hashlib import md5


class DummyCorpusInfo(object):

    def __init__(self):
        pass

    def get_corpus_size(self, corp_id):
        return ord(corp_id[0]) * 1000000

    def get_corpus_name(self, corp_id):
        return '{0} as corpus name'.format(corp_id)

    def get_corpus_description(self, corp_id):
        return 'A description of {0}'.format(corp_id)

    def get_corpus_encoding(self, corp_id):
        return 'utf-8'

    def get_data_path(self, corp_id):
        return '/var/local/corpora/indexed/{0}'.format(corp_id)


class DummyShared(DummyCorpusInfo):

    def __init__(self):
        super(DummyShared, self).__init__()
        self._desc = {}
        self._ttdesc_id = 0
        self._articles = {}  # entry hash => db ID

    def get_ref_ttdesc(self, ident):
        return self._desc.get(ident, None)

    def add_ref_art(self, ident, value):
        self._desc[ident] = value

    @property
    def ttdesc_id_inc(self):
        self._ttdesc_id += 1
        return self._ttdesc_id

    @property
    def ttdesc_id(self):
        return self._ttdesc_id

    def reuse_article(self, entry):
        ahash = md5(entry).hexdigest()
        if ahash in self._articles:
            return self._articles[ahash]
        return None

    def add_article(self, entry, db_id):
        ahash = md5(entry).hexdigest()
        self._articles[ahash] = db_id

    def registry_exists(self, corpus_id, variant):
        return False


class DummyCursor(object):

    def __init__(self, dictionary):
        self._result = []
        self._dict = dictionary

    @staticmethod
    def _import_v(v):
        if isinstance(v, str):
            return v.replace('\'', r'\'')
        elif v is None:
            return ''
        else:
            return str(v)

    def execute(self, sql, args=()):
        self._result = []
        if sql.startswith('SELECT COUNT(*) AS cnt FROM'):
            if self._dict:
                self._result = [dict(cnt=1)]
            else:
                self._result = [[1]]
        elif sql.startswith('SELECT COUNT(*) AS num FROM corpus_structure'):
            if self._dict:
                self._result = [dict(num=0)]
            else:
                self._result = [[0]]
        print((sql % tuple('\'{0}\''.format(self._import_v(s)) for s in args)))

    def fetchone(self):
        return self._result[0]

    def fetchall(self):
        return self._result


class DummySQL(object):
    """
    """

    def __init__(self):
        pass

    def cursor(self, dictionary=True, buffered=False):
        return DummyCursor(dictionary)

    @property
    def connection(self):
        return None

    def commit(self):
        pass

    def rollback(self):
        pass
