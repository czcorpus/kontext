# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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

from dataclasses import dataclass
import logging
from .common import StructAttr
from typing import Any, Dict, List, Set, Tuple, Union


def is_range_argument(item) -> bool:
    return type(item) is dict and 'from' in item and 'to' in item


@dataclass
class AttrArgs:
    """
    Stores a multi-value dictionary and allows an export
    to SQL WHERE expression as used by the plugin.
    E.g.: attributes = { 'key1' : ['value1_1', 'value1_2'], 'key2' : ['value2_1'] }
    leads to the following SQL "component": (key1 = ? OR key1 = ?) AND (key2 = ?)
    and attached values: ('value1_1', 'value1_2', 'value2_1')
    """
    data: Dict[StructAttr, Union[str, List[str], Dict[str, Any]]]
    bib_id: StructAttr
    bib_label: StructAttr
    autocomplete_attr: StructAttr
    empty_val_placeholder: Any

    def __len__(self) -> int:
        return len(self.data)

    def import_value(self, value: str) -> str:
        if value == self.empty_val_placeholder:
            return ''  # important! - cannot use None here as it is converted to NULL within database
        return value

    def cmp_operator(self, val: str) -> str:
        return 'LIKE' if '%' in val else '='

    def export_where(self, corpus_name: str) -> Tuple[str, List[str]]:
        """
        Exports data into a SQL WHERE expression

        arguments:
        corpus_name -- identifer of the corpus

        returns:
        a SQL WHERE expression in conjunctive normal form
        """

        WHERE_STRUCTATTR = 'structure_name = %s AND structattr_name = %s'

        where = []
        sql_values = []
        for key, values in self.data.items():
            if self.autocomplete_attr == self.bib_label and key == self.bib_id:
                continue

            cnf_item = []
            if type(values) in (list, tuple):
                general_items, general_values = [], []
                bib_label_items, bib_label_values = [], []
                for value in values:
                    if len(value) == 0 or value[0] != '@':
                        general_items.append(f'value {self.cmp_operator(value)} %s')
                        general_values.append(self.import_value(value))
                    else:
                        bib_label_items.append(f'value {self.cmp_operator(value[1:])} %s')
                        bib_label_values.append(self.import_value(value[1:]))
                if general_items:
                    cnf_item.append(f'({WHERE_STRUCTATTR} AND ({" OR ".join(general_items)}))')
                    sql_values.extend(key.values() + general_values)
                if bib_label_items:
                    cnf_item.append(f'({WHERE_STRUCTATTR} AND ({" OR ".join(bib_label_items)}))')
                    sql_values.extend(self.bib_label.values() + bib_label_values)

            elif is_range_argument(values):
                pass  # a range query  TODO

            # values is of type str
            else:
                cnf_item.append(f'({WHERE_STRUCTATTR} AND LOWER(value) LIKE LOWER(%s))')
                sql_values.extend(key.values() + [self.import_value(values)])

            if len(cnf_item) > 0:
                where.append(f'({" OR ".join(cnf_item)})')

        sql_values.append(corpus_name)
        if where:
            return f'({" OR ".join(where)}) AND corpus_name = %s', sql_values
        return 'corpus_name = %s', sql_values

    def export_having(self) -> Tuple[str, List[str]]:

        having = []
        sql_values = []
        for key, values in self.data.items():
            if self.autocomplete_attr == self.bib_label and key == self.bib_id:
                continue

            cnf_item = []
            if type(values) in (list, tuple):
                for value in values:
                    if len(value) == 0 or value[0] != '@':
                        cnf_item.append(f'JSON_VALUE(data, %s) {self.cmp_operator(value)} %s')
                        sql_values.append(f'$."{key.key()}"')
                        sql_values.append(self.import_value(value))
                    else:
                        cnf_item.append(f'JSON_VALUE(data, %s) {self.cmp_operator(value[1:])} %s')
                        sql_values.append(f'$."{self.bib_label.key()}"')
                        sql_values.append(self.import_value(value[1:]))

            elif is_range_argument(values):
                pass  # a range query  TODO

            # values is of type str
            else:
                cnf_item.append(f'LOWER(JSON_VALUE(data, %s)) LIKE LOWER(%s)')
                sql_values.append(f'$."{key.key()}"')
                sql_values.append(self.import_value(value))

            if len(cnf_item) > 0:
                having.append(f'({" OR ".join(cnf_item)})')

        if having:
            return " AND ".join(having), sql_values
        return '', []


@dataclass
class QueryComponents:
    sql_template: str
    selected_attrs: List[StructAttr]
    hidden_attrs: List[StructAttr]
    where_values: List[str]


@dataclass
class QueryBuilder:
    corpus_name: str
    aligned_corpora: List[str]  # TODO, not implemented
    attr_map: Dict[StructAttr, Union[str, List[str], Dict[str, Any]]]
    srch_attrs: Set[StructAttr]
    bib_id: StructAttr
    bib_label: StructAttr
    autocomplete_attr: StructAttr
    empty_val_placeholder: Any

    def create_sql(self) -> QueryComponents:
        attr_items = AttrArgs(data=self.attr_map,
                              bib_id=self.bib_id,
                              bib_label=self.bib_label,
                              autocomplete_attr=self.autocomplete_attr,
                              empty_val_placeholder=self.empty_val_placeholder)

        where_sql, where_values = attr_items.export_where(self.corpus_name)
        having_sql, having_values = attr_items.export_having()
        hidden_attrs = set()

        if self.bib_id is not None and self.bib_id not in self.srch_attrs:
            hidden_attrs.add(self.bib_id)

        selected_attrs = tuple(self.srch_attrs.union(hidden_attrs))
        sql_template = f'''
        SELECT t.id, poscount, JSON_OBJECTAGG(CONCAT(t_value.structure_name, '.', t_value.structattr_name), t_value.value) as data
        FROM (
            SELECT DISTINCT value_tuple_id as id
            FROM corpus_structattr_value AS t_value
            JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value.id = t_value_mapping.value_id
            WHERE {where_sql}
        ) as t
        JOIN corpus_structattr_value_mapping AS t_value_mapping ON t_value_mapping.value_tuple_id = t.id
        JOIN corpus_structattr_value_tuple AS t_value_tuple ON t_value_mapping.value_tuple_id = t_value_tuple.id
        JOIN corpus_structattr_value AS t_value ON t_value_mapping.value_id = t_value.id
        {f'GROUP BY t.id HAVING {having_sql}' if having_sql else 'GROUP BY t.id'}
        '''
        logging.error(sql_template)
        logging.error(where_values + having_values)
        return QueryComponents(sql_template, selected_attrs, hidden_attrs, where_values + having_values)
