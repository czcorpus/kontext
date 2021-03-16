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

from typing import Dict, Any


class PqueryFormArgs(object):

    def __init__(self):
        self.corpname = None
        self.usesubcorp = None
        self.min_freq = 0
        self.pos_index = 0
        self.pos_align = 'left'
        self.position = None
        self.attr = None
        self.form_type = 'pquery'
        self.conc_ids = []

    def update_by_user_query(self, data):
        self.corpname = data['corpname']
        self.usesubcorp = data.get('usesubcorp')
        self.min_freq = data['min_freq']
        self.pos_index = data['pos_index']
        self.pos_align = data['pos_align']
        self.position = data['position']
        self.attr = data['attr']
        self.conc_ids = data['conc_ids']

    def to_dict(self) -> Dict[str, Any]:
        tmp = {k: v for k, v in self.__dict__.items() if not k.startswith('_')}
        return tmp

    def to_qp(self) -> Dict[str, Any]:
        return self.to_dict()

    def from_dict(self, data):
        for k, v in data.items():
            setattr(self, k, v)
