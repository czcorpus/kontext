# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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

import abc
from typing import TYPE_CHECKING, Any, Callable, Dict, List

# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from action.plugin.ctx import AbstractUserPluginCtx


class IssueReportingAction:

    def to_dict(self) -> Dict[Any, Any]:
        return self.__dict__


class DynamicReportingAction(IssueReportingAction):

    def __init__(self) -> None:
        self.type: str = 'dynamic'


class StaticReportingAction(IssueReportingAction):

    def __init__(self, url: str, args: Dict[str, str], label: str, blank_window: bool) -> None:
        self.url: str = url
        self.args: Dict[str, str] = args
        self.label: str = label
        self.blank_window: bool = blank_window
        self.type: str = 'static'


class AbstractIssueReporting(abc.ABC):

    def export_report_action(self, plugin_ctx: 'AbstractUserPluginCtx') -> IssueReportingAction:
        pass

    async def submit(self, plugin_ctx: 'AbstractUserPluginCtx', args: Dict[str, str]):
        pass
