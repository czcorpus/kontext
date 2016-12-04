# Copyright (c) 2015 Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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
from collections import defaultdict

from plugins.abstract.subcmixer import AbstractSubcMixer
from plugins import inject
import plugins
from plugins import PluginException
from category_tree import CategoryTree, CategoryExpression
from metadata_model import MetadataModel
from controller import exposed
import actions.subcorpus
import corplib


@exposed(return_type='json', acess_level=1)
def subcmixer_run_calc(ctrl, request):
    try:
        return plugins.get('subcmixer').process(ctrl._plugin_api, ctrl.corp, request.form['corpname'],
                                                json.loads(request.form['expression']))
    except Exception as e:
        ctrl.add_system_message('error', unicode(e))
        return {}


@exposed(return_type='json', access_level=1)
def subcmixer_create_subcorpus(ctrl, request):
    if not request.form['subcname']:
        ctrl.add_system_message('error', 'Missing subcorpus name')
        return {}
    else:
        subc_path = ctrl.prepare_subc_path(request.form['corpname'], request.form['subcname'])
        opus_ids = request.form['ids'].split(',')
        id_attr = request.form['idAttr'].split('.')
        result = corplib.create_subcorpus(subc_path, ctrl.corp, id_attr[0],
                                          '|'.join('%s="%s"' % (id_attr[1], x) for x in opus_ids))
        return dict(status=result)


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


class SubcMixer(AbstractSubcMixer):

    CORPUS_MAX_SIZE = 500000000  # TODO

    def __init__(self, corparch):
        self._corparch = corparch

    @staticmethod
    def _calculate_real_sizes(cat_tree, sizes, total_size):
        expressions = [item[3] for item in cat_tree.category_list if item[3]]
        ans = dict(attrs=[], total=total_size)
        for i, expression in enumerate(expressions):
            ans['attrs'].append((unicode(expression), float(sizes[i]) / float(total_size),))
        return ans

    @staticmethod
    def _get_opus_ids(db, db_ids):
        db.execute('SELECT %s FROM item WHERE id IN (%s) AND corpus_id = ?' % (
            db.id_attr, ', '.join([str(x) for x in db_ids])), (db.corpus_id,))
        return map(lambda x: x[0], db.fetchall())

    @staticmethod
    def _import_task_args(args):
        """
        generate IDs and parent IDs for
        passed conditions
        """
        ans = []
        ans.append([[0, None, 1, None]])

        grouped = defaultdict(lambda: [])
        for item in args:
            grouped[item['attrName']].append(item)

        counter = 1
        for expressions in grouped.values():
            tmp = []
            for pg in ans[-1]:
                for item in expressions:
                    tmp.append([
                        counter,
                        pg[0],
                        float(item['ratio']) / 100.,
                        CategoryExpression(item['attrName'], '==', item['attrValue'])])
                    counter += 1
            ans.append(tmp)
        ret = []
        for item in ans:
            for subitem in item:
                ret.append(subitem)
        return ret

    def process(self, plugin_api, corpus, corpname, args):
        used_structs = set(item['attrName'].split('.')[0] for item in args)
        if len(used_structs) > 1:
            raise SubcMixerException('Subcorpora based on more than a single structure are not supported at the moment.')
        corpus_info = self._corparch.get_corpus_info(plugin_api, corpname)
        db = Database(corpus_info.metadata.database, corpus_info.id,
                      corpus_info.metadata.id_attr)
        conditions = self._import_task_args(args)
        cat_tree = CategoryTree(conditions, db, 'item', SubcMixer.CORPUS_MAX_SIZE)
        mm = MetadataModel(db, cat_tree)
        corpus_items = mm.solve()

        if corpus_items.size_assembled > 0:
            variables = map(lambda item: item[0],
                            filter(lambda item: item[1] > 0,
                                   [x for x in enumerate(corpus_items.variables, 1)]))
            opus_ids = self._get_opus_ids(db, variables)
            ans = {}
            ans.update(self._calculate_real_sizes(cat_tree, corpus_items.category_sizes, corpus_items.size_assembled))
            ans['ids'] = opus_ids,
            ans['structs'] = list(used_structs)
            return ans

        else:
            raise SubcMixerException('Corpus composition failed. '
                                     'One of the provided conditions generates no data.')

    def export_actions(self):
        return {actions.subcorpus.Subcorpus: [subcmixer_run_calc, subcmixer_create_subcorpus]}


@inject('corparch')
def create_instance(settings, corparch):
    return SubcMixer(corparch)

