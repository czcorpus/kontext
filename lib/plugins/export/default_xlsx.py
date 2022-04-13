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
from typing import Any, Dict, List, Tuple

from action.model.concordance import ConcActionModel
from action.model.pquery import ParadigmaticQueryActionModel
from bgcalc.coll_calc import CalculateCollsResult
from conclib.errors import ConcordanceQueryParamsError
from kwiclib import KwicPageData
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from views.colls import SavecollArgs
from views.concordance import SaveConcArgs
from views.freqs import SavefreqArgs
from views.pquery import SavePQueryArgs

from . import AbstractExport, ExportPluginException, lang_row_to_list


class XLSXExport(AbstractExport):

    def __init__(self, subtype, translate):
        self._written_lines = 0
        self._wb = Workbook(write_only=True)
        self._sheet = self._wb.create_sheet()
        self._col_types = ()
        if subtype == 'concordance':
            self._sheet.title = translate('concordance')
            self._import_row = lang_row_to_list
        elif subtype == 'freq':
            self._sheet.title = translate('frequency distribution')
            self._import_row = lambda x: x
        elif subtype == 'wordlist':
            self._sheet.title = translate('word list')
            self._import_row = lambda x: x
        elif subtype == 'coll':
            self._sheet.title = translate('collocations')
            self._import_row = lambda x: x
        elif subtype == 'pquery':
            self._sheet.title = translate('paradigmatic query')
            self._import_row = lambda x: x

    def content_type(self):
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    def raw_content(self):
        output = BytesIO()
        self._wb.save(filename=output)
        return output.getvalue()

    def _writeheading(self, data):
        if len(data) > 1 and data[0] != '' and all(s == '' for s in data[1:]):
            self._sheet.append([data[0]])
            for _ in range(3):
                self._sheet.append([])
            # this kind of a hack in "write-only" mode
            self._sheet.merged_cells.ranges.append('A1:G4')
        else:
            self._sheet.append(data)
        self._sheet.append([])
        self._written_lines += 2

    def _write_ref_headings(self, data):
        cells = []
        for d in data:
            cell = WriteOnlyCell(self._sheet, d)
            cell.font = cell.font.copy(bold=True)
            cells.append(cell)
        self._sheet.append(cells)
        self._written_lines += 1

    def _set_col_types(self, *types):
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

    def _writerow(self, line_num, *lang_rows):
        row = []
        if line_num is not None:
            row.append(line_num)
        for lang_row in lang_rows:
            row += self._import_row(lang_row)
        self._sheet.append([self._get_cell(*self._import_value(d, i)) for i, d in enumerate(row)])
        self._written_lines += 1

    def _new_sheet(self, name):
        if self._written_lines > 1:
            self._sheet = self._wb.create_sheet()
        self._sheet.title = name

    def _get_cell(self, value, cell_format):
        cell = WriteOnlyCell(self._sheet, value)
        cell.number_format = cell_format
        return cell

    async def write_conc(self, amodel: ConcActionModel, data: KwicPageData, args: SaveConcArgs):
        if args.heading:
            doc_struct = amodel.corp.get_conf('DOCSTRUCTURE')
            refs_args = [x.strip('=') for x in amodel.args.refs.split(',')]
            used_refs = [
                ('#', amodel.plugin_ctx.translate('Token number')),
                (doc_struct, amodel.plugin_ctx.translate('Document number')),
                *[(x, x) for x in amodel.corp.get_structattrs()],
            ]
            used_refs = [x[1] for x in used_refs if x[0] in refs_args]
            self._write_ref_headings(
                [''] + used_refs if args.numbering else used_refs)

        if 'Left' in data.Lines[0]:
            left_key, kwic_key, right_key = 'Left', 'Kwic', 'Right'
        elif 'Sen_Left' in data.Lines[0]:
            left_key, kwic_key, right_key = 'Sen_Left', 'Kwic', 'Sen_Right'
        else:
            raise ConcordanceQueryParamsError(amodel.translate('Invalid data'))

        for row_num, line in enumerate(data.Lines, args.from_line):
            lang_rows = self._process_lang(
                line, left_key, kwic_key, right_key, add_linegroup=amodel.lines_groups.is_defined())
            if 'Align' in line:
                lang_rows += self._process_lang(
                    line['Align'], left_key, kwic_key, right_key, add_linegroup=False)
            self._writerow(row_num if args.numbering else None, *lang_rows)

    async def write_coll(self, amodel: ConcActionModel, data: CalculateCollsResult, args: SavecollArgs):
        self._set_col_types(int, str, *((float,) * 8))
        if args.colheaders or args.heading:
            self._writeheading([''] + [item['n'] for item in data.Head])
        for i, item in enumerate(data.Items, 1):
            self._writerow(
                i, (item['str'], str(item['freq']), *(str(stat['s']) for stat in item['Stats'])))

    async def write_freq(self, amodel: ConcActionModel, data: Dict[str, Any], args: SavefreqArgs):
        # Here we expect that when saving multi-block items, all the block have
        # the same number of columns which is quite bad. But currently there is
        # no better common 'denominator'.
        num_word_cols = len(data['Blocks'][0].get('Items', [{'Word': []}])[0].get('Word'))
        self._set_col_types(*([int] + num_word_cols * [str] + [float, float]))

        for block in data['Blocks']:
            if args.mapped_args.multi_sheet_file:
                self._new_sheet(block['Head'][0]['n'])

            if args.colheaders or args.heading:
                self._writeheading([''] + [item['n'] for item in block['Head'][:-2]] +
                                   ['freq', 'freq [%]'])
            for i, item in enumerate(block['Items'], 1):
                self._writerow(i, [w['n'] for w in item['Word']] + [str(item['freq']),
                                                                    str(item.get('rel', ''))])

    async def write_pquery(self, amodel: ParadigmaticQueryActionModel, data: Tuple[int, List[Tuple[str, int]]], args: SavePQueryArgs):
        self._set_col_types(int, str, float)

        if args.colheaders or args.heading:
            self._writeheading(['', 'value', 'freq'])

        for i, row in enumerate(data, 1):
            self._writerow(i, row)


def create_instance(subtype, translate):
    return XLSXExport(subtype, translate)
