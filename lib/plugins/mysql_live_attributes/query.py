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

    def export_subquery(self, corpus_name: str) -> Tuple[str, List[str]]:
        WHERE_STRUCTATTR = 'structure_name = %s AND structattr_name = %s'

        subqueries, sql_values = [], []
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
                subqueries.append(f'''
                    SELECT value_tuple_id as id
                    FROM corpus_structattr_value AS t1
                    JOIN corpus_structattr_value_mapping AS t2 ON t1.id = t2.value_id
                    WHERE ({" OR ".join(cnf_item)}) AND corpus_name = %s''')
                sql_values.append(corpus_name)

        if subqueries:
            return " INTERSECT ".join(subqueries), sql_values

        sql_values.append(corpus_name)
        return f'''
            SELECT value_tuple_id as id
            FROM corpus_structattr_value AS t1
            JOIN corpus_structattr_value_mapping AS t2 ON t1.id = t2.value_id
            WHERE corpus_name = %s''', sql_values


@dataclass
class QueryComponents:
    sql_template: str
    selected_attrs: List[StructAttr]
    hidden_attrs: List[StructAttr]
    where_values: List[str]


@dataclass
class QueryBuilder:
    corpus_name: str
    aligned_corpora: List[str]
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

        sql_sub, args = attr_items.export_subquery(self.corpus_name)
        hidden_attrs = set()

        sql_inner = [
            f'INNER JOIN corpus_structattr_value_tuple AS t{i} ON t{i}.item_id = tuple.item_id AND t{i}.corpus_name = %s'
            for i, _ in enumerate(self.aligned_corpora)
        ]
        args.extend(self.aligned_corpora)

        if self.bib_id is not None and self.bib_id not in self.srch_attrs:
            hidden_attrs.add(self.bib_id)

        selected_attrs = tuple(self.srch_attrs.union(hidden_attrs))
        sql_template = f'''
            SELECT t.id, tuple.poscount, GROUP_CONCAT(CONCAT(value.structure_name, '.', value.structattr_name, '=', value.value) SEPARATOR '\n') as data
            FROM (
                {sql_sub}
            ) as t
            JOIN corpus_structattr_value_tuple AS tuple ON tuple.id = t.id
            {" ".join(sql_inner)}
            JOIN corpus_structattr_value_mapping AS map ON map.value_tuple_id = t.id
            JOIN corpus_structattr_value AS value ON value.id = map.value_id
            WHERE (
                {" OR ".join("(value.structure_name = %s AND value.structattr_name = %s)" for _ in selected_attrs)}
            )
            GROUP BY t.id
        '''
        for sel in selected_attrs:
            args.append(sel.struct)
            args.append(sel.attr)

        return QueryComponents(sql_template, selected_attrs, hidden_attrs, args)
