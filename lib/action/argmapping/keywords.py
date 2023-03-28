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

from dataclasses import asdict, dataclass
from typing import Any, Dict, Optional


@dataclass
class KeywordsFormArgs:
    _id: str = None
    form_type: str = 'kwords'
    corpname: str = None
    usesubcorp: str = None
    ref_corpname: str = None
    ref_usesubcorp: str = None
    wlattr: str = None
    wlpat: str = None
    wlminfreq: int = 1
    wlnums: str = 'frq'
    wltype: str = 'simple'
    include_nonwords: str = '0'
    score_type: Optional[str] = None

    def update_by_user_query(self, data):
        self.corpname = data['corpname']
        self.usesubcorp = data.get('usesubcorp')
        self.ref_corpname = data['ref_corpname']
        self.ref_usesubcorp = data.get('ref_usesubcorp')
        self.wlattr = data['wlattr']
        self.wlpat = data['wlpat']
        self.wlminfreq = data['wlminfreq']
        self.wlnums = data['wlnums']
        self.wltype = data['wltype']
        self.include_nonwords = data['include_nonwords']
        self.score_type = data['score_type']

    def to_dict(self) -> Dict[str, Any]:
        return {k: v for k, v in asdict(self).items() if not k.startswith('_')}

    def to_qp(self) -> Dict[str, Any]:
        return self.to_dict()

    @property
    def id(self):
        return self._id

    @staticmethod
    def from_dict(data, id=None):
        ans = KeywordsFormArgs()
        ans._id = id
        for k, v in data.items():
            if not k.startswith('_'):
                setattr(ans, k, v)
        return ans
