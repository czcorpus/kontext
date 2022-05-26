# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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


from dataclasses import asdict, dataclass, field
from typing import Any, Dict, List, Optional, Tuple, Union

from conclib.freq import FreqData


@dataclass
class FreqCalcArgs:
    """
    Collects all the required arguments passed around when
    calculating frequency distribution
    """
    user_id: int
    corpname: str
    collator_locale: str
    pagesize: int
    flimit: int
    fcrit: Union[List[str], Tuple[str, ...]]
    freq_sort: str
    ftt_include_empty: int  # 0, 1  # TODO should be bool
    rel_mode: int  # 0, 1 # TODO should be bool
    fmaxitems: int
    subcname: Optional[str] = None
    subcpath: List[str] = field(default_factory=list)
    fpage: int = 1  # ??
    samplesize: int = 0
    q: List[str] = field(default_factory=list)
    remove_empty_items: int = 1


@dataclass
class FreqCalcResult:
    freqs: List[FreqData]
    conc_size: int


@dataclass
class Freq2DCalcArgs:
    q: List[str]
    user_id: int
    corpname: str
    ctminfreq: int
    ctminfreq_type: str
    fcrit: str
    cache_path: Optional[str] = None
    subcpath: List[str] = field(default_factory=list)
    subcname: Optional[str] = None
    collator_locale: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
