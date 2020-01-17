# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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
from controller.plg import PluginApi
from typing import Dict, Any, List, Callable


class IssueReportingAction(object):

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

    @abc.abstractmethod
    def export_report_action(self, plugin_api: PluginApi) -> Dict[Any, List[Callable[[Any], Any]]]:
        pass

    @abc.abstractmethod
    def submit(self, plugin_api: PluginApi, args: Dict[str, str]):
        pass
