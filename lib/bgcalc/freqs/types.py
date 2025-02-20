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
    rel_mode: int  # 0, 1 # TODO should be bool
    fmaxitems: int
    fpagesize: Optional[int] = 100  # this makes the class compatible with our production RQ worker
    subcname: Optional[str] = None
    subcpath: Optional[str] = None
    fpage: Optional[int] = 1  # ??
    cutoff: Optional[int] = 0
    q: Optional[List[str]] = field(default_factory=list)


@dataclass
class FreqCalcResult:
    freqs: List[FreqData]
    conc_size: int


@dataclass
class Freq2DCalcArgs:
    q: List[str]
    user_id: int
    corpname: str
    cutoff: int
    ctminfreq: int
    ctminfreq_type: str
    fcrit: str
    max_result_size: int = 1000
    cache_path: Optional[str] = None
    subcorpora_dir: Optional[str] = None
    subcorpus_id: Optional[str] = None
    collator_locale: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
