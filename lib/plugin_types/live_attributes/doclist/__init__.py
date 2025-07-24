# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
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

import hashlib
from dataclasses import dataclass
from typing import Dict, List

import ujson as json
from dataclasses_json import LetterCase, dataclass_json


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class DocListItem:

    id: str
    label: str
    idx: int
    num_of_pos: int
    attrs: Dict[str, str]


def mk_cache_key(attrs: Dict[str, List[str]], aligned: List[str], view_attrs: List[str]) -> str:
    return hashlib.sha1((json.dumps(attrs) + '#'.join(aligned) + '*'.join(view_attrs)).encode()).hexdigest()
