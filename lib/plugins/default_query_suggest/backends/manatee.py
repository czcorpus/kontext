# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
# Copyright (c) 2020 Tomas Machalek <tomas.machalek@gmail.com>
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

from collections import defaultdict
import re
from typing import List
from corplib import CorpusManager
from conclib.search import get_conc
from conclib.freq import multi_level_crit
from bgcalc import freq_calc
from plugins.abstract.query_suggest import AbstractBackend
import manatee
from strings import re_escape


class PosAttrPairRelManateeBackend(AbstractBackend):

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        fixed_corp = conf.get('corpus')
        self._corp = CorpusManager().get_Corpus(fixed_corp) if fixed_corp else None

    def _freq_dist(self, corp: manatee.Corpus, conc: manatee.Concordance, fcrit: str, user_id: int):
        args = freq_calc.FreqCalsArgs()
        args.corpname = corp.corpname
        args.subcname = getattr(corp, 'subcname', None)
        args.subcpath = ''  # TODO xx
        args.user_id = user_id
        args.fromp = 0
        args.pagesize = 100
        args.save = False
        args.samplesize = 0
        args.flimit = 1
        args.fcrit = [fcrit]
        args.ml = 2
        args.ftt_include_empty = 0
        args.rel_mode = 1
        args.collator_locale = 'en_US'  # TODO xx
        args.fmaxitems = 1
        args.fpage = 1
        args.line_offset = 0
        args.force_cache = False

        freqs = [conc.xfreq_dist(cr, args.flimit, args.freq_sort, args.ml, args.ftt_include_empty, args.rel_mode,
                                 args.collator_locale)
                 for cr in args.fcrit]
        return freqs[0].get('Items', [])

    def find_suggestion(self, user_id: int, ui_lang: str, maincorp: manatee.Corpus, corpora: List[str], subcorpus: str,
                        value: str, value_type: str, value_subformat: str, query_type: str, p_attr: str, struct: str,
                        s_attr: str):
        used_corp = self._corp if self._corp is not None else maincorp
        value_norm = value if value_subformat in ('regexp', 'advanced') else re_escape(value)
        icase = '(?i)' if value_subformat in ('simple_ic',) else ''
        conc = get_conc(used_corp, user_id,
                        (f'aword,[{self._conf["attr1"]}="{icase}{value_norm}" | {self._conf["attr2"]}="{icase}{value_norm}"]',))
        conc.sync()
        mlargs = dict(ml1attr=self._conf["attr1"], ml2attr=self._conf["attr2"])
        fcrit = multi_level_crit(2, **mlargs)
        data = self._freq_dist(corp=used_corp, conc=conc, fcrit=fcrit, user_id=user_id)
        rels = defaultdict(lambda: set())
        for item in data:
            attr1, attr2 = tuple([w['n'] for w in item['Word']])[:2]
            rels[attr1].add(attr2.lower())
        return dict(attrs=(self._conf['attr1'], self._conf['attr2']),
                    data=dict((k, list(v)) for k, v in rels.items()))
