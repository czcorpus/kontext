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
import re


class WordlistFormArgs(object):

    def __init__(self):
        self.form_type = 'wlist'
        self.corpname = None
        self.usesubcorp = None
        self.wlattr = None
        self.wlpat = None
        self.wlminfreq = 1
        self.wlnums = 'frq'
        self.wltype = 'simple'
        self.wlsort = 'f'
        self.pfilter_words = []
        self.nfilter_words = []
        self.include_nonwords = '0'

    def update_by_user_query(self, data):
        self.corpname = data['corpname']
        self.usesubcorp = data.get('usesubcorp')
        self.wlattr = data['wlattr']
        self.wlpat = data['wlpat']
        self.wlminfreq = data['wlminfreq']
        self.wlnums = data['wlnums']
        self.wltype = data['wltype']
        self.wlsort = data['wlsort']
        self.pfilter_words = [w for w in re.split(r'\s+', data['pfilter_words'].strip()) if w]
        self.nfilter_words = [w for w in re.split(r'\s+', data['nfilter_words'].strip()) if w]
        self.include_nonwords = data['include_nonwords']

    def to_dict(self) -> Dict[str, Any]:
        tmp = {k: v for k, v in self.__dict__.items() if not k.startswith('_')}
        return tmp

    def to_qp(self) -> Dict[str, Any]:
        return self.to_dict()

    def from_dict(self, data):
        for k, v in data.items():
            setattr(self, k, v)
