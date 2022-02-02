# Copyright (c) 2015 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

from typing import List, NamedTuple, Optional, Union
import numpy as np
import copy
from lib.plugins.abstract.integration_db import IntegrationDatabase

from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursor

from plugins.mysql_subcmixer import TaskArgs


class ExpressionJoin(object):

    def __init__(self, operator):
        self.items = []
        self.operator = operator

    def add(self, item):
        self.items.append(item)

    def negate(self):
        expr = ExpressionJoin('AND' if self.operator == 'OR' else 'OR')
        for item in self.items:
            expr.add(item.negate())
        return expr

    def __iter__(self):
        return self.items.__iter__()

    def __str__(self):
        return (' %s ' % self.operator).join('%s' % item for item in self.items)

    def __repr__(self):
        return f'ExpressionJoin{{{self.__str__()}}}'


class CategoryExpression(object):
    OPERATORS = {'==': '<>', '<>': '==', '<=': '>=', '>=': '<='}

    @staticmethod
    def create(args):
        if args is not None:
            return CategoryExpression(**args)
        return None

    @property
    def mysql_op(self):
        return '=' if self.op == '==' else self.op

    def negate(self):
        return CategoryExpression(f'{self.struct}.{self.attr}', CategoryExpression.OPERATORS[self.op], self.value)

    def __init__(self, structattr: str, op: str, value: str):
        self.struct, self.attr = structattr.split('.')
        if op not in CategoryExpression.OPERATORS:
            raise Exception('Invalid operator: %s' % op)
        self.op = op
        self.value = value

    def __iter__(self):  # TODO why iterator?
        return [self].__iter__()

    def __str__(self):
        return f"{self.struct}.{self.attr} {self.op} '{self.value}'"

    def __repr__(self):
        return f'CategoryExpression{{{self.__str__()}}}'


class CategoryTreeNode(object):
    def __init__(self, node_id: int, parent_id: Optional[int], requested_ratio: float, metadata_condition: Optional[CategoryExpression]):
        self.node_id = node_id
        self.parent_id = parent_id
        self.ratio = requested_ratio
        self.metadata_condition = metadata_condition
        self.size: float = None
        self.children: List[CategoryTreeNode] = []

    def __repr__(self):
        return 'CategoryTreeNode(id: {0}, parent: {1}, ratio: {2}, metadata: {3}, size: {4})'.format(
            self.node_id, self.parent_id, self.ratio, self.metadata_condition, self.size)


class TaskArgs(NamedTuple):
    node_id: int
    parent_id: Optional[int]
    ratio: float
    expression: Optional[CategoryExpression]


class CategoryTreeException(Exception):
    pass


class CategoryTree(object):
    """
    Category tree represents the user required corpus structure

    arguments:
    category_list -- A list of categories from which the user wants to generate the corpus including
                     the requested ratios and links to their parent categories
    integration_db -- a Database instance.
    table_name -- Name of the table in metaDB that holds the metadata
    corpus_max_size -- Maximal size of resulting corpora in words

    """

    def __init__(self, category_list: List[TaskArgs], db: IntegrationDatabase[MySQLConnection, MySQLCursor], corpus_id: str, aligned_corpora: List[str], corpus_max_size: int):
        self.category_list = category_list
        self.num_categories = len(category_list)
        self.corpus_max_size = corpus_max_size
        self.root_node = CategoryTreeNode(self.category_list[0].node_id, self.category_list[0].parent_id,
                                          self.category_list[0].ratio, self.category_list[0].expression)
        self.corpus_id = corpus_id
        self.aligned_corpora = aligned_corpora
        self._db = db
        self._add_virtual_cats()
        self._build()
        self.initialize_bounds()

    def _add_virtual_cats(self) -> None:
        updated_list = copy.deepcopy(self.category_list)
        cats_updated = [False] * self.num_categories
        for cat in self.category_list:
            par_id = cat.parent_id
            if par_id and par_id > 0:
                i = 0
                mdc = ExpressionJoin('AND')
                for other_cat in self.category_list:
                    if other_cat.parent_id == par_id and par_id > 0:
                        cond = other_cat.expression.negate()
                        mdc.add(cond)
                        i += 1
                if not cats_updated[par_id]:
                    updated_list.append([self.num_categories, par_id, 0, mdc])
                    cats_updated[par_id] = True
                    self.num_categories += 1
                    self.category_list = updated_list

    def _build(self) -> None:
        for i in range(1, self.num_categories):
            cat = self.category_list[i]
            node_id, parent_id, ratio, mc = cat
            parent_node = self._get_node_by_id(self.root_node, parent_id)
            pmc = parent_node.metadata_condition
            if pmc is not None:
                res = [mc] + pmc
            else:
                res = [mc]
            cat_node = CategoryTreeNode(node_id, parent_id, ratio, res)
            parent_node.children.append(cat_node)

    def _get_node_by_id(self, node: CategoryTreeNode, wanted_id: int) -> CategoryTreeNode:
        if node.node_id != wanted_id:
            if node.children is not None:
                for child in node.children:
                    node = self._get_node_by_id(child, wanted_id)
                    if node is not None and node.node_id == wanted_id:
                        return node
        else:
            return node

    def _get_max_group_sizes(self, sizes: List[float], ratios: List[float], parent_size: float) -> List[Union[int, float]]:
        num_g = len(sizes)
        children_size = sum(sizes)
        data_size = min(children_size, parent_size)
        required_sizes = [0] * num_g
        max_sizes: List[Union[int, float]] = None
        while True:
            for i in range(0, num_g):
                required_sizes[i] = data_size * ratios[i]

            reserves = np.subtract(sizes, required_sizes)
            ilr = list(reserves).index(min(reserves))
            lowest_reserve = reserves[ilr]
            if lowest_reserve > -0.001:
                max_sizes = required_sizes
                break
            data_size = sizes[ilr] / float(ratios[ilr])
            for i in range(num_g):
                if i != ilr:
                    sizes[i] = data_size * ratios[i]
        return max_sizes

    def compute_sizes(self, node: CategoryTreeNode) -> None:
        if len(node.children) > 0:
            sizes = []
            ratios = []
            for child in node.children:
                self.compute_sizes(child)
                sizes.append(child.size)
                ratios.append(child.ratio)
            res = self._get_max_group_sizes(sizes, ratios, node.size)
            # update group size
            node.size = sum(res)
            # update child node sizes
            i = 0
            for n in node.children:
                d = n.size - res[i]
                n.size = res[i]
                if d > 0 and len(n.children) > 0:
                    self.compute_sizes(n)
                i += 1

    def initialize_bounds(self) -> None:
        for i in range(1, len(self.category_list)):
            node = self._get_node_by_id(self.root_node, i)
            node.size = self._get_category_size(node.metadata_condition)

        aligned_join = [f'''
            INNER JOIN corpus_structattr_value AS t{1+i}
                ON t{1+i}.corpus_name = %s
                AND t{1+i}.structure_name = t1.structure_name
                AND t{1+i}.structattr_name = t1.structattr_name
                AND t{1+i}.value = t1.value
            ''' for i in range(len(self.aligned_corpora))
                        ]

        sql = f'''
            SELECT SUM(t_tuple.poscount) AS poscount
            FROM corpus_structattr_value AS t1
            {' '.join(aligned_join)}
            JOIN corpus_structattr_value_mapping AS t_map ON t_map.value_id = t1.id
            JOIN corpus_structattr_value_tuple AS t_tuple ON t_tuple.id = t_map.value_tuple_id
            WHERE t1.corpus_name = %s
        '''

        with self._db.cursor() as cursor:
            cursor.execute(sql, tuple(self.aligned_corpora) + (self.corpus_id,))
            row = cursor.fetchone()

        if row is None or not row['poscount']:
            raise CategoryTreeException('Failed to initialize bounds')

        self.root_node.size = min(self.corpus_max_size, row['poscount'])
        self.compute_sizes(self.root_node)

    def _get_category_size(self, mc: CategoryExpression) -> float:
        """
        This method only computes the maximal available size of category described by provided
        list of metadata conditions

        arguments:
        mc -- A list of metadata sql conditions that determines if texts belongs to this category
        """

        aligned_join = [f'''
            INNER JOIN corpus_structattr_value AS t{1+i}
                ON t{1+i}.corpus_name = %s
                AND t{1+i}.structure_name = t1.structure_name
                AND t{1+i}.structattr_name = t1.structattr_name
                AND t{1+i}.value = t1.value
            ''' for i in range(len(self.aligned_corpora))
                        ]

        where_items = [
            f'AND t1.structure_name = %s AND t1.structattr_name = %s AND t1.value = %s' for subl in mc for expr in subl]

        sql = f'''
            SELECT SUM(t_tuple.poscount) AS poscount
            FROM corpus_structattr_value AS t1
            {' '.join(aligned_join)}
            JOIN corpus_structattr_value_mapping AS t_map ON t_map.value_id = t1.id
            JOIN corpus_structattr_value_tuple AS t_tuple ON t_tuple.id = t_map.value_tuple_id
            WHERE t1.corpus_name = %s
            {' '.join(where_items)}
        '''

        with self._db.cursor() as cursor:
            cursor.execute(sql, (*self.aligned_corpora, self.corpus_id,) +
                           tuple(v for subl in mc for expr in subl for v in (expr.struct, expr.attr, expr.val)))
            row = cursor.fetchone()

        return 0 if row is None else row['poscount']
