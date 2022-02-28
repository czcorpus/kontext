# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class WordlistFormArgs(object):
    _id: str = None
    form_type: str = 'wlist'
    corpname: str = None
    usesubcorp: str = None
    wlattr: str = None
    wlpat: str = None
    wlminfreq: int = 1
    wlnums: str = 'frq'
    wltype: str = 'simple'
    pfilter_words: List[str] = field(default_factory=list)
    nfilter_words: List[str] = field(default_factory=list)
    include_nonwords: str = '0'
    wlposattrs: List[str] = field(default_factory=list)

    def update_by_user_query(self, data):
        self.corpname = data['corpname']
        self.usesubcorp = data.get('usesubcorp')
        self.wlattr = data['wlattr']
        self.wlpat = data['wlpat']
        self.wlminfreq = data['wlminfreq']
        self.wlnums = data['wlnums']
        self.wltype = data['wltype']
        self.pfilter_words = data['pfilter_words']
        self.nfilter_words = data['nfilter_words']
        self.include_nonwords = data['include_nonwords']
        self.wlposattrs = data.get('wlposattrs', [])

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if not k.startswith('_')}

    def to_qp(self) -> Dict[str, Any]:
        return self.to_dict()

    @property
    def id(self):
        return self._id

    @staticmethod
    def from_dict(data, id=None):
        ans = WordlistFormArgs()
        ans._id = id
        for k, v in data.items():
            if not k.startswith('_'):
                setattr(ans, k, v)
        return ans

    def get_wlposattr(self, level: int):
        return self.wlposattrs[level] if level < len(self.wlposattrs) else None


@dataclass
class WordlistSaveFormArgs:
    corpname: str = ''
    usesubcorp: str = ''
    from_line: int = 1
    to_line: Optional[int] = None
    saveformat: str = 'text'
    colheaders: bool = False
    heading: bool = False

    def update_by_user_query(self, data):
        self.corpname = data['corpname']
        self.usesubcorp = data['usesubcorp']
        self.from_line = data['from_line']
        self.to_line = data['to_line']
        self.saveformat = data['saveformat']
        self.colheaders = data['colheaders']
        self.heading = data['heading']

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if not k.startswith('_')}
