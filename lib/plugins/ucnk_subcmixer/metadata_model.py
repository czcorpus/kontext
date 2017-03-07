# Copyright (c) 2015 Institute of the Czech National Corpus
# Copyright (c) 2015 Martin Stepan <martin.stepan@ff.cuni.cz>,
#                    Tomas Machalek <tomas.machalek@gmail.com>
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

import numpy as np
import pulp


class CorpusComposition(object):

    def __init__(self, variables, size_assembled, category_sizes, used_bounds, num_texts):
        self.variables = variables
        self.size_assembled = size_assembled
        self.category_sizes = category_sizes
        self.num_texts = num_texts
        self.used_bounds = [np.round(b) for b in used_bounds]

    def __repr__(self):
        return 'CorpusComposition(size: %s, num_texts: %s, num_vars: %s)' % (
            self.size_assembled, self.num_texts, len(self.variables)
            if self.variables is not None else None)


class MetadataModel:
    """
    This class represents the linear optimization model for given categoryTree.

    arguments:

    meta_db -- a Database instance
    category_tree -- a tree holding the user input
    id_attr -- an unique identifier of a 'bibliography' item (defined in corpora.xml).
    """

    def __init__(self, meta_db, category_tree, id_attr):
        self._db = meta_db
        self.c_tree = category_tree
        self._id_attr = id_attr

        self.text_sizes, self._id_map = self._get_text_sizes()
        self.num_texts = len(self.text_sizes)
        self.b = [0] * (self.c_tree.num_categories - 1)
        self.A = np.zeros((self.c_tree.num_categories, self.num_texts))
        self._init_ab(self.c_tree.root_node)

    def _get_text_sizes(self):
        """
        List all the texts matching main corpus and optional
        aligned corpora. This will be the base for the 'A'
        matrix in the optimization problem.

        Also generate a map "db_ID -> row index" to be able
        to work with db-fetched subsets of the texts and
        matching them with the 'A' matrix (i.e. in a filtered
        result a record has a different index then in
        all the records list).
        """
        sql = 'SELECT m1.{cc}, m1.{item_id} FROM {tn} AS m1 '.format(cc=self._db.count_col,
                                                                     item_id=self._id_attr, tn=self.c_tree.table_name)
        args = []
        sql, args = self._db.append_aligned_corp_sql(sql, args)
        sql += ' WHERE m1.corpus_id = ? ORDER BY m1.id'
        args.append(self._db.corpus_id)
        sizes = []
        id_map = {}
        i = 0
        for row in self._db.execute(sql, args):
            sizes.append(row[0])
            id_map[row[1]] = i
            i += 1
        return sizes, id_map

    def _init_ab(self, node):
        """
        Initialization method for coefficient matrix (A) and vector of bounds (b)
        Recursively traverses all nodes of given categoryTree starting from its root.
        Each node is processed in order to generate one inequality constraint.

        :param node: currently processed node of the categoryTree
        """
        if node.metadata_condition is not None:
            sql_items = [u'm1.%s %s ?' % (mc.attr, mc.op) for subl in node.metadata_condition for mc in subl]
            sql_args = []
            sql = u'SELECT m1.{id_attr}, m1.{cc} FROM {tn} AS m1 '.format(
                    id_attr=self._id_attr, cc=self._db.count_col, tn=self.c_tree.table_name)

            sql, sql_args = self._db.append_aligned_corp_sql(sql, sql_args)

            sql += u' WHERE {where} AND m1.corpus_id = ?'.format(where=u' AND '.join(sql_items))
            sql_args += [mc.value for subl in node.metadata_condition for mc in subl]
            sql_args.append(self._db.corpus_id)

            for row in self._db.execute(sql, sql_args):
                self.A[node.node_id - 1][self._id_map[row[0]]] = row[1]
            self.b[node.node_id - 1] = node.size

        if len(node.children) > 0:
            for child in node.children:
                self._init_ab(child)

    def translate_vars_to_doc_ids(self, vars):
        """
        Transform matrix 'A' row indices back to
        database row identifiers.
        """
        tmp = dict((v, k) for k, v in self._id_map.items())
        return [tmp[i] for i in vars]

    def solve(self):
        """
        A method that converts the matrix notation of LP model to format used by PULP
        library and solves it.

        returns:
        object representation of resulting composition
        """

        if sum(self.b) == 0:
            return CorpusComposition(None, 0, None, [], 0)

        x_min = 0
        x_max = 1
        num_conditions = len(self.b)
        x = pulp.LpVariable.dicts('x', range(self.num_texts), x_min, x_max)
        lp_prob = pulp.LpProblem('Minmax Problem', pulp.LpMaximize)
        lp_prob += pulp.lpSum(x), 'Minimize_the_maximum'
        for i in range(num_conditions):
            label = 'Max_constraint_%d' % i
            condition = pulp.lpSum([self.A[i][j] * x[j] for j in range(self.num_texts)]) <= self.b[i]
            lp_prob += condition, label

        lp_prob.solve()

        variables = [0] * self.num_texts
        # kind of ugly
        for v in lp_prob.variables():
            if v.name == "__dummy":
                continue
            i = int(v.name[2:len(v.name)])
            variables[i] = np.round(v.varValue, decimals=0)

        category_sizes = []
        for c in range(0, self.c_tree.num_categories-1):
            cat_size = self._get_category_size(variables, c)
            category_sizes.append(cat_size)
        size_assembled = self._get_assembled_size(variables)

        return CorpusComposition(variables, size_assembled, category_sizes, self.b, sum(variables))

    def _get_assembled_size(self, results):
        return np.dot(results, self.text_sizes)

    def _get_category_size(self, results, cat_id):
        category_sizes = self.A[cat_id][:]
        return np.dot(results, category_sizes)


