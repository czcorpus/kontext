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

from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field, asdict


@dataclass
class SubsetComplementsAndRatio:
    conc_ids: List[str]
    max_non_matching_ratio: float

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> 'SubsetComplementsAndRatio':
        return SubsetComplementsAndRatio(d['conc_ids'], d['max_non_matching_ratio'])


@dataclass
class SupersetAndRatio:
    conc_id: str
    max_non_matching_ratio: float

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> 'SupersetAndRatio':
        return SupersetAndRatio(d['conc_id'], d['max_non_matching_ratio'])


@dataclass
class PqueryFormArgs:

    corpname: str
    position: str
    attr: str
    usesubcorp: Optional[str] = field(default=None)
    min_freq: int = field(default=0)
    pos_left: int = field(default=0)
    pos_right: int = field(default=0)
    pos_align: str = field(default='left')
    form_type: str = field(default='pquery')
    conc_ids: List[str] = field(default_factory=list)
    pquery_type: str = field(default='split')
    conc_subset_complements: Optional[SubsetComplementsAndRatio] = field(default=None)
    conc_superset: Optional[SupersetAndRatio] = field(default=None)

    def update_by_user_query(self, data):
        self.corpname = data['corpname']
        self.usesubcorp = data.get('usesubcorp')
        self.min_freq = data['min_freq']
        self.pos_left = data['pos_left']
        self.pos_right = data['pos_right']
        self.pos_align = data['pos_align']
        self.position = data['position']
        c_tmp = data['conc_subset_complements']
        if c_tmp:
            self.conc_subset_complements = SubsetComplementsAndRatio(
                data['conc_subset_complements']['conc_ids'],
                data['conc_subset_complements']['max_non_matching_ratio'])
        if data['conc_superset']:
            self.conc_superset = SupersetAndRatio(
                data['conc_superset']['conc_id'],
                data['conc_superset']['max_non_matching_ratio'])
        self.attr = data['attr']
        self.conc_ids = data['conc_ids']
        self.pquery_type = data['pquery_type']

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_qp(self) -> Dict[str, Any]:
        return self.to_dict()

    def from_dict(self, data):
        for k, v in data.items():
            if hasattr(self, k):
                if k == 'conc_subset_complements':
                    self.conc_subset_complements = SubsetComplementsAndRatio.from_dict(v) if v else None
                elif k == 'conc_superset':
                    self.conc_superset = SupersetAndRatio.from_dict(v) if v else None
                else:
                    setattr(self, k, v)
