# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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


from dataclasses import fields, MISSING
from typing import List, NewType, Optional, Type, TypeVar

from action.errors import UserReadableException
from sanic.request import Request

T = TypeVar('T')

StrOpt = NewType('StrOpt', Optional[str])
ListStrOpt = NewType('ListStrOpt', List[str])
IntOpt = NewType('IntOpt', Optional[int])
ListIntOpt = NewType('ListIntOpt', List[int])


def is_optional_field(field_obj):
    has_default = field_obj.default is not MISSING
    has_default_factory = field_obj.default_factory is not MISSING
    return has_default or has_default_factory


def create_mapped_args(tp: Type, req: Request):
    """
    Create an instance of a (dataclass) Type based on req arguments.
    Please note that the Type should contain only str/List[str] and int/List[int] values.

    TODO handle Optional vs. default_factory etc.
    """
    data = {}
    for field in fields(tp):
        mk, mtype = field.name, field.type
        v = req.args.getlist(mk, [])
        if len(v) == 0:
            v = req.form.get(mk, [])
        if mtype == str:
            if len(v) == 0:
                if is_optional_field(field):
                    continue
                raise UserReadableException(f'Missing request argument {mk}')
            if len(v) > 1:
                raise UserReadableException(f'Argument {mk} is cannot be multi-valued')
            data[mk] = v[0]
        elif mtype == StrOpt:
            if len(v) > 1:
                raise UserReadableException(f'Argument {mk} is cannot be multi-valued')
            elif len(v) == 1:
                data[mk] = v[0]
        elif mtype == List[str]:
            if len(v) == 0:
                if is_optional_field(field):
                    continue
                raise UserReadableException(f'Missing request argument {mk}')
            data[mk] = v
        elif mtype == ListStrOpt:
            if len(v) > 0:
                data[mk] = v
        elif mtype == int:
            if len(v) == 0:
                if is_optional_field(field):
                    continue
                raise UserReadableException(f'Missing request argument {mk}')
            elif len(v) > 1:
                raise UserReadableException(f'Argument {mk} is cannot be multi-valued')
            data[mk] = int(v[0])
        elif mtype == IntOpt:
            if len(v) > 1:
                raise UserReadableException(f'Argument {mk} is cannot be multi-valued')
            elif len(v) == 1:
                data[mk] = int(v[0])
        elif mtype == List[int]:
            if len(v) == 0:
                if is_optional_field(field):
                    continue
                raise UserReadableException(f'Missing request argument {mk}')
            data[mk] = [int(x) for x in v]
        elif mtype == ListIntOpt:
            if len(v) > 0:
                data[mk] = [int(x) for x in v]
        elif mtype == bool:
            data[mk] = bool(int(v[0]))
    return tp(**data)
