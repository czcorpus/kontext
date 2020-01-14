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


class IssueReportingAction(object):

    def to_dict(self):
        return self.__dict__


class DynamicReportingAction(IssueReportingAction):

    def __init__(self):
        self.type = 'dynamic'


class StaticReportingAction(IssueReportingAction):

    def __init__(self, url, args, label, blank_window):
        self.url = url
        self.args = args
        self.label = label
        self.blank_window = blank_window
        self.type = 'static'


class AbstractIssueReporting(abc.ABC):

    @abc.abstractmethod
    def export_report_action(self, plugin_api):
        pass

    @abc.abstractmethod
    def submit(self, plugin_api, args):
        pass
