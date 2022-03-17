# Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

from typing import Iterator, List, NamedTuple, Optional, Union
import copy

import numpy as np
from aiomysql import Connection, Cursor

from plugin_types.integration_db import IntegrationDatabase


class CategoryExpression(object):
    OPERATORS = {'==': '<>', '<>': '==', '<=': '>=', '>=': '<='}

    @staticmethod
    def create(args):
        if args is not None:
            return CategoryExpression(**args)
        return None

    @property
    def mysql_op(self) -> str:
        return '=' if self.op == '==' else self.op

    def negate(self) -> 'CategoryExpression':
        return CategoryExpression(f'{self.struct}.{self.attr}', CategoryExpression.OPERATORS[self.op], self.value)

    def __init__(self, structattr: str, op: str, value: str):
        if op not in CategoryExpression.OPERATORS:
            raise Exception(f'Invalid operator: {op}')

        self.struct, self.attr = structattr.split('.')
        self.op = op
        self.value = value

    def __iter__(self) -> Iterator['CategoryExpression']:
        return [self].__iter__()

    def __str__(self) -> str:
        return f"{self.struct}.{self.attr} {self.op} '{self.value}'"

    def __repr__(self) -> str:
        return f'CategoryExpression{{{self.__str__()}}}'


class ExpressionJoin(object):

    def __init__(self, op: str):
        self.items: List[CategoryExpression] = []
        self.op = op

    def add(self, item: CategoryExpression):
        self.items.append(item)

    def negate(self) -> 'ExpressionJoin':
        expr = ExpressionJoin('AND' if self.op == 'OR' else 'OR')
        for item in self.items:
            expr.add(item.negate())
        return expr

    @property
    def mysql_op(self) -> str:
        return self.op

    def __iter__(self) -> Iterator[CategoryExpression]:
        return self.items.__iter__()

    def __str__(self) -> str:
        return f' {self.op} '.join(str(item) for item in self.items)

    def __repr__(self) -> str:
        return f'ExpressionJoin{{{self.__str__()}}}'


class CategoryTreeNode(object):
    def __init__(self, node_id: int, parent_id: Optional[int], requested_ratio: Union[int, float], metadata_condition: Optional[List[Union[CategoryExpression, ExpressionJoin]]]):
        self.node_id = node_id
        self.parent_id = parent_id
        self.ratio = requested_ratio
        self.metadata_condition = metadata_condition
        self.size: Union[int, float] = 0
        self.children: List[CategoryTreeNode] = []

    def __repr__(self) -> str:
        return 'CategoryTreeNode(id: {0}, parent: {1}, ratio: {2}, metadata: {3}, size: {4})'.format(
            self.node_id, self.parent_id, self.ratio, self.metadata_condition, self.size)


class TaskArgs(NamedTuple):
    node_id: int
    parent_id: Optional[int]
    ratio: Union[int, float]
    expression: Optional[Union[CategoryExpression, ExpressionJoin]]


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

    def __init__(self, category_list: List[TaskArgs], db: IntegrationDatabase[Connection, Cursor], corpus_id: str, aligned_corpora: List[str], corpus_max_size: int):
        self.category_list = category_list
        self.num_categories = len(category_list)
        self.corpus_max_size = corpus_max_size
        # root has: node_id = 0, parent_id = None, ratio = 1, expression = None
        self.root_node = CategoryTreeNode(
            self.category_list[0].node_id,
            self.category_list[0].parent_id,
            self.category_list[0].ratio,
            None if self.category_list[0].expression is None else [self.category_list[0].expression]
        )
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
            if par_id is not None and par_id > 0 and not cats_updated[par_id]:
                i = 0
                mdc = ExpressionJoin('AND')
                for other_cat in self.category_list:
                    # in the initialization there are no ExpressionJoin in category_list,
                    # here checking for typing reasons
                    if other_cat.parent_id == par_id and isinstance(other_cat.expression, CategoryExpression):
                        cond = other_cat.expression.negate()
                        mdc.add(cond)
                        i += 1
                updated_list.append(TaskArgs(self.num_categories, par_id, 0, mdc))
                self.num_categories += 1
                cats_updated[par_id] = True
        self.category_list = updated_list

    def _build(self) -> None:
        for cat in self.category_list:
            node_id, parent_id, ratio, mc = cat
            # ignore root node
            if parent_id is None or mc is None:
                continue

            parent_node = self._get_node_by_id(self.root_node, parent_id)
            if parent_node is None:
                continue

            if parent_node.metadata_condition is not None:
                res = [mc] + [v for v in parent_node.metadata_condition]
            else:
                res = [mc]

            cat_node = CategoryTreeNode(node_id, parent_id, ratio, res)
            parent_node.children.append(cat_node)

    def _get_node_by_id(self, node: CategoryTreeNode, wanted_id: int) -> Optional[CategoryTreeNode]:
        if node.node_id != wanted_id:
            for child in node.children:
                n = self._get_node_by_id(child, wanted_id)
                if n is not None and n.node_id == wanted_id:
                    return n
        else:
            return node

        return None

    def _get_max_group_sizes(
            self, sizes: List[Union[int, float]], ratios: List[Union[int, float]],
            parent_size: Union[int, float]) -> List[Union[int, float]]:
        children_size = sum(sizes)
        data_size = min(children_size, parent_size)

        while True:
            required_sizes = [data_size * ratio for ratio in ratios]

            reserves = np.subtract(sizes, required_sizes)
            lowest_reserve = min(reserves)
            ilr = np.where(reserves == lowest_reserve)[0][0]
            if lowest_reserve > -0.001:
                return required_sizes

            data_size = sizes[ilr] / ratios[ilr]
            sizes = [data_size * ratio if i != ilr else sizes[i] for i, ratio in enumerate(ratios)]

    def compute_sizes(self, node: CategoryTreeNode) -> None:
        if len(node.children) > 0:
            for child in node.children:
                self.compute_sizes(child)

            max_sizes = self._get_max_group_sizes(
                [child.size for child in node.children],
                [child.ratio for child in node.children],
                node.size
            )

            # update group size
            node.size = sum(max_sizes)
            # update child node sizes
            for i, child in enumerate(node.children):
                d = child.size - max_sizes[i]
                child.size = max_sizes[i]
                if d > 0:
                    self.compute_sizes(child)

    async def initialize_bounds(self) -> None:
        # we dont care about root node
        for i in range(1, len(self.category_list)):
            node = self._get_node_by_id(self.root_node, i)
            if node is not None and node.metadata_condition is not None:
                node.size = await self._get_category_size(node.metadata_condition)

        aligned_join = [
            f'INNER JOIN corpus_structattr_value_tuple AS a{i} ON a{i}.corpus_name = %s AND a{i}.item_id = t_tuple.item_id'
            for i in range(len(self.aligned_corpora))
        ]

        sql = f'''
            SELECT SUM(t_tuple.poscount) AS poscount
            FROM (
                SELECT DISTINCT t_map.value_tuple_id
                FROM corpus_structattr_value AS t_value
                JOIN corpus_structattr_value_mapping AS t_map ON t_map.value_id = t_value.id
                WHERE t_value.corpus_name = %s
            ) AS tuple_ids
            JOIN corpus_structattr_value_tuple AS t_tuple ON t_tuple.id = tuple_ids.value_tuple_id
            {' '.join(aligned_join)}
        '''

        async with self._db.cursor() as cursor:
            await cursor.execute(sql, (self.corpus_id, *self.aligned_corpora))
            row = await cursor.fetchone()

        if row is None or not row['poscount']:
            raise CategoryTreeException('Failed to initialize bounds')

        self.root_node.size = min(self.corpus_max_size, int(row['poscount']))
        self.compute_sizes(self.root_node)

    async def _get_category_size(self, mc: List[Union[CategoryExpression, ExpressionJoin]]) -> int:
        """
        This method only computes the maximal available size of category described by provided
        list of metadata conditions

        arguments:
        mc -- A list of metadata sql conditions that determines if texts belongs to this category
        """

        sql_items = [
            f'''
                SELECT t_map.value_tuple_id
                FROM corpus_structattr_value AS t_value
                JOIN corpus_structattr_value_mapping AS t_map ON t_map.value_id = t_value.id
                WHERE t_value.corpus_name = %s AND t_value.structure_name = %s AND t_value.structattr_name = %s
                  AND t_value.value {expr.mysql_op} %s
                '''
            for subl in mc for expr in subl
        ]

        aligned_join = [
            f'INNER JOIN corpus_structattr_value_tuple AS a{i} ON a{i}.corpus_name = %s AND a{i}.item_id = t_tuple.item_id'
            for i in range(len(self.aligned_corpora))
        ]

        sql = f'''
            SELECT SUM(t_tuple.poscount) AS poscount
            FROM (
                -- we dont want to use INTERSECT because old MariaDB version does not support it
                SELECT count(*) AS num, union_tuple_ids.value_tuple_id
                FROM (
                    {' UNION ALL '.join(sql_items)}
                ) union_tuple_ids
                GROUP BY union_tuple_ids.value_tuple_id
                HAVING num = {len(sql_items)}
            ) as tuple_ids
            JOIN corpus_structattr_value_tuple AS t_tuple ON t_tuple.id = tuple_ids.value_tuple_id
            {' '.join(aligned_join)}
        '''

        params = tuple(
            param
            for subl in mc
            for expr in subl
            for param in (self.corpus_id, expr.struct, expr.attr, expr.value)
        )
        params += tuple(self.aligned_corpora)

        async with self._db.cursor() as cursor:
            await cursor.execute(sql, params)
            row = await cursor.fetchone()

        return 0 if row['poscount'] is None else int(row['poscount'])
