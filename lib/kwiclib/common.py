# Copyright (c) 2003-2009  Pavel Rychly
# Copyright (c) 2014  Institute of the Czech National Corpus
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.


import re
from dataclasses import dataclass, field
from enum import Enum
from typing import (
    Any, Dict, Generator, Iterable, Iterator, List, Optional, Tuple, TypeVar,
    Union)

SortCritType = List[Tuple[str, Union[str, int]]]
T = TypeVar('T')


def pair(data: Union[Iterable[T], Iterator[T]]) -> Generator[Tuple[T, T], None, None]:
    iterator = data if isinstance(data, Iterator) else iter(data)
    while True:
        try:
            yield next(iterator), next(iterator)
        except StopIteration:
            break


def split_chunk(pseudo_token: Tuple[str, str], next_cls: str) -> List[Tuple[str, str]]:
    """
    Because Manatee sometimes (based on selected attributes
    to be displayed) produces chunks like
    ('This is a single string', '{class3}')
    ... and we prefer items split like this:
    ('This', '{class3}'), ('is', '{class3}'), ... etc.
    """
    pt, cls = pseudo_token
    if cls in ("strc", "attr") or next_cls == "attr":
        return [(pt, cls)]
    # split string only if it's not `strc` or `attr`
    # and if the next token is not attr
    return [(t, cls) for t in re.split(r'\s+', pt)]


def tokens2strclass(tokens) -> List[Dict[str, str]]:
    """
    Converts internal data structure produced by KwicLine and CorpRegion containing tokens and
    respective HTML classes into a more suitable form.

    arguments:
    tokens -- a tuple of the following format: ('a token', '{class1 class2}', 'another token', '{class3}',...)

    returns:
    a list of dicts {'str': '[token]', 'class': '[classes]'}
    """
    pairs = list(pair(tokens))
    pairs = [y for x in [split_chunk(p, pairs[i + 1][1] if i + 1 < len(pairs) else "")
                         for i, p in enumerate(pairs)] for y in x]
    return [{'str': str_token, 'class': class_token.strip('{}')}
            for str_token, class_token in pairs]


def lngrp_sortcrit(lab: str, separator: str = '.') -> SortCritType:
    # TODO
    def num2sort(n: str) -> Tuple[str, Union[str, int]]:
        if re.compile('[0-9]+$').match(n):
            return 'n', int(n)
        else:
            return 'c', n
    if not lab:
        return [('x', 'x')]
    return list(map(num2sort, lab.split(separator, 3)))


class Pagination:
    first_page = 1
    prev_page = None
    next_page = None
    last_page = None

    def export(self):
        return dict(firstPage=self.first_page, prevPage=self.prev_page,
                    nextPage=self.next_page, lastPage=self.last_page)


class AttrRole(Enum):
    USER = 0b01
    INTERNAL = 0b10

    @staticmethod
    def is_role(value: int, role: 'AttrRole') -> bool:
        return (value & role.value) == role.value


class MergedPosAttrs(dict):
    def set_role(self, attr: str, role: AttrRole):
        self[attr] = self.get(attr, 0) | role.value

    def is_role(self, attr: str, role: AttrRole) -> bool:
        return AttrRole.is_role(self[attr], role)


@dataclass
class KwicPageData:
    """
    Defines data required to render a KWIC page
    """
    Lines: Optional[List[Any]] = None
    GroupNumbers: Optional[List[Any]] = None
    fromp: Optional[int] = None
    Page: List[Any] = field(default_factory=list)
    pagination: Pagination = field(default_factory=lambda: Pagination())
    concsize: Optional[int] = None
    result_arf: Optional[float] = None
    result_relative_freq: Optional[float] = None
    KWICCorps: List[Any] = field(default_factory=list)
    CorporaColumns: List[Any] = field(default_factory=list)
    merged_attrs: List[Tuple[str, int]] = field(default_factory=list)
    merged_ctxattrs: List[Tuple[str, int]] = field(default_factory=list)
