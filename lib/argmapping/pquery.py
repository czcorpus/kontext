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
    conc_subset_complement_id: Optional[str] = field(default=None)
    condition_never_tolerance: Optional[float] = field(default=0.0)
    conc_superset_id: Optional[str] = field(default=None)
    condition_always_tolerance: Optional[float] = field(default=0.0)

    def update_by_user_query(self, data):
        self.corpname = data['corpname']
        self.usesubcorp = data.get('usesubcorp')
        self.min_freq = data['min_freq']
        self.pos_left = data['pos_left']
        self.pos_right = data['pos_right']
        self.pos_align = data['pos_align']
        self.position = data['position']
        self.attr = data['attr']
        self.conc_ids = data['conc_ids']

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def to_qp(self) -> Dict[str, Any]:
        return self.to_dict()

    def from_dict(self, data):
        for k, v in data.items():
            if hasattr(self, k):
                setattr(self, k, v)
