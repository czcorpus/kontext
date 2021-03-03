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
import logging


class PqueryFormArgs(object):

    def __init__(self):
        self.corpora = []
        self.usesubcorp = None
        self.min_freq = 0
        self.position = ''
        self.queries = []
        self.attr = None
        self.form_type = 'pquery'

    def update_by_user_query(self, data):
        self.corpora = [data['queries'][0]['corpname']]
        self.usesubcorp = data.get('usesubcorp')
        self.min_freq = data['min_freq']
        self.position = data['position']
        self.queries = data['queries']
        self.attr = data['attr']

        logging.getLogger(__name__).debug('data: {}'.format(data))

    def to_dict(self) -> Dict[str, Any]:
        tmp = {k: v for k, v in self.__dict__.items() if not k.startswith('_')}
        return tmp

    def from_dict(self, data):
        for k, v in data.items():
            setattr(self, k, v)
