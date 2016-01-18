# Copyright (c) 2016 Institute of the Czech National Corpus
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
"""
Text types helper functions (collecting checked text types from a respective
HTML form and transforming them into a query, adding sizes of respective sets
specified by attributes values).
"""

from functools import partial

import l10n
from argmapping import Args
from werkzeug.wrappers import Request


class StructNormsCalc(object):
    """
    Adds a size information of texts related to respective attribute values
    """
    def __init__(self, corpus, structname, subcnorm):
        self._corp = corpus
        self._structname = structname
        self._struct = self._corp.get_struct(structname)
        self._subcnorm = subcnorm
        self._export_string = partial(l10n.export_string, to_encoding=self._corp.get_conf('ENCODING'))
        self._normvals = self._calc_normvals()

    def _calc_normvals(self):
        if self._subcnorm == 'freq':
            normvals = dict([(self._struct.beg(i), 1) for i in range(self._struct.size())])
        elif self._subcnorm == 'tokens':
            normvals = dict([(self._struct.beg(i), self._struct.end(i) - self._struct.beg(i))
                             for i in range(self._struct.size())])
        else:
            nas = self._struct.get_attr(self._subcnorm).pos2str
            normvals = dict([(self._struct.beg(i), self.safe_int(nas(i))) for i in range(self._struct.size())])
        return normvals

    @staticmethod
    def safe_int(s):
        try:
            return int(s)
        except ValueError:
            return 0

    def compute_norm(self, attrname, value):
        attr = self._struct.get_attr(attrname)
        valid = attr.str2id(self._export_string(unicode(value)))
        r = self._corp.filter_query(self._struct.attr_val(attrname, valid))
        cnt = 0
        while not r.end():
            cnt += self._normvals[r.peek_beg()]
            r.next()
        return cnt


class TextTypeCollector(object):

    EMPTY_VAL_PLACEHOLDER = '-'

    def __init__(self, corpus, src_obj):
        """
        arguments:
        corpus -- a manatee.Corpus instance
        src_obj -- object holding argument names and values (request or controller.args)
        """
        self._corp = corpus
        self._src_obj = src_obj
        if isinstance(src_obj, Args):
            self._attr_producer_fn = lambda o: dir(o)
            self._access_fn = lambda o, att: getattr(o, att)
        elif isinstance(src_obj, Request):
            self._attr_producer_fn = lambda o: o.form.keys()
            self._access_fn = lambda o, x: apply(o.form.getlist, (x,))
        else:
            raise ValueError('Invalid source object (must be either argmapping.Args or Request): %s' % (
                             src_obj.__class__.__name__,))

    def get_query(self):
            """
            returns:
            a list of tuples (struct, condition); strings are encoded to the encoding current
            corpus uses!
            """

            scas = [(a[4:], self._access_fn(self._src_obj, a))
                    for a in self._attr_producer_fn(self._src_obj) if a.startswith('sca_')]
            structs = {}
            for sa, v in scas:
                if type(v) in (str, unicode) and '|' in v:
                    v = v.split('|')
                s, a = sa.split('.')
                if type(v) is list:
                    expr_items = []
                    for v1 in v:
                        if v1 != '':
                            if v1 == TextTypeCollector.EMPTY_VAL_PLACEHOLDER:
                                v1 = ''
                            expr_items.append('%s="%s"' % (a, l10n.escape(v1)))
                    if len(expr_items) > 0:
                        query = '(%s)' % ' | '.join(expr_items)
                    else:
                        query = None
                else:
                    query = '%s="%s"' % (a, l10n.escape(v))

                if query is not None:  # TODO: is the following encoding change always OK?
                    query = l10n.export_string(query, to_encoding=self._corp.get_conf('ENCODING'))
                    if s in structs:
                        structs[s].append(query)
                    else:
                        structs[s] = [query]
            return [(sname, ' & '.join(subquery)) for sname, subquery in structs.items()]



