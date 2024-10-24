# Copyright (c) 2024 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2024 Martin Zimandl <martin.zimandl@gmail.com>
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

@dataclass
class FullSearchArgs:
    name: str
    any_property_value: str
    any_property_value_is_sub: bool
    posattr_name: str
    posattr_value: str
    posattr_value_is_sub: bool
    structure_name: str
    structattr_name: str
    structattr_value: str
    structattr_value_is_sub: bool
    corpus: str
    subcorpus: str
    wl_pat: str
    wl_attr: str
    wl_pfilter: str
    wl_nfilter: str

    def empty(self) -> bool:
        return all(v is None for v in self.__dict__.values())