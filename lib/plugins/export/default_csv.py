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
from typing import Any, Dict, List, Tuple

from action.argmapping.wordlist import WordlistSaveFormArgs
from action.model.concordance import ConcActionModel
from action.model.pquery import ParadigmaticQueryActionModel
from action.model.wordlist import WordlistActionModel
from bgcalc.coll_calc import CalculateCollsResult
from conclib.errors import ConcordanceQueryParamsError
from kwiclib import KwicPageData
from views.colls import SavecollArgs
from views.concordance import SaveConcArgs
from views.freqs import SavefreqArgs
from views.pquery import SavePQueryArgs

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

    def __init__(self, subtype, translate):
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

    def _write_ref_headings(self, data):
        self.csv_writer.writerow(data)

    def _writeheading(self, data):
        self.csv_writer.writerow(data)

    def _writerow(self, line_num, *lang_rows):
        row = []
        if line_num is not None:
            row.append(line_num)
        for lang_row in lang_rows:
            row += self._import_row(lang_row)
        self.csv_writer.writerow(row)

    async def write_conc(self, amodel: ConcActionModel, data: KwicPageData, args: SaveConcArgs):
        if args.heading:
            self._writeheading([
                'corpus: {}\nsubcorpus: {}\nconcordance size: {}\nARF: {},\nquery: {}'.format(
                    amodel.corp.human_readable_corpname,
                    amodel.args.usesubcorp,
                    data.concsize,
                    data.result_arf,
                    ',\n'.join(
                        f"{x['op']}: {x['arg']} ({x['size']})"
                        for x in (await amodel.concdesc_json())
                    ),
                ), '', '', ''])
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
        if args.colheaders or args.heading:
            self._writeheading([''] + [item['n'] for item in data.Head])
        for i, item in enumerate(data.Items, 1):
            self._writerow(
                i, (item['str'], str(item['freq']), *(str(stat['s']) for stat in item['Stats'])))

    async def write_freq(self, amodel: ConcActionModel, data: Dict[str, Any], args: SavefreqArgs):
        for block in data['Blocks']:
            if args.colheaders or args.heading:
                self._writeheading([''] + [item['n'] for item in block['Head'][:-2]] +
                                   ['freq', 'freq [%]'])
            for i, item in enumerate(block['Items'], 1):
                self._writerow(i, [w['n'] for w in item['Word']] + [str(item['freq']),
                                                                    str(item.get('rel', ''))])

    async def write_pquery(self, amodel: ParadigmaticQueryActionModel, data: Tuple[int, List[Tuple[str, int]]], args: SavePQueryArgs):
        if args.colheaders or args.heading:
            self._writeheading(['', 'value', 'freq'])

        for i, row in enumerate(data, 1):
            self._writerow(i, row)

    async def write_wordlist(self, amodel: WordlistActionModel, data: List[Tuple[str, int]], args: WordlistSaveFormArgs):
        if args.colheaders:
            self._writeheading(['', amodel.curr_wlform_args.wlattr, 'freq'])

        elif args.heading:
            self._writeheading([
                'corpus: {}\nsubcorpus: {},\npattern: {}'.format(
                    amodel.corp.human_readable_corpname, amodel.args.usesubcorp, amodel.curr_wlform_args.wlpat),
                '', ''
            ])

        for i, item in enumerate(data, 1):
            self._writerow(i, [item[0], str(item[1])])


def create_instance(subtype, translate):
    return CSVExport(subtype, translate)
