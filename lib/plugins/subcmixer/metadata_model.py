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

__author__ = 'Martin Stepan <martin.stepan@ff.cuni.cz>'

import sqlite3
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
    
    category_tree -- a tree holding the user input
    """

    def __init__(self, category_tree):
        self.c_tree = category_tree
        self.connection = sqlite3.connect(self.c_tree.meta_db)
        self.cur = self.connection.cursor()
        self.cur.execute("SELECT COUNT(*) FROM %s" % self.c_tree.table_name)
        self.num_texts = self.cur.fetchone()[0]
        self.b = [0] * (self.c_tree.num_categories - 1)
        self.A = np.zeros((self.c_tree.num_categories, self.num_texts))
        self._init_ab(self.c_tree.root_node)
        self.text_sizes = [row[0] for row in self.cur.execute("SELECT opus_wordcount FROM item")]

    def _init_ab(self, node):
        """
        Initialization method for coefficient matrix (A) and vector of bounds (b)
        Recursively traverses all nodes of given categoryTree starting from its root.
        Each node is processed in order to generate one inequality constraint.

        :param node: currently processed node of the categoryTree
        """

        sql = "SELECT id, opus_wordcount FROM %s WHERE " % self.c_tree.table_name
        if node.metadata_condition is not None:
            i = 0
            for mc in node.metadata_condition:
                if i > 0:
                    sql += " AND "
                sql = sql + mc
                i += 1

            for row in self.cur.execute(sql):
                self.A[node.node_id - 1][row[0] - 1] = row[1]
            self.b[node.node_id - 1] = node.size

        if len(node.children) > 0:
            for child in node.children:
                self._init_ab(child)

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
        #kind of ugly
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


