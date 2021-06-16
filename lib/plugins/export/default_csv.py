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
like data can be used) to CSV format.
"""

import csv

from . import AbstractExport, lang_row_to_list


class Writeable(object):
    """
    An auxiliary class serving as a buffer
    """

    def __init__(self):
        self.rows = []

    def write(self, s):
        self.rows.append(s)


class CSVExport(AbstractExport):
    """
    A plug-in itself
    """

    def __init__(self, subtype):
        self.csv_buff = Writeable()
        self.csv_writer = csv.writer(self.csv_buff, delimiter=';',
                                     quotechar='"', quoting=csv.QUOTE_ALL)
        if subtype == 'concordance':
            self._import_row = lang_row_to_list
        else:
            self._import_row = lambda x: x

    def content_type(self):
        return 'text/csv'

    def raw_content(self):
        return ''.join(self.csv_buff.rows)

    def write_ref_headings(self, data):
        self.csv_writer.writerow(data)

    def writeheading(self, data):
        self.csv_writer.writerow(data)

    def writerow(self, line_num, *lang_rows):
        row = []
        if line_num is not None:
            row.append(line_num)
        for lang_row in lang_rows:
            row += self._import_row(lang_row)
        self.csv_writer.writerow(row)


def create_instance(subtype):
    return CSVExport(subtype)
