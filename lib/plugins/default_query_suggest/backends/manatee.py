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

from plugins.abstract.query_suggest import AbstractBackend
from typing import List
from corplib import CorpusManager
from conclib.search import get_conc
import manatee


class MatchingPosAttrManateeBackend(AbstractBackend):

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._conf = conf
        fixed_corp = conf.get('corpus')
        self._corp = CorpusManager().get_Corpus(fixed_corp) if fixed_corp else None

    def find_suggestion(self, user_id: int, ui_lang: str, maincorp: manatee.Corpus, corpora: List[str], subcorpus: str,
                        value: str, value_type: str, query_type: str, p_attr: str, struct: str, s_attr: str):
        used_corp = self._corp if self._corp is not None else maincorp
        conc = get_conc(used_corp, user_id, (f'aword,[{self._conf["search_attr"]}="{value}"]',))
        conc.sync()
        freq = conc.xfreq_dist(
            f'{self._conf["crit_attr"]}/e 0<0',
            limit=1,
            sortkey='f',
            ml=0,
            ftt_include_empty=False,
            rel_mode=1,
            collator_locale=ui_lang
        )
        return [word['n'] for item in freq.get('Items', []) for word in item['Word']]
