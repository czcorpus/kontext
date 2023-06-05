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

from dataclasses import dataclass

from action.argmapping.conc.base import ConcFormArgs
from dataclasses_json import dataclass_json
from .base import AbstractRawQueryDecoder


@dataclass_json
@dataclass
class _ConcFormArgs:
    form_type: str = 'lgroup'


class LgroupOpArgs(ConcFormArgs[_ConcFormArgs], AbstractRawQueryDecoder):
    """
    This is used to store special actions that modify
    compiled query string but are produced in a special
    way and thus cannot be edited again (e.g. lines groups
    operations).
    """
    def __init__(self, persist: bool):
        super().__init__(persist)
        self.data = _ConcFormArgs()

    def from_raw_query(self, q, corpname) -> 'LgroupOpArgs':
        if q[1:] != "":
            raise ValueError('Raw LgroupOpArgs query must be empty')
        return self


@dataclass_json
@dataclass
class _LockedOpFormsArgs:
    form_type: str = 'locked'


class LockedOpFormsArgs(ConcFormArgs[_LockedOpFormsArgs], AbstractRawQueryDecoder):
    """
    LockedOpFormsArgs is used to persist actions that modify compiled
    query string and are mapped to an existing user-editable
    form (see the difference with LgroupOpArgs) but we
    do not want user to edit them manually (e.g. user
    filters manually selected lines which produces a bunch
    of token IDs which cannot be deserialized into a form).
    """

    def __init__(self, persist: bool):
        super().__init__(persist)
        self.data = _LockedOpFormsArgs()

    def from_raw_query(self, q, corpname) -> 'LockedOpFormsArgs':
        if q[1:] != "":
            raise ValueError('Raw LockedOpFormsArgs query must be empty')
        return self


@dataclass_json
@dataclass
class _SampleFormArgs:
    form_type: str = 'sample'
    rlines: str = '250'


class SampleFormArgs(ConcFormArgs[_SampleFormArgs], AbstractRawQueryDecoder):
    """
    SampleFormArgs provides methods to handle "create sample"
    form arguments represented by the _SampleFormArgs data class.
    """

    def __init__(self, persist: bool):
        super().__init__(persist)
        self.data = _SampleFormArgs()

    def from_raw_query(self, q, corpname) -> 'SampleFormArgs':
        self.data.rlines = q[1:]
        return self


@dataclass_json
@dataclass
class _ShuffleFormArgs:
    form_type: str = 'shuffle'


class ShuffleFormArgs(ConcFormArgs[_ShuffleFormArgs], AbstractRawQueryDecoder):
    """
    ShuffleFormArgs provides methods to handle "shuffle concordance lines"
    form arguments represented by the _ShuffleFormArgs data class.
    """
    def __init__(self, persist: bool):
        super().__init__(persist)
        self.data = _ShuffleFormArgs()

    def from_raw_query(self, q, corpname) -> 'ShuffleFormArgs':
        if q[1:] != "":
            raise ValueError('Raw ShuffleFormArgs query must be empty')
        return self


@dataclass_json
@dataclass
class _KwicSwitchArgs:
    form_type: str = 'switchmc'
    maincorp: str = ''


class KwicSwitchArgs(ConcFormArgs[_KwicSwitchArgs], AbstractRawQueryDecoder):
    """
    KwicSwitchArgs provides methods to handle "switch main corp"
    (aligned corpora only) form arguments represented by the
    _KwicSwitchArgs data class.
    """
    def __init__(self, maincorp: str, persist: bool) -> None:
        super().__init__(persist)
        self.data = _KwicSwitchArgs(maincorp=maincorp)


    def from_raw_query(self, q, corpname) -> 'KwicSwitchArgs':
        self.data.maincorp = q[1:]
        return self