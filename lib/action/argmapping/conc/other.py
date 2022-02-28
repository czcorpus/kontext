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

from argmapping.conc.base import ConcFormArgs
from dataclasses import dataclass
from dataclasses_json import dataclass_json


@dataclass_json
@dataclass
class _ConcFormArgs:
    form_type: str = 'lgroup'


class LgroupOpArgs(ConcFormArgs[_ConcFormArgs]):
    """
    This is used to store special actions that modify
    compiled query string but are produced in a special
    way and thus cannot be edited again (e.g. lines groups
    operations).
    """
    def __init__(self, persist: bool):
        super().__init__(persist)
        self.data = _ConcFormArgs()


@dataclass_json
@dataclass
class _LockedOpFormsArgs:
    form_type: str = 'locked'


class LockedOpFormsArgs(ConcFormArgs[_LockedOpFormsArgs]):
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


@dataclass_json
@dataclass
class _SampleFormArgs:
    form_type: str = 'sample'
    rlines: str = '250'


class SampleFormArgs(ConcFormArgs[_SampleFormArgs]):
    """
    SampleFormArgs provides methods to handle "create sample"
    form arguments represented by the _SampleFormArgs data class.
    """

    def __init__(self, persist: bool):
        super().__init__(persist)
        self.data = _SampleFormArgs()


@dataclass_json
@dataclass
class _ShuffleFormArgs:
    form_type: str = 'shuffle'


class ShuffleFormArgs(ConcFormArgs[_ShuffleFormArgs]):
    """
    ShuffleFormArgs provides methods to handle "shuffle concordance lines"
    form arguments represented by the _ShuffleFormArgs data class.
    """
    def __init__(self, persist: bool):
        super().__init__(persist)
        self.data = _ShuffleFormArgs()


@dataclass_json
@dataclass
class _KwicSwitchArgs:
    form_type: str = 'switchmc'
    maincorp: str = ''


class KwicSwitchArgs(ConcFormArgs[_KwicSwitchArgs]):
    """
    KwicSwitchArgs provides methods to handle "switch main corp"
    (aligned corpora only) form arguments represented by the
    _KwicSwitchArgs data class.
    """
    def __init__(self, maincorp: str, persist: bool) -> None:
        super().__init__(persist)
        self.data = _KwicSwitchArgs(maincorp=maincorp)
