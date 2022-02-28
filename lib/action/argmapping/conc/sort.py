# Copyright (c) 2017 Charles University, Faculty of Arts,
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

from typing import Dict, Any
from action.argmapping.conc.base import ConcFormArgs
from action.argmapping.error import ValidationError
from dataclasses import dataclass
from dataclasses_json import dataclass_json


@dataclass_json
@dataclass
class _SortFormArgs:
    form_type: str = 'sort'
    form_action: str = 'sortx'
    sattr: str = 'word'
    skey: str = 'kw'
    spos: int = 3  # number of tokens to sort
    sicase: str = ''
    sbward: str = ''
    sortlevel: int = 1
    ml1attr: str = 'word'
    ml2attr: str = 'word'
    ml3attr: str = 'word'
    ml4attr: str = 'word'
    ml1icase: str = ''
    ml2icase: str = ''
    ml3icase: str = ''
    ml4icase: str = ''
    ml1bward: str = ''
    ml2bward: str = ''
    ml3bward: str = ''
    ml4bward: str = ''
    ml1pos: int = 1
    ml2pos: int = 1
    ml3pos: int = 1
    ml4pos: int = 1
    ml1ctx: str = '0~0>0'
    ml2ctx: str = '0~0>0'
    ml3ctx: str = '0~0>0'
    ml4ctx: str = '0~0>0'


class SortFormArgs(ConcFormArgs[_SortFormArgs]):
    """
    SortFormArgs provides methods to handle concordance
    query form arguments represented by the _SortFormArgs data class.
    """

    def __init__(self, persist: bool) -> None:
        """
        args:
            persist -- specify whether the object should be stored
                       to disk when the current action is finished
        """
        super().__init__(persist)
        self.data = _SortFormArgs()

    def update_by_user_query(self, data: Dict[str, Any]):
        if data.get('type') == 'sortQueryArgs':
            self.data.sattr = data['sattr']
            self.data.skey = data['skey']
            self.data.sbward = data['sbward']
            self.data.sicase = data['sicase']
            self.data.spos = data['spos']
            self.data.form_action = 'sortx'
        elif data.get('type') == 'mlSortQueryArgs':
            self.data.form_action = 'mlsortx'
            self.data.sortlevel = len(data['levels'])
            num_levels = len(data['levels'])
            if num_levels > 4:
                raise ValidationError('Multi-level sorting supports at most 4 levels')
            if num_levels > 0:
                self.data.ml1attr = data['levels'][0]['sattr']
                self.data.ml1bward = data['levels'][0]['sbward']
                self.data.ml1ctx = data['levels'][0]['ctx']
                self.data.ml1icase = data['levels'][0]['sicase']
                self.data.ml1pos = data['levels'][0]['spos']
            if num_levels > 1:
                self.data.ml2attr = data['levels'][1]['sattr']
                self.data.ml2bward = data['levels'][1]['sbward']
                self.data.ml2ctx = data['levels'][1]['ctx']
                self.data.ml2icase = data['levels'][1]['sicase']
                self.data.ml2pos = data['levels'][1]['spos']
            if num_levels > 2:
                self.data.ml3attr = data['levels'][2]['sattr']
                self.data.ml3bward = data['levels'][2]['sbward']
                self.data.ml3ctx = data['levels'][2]['ctx']
                self.data.ml3icase = data['levels'][2]['sicase']
                self.data.ml3pos = data['levels'][2]['spos']
            if num_levels > 3:
                self.data.ml4attr = data['levels'][3]['sattr']
                self.data.ml4bward = data['levels'][3]['sbward']
                self.data.ml4ctx = data['levels'][3]['ctx']
                self.data.ml4icase = data['levels'][3]['sicase']
                self.data.ml4pos = data['levels'][3]['spos']
        else:
            raise Exception('Failed to recognize sort form source data')
