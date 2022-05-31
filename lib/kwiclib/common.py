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
from typing import Generator, Iterable, Iterator, List, Tuple, TypeVar, Union

SortCritType = List[Tuple[str, Union[str, int]]]
T = TypeVar('T')


def pair(data: Union[Iterable[T], Iterator[T]]) -> Generator[Tuple[T, T], None, None]:
    iterator = data if isinstance(data, Iterator) else iter(data)
    while True:
        try:
            yield next(iterator), next(iterator)
        except StopIteration:
            break


def tokens2strclass(tokens):
    """
    Converts internal data structure produced by KwicLine and CorpRegion containing tokens and
    respective HTML classes into a more suitable form.

    arguments:
    tokens -- a tuple of the following format: ('a token', '{class1 class2}', 'another token', '{class3}',...)

    returns:
    a list of dicts {'str': '[token]', 'class': '[classes]'}
    """
    return [{'str': str_token, 'class': class_token.strip('{}')}
            for str_token, class_token in pair(tokens)]


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
