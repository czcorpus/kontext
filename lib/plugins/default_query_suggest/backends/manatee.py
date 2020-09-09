# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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


class MatchingPosAttrManateeBackend(AbstractBackend):

    def __init__(self, conf, ident):
        super().__init__(ident)
        self._cm = CorpusManager()
        self._corp = self._cm.get_Corpus(conf['corpus'])
        self._conf = conf

    def find_suggestion(self, ui_lang: str, corpora: List[str], subcorpus: str, value: str, value_type: str,
                        query_type: str, p_attr: str, struct: str, s_attr: str):
        conc = get_conc(self._corp, 2, [f'aword,[{self._conf["search_attr"]}="{value}"]'])
        conc.sync()
        freq = conc.xfreq_dist(
            self._conf["crit_attr"],
            limit=1,
            sortkey='f',
            ml=0,
            ftt_include_empty=False,
            rel_mode=0,
            collator_locale=ui_lang
        )

        return [
            word['n']
            for item in freq['Items']
            for word in item['Word']
        ]
