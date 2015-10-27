# Copyright (c) 2015 Institute of the Czech National Corpus
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

import json
import sqlite3

from plugins.abstract.subcmixer import AbstractSubMixer
from plugins import inject
import plugins
from plugins import PluginException
from category_tree import CategoryTree, CategoryExpression
from metadata_model import MetadataModel
from controller import exposed
import actions.subcorpus
import corplib

__author__ = 'Tomas Machalek <tomas.machalek@gmail.com>'


@exposed(return_type='json', acess_level=1)
def subcmixer_run_calc(ctrl, request):
    try:
        subc_path = ctrl.prepare_subc_path(request.args['corpname'], request.form['subcname'])
        stats = plugins.get('subcmixer').process(subc_path, ctrl.corp, request.args['corpname'],
                                                 json.loads(request.form['expression']))
        return {'status': 'OK', 'stats': stats}
    except Exception as e:
        ctrl.add_system_message('error', unicode(e))
        return {}


class Database(object):
    """
    Provides database operations on the 'metadata' database
    as required by category_tree and metadata_model.
    """

    def __init__(self, db_path, corpus_id, id_attr):
        self._db_path = db_path
        self._conn = sqlite3.connect(db_path)
        self._cur = self._conn.cursor()
        self._count_col = self._find_count_col()
        self._corpus_id = corpus_id
        self._id_attr = id_attr

    @property
    def count_col(self):
        """
        represents a column containing number of positions
        This is auto-detected via 'poscount' string search
        """
        return self._count_col

    @property
    def corpus_id(self):
        return self._corpus_id

    @property
    def id_attr(self):
        return self._id_attr.replace('.', '_')

    def execute(self, sql, args=()):
        return self._cur.execute(sql, args)

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def close(self):
        return self._conn.close()

    def _find_count_col(self):
        data = self._cur.execute('PRAGMA table_info(\'item\')').fetchall()
        try:
            return next(d[1] for d in data if 'poscount' in d[1])
        except StopIteration:
            raise Exception('Failed to find column containing position counts in %s' % self._db_path)


class SubcMixerException(PluginException):
    pass


class SubcMixer(AbstractSubMixer):

    CORPUS_MAX_SIZE = 500000000  # TODO

    def __init__(self, corparch):
        self._corparch = corparch

    def form_data(self, plugin_api):
        return {
            'text_types': plugin_api.text_types
        }

    def _calculate_real_sizes(self, cat_tree, sizes, total_size):
        expressions = [item[3] for item in cat_tree.category_list if item[3]]
        ans = {}
        for i, expression in enumerate(expressions):
            ans[unicode(expression)] = float(sizes[i]) / float(total_size)
        return ans

    def _get_opus_ids(self, db, db_ids):
        db.execute('SELECT %s FROM item WHERE id IN (%s) AND corpus_id = ?' % (
            db.id_attr, ', '.join([str(x) for x in db_ids])), (db.corpus_id,))
        return map(lambda x: x[0], db.fetchall())

    def _create_subcorpus(self, subc_path, corpus, corpus_info, atom_ids):
        structattr = corpus_info.metadata.id_attr.split('.')
        query = '(%s)' % '|'.join(map(lambda x: '%s="%s"' % (structattr[1], x), atom_ids))
        corplib.create_subcorpus(subc_path, corpus, structattr[0], query)

    def process(self, subc_path, corpus, corpname, conditions):
        corpus_info = self._corparch.get_corpus_info(corpname)
        db = Database(corpus_info.metadata.database, corpus_info.id,
                      corpus_info.metadata.id_attr)
        conditions = [[c['id'], c['parentId'], c['ratio'], CategoryExpression.create(c['expr'])]
                      for c in conditions]
        cat_tree = CategoryTree(conditions, db, 'item', SubcMixer.CORPUS_MAX_SIZE)
        mm = MetadataModel(db, cat_tree)
        corpus_items = mm.solve()
        if corpus_items.size_assembled > 0:
            variables = map(lambda item: item[0],
                            filter(lambda item: item[1] > 0,
                                   [x for x in enumerate(corpus_items.variables, 1)]))
            self._create_subcorpus(subc_path, corpus, corpus_info, self._get_opus_ids(db, variables))
            return self._calculate_real_sizes(cat_tree, corpus_items.category_sizes, corpus_items.size_assembled)

        else:
            raise SubcMixerException('Corpus composition failed. '
                                     'One of the provided conditions generates no data.')

    def export_actions(self):
        return {actions.subcorpus.Subcorpus: [subcmixer_run_calc]}


@inject('corparch')
def create_instance(settings, corparch):
    return SubcMixer(corparch)

