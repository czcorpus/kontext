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

from typing import Set, Tuple, List, Dict

import numpy as np
import pulp

from lib.plugins.mysql_subcmixer.category_tree import CategoryTree, CategoryTreeNode
from plugins.abstract.integration_db import IntegrationDatabase

from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursor


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

    def __init__(self, db: IntegrationDatabase[MySQLConnection, MySQLCursor], category_tree: CategoryTree, id_attr: str):
        self._db = db
        self.category_tree = category_tree
        self._id_struct, self._id_attr = id_attr.split('.')

        self.text_sizes, self._id_map = self._get_text_sizes()
        # text_sizes and _id_map both contain all the documents from the corpus
        # no matter whether they have matching aligned counterparts
        self.num_texts = len(self.text_sizes)
        self.b = [0] * (self.category_tree.num_categories - 1)
        self.A = np.zeros((self.category_tree.num_categories, self.num_texts))
        used_ids: Set[int] = set()
        self._init_ab(self.category_tree.root_node, used_ids)
        # for items without aligned counterparts we create
        # conditions fulfillable only for x[i] = 0
        self._init_ab_nonalign(used_ids)

    def _get_text_sizes(self) -> Tuple[List[int], Dict[int, int]]:
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

        sql = f'''
            SELECT MIN(t_tuple.id) AS db_id, SUM(t_tuple.poscount) AS poscount
            FROM corpus_structattr_value AS t1
            JOIN corpus_structattr_value_mapping AS t_map ON t_map.value_id = t1.id
            JOIN corpus_structattr_value_tuple AS t_tuple ON t_tuple.id = t_map.value_tuple_id
            WHERE t1.corpus_name = %s AND t1.structure_name = %s AND t1.structattr_name = %s
            GROUP BY t1.value
            ORDER BY db_id
        '''

        sizes = []
        id_map = {}

        with self._db.cursor() as cursor:
            cursor.execute(sql, (self.category_tree.corpus_id, self._id_struct, self._id_attr))
            for i, row in enumerate(cursor):
                sizes.append(row['poscount'])
                id_map[row['db_id']] = i

        return sizes, id_map

    def _init_ab_nonalign(self, used_ids: Set[int]) -> None:
        # Now we process items with no aligned counterparts.
        # In this case we must define a condition which will be
        # fulfilled if X[i] == 0
        for k, v in self._id_map.items():
            if k not in used_ids:
                for i in range(1, len(self.b)):
                    self.A[i][v] = self.b[i] * 2 if self.b[i] > 0 else 10000

    def _init_ab(self, node: CategoryTreeNode, used_ids: Set[int]) -> None:
        """
        Initialization method for coefficient matrix (A) and vector of bounds (b)
        Recursively traverses all nodes of given categoryTree starting from its root.
        Each node is processed in order to generate one inequality constraint.

        args:
        node -- currently processed node of the categoryTree
        used_ids -- a set of ids used in previous nodes
        """
        if node.metadata_condition is not None:
            sql_items = [
                f'''
                SELECT t_map.value_tuple_id
                FROM corpus_structattr_value AS t_value
                JOIN corpus_structattr_value_mapping AS t_map ON t_map.value_id = t_value.id
                WHERE t_value.corpus_name = %s AND t_value.structure_name = %s AND t_value.structattr_name = %s AND t_value.value {mc.mysql_op} %s)
                '''
                for subl in node.metadata_condition
                for mc in subl
            ]

            aligned_join = [
                f'INNER JOIN corpus_structattr_value_tuple AS a{i}.corpus_name = %s AND a{i} ON t_tuple.item_id = a{i}.item_id'
                for i in range(len(self.category_tree.aligned_corpora))
            ]

            sql = f'''
                SELECT MIN(t_map.value_tuple_id) AS db_id, SUM(t_tuple.poscount) AS poscount, t_value.value
                FROM (
                    {' INTERSECT '.join(sql_items)}
                ) as t_map
                JOIN corpus_structattr_value_tuple AS t_tuple ON t_tuple.id = t_map.value_tuple_id
                {' '.join(aligned_join)}
                JOIN corpus_structattr_value AS t_value ON t_value.id = t_map.value_id
                    AND t_value.corpus_name = %s
                    AND t_value.struct_name = %s
                    AND t_value.structattr_name = %s
                GROUP BY t_value.value
                ORDER BY db_id
            '''

            with self._db.cursor() as cursor:
                cursor.execute(sql, tuple(v for subl in node.metadata_condition for mc in subl for v in (
                    self.category_tree.corpus_id, mc.struct, mc.attr, mc.value)) + (self.category_tree.corpus_id, self._id_struct, self._id_attr))
                for row in cursor:
                    self.A[node.node_id - 1][self._id_map[row['db_id']]] = row['poscount']
                    used_ids.add(row['db_id'])
            self.b[node.node_id - 1] = node.size

        if len(node.children) > 0:
            for child in node.children:
                self._init_ab(child, used_ids)

    def solve(self) -> CorpusComposition:
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
        for c in range(0, self.category_tree.num_categories - 1):
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
