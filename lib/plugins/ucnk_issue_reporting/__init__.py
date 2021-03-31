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

import urllib.request
import urllib.parse
import urllib.error

from plugins import inject
from plugins.abstract.issue_reporting import AbstractIssueReporting, StaticReportingAction
from translation import ugettext as _


class UcnkErrorReporting(AbstractIssueReporting):

    def export_report_action(self, plugin_ctx):
        args = {'issue[custom_field_values][16]': urllib.parse.quote_plus(plugin_ctx.current_url)}
        return StaticReportingAction(
            url='https://podpora.korpus.cz/projects/kontext/issues/new',
            args=args,
            label=_('Report an error'),
            blank_window=True)


@inject()
def create_instance(settings):
    return UcnkErrorReporting()
