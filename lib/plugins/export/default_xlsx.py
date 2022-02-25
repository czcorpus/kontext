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
from io import BytesIO
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell

from . import AbstractExport, lang_row_to_list, ExportPluginException
from translation import ugettext as _


class XLSXExport(AbstractExport):

    def __init__(self, subtype):
        self._written_lines = 0
        self._wb = Workbook(write_only=True)
        self._sheet = self._wb.create_sheet()
        self._col_types = ()
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
        elif subtype == 'pquery':
            self._sheet.title = _('paradigmatic query')
            self._import_row = lambda x: x

    def content_type(self):
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    def raw_content(self):
        output = BytesIO()
        self._wb.save(filename=output)
        return output.getvalue()

    def writeheading(self, data):
        if type(data) is dict:
            data = [f'{k}: {v}' for k, v in data.items()]
        self._sheet.append(data)
        self._sheet.append([])
        self._written_lines += 2

    def write_ref_headings(self, data):
        cells = []
        for d in data:
            cell = WriteOnlyCell(self._sheet, d)
            cell.font = cell.font.copy(bold=True)
            cells.append(cell)
        self._sheet.append(cells)
        self._sheet.merged_cells.ranges.append('A1:G1')
        self._written_lines += 1

    def set_col_types(self, *types):
        self._col_types = types

    def _import_value(self, v, i):
        format_map = {
            int: '0',
            int: '0',
            float: '0.00',
            str: 'General'
        }
        if i < len(self._col_types):
            out_type = self._col_types[i]
        else:
            out_type = str
        if out_type not in format_map:
            raise ExportPluginException('Unsupported cell type %s' % out_type)
        if out_type is not str and v is None or v == '':
            out_type = str
        return out_type(v), format_map[out_type]

    def writerow(self, line_num, *lang_rows):
        row = []
        if line_num is not None:
            row.append(line_num)
        for lang_row in lang_rows:
            row += self._import_row(lang_row)
        self._sheet.append([self._get_cell(*self._import_value(d, i)) for i, d in enumerate(row)])
        self._written_lines += 1

    def new_sheet(self, name):
        if self._written_lines > 1:
            self._sheet = self._wb.create_sheet()
        self._sheet.title = name

    def _get_cell(self, value, cell_format):
        cell = WriteOnlyCell(self._sheet, value)
        cell.number_format = cell_format
        return cell


def create_instance(subtype):
    return XLSXExport(subtype)
