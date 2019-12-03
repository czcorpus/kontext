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
import codecs
import io

from . import AbstractExport, lang_row_to_list


class Writeable(object):
    """
    An auxiliary class serving as a buffer
    """

    def __init__(self):
        self.rows = []

    def write(self, s):
        self.rows.append(s)


class UnicodeCSVWriter:
    """
    An auxiliary class for creating UTF-8 encoded CSV file.

    Code taken from http://docs.python.org/2/library/csv.html
    """

    def __init__(self, f, dialect=csv.excel, encoding="utf-8", **kwds):
        self.queue = io.StringIO()
        self.writer = csv.writer(self.queue, dialect=dialect, **kwds)
        self.stream = f
        self.encoder = codecs.getincrementalencoder(encoding)()

    def writerow(self, row):
        normalized_row = []
        for item in row:
            if type(item) not in (str, str):
                item = str(item)
            item = item.encode("utf-8")
            normalized_row.append(item)
        self.writer.writerow(normalized_row)
        data = self.queue.getvalue()
        data = data.decode("utf-8")
        # ... and reencode it into the target encoding
        data = self.encoder.encode(data)
        # write to the target stream
        self.stream.write(data)
        # empty queue
        self.queue.truncate(0)

    def writerows(self, rows):
        for row in rows:
            self.writerow(row)


class CSVExport(AbstractExport):
    """
    A plug-in itself
    """

    def __init__(self, subtype):
        self.csv_buff = Writeable()
        self.csv_writer = UnicodeCSVWriter(
            self.csv_buff, delimiter=';', quotechar='"', quoting=csv.QUOTE_ALL)
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

    def writerow(self, line_num, *lang_rows):
        row = []
        if line_num is not None:
            row.append(line_num)
        for lang_row in lang_rows:
            row += self._import_row(lang_row)
        self.csv_writer.writerow(row)


def create_instance(subtype):
    return CSVExport(subtype)
