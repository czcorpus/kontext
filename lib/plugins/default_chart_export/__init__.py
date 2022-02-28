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

from collections import OrderedDict

from plugin_types.chart_export import AbstractChartExportPlugin, UnknownFormatException
from plugins.default_chart_export.excel import ExcelExport


class DefaultChartExportPlugin(AbstractChartExportPlugin):
    """
    For the documentation, please see the docs for AbstractChartExportPlugin
    and also a respective stub file.
    """

    def __init__(self):
        self._exports = OrderedDict()
        e1 = ExcelExport()
        self._exports[e1.get_format_name()] = e1

    def _test_format(self, f):
        if f not in list(self._exports.keys()):
            raise UnknownFormatException(f)

    def get_supported_types(self):
        return list(self._exports.keys())

    def get_content_type(self, format):
        self._test_format(format)
        return self._exports[format].get_content_type()

    def get_suffix(self, format):
        self._test_format(format)
        return self._exports[format].get_suffix()

    def export_pie_chart(self, data, title, format):
        self._test_format(format)
        return self._exports[format].export_pie_chart(data, title)


def create_instance(conf):
    return DefaultChartExportPlugin()
