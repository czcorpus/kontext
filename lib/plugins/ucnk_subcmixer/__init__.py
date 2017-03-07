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
import logging

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
    return plugins.get('subcmixer').process(plugin_api=ctrl._plugin_api, corpus=ctrl.corp,
                                            corpname=request.form['corpname'],
                                            aligned_corpora=request.form.getlist('aligned_corpora'),
                                            args=json.loads(request.form['expression']))


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

    db_path -- path to a sqlite3 database file where structural metadata are stored
    table_name -- name of table where structural metadata are stored
    corpus_id -- main corpus identifier
    id_attr -- an unique identifier of bibliography items
    aligned_corpora -- a list of corpora identifiers we require the primary corpus to be aligned to
    """

    def __init__(self, db_path, table_name, corpus_id, id_attr, aligned_corpora):
        self._db_path = db_path
        self._table_name = table_name
        self._aligned_corpora = aligned_corpora
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

    def append_aligned_corp_sql(self, sql, args):
        """
        This function adds one or more JOINs attaching
        required aligned corpora to a partial SQL query
        (query without WHERE and following parts).

        Please note that table is self-joined via
        an artificial attribute 'item_id' which identifies
        a single bibliography item across all the languages
        (i.e. it is language-independent). In case of
        the Czech Nat. Corpus and its InterCorp series
        this is typically achieved by modifying
        id_attr value by stripping its language identification
        prefix (e.g. 'en:Adams-Holisticka_det_k:0' transforms
        into 'Adams-Holisticka_det_k:0').

        arguments:
        sql -- a CQL prefix in form 'SELECT ... FROM ...'
               (i.e. no WHERE, LIIMIT, HAVING...)
        args -- arguments passed to this partial SQL

        returns:
        a 2-tuple (extended SQL string, extended args list)
        """
        i = 1
        ans_sql = sql
        ans_args = args[:]
        for ac in self._aligned_corpora:
            ans_sql += ' JOIN {tn} AS m{t2} ON m{t1}.item_id = m{t2}.item_id AND m{t2}.corpus_id = ?'.format(
                tn=self._table_name, t1=1, t2=i + 1)
            ans_args.append(ac)
            i += 1
        return ans_sql, ans_args

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

    def process(self, plugin_api, corpus, corpname, aligned_corpora, args):
        used_structs = set(item['attrName'].split('.')[0] for item in args)
        if len(used_structs) > 1:
            raise SubcMixerException('Subcorpora based on more than a single structure are not supported at the moment.')
        corpus_info = self._corparch.get_corpus_info(plugin_api, corpname)
        db = Database(db_path=corpus_info.metadata.database, table_name='item', corpus_id=corpus_info.id,
                      id_attr=corpus_info.metadata.id_attr, aligned_corpora=aligned_corpora)
        conditions = self._import_task_args(args)
        cat_tree = CategoryTree(conditions, db, 'item', SubcMixer.CORPUS_MAX_SIZE)
        mm = MetadataModel(meta_db=db, category_tree=cat_tree, id_attr=corpus_info.metadata.id_attr.replace('.', '_'))
        corpus_items = mm.solve()

        if corpus_items.size_assembled > 0:
            variables = map(lambda item: item[0],
                            filter(lambda item: item[1] > 0,
                                   [x for x in enumerate(corpus_items.variables)]))
            opus_ids = mm.translate_vars_to_doc_ids(variables)
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

