# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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

from typing import List, Tuple, Dict
from dataclasses import dataclass
from dataclasses_json import dataclass_json


@dataclass_json
@dataclass
class SuggestionLemmaData:
    match_indirect: bool
    sublemmas: List[str]


@dataclass_json
@dataclass
class CncSublemmaSuggestion:
    attrs: Tuple[str, str, str]
    value: str
    data: Dict[str, SuggestionLemmaData]
