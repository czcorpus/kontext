# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2017 Petr Duda <petrduda@seznam.cz>
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import os
from StringIO import StringIO
from openpyxl import Workbook
from openpyxl.styles import Alignment, Side, Color, PatternFill, Font, Border, colors

from plugins.export_freq2d import AbstractExportFreq2d


class XLSXExport(AbstractExportFreq2d):

    def __init__(self):
        self._wb = Workbook()
        self._sheet = self._wb.active
        self._attr1 = None
        self._attr2 = None
        self._labels1 = None
        self._labels2 = None
        self._alpha_level = None
        self._min_abs_freq = None
        self._data = None

    def content_type(self):
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    def set_content(self, attr1, attr2, labels1, labels2, alpha_level, min_abs_freq, data):
        self._attr1 = attr1
        self._attr2 = attr2
        self._labels1 = labels1
        self._labels2 = labels2
        self._alpha_level = alpha_level
        self._min_abs_freq = min_abs_freq
        self._data = data

        # define styles
        kontext_green = "d2edc0"
        green_fill = PatternFill(patternType='solid', fgColor=Color(kontext_green))
        gray_font = Font(color="999999")
        green_border = Side(style='medium', color=kontext_green)
        no_border = Side(style='thin', color=colors.WHITE)

        # --------------
        # render caption
        # --------------
        table_width = len(self._data[0]) * 3 + 1
        self._sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=table_width)
        self._sheet["A1"].fill = green_fill
        self._sheet["A1"] = "Two-attribute interrelationship: " + self._attr1 + "\\" + self._attr2
        self._sheet["A1"].font = Font(bold=True)
        self._sheet["A3"] = "Attr. 1:"
        self._sheet["B3"] = self._attr1
        self._sheet["A4"] = "Attr. 2:"
        self._sheet["B4"] = self._attr2
        self._sheet["A5"] = "Alpha level:"
        self._sheet["B5"] = float(self._alpha_level)
        self._sheet["A6"] = "Min. abs. freq.:"
        self._sheet["B6"] = self._min_abs_freq

        # -----------------
        # render data table
        # -----------------
        data_first_row = 8

        # fill attr cell
        self._sheet.cell(row=data_first_row, column=1).value = self._attr1 + "\\" + self._attr2
        self._sheet.cell(row=data_first_row, column=1).font = Font(bold=True)

        # fill in row names
        rows = self._labels1
        row_index = data_first_row + 1
        for row_name in rows:
            r = self._sheet.cell(row=row_index, column=1)
            r.value = row_name
            r.fill = green_fill
            r.alignment = Alignment(horizontal='right')
            row_index += 1

        # fill in column names
        columns = self._labels2
        column_index = 2
        for col_name in columns:
            c = self._sheet.cell(row=data_first_row, column=column_index)
            c.value = col_name
            c.fill = green_fill
            c.alignment = Alignment(horizontal='center')
            self._sheet.merge_cells(start_row=data_first_row, start_column=column_index, end_row=data_first_row,
                                    end_column=column_index + 2)
            column_index += 3

        # fill in data
        row_index = data_first_row + 1
        for row_val in self._data:
            column_index = 2
            for col_val in row_val:
                min_col = self._sheet.cell(row=row_index, column=column_index)
                act_col = self._sheet.cell(row=row_index, column=column_index + 1)
                max_col = self._sheet.cell(row=row_index, column=column_index + 2)
                min_col.border = Border(bottom=green_border, right=no_border)
                act_col.border = Border(bottom=green_border, right=no_border)
                max_col.border = Border(right=green_border, bottom=green_border)
                if col_val is not None:
                    min_col.value = col_val[0]
                    act_col.value = col_val[1]
                    max_col.value = col_val[2]
                    min_col.font = gray_font
                    max_col.font = gray_font
                column_index += 3
            row_index += 1

    def raw_content(self):
        output = StringIO()
        self._wb.save(filename=output)
        return output.getvalue()

    def old_save(self):
        file_path = "/tmp/xls_test/export_freq2d.xlsx"
        self._wb.save(file_path)
        return file_path


def create_instance():
    return XLSXExport()
