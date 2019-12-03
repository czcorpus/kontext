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

    def __init__(self, status, variables, size_assembled, category_sizes, used_bounds, num_texts=None):
        self.status = status
        self.variables = variables
        self.size_assembled = size_assembled
        self.category_sizes = category_sizes
        self.num_texts = num_texts
        self.used_bounds = [np.round(b) for b in used_bounds]

    def __repr__(self):
        return 'CorpusComposition(status: %s, size: %s, num_texts: %s, num_vars: %s)' % (
            self.status, self.size_assembled, self.num_texts, len(self.variables)
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
        # text_sizes and _id_map both contain all the documents from the corpus
        # no matter whether they have matching aligned counterparts
        self.num_texts = len(self.text_sizes)
        self.b = [0] * (self.c_tree.num_categories - 1)
        self.A = np.zeros((self.c_tree.num_categories, self.num_texts))
        used_ids = set()
        self._init_ab(self.c_tree.root_node, used_ids)
        # for items without aligned counterparts we create
        # conditions fulfillable only for x[i] = 0
        self._init_ab_nonalign(used_ids)

    def _get_text_sizes(self):
        """
        List all the texts matching main corpus. This will be the
        base for the 'A' matrix in the optimization problem.
        In case we work with aligned corpora we still want
        the same result here as the non-aligned items from
        the primary corpus will not be selected in
        _init_ab() due to applied self JOIN
        (append_aligned_corp_sql())

        Also generate a map "db_ID -> row index" to be able
        to work with db-fetched subsets of the texts and
        matching them with the 'A' matrix (i.e. in a filtered
        result a record has a different index then in
        all the records list).
        """
        sql = 'SELECT m1.id, m1.{cc} FROM {tn} AS m1 '.format(
            cc=self._db.count_col, tn=self.c_tree.table_name)
        args = []
        sql += ' WHERE m1.corpus_id = ? ORDER BY m1.id'
        args.append(self._db.corpus_id)
        sizes = []
        id_map = {}
        i = 0
        for row in self._db.execute(sql, args):
            sizes.append(row[1])
            id_map[row[0]] = i
            i += 1
        return sizes, id_map

    def _init_ab_nonalign(self, used_ids):
        # Now we process items with no aligned counterparts.
        # In this case we must define a condition which will be
        # fulfilled iff X[i] == 0
        for k, v in list(self._id_map.items()):
            if k not in used_ids:
                for i in range(1, len(self.b)):
                    self.A[i][v] = self.b[i] * 2 if self.b[i] > 0 else 10000

    def _init_ab(self, node, used_ids):
        """
        Initialization method for coefficient matrix (A) and vector of bounds (b)
        Recursively traverses all nodes of given categoryTree starting from its root.
        Each node is processed in order to generate one inequality constraint.

        args:
        node -- currently processed node of the categoryTree
        used_ids -- a set of ids used in previous nodes
        """
        if node.metadata_condition is not None:
            sql_items = ['m1.{0} {1} ?'.format(mc.attr, mc.op)
                         for subl in node.metadata_condition for mc in subl]
            sql_args = []
            sql = 'SELECT m1.id, m1.{cc} FROM {tn} AS m1 '.format(cc=self._db.count_col,
                                                                  tn=self.c_tree.table_name)

            sql, sql_args = self._db.append_aligned_corp_sql(sql, sql_args)

            sql += ' WHERE {where} AND m1.corpus_id = ?'.format(where=' AND '.join(sql_items))
            sql_args += [mc.value for subl in node.metadata_condition for mc in subl]  # 'WHERE' args
            sql_args.append(self._db.corpus_id)
            self._db.execute(sql, sql_args)
            for row in self._db.fetchall():
                self.A[node.node_id - 1][self._id_map[row[0]]] = row[1]
                used_ids.add(row[0])
            self.b[node.node_id - 1] = node.size

        if len(node.children) > 0:
            for child in node.children:
                self._init_ab(child, used_ids)

    def solve(self):
        """
        A method that converts the matrix notation of LP model to format used by PULP
        library and solves it.

        returns:
        object representation of resulting composition
        """

        if sum(self.b) == 0:
            return CorpusComposition(None, [], 0, [], [], 0)

        x_min = 0
        x_max = 1
        num_conditions = len(self.b)
        x = pulp.LpVariable.dicts('x', list(range(self.num_texts)), x_min, x_max)
        lp_prob = pulp.LpProblem('Minmax Problem', pulp.LpMaximize)
        lp_prob += pulp.lpSum(x), 'Minimize_the_maximum'
        for i in range(num_conditions):
            label = 'Max_constraint_%d' % i
            condition = pulp.lpSum([self.A[i][j] * x[j]
                                    for j in range(self.num_texts)]) <= self.b[i]
            lp_prob += condition, label

        stat = lp_prob.solve()

        variables = [0] * self.num_texts
        # transform Pulp's variables (x_[number]) back to
        # the indices we need
        for v in lp_prob.variables():
            if v.name == '__dummy':
                continue
            i = int(v.name[2:len(v.name)])
            variables[i] = np.round(v.varValue, decimals=0)

        category_sizes = []
        for c in range(0, self.c_tree.num_categories - 1):
            cat_size = self._get_category_size(variables, c)
            category_sizes.append(cat_size)
        size_assembled = self._get_assembled_size(variables)

        return CorpusComposition(status=pulp.LpStatus[stat], variables=variables, size_assembled=size_assembled,
                                 category_sizes=category_sizes, used_bounds=self.b, num_texts=sum(variables))

    def _get_assembled_size(self, results):
        return np.dot(results, self.text_sizes)

    def _get_category_size(self, results, cat_id):
        category_sizes = self.A[cat_id][:]
        return np.dot(results, category_sizes)
