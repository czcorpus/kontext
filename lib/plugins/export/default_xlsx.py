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

from . import AbstractExport, lang_row_to_list, ExportPluginException
from translation import ugettext as _


class XLSXExport(AbstractExport):

    def __init__(self, subtype):
        self._wb = Workbook()
        self._sheet = self._wb.active
        self._col_types = ()
        self._curr_line = 1
        if subtype == 'concordance':
            self._sheet.title = _('concordance')
            self._import_row = lang_row_to_list
        elif subtype == 'freq':
            self._sheet.title = _('frequency distribution')
            self._import_row = lambda x: x
        elif subtype == 'wordlist':
            self._sheet.title = _('word list')
            self._import_row = lambda x: x
        elif subtype == 'coll':
            self._sheet.title = _('collocations')
            self._import_row = lambda x: x

    def content_type(self):
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    def raw_content(self):
        output = StringIO()
        self._wb.save(filename=output)
        return output.getvalue()

    def writeheading(self, data):
        for i in range(1, len(data) + 1):
            col = get_column_letter(i)
            self._sheet.cell('%s%s' % (col, self._curr_line)).value = data[i - 1]
        self._curr_line += 1

    def set_col_types(self, *types):
        self._col_types = types

    def _import_value(self, v, i):
        format_map = {
            int: '0',
            long: '0',
            float: '0.00',
            unicode: 'General'
        }
        if i < len(self._col_types):
            out_type = self._col_types[i]
        else:
            out_type = unicode
        if out_type not in format_map:
            raise ExportPluginException('Unsupported cell type %s' % out_type)
        return out_type(v), format_map[out_type]

    def writerow(self, line_num, *lang_rows):
        row = []
        if line_num is not None:
            row.append(line_num)
        for lang_row in lang_rows:
            row += self._import_row(lang_row)
        for i in range(1, len(row) + 1):
            col = get_column_letter(i)
            value, cell_format = self._import_value(row[i - 1], i - 1)
            cell = self._sheet.cell('%s%s' % (col, self._curr_line))
            cell.value = value
            cell.number_format = cell_format
        self._curr_line += 1


def create_instance(subtype):
    return XLSXExport(subtype)
