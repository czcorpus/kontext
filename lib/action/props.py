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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.


from dataclasses import dataclass
from typing import Any, Callable, Optional, Tuple, Union
from action.result.base import BaseResult
from action.krequest import KRequest


@dataclass
class ActionProps:

    action_name: str

    action_prefix: str

    return_type: str

    access_level: int = 1
    """
    0 = always public access (even if no_anonymous_access is set to true; this is mostly for login actions
    1 = public access if no_anonymous_access is False
    2 = only for registered users
    """

    http_method: Union[Optional[str], Tuple[str, ...]] = 'GET'

    page_model: Optional[Union[str, BaseResult]] = None
    """
    Either a module name for TypeScript page model or a variant of action.result.base.BaseResult
    (which, among others, also provides the TypeScript module)
    """

    template: Optional[str] = None

    mutates_result: bool = False

    action_log_mapper: Callable[[KRequest], Any] = False
