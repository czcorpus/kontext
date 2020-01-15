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

    def to_dict(self) -> Dict[Any, Any]: ...


class DynamicReportingAction(IssueReportingAction): ...


class StaticReportingAction(IssueReportingAction):

    url:str
    args:Dict[str, str]
    label:str
    blank_window:bool
    type:str

    def __init__(self, url:str, args:str, label:Dict[str, str], blank_window:bool) -> None: ...


class AbstractIssueReporting(abc.ABC):

    def export_report_action(self, plugin_api:PluginApi) -> Dict[Any, List[Callable[[Any], Any]]]: ...

    def submit(self, plugin_api:PluginApi, args:Dict[str, str]): ...
