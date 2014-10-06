# Copyright (c) 2014 Czech National Corpus
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

"""
A plug-in allowing export of a concordance (in fact, any row/cell
like data can be used) to XLSX (Office Open XML) format.

Plug-in requires openpyxl library.
"""

from StringIO import StringIO

from openpyxl import Workbook
from openpyxl.compat import range
from openpyxl.cell import get_column_letter

from . import AbstractExport, lang_row_to_list
from translation import ugettext as _


class XLSXExport(AbstractExport):

    def __init__(self, subtype):
        self._wb = Workbook()
        self._sheet = self._wb.active
        self._curr_line = 1
        if subtype == 'concordance':
            self._sheet.title = _('concordance')
            self._import_row = lang_row_to_list
        else:
            self._sheet.title = _('frequency distribution')
            self._import_row = lambda x: x

    def content_type(self):
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    def raw_content(self):
        output = StringIO()
        self._wb.save(filename=output)
        return output.getvalue()

    def writerow(self, line_num, *lang_rows):
        row = []
        for lang_row in lang_rows:
            row += self._import_row(lang_row)

        for i in range(1, len(row) + 1):
            col = get_column_letter(i)
            self._sheet.cell('%s%s' % (col, self._curr_line)).value = row[i - 1]
        self._curr_line += 1


def create_instance(subtype):
    return XLSXExport(subtype)
