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

from . import AbstractExport, ExportPluginException


class GeneralDocument(object):

    def __init__(self, root_name):
        self._root = etree.Element(root_name)
        self._heading = etree.SubElement(self._root, 'heading')

    @staticmethod
    def add_line_number(elm, num):
        if num is not None:
            line_num_elm = etree.SubElement(elm, 'num')
            line_num_elm.text = str(num)

    def tostring(self):
        return etree.tostring(self._root, pretty_print=True, encoding='UTF-8')

    def _auto_add_heading(self, data):
        if data is None:
            items = []
        elif type(data) in (list, tuple):
            items = [('item', x) for x in data]
        else:
            items = list(data.items())
        for k, v in items:
            elm = etree.Element(k)
            self._heading.append(elm)
            if type(v) is list or type(v) is tuple:
                for item in v:
                    item_elm = etree.Element('item')
                    item_elm.text = item
                    elm.append(item_elm)
            else:
                elm.text = str(v)


class CollDocument(GeneralDocument):

    def __init__(self):
        super(CollDocument, self).__init__('collocations')
        self._items = etree.SubElement(self._root, 'items')

    def add_heading(self, data):
        scores_elm = etree.SubElement(self._heading, 'scores')
        for d in data:
            score_elm = etree.SubElement(scores_elm, 'score')
            score_elm.text = str(d)

    def add_line(self, data, line_num=None):
        item_elm = etree.SubElement(self._items, 'item')
        self.add_line_number(item_elm, line_num)
        str_elm = etree.SubElement(item_elm, 'str')
        str_elm.text = data[0]
        freq_elm = etree.SubElement(item_elm, 'freq')
        freq_elm.text = str(data[1])
        for v in data[2:]:
            score_elm = etree.SubElement(item_elm, 'score')
            score_elm.text = str(v)


class WordlistDocument(GeneralDocument):

    def __init__(self):
        super(WordlistDocument, self).__init__('word_list')
        self._items = etree.SubElement(self._root, 'items')

    def add_line(self, data, line_num=None):
        item_elm = etree.SubElement(self._items, 'item')
        if line_num is not None:
            line_num_elm = etree.SubElement(item_elm, 'num')
            line_num_elm.text = str(line_num)
        str_elm = etree.SubElement(item_elm, 'str')
        str_elm.text = data[0]
        freq_elm = etree.SubElement(item_elm, 'freq')
        freq_elm.text = str(data[1])

    def add_heading(self, data):
        self._auto_add_heading(data)


class FreqDocument(GeneralDocument):

    def __init__(self):
        super(FreqDocument, self).__init__('frequency')
        self._curr_items = None

    def add_block(self, name):
        curr_block = etree.SubElement(self._root, 'block')
        name_elm = etree.SubElement(curr_block, 'name')
        name_elm.text = name
        self._curr_items = etree.SubElement(curr_block, 'items')

    def add_line(self, data, line_num=None):
        if self._curr_items is None:
            self.add_block('')
        item_elm = etree.SubElement(self._curr_items, 'item')

        if line_num is not None:
            line_num_elm = etree.SubElement(item_elm, 'num')
            line_num_elm.text = str(line_num)

        for i in range(len(data) - 2):
            str_elm = etree.SubElement(item_elm, 'str')
            str_elm.text = data[0]
        freq_elm = etree.SubElement(item_elm, 'freq')
        freq_elm.text = data[-2]
        if len(data) > 2:
            freq_pc_elm = etree.SubElement(item_elm, 'freq_pc')
            freq_pc_elm.text = data[-1]

    def add_heading(self, data):
        self._auto_add_heading(data)


class ConcDocument(GeneralDocument):

    def __init__(self):
        super(ConcDocument, self).__init__('concordance')
        self._lines = etree.Element('lines')
        self._root.append(self._lines)

    def _append_lang(self, elm, data):
        """
        Converts a dict to <key>value</key> items and appends
        them to the 'elm' argument
        """
        if 'linegroup' in data:
            lng_elm = etree.SubElement(elm, 'line_group')
            lng_elm.text = data['linegroup']
        ref_elm = etree.SubElement(elm, 'ref')
        for item in data.get('ref', []):
            item_elm = etree.SubElement(ref_elm, 'item')
            item_elm.text = item
        left_context_elm = etree.SubElement(elm, 'left_context')
        left_context_elm.text = data.get('left_context', '')
        kwic_elm = etree.SubElement(elm, 'kwic')
        kwic_elm.text = data.get('kwic', '')
        right_context_elm = etree.SubElement(elm, 'right_context')
        right_context_elm.text = data.get('right_context', '')

    def add_block(self):
        pass

    def add_heading(self, data):
        self._auto_add_heading(data)

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


class PqueryDocument(GeneralDocument):

    def __init__(self):
        super(PqueryDocument, self).__init__('pquery_results')
        self._items = etree.SubElement(self._root, 'items')

    def add_line(self, data, line_num=None):
        item_elm = etree.SubElement(self._items, 'item')
        if line_num is not None:
            line_num_elm = etree.SubElement(item_elm, 'num')
            line_num_elm.text = str(line_num)
        str_elm = etree.SubElement(item_elm, 'str')
        str_elm.text = data[0]
        freq_elm = etree.SubElement(item_elm, 'freq')
        freq_elm.text = str(data[1])

    def add_heading(self, data):
        self._auto_add_heading(data)


class XMLExport(AbstractExport):
    """
    The plug-in itself
    """
    SUBTYPE_MAP = {
        'concordance': ConcDocument,
        'freq': FreqDocument,
        'wordlist': WordlistDocument,
        'coll': CollDocument,
        'pquery': PqueryDocument
    }

    def __init__(self, subtype):
        subtype_class = self.SUBTYPE_MAP.get(subtype, None)
        if subtype_class is None:
            raise ExportPluginException('Unknown export subtype %s' % subtype)
        self._document = subtype_class()
        self._corpnames = []

    def set_corpnames(self, corpnames):
        self._corpnames = corpnames

    def content_type(self):
        return 'application/xml'

    def raw_content(self):
        return self._document.tostring()

    def add_block(self, name):
        self._document.add_block(name)

    def writeheading(self, data):
        self._document.add_heading(data)

    def write_ref_headings(self, data):
        self._document.add_heading(dict(refs=data))

    def writerow(self, line_num, *lang_rows):
        if len(lang_rows) == 0:
            raise ValueError('empty line')
        elif len(lang_rows) == 1:  # single language has a slightly different XML structure
            self._document.add_line(lang_rows[0], line_num)
        else:
            self._document.add_multilang_line(lang_rows, self._corpnames, line_num)


def create_instance(subtype):
    return XMLExport(subtype)
