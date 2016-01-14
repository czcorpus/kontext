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

from functools import partial

from l10n import export_string


class StructNormsCalc(object):

    def __init__(self, corpus, structname, subcnorm):
        self._corp = corpus
        self._structname = structname
        self._struct = self._corp.get_struct(structname)
        self._subcnorm = subcnorm
        self._export_string = partial(export_string, to_encoding=self._corp.get_conf('ENCODING'))
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





