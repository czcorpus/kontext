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
from typing import List, Tuple
from corplib import CorpusManager
from conclib.search import get_conc
from conclib.freq import multi_level_crit
from bgcalc import freq_calc
from plugins.abstract.query_suggest import AbstractBackend
import manatee
from strings import re_escape
import logging
import l10n


class PosAttrPairRelManateeBackend(AbstractBackend):

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        fixed_corp = conf.get('corpus')
        self._preset_corp = CorpusManager().get_corpus(fixed_corp) if fixed_corp else None

    def _freq_dist(self, corp: manatee.Corpus, conc: manatee.Concordance, fcrit: str, user_id: int):
        args = freq_calc.FreqCalsArgs()
        args.corpname = corp.corpname
        args.subcname = getattr(corp, 'subcname', None)
        args.subcpath = ''  # TODO xx
        args.user_id = user_id
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

    def _normalize_multivalues(self, corp: manatee.Corpus, srch_val: str, attr1: str, attr2: str) -> Tuple[str, str]:
        multisep1 = corp.get_conf(self._conf["attr1"] + '.MULTISEP')
        multisep2 = corp.get_conf(self._conf["attr2"] + '.MULTISEP')
        if multisep1 and multisep2:
            attr_pairs = list(zip(attr1.split(multisep1), attr2.split(multisep2)))
            if len(attr_pairs) > 1:
                for attr1c, attr2c in attr_pairs:
                    if srch_val.lower() == attr1c.lower() or srch_val.lower() == attr2c.lower():
                        return attr1c, attr2c
                logging.warning(
                    f'PosAttrPairRelManateeBackend multivalue normalization mismatch - {attr1}...{attr2}')

        return attr1, attr2

    def find_suggestion(self, user_id: int, ui_lang: str, maincorp: manatee.Corpus, corpora: List[str], subcorpus: str,
                        value: str, value_type: str, value_subformat: str, query_type: str, p_attr: str, struct: str,
                        s_attr: str):
        used_corp = self._preset_corp if self._preset_corp is not None else maincorp
        value_norm = value if value_subformat in ('regexp', 'advanced') else re_escape(value)
        icase = '(?i)' if value_subformat in ('simple_ic',) else ''
        rels = defaultdict(lambda: set())
        try:
            conc = get_conc(used_corp, user_id,
                            (f'aword,[{self._conf["attr1"]}="{icase}{value_norm}" | {self._conf["attr2"]}="{icase}{value_norm}"]',))
            conc.sync()
            mlargs = dict(ml1attr=self._conf["attr1"], ml2attr=self._conf["attr2"])
            fcrit = multi_level_crit(2, **mlargs)
            data = self._freq_dist(corp=used_corp, conc=conc, fcrit=fcrit, user_id=user_id)
            for item in data:
                attr1, attr2 = self._normalize_multivalues(used_corp, value_norm, *(tuple([w['n'] for w in item['Word']])[:2]))
                rels[attr1].add(attr2)
        except RuntimeError as ex:
            msg = str(ex).lower()
            if 'syntax error' not in msg:
                raise ex
        return dict(attrs=(self._conf['attr1'], self._conf['attr2']),
                    data=dict((k, l10n.sort(v, ui_lang, key=lambda itm: itm, reverse=False))
                              for k, v in rels.items()))
