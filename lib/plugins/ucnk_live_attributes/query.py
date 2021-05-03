# Copyright (c) 2014 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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


def is_range_argument(item):
    return type(item) is dict and 'from' in item and 'to' in item


class AttrArgs(object):
    """
    Stores a multi-value dictionary and allows an export
    to SQL WHERE expression as used by the plugin.
    E.g.: attributes = { 'key1' : ['value1_1', 'value1_2'], 'key2' : ['value2_1'] }
    leads to the following SQL "component": (key1 = ? OR key1 = ?) AND (key2 = ?)
    and attached values: ('value1_1', 'value1_2', 'value2_1')
    """

    def __init__(self, data, bib_id, bib_label, autocomplete_attr, empty_val_placeholder):
        """
        arguments:
        data -- a dictionary where values are either lists or single values
        bib_id -- unique attribute used as a bibliography key
        bib_label -- attribute used to display bibliography entries
        autocomplete_attr -- attribute queried in auto-complete mode
        empty_val_placeholder -- value used instead of an empty value
        """
        self.data = data
        self._bib_id = bib_id
        self._bib_label = bib_label
        self._autocomplete_attr = autocomplete_attr
        self.empty_val_placeholder = empty_val_placeholder

    def __len__(self):
        return len(self.data)

    def import_value(self, value):
        if value == self.empty_val_placeholder:
            return ''  # important! - cannot use None here as it is converted to NULL within database
        return value

    def export_sql(self, item_prefix, corpus_id):
        """
        Exports data into a SQL WHERE expression

        arguments:
        item_prefix -- prefix used to identify attach columns properly in case multiple tables (e.g. via JOIN) is used
        corpus_name -- identifer of the corpus

        returns:
        a SQL WHERE expression in conjunctive normal form
        """
        def cmp_operator(val):
            return 'LIKE' if '%' in val else '='

        where = []
        sql_values = []
        for key, values in self.data.items():
            key = key.replace('.', '_')
            if key == self._bib_label and self._bib_label != self._autocomplete_attr:
                key = self._bib_id
            cnf_item = []
            if type(values) in (list, tuple):
                for value in values:
                    if len(value) == 0 or value[0] != '@':
                        cnf_item.append(f'{item_prefix}.{key} {cmp_operator(value)} ?')
                        sql_values.append(self.import_value(value))
                    else:
                        cnf_item.append(f'{item_prefix}.{self._bib_label} {cmp_operator(value[1:])} ?')
                        sql_values.append(self.import_value(value[1:]))

            elif is_range_argument(values):
                pass  # a range query  TODO

            elif type(values) is str:
                cnf_item.append(f'{item_prefix}.{key} LIKE ?')
                sql_values.append(self.import_value(values))

            else:
                cnf_item.append(f'ktx_lower({item_prefix}.{key}) {cmp_operator(values)} ktx_lower(?)')
                sql_values.append(self.import_value(values))

            if len(cnf_item) > 0:
                where.append('({})'.format(' OR '.join(cnf_item)))

        where.append(f'{item_prefix}.corpus_id = ?')
        sql_values.append(corpus_id)
        return ' AND '.join(where), sql_values


class QueryComponents(object):

    def __init__(self, sql_template, selected_attrs, hidden_attrs, where_values):
        self.sql_template = sql_template
        self.selected_attrs = selected_attrs
        self.hidden_attrs = hidden_attrs
        self.where_values = where_values

    def __str__(self):
        return (f'QueryComponents(sql_template={self.sql_template}, '
                f'selected_attrs: {self.selected_attrs}, where: {self.where_values}')


class QueryBuilder(object):

    def __init__(self, corpus_info, attr_map, srch_attrs, aligned_corpora, autocomplete_attr, empty_val_placeholder):
        self._corpus_info = corpus_info
        self._attr_map = attr_map
        self._srch_attrs = srch_attrs
        self._aligned_corpora = aligned_corpora
        self._autocomplete_attr = autocomplete_attr
        self._empty_val_placeholder = empty_val_placeholder

    @staticmethod
    def apply_prefix(values, prefix):
        return [f'{prefix}.{v}' for v in values]

    # TODO redundant
    @staticmethod
    def import_key(k):
        return k.replace('.', '_', 1) if k is not None else k

    def create_sql(self):
        bib_id = self.import_key(self._corpus_info.metadata.id_attr)
        bib_label = self.import_key(self._corpus_info.metadata.label_attr)
        attr_items = AttrArgs(data=self._attr_map,
                              bib_id=bib_id,
                              bib_label=bib_label,
                              autocomplete_attr=self._autocomplete_attr,
                              empty_val_placeholder=self._empty_val_placeholder)
        where_sql, where_values = attr_items.export_sql('t1', self._corpus_info.id)
        join_sql = []
        i = 2
        for item in self._aligned_corpora:
            join_sql.append(f'JOIN item AS t{i} ON t1.item_id = t{i}.item_id')
            where_sql += f' AND t{i}.corpus_id = ?'
            where_values.append(item)
            i += 1

        hidden_attrs = set()
        if bib_id is not None and bib_id not in self._srch_attrs:
            hidden_attrs.add(bib_id)
        if not bib_id:
            hidden_attrs.add('id')
        selected_attrs = tuple(self._srch_attrs.union(hidden_attrs))

        if len(where_sql) > 0:
            sql_template = "SELECT DISTINCT {} FROM item AS t1 {} WHERE {}".format(
                            ', '.join(self.apply_prefix(selected_attrs, 't1')), ' '.join(join_sql), where_sql)
        else:
            sql_template = "SELECT DISTINCT {} FROM item AS t1 {} ".format(
                            ', '.join(self.apply_prefix(selected_attrs, 't1')), ' '.join(join_sql))
        tmp = QueryComponents(sql_template, selected_attrs, hidden_attrs, where_values)
        return tmp


class DataIterator(object):
    """
    This object represents an iterator which
    goes through cartesian product of all the selected
    lines and selected column names:

    [(row1, key1), (row1, key2), ..., (row1, keyM), (row2, key1), (row2, key2), ..., (rowN, keyM)]
    """

    def __init__(self, db, query_builder):
        self._db = db
        self._query_builder = query_builder

    def __iter__(self):
        qc = self._query_builder.create_sql()
        cursor = self._db.cursor()
        for item in cursor.execute(qc.sql_template, qc.where_values).fetchall():
            for attr in qc.selected_attrs:
                if item[attr] is not None and attr not in qc.hidden_attrs:
                    yield item, attr
