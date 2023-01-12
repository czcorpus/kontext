# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Any, Dict, List, Optional, Tuple

from action.argmapping import Args


class CollFormArgs:

    def __init__(self) -> None:
        self.cattr: Optional[str] = None
        self.cfromw: str = '-1'
        self.ctow: str = '0'
        self.cminfreq: str = '3'
        self.cminbgr: str = '3'
        self.cbgrfns: List[str] = ['t', 'm', 'd']
        self.csortfn: str = 'd'

    def update(self, args: Args) -> 'CollFormArgs':
        self.cattr = args.cattr
        self.cfromw = args.cfromw
        self.ctow = args.ctow
        self.cminfreq = args.cminfreq
        self.cminbgr = args.cminbgr
        self.cbgrfns = args.cbgrfns
        self.csortfn = args.csortfn
        return self

    def to_dict(self) -> Dict[str, Any]:
        return dict(self.__dict__)


class FreqFormArgs:

    def __init__(self) -> None:
        self.fttattr: List[str] = []
        self.flimit: str = '1'
        self.freq_sort: str = 'freq'
        self.ftt_include_empty: bool = False

    def update(self, args: Args) -> 'FreqFormArgs':
        self.fttattr = args.fttattr + args.fttattr_async
        self.flimit = args.flimit
        self.freq_sort = args.freq_sort
        self.ftt_include_empty = args.ftt_include_empty
        return self

    def to_dict(self) -> Dict[str, Any]:
        return dict(self.__dict__)


class CTFreqFormArgs:
    """
    CTFreqFormArgs specifies parameters used in
    2D freq. distribution form. Please note that
    while the form arguments contain separated
    attributes and criteria (ctattr*, ctfcrit*),
    the server API action for calculating
    the distribution requires (just like other
    freq. distributions) single string for both
    attribute and criterion
    (e.g. "ctfcrit1=lemma 0<0")
    """

    def __init__(self, default_attr: str = 'word'):
        self.ctminfreq: int = 80
        self.ctminfreq_type: str = 'pabs'
        self.ctattr1: str = default_attr
        self.ctfcrit1: str = '0<0'
        self.ctattr2: str = default_attr
        self.ctfcrit2: str = '0<0'

    def _import_fcrit(self, v: str) -> Tuple[str, str]:
        """
        Transform single string freq. criterion into
        two values - attribute and positional information.
        """
        items = v.split(' ', 1)
        return items[0], items[1]

    def update(self, args: Args) -> 'CTFreqFormArgs':
        self.ctminfreq = args.ctminfreq
        self.ctminfreq_type = args.ctminfreq_type
        self.ctattr1, self.ctfcrit1 = self._import_fcrit(args.ctfcrit1)
        self.ctattr2, self.ctfcrit2 = self._import_fcrit(args.ctfcrit2)
        return self

    def to_dict(self) -> Dict[str, Any]:
        return dict(self.__dict__)
