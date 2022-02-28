# Copyright (c) 2017 Charles University in Prague, Faculty of Arts,
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

from openpyxl import Workbook
from openpyxl.chart import PieChart, Reference

from plugin_types.chart_export import AbstractChartExport
import io


class ExcelExport(AbstractChartExport):

    def get_content_type(self):
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    def get_suffix(self):
        return 'xlsx'

    def get_format_name(self):
        return 'Excel'

    def export_pie_chart(self, data, title):
        wb = Workbook()
        ws = wb.active
        for row in [('', '')] + data:
            ws.append(row)

        pie = PieChart()
        labels = Reference(ws, min_col=1, min_row=2, max_row=len(data) + 1)
        items = Reference(ws, min_col=2, min_row=1, max_row=len(data) + 1)
        pie.add_data(items, titles_from_data=True)
        pie.set_categories(labels)
        pie.title = title
        ws.add_chart(pie, 'A{0}'.format(len(data) + 3))

        output = io.BytesIO()
        wb.save(filename=output)
        output.flush()
        return output.getvalue()
