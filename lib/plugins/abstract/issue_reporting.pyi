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

from typing import Dict, Any, Union, ClassVar, List, Callable
import kontext

AnyStr = Union[str, unicode]


class IssueReportingAction(object):

    def to_dict(self) -> Dict[Any]: ...


class DynamicReportingAction(IssueReportingAction): ...


class StaticReportingAction(IssueReportingAction):

    url:AnyStr
    args:Dict[AnyStr, AnyStr]
    label:AnyStr
    blank_window:bool
    type:AnyStr

    def __init__(self, url:AnyStr, args:AnyStr, label:Dict[AnyStr, AnyStr], blank_window:bool): ...


class AbstractIssueReporting(object):

    def export_report_action(self, plugin_api:):Dict[ClassVar, List[Callable[[self, Any]:Any]]]: ...

    def submit(self, plugin_api:kontext.PluginApi, args:Dict[AnyStr, AnyStr]): ...
