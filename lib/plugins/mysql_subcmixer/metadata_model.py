# Copyright (c) 2022 Institute of the Czech National Corpus
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2015 Martin Stepan <martin.stepan@ff.cuni.cz>,
#                    Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Optional, Set, Tuple, List, Dict

import numpy as np
import pulp
from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursor

from plugins.abstract.integration_db import IntegrationDatabase
from .category_tree import CategoryTree, CategoryTreeNode


class CorpusComposition(object):

    def __init__(self, status: Optional[str], variables: List[int], size_assembled: int, category_sizes: List[int], used_bounds: List[int], num_texts: Optional[int]=None):
        self.status = status
        self.variables = variables
        self.size_assembled = size_assembled
        self.category_sizes = category_sizes
        self.num_texts = num_texts
        self.used_bounds = used_bounds

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
        self.b = np.zeros(self.category_tree.num_categories - 1)  # required sizes, bounds
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
            FROM corpus_structattr_value AS t_value
            JOIN corpus_structattr_value_mapping AS t_map ON t_map.value_id = t_value.id
            JOIN corpus_structattr_value_tuple AS t_tuple ON t_tuple.id = t_map.value_tuple_id
            WHERE t_value.corpus_name = %s AND t_value.structure_name = %s AND t_value.structattr_name = %s
            GROUP BY t_value.value
            ORDER BY db_id
        '''

        sizes = []
        id_map = {}

        with self._db.cursor() as cursor:
            cursor.execute(sql, (self.category_tree.corpus_id, self._id_struct, self._id_attr))
            for i, row in enumerate(cursor):
                sizes.append(int(row['poscount']))
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
                WHERE t_value.corpus_name = %s AND t_value.structure_name = %s AND t_value.structattr_name = %s AND t_value.value {mc.mysql_op} %s
                '''
                for subl in node.metadata_condition
                for mc in subl
            ]

            aligned_join = [
                f'INNER JOIN corpus_structattr_value_tuple AS a{i} ON a{i}.corpus_name = %s AND a{i}.item_id = t_tuple.item_id'
                for i in range(len(self.category_tree.aligned_corpora))
            ]

            sql = f'''
                SELECT MIN(tuple_ids.value_tuple_id) AS db_id, SUM(t_tuple.poscount) AS poscount
                FROM (
                    {' INTERSECT '.join(sql_items)}
                ) as tuple_ids
                JOIN corpus_structattr_value_mapping AS t_map ON t_map.value_tuple_id = tuple_ids.value_tuple_id
                JOIN corpus_structattr_value AS t_value ON t_value.id = t_map.value_id
                JOIN corpus_structattr_value_tuple AS t_tuple ON t_tuple.id = tuple_ids.value_tuple_id
                {' '.join(aligned_join)}
                WHERE t_value.corpus_name = %s AND t_value.structure_name = %s AND t_value.structattr_name = %s
                GROUP BY t_value.value
                ORDER BY db_id
            '''

            params = tuple(
                param
                for subl in node.metadata_condition
                for mc in subl
                for param in (self.category_tree.corpus_id, mc.struct, mc.attr, mc.value)
            )
            params += tuple(self.category_tree.aligned_corpora)
            params += (self.category_tree.corpus_id, self._id_struct, self._id_attr)

            with self._db.cursor() as cursor:
                cursor.execute(sql, params)
                for row in cursor:
                    self.A[node.node_id - 1][self._id_map[row['db_id']]] = int(row['poscount'])
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

        x = pulp.LpVariable.dicts('x', list(range(self.num_texts)), 0, 1)
        lp_prob: pulp.LpProblem = pulp.LpProblem('Minmax_Problem', pulp.LpMaximize)
        lp_prob += pulp.lpSum(x), 'Minimize_the_maximum'
        for i in range(len(self.b)):
            condition = pulp.lpSum([
                self.A[i][j] * x[j]
                for j in range(self.num_texts)
            ]) <= self.b[i]
            lp_prob += condition, f'Max_constraint_{i}'

        stat = lp_prob.solve()

        variables = np.zeros(self.num_texts, dtype=int)
        # transform Pulp's variables (x_[number]) back to
        # the indices we need
        for v in lp_prob.variables():
            if v.name == '__dummy':
                continue
            i = int(v.name[2:])
            variables[i] = int(np.round(v.varValue))

        return CorpusComposition(
            status=pulp.LpStatus[stat],
            variables=list(variables),
            size_assembled=int(np.dot(variables, self.text_sizes)),
            category_sizes=[
                int(np.dot(variables, self.A[cat_id][:]))
                for cat_id in range(self.category_tree.num_categories - 1)
            ],
            used_bounds=[int(np.round(b)) for b in self.b],
            num_texts=sum(variables)
        )
