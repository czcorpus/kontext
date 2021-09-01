# Copyright (c) 2021 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
from typing import List


@dataclass(frozen=True)
class StructAttr:
    struct: str
    attr: str

    def values(self) -> List[str]:
        return [self.struct, self.attr]

    def key(self) -> str:
        return f'{self.struct}.{self.attr}'

    @staticmethod
    def get(v) -> 'StructAttr':
        return StructAttr(*v.split('.'))


@dataclass(frozen=True)
class AttrValueKey:
    short_name: str
    ident: str
    full_name: str
