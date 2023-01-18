# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

from typing import Optional, TypeVar, Generic
from dataclasses import dataclass

T = TypeVar('T')

@dataclass
class BaseResult(Generic[T]):
    """
    Base result represents the most general value representing
    a result of an action function.

    This value can be set as a result to KResponse (KResponse.set_result(result)).
    """

    js_module: Optional[str] = None
    """
    js_module represents JS/TS module providing PageModel for a respective
    result page.
    """

    value: Optional[T] = None
    """
    value is a raw API response providing action result data which can be
    used either "as is" or with matching "js_module" value providing client-side
    application to handle the data. 
    """