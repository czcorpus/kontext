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
like data can be used) to XML format.
"""
from lxml import etree
import logging

from . import AbstractExport


class Document(object):

    def __init__(self):
        self._root = etree.Element('concordance')
        self._lines = etree.Element('lines')
        self._root.append(self._lines)

    def _append_lang(self, elm, data):
        """
        Converts a dict to <key>value</key> items and appends
        them to the 'elm' argument
        """
        ref_elm = etree.SubElement(elm, 'ref')
        ref_elm.text = data.get('ref', '')
        left_context_elm = etree.SubElement(elm, 'left_context')
        left_context_elm.text = data.get('left_context', '')
        kwic_elm = etree.SubElement(elm, 'kwic')
        kwic_elm.text = data.get('kwic', '')
        right_context_elm = etree.SubElement(elm, 'right_context')
        right_context_elm.text = data.get('right_context', '')

    def add_line(self, data, line_num=None):
        """
        Adds a single language row to the document

        arguments:
        data -- a dictionary of key->value pairs to be converted into XML elements <key>value</key>
        line_num -- optional line number (if None, element is omitted)
        """
        line_elm = etree.SubElement(self._lines, 'line')
        if line_num is not None:
            line_num_elm = etree.SubElement(line_elm, 'num')
            line_num_elm.text = str(line_num)
        self._append_lang(line_elm, data)

    def add_multilang_line(self, lang_rows, corpnames, line_num=None):
        """
        Adds multiple languages row to the document

        arguments:
        lang_rows -- a list of dictionaries of key->value pairs to be converted into XML elements <key>value</key>
        corpnames -- a list of corpora names; the order must match the 'lang_rows' argument (i.e. 1st corpus name
                     should describe 1st record in 'lang_rows')
        line_num -- optional line number (if None, element is omitted)
        """
        line_elm = etree.SubElement(self._lines, 'parallel_lines')
        if line_num is not None:
            line_num_elm = etree.SubElement(line_elm, 'num')
            line_num_elm.text = str(line_num)
        for i in range(len(lang_rows)):
            lang_row = lang_rows[i]
            parline_elm = etree.SubElement(line_elm, 'parline')
            if i < len(corpnames):
                parline_elm.attrib['corpus'] = corpnames[i]
            else:
                logging.getLogger(__name__).warning('Unable to fetch corpname for XML export')
            self._append_lang(parline_elm, lang_row)

    def tostring(self):
        return etree.tostring(self._root, pretty_print=True, encoding='UTF-8')


class XMLExport(AbstractExport):
    """
    The plug-in itself
    """
    def __init__(self):
        self._document = Document()
        self._corpnames = []

    def set_corpnames(self, corpnames):
        self._corpnames = corpnames

    def content_type(self):
        return 'application/xml'

    def raw_content(self):
        return self._document.tostring()

    def writerow(self, line_num, *lang_rows):
        if len(lang_rows) == 0:
            raise ValueError('empty line')
        elif len(lang_rows) == 1:  # single language has a slightly different XML structure
            self._document.add_line(lang_rows[0], line_num)
        else:
            self._document.add_multilang_line(lang_rows, self._corpnames, line_num)


def create_instance():
    return XMLExport()