# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
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
A plug-in allowing export of miscellaneous KonText data sets (conc, freq, coll,...)
to JSONL.
"""

from typing import Any, Dict, List, Tuple
import ujson
import io

from action.argmapping.wordlist import WordlistSaveFormArgs
from action.model.concordance import ConcActionModel
from action.model.pquery import ParadigmaticQueryActionModel
from action.model.wordlist import WordlistActionModel
from babel import Locale
from babel.numbers import format_decimal
from bgcalc.coll_calc import CalculateCollsResult
from bgcalc.pquery.storage import PqueryDataLine
from conclib.errors import ConcordanceQueryParamsError
from kwiclib.common import KwicPageData
from views.colls import SavecollArgs
from views.concordance import SaveConcArgs
from views.freqs import SavefreqArgs
from views.pquery import SavePQueryArgs
from . import AbstractExport


class JSONLExport(AbstractExport):
    """
    """

    def __init__(self, locale: Locale):
        super().__init__(locale)
        self._document = io.StringIO()

    def _formatnumber(self, x):
        return format_decimal(x, locale=self._locale, group_separator=False)

    def content_type(self):
        return 'application/jsonl'

    def raw_content(self):
        return self._document.getvalue()

    def _writerow(self, anything):
        self._document.write(ujson.dumps(anything) + "\n")

    def _enhance_refs(self, item, refs: List[str]):
        item['ref'] = dict((refs[i], v) for i, v in enumerate(item['ref']))

    async def write_conc(self, amodel: ConcActionModel, data: KwicPageData, args: SaveConcArgs):
        refs_args = [x.strip('=') for x in amodel.args.refs.split(',')]
        used_refs = [(x, x) for x in amodel.corp.get_structattrs()]
        used_refs = [x[1] for x in used_refs if x[0] in refs_args]

        if 'Left' in data.Lines[0]:
            left_key, kwic_key, right_key = 'Left', 'Kwic', 'Right'
        elif 'Sen_Left' in data.Lines[0]:
            left_key, kwic_key, right_key = 'Sen_Left', 'Kwic', 'Sen_Right'
        else:
            raise ConcordanceQueryParamsError('Invalid data')

        for row_num, line in enumerate(data.Lines, args.from_line):
            row_obj = {}
            exported_line = self._process_lang(
                line, left_key, kwic_key, right_key, add_linegroup=amodel.lines_groups.is_defined())
            self._enhance_refs(exported_line[0], used_refs)
            row_obj.update(exported_line[0])  # primary lang.
            if 'Align' in line:
                aligned = self._process_lang(
                    line['Align'], left_key, kwic_key, right_key, add_linegroup=False)
                for aitem in aligned:
                    self._enhance_refs(aitem, used_refs)
                row_obj['aligned'] = aligned
            self._writerow(row_obj)

    async def write_coll(self, amodel: ConcActionModel, data: CalculateCollsResult, args: SavecollArgs):
        for item in data.Items:
            del item['pfilter']
            del item['nfilter']
            item['stats'] = item['Stats']
            del item['Stats']
            self._writerow(item)

    async def write_freq(self, amodel: ConcActionModel, data: Dict[str, Any], args: SavefreqArgs):
        for item in data['Blocks'][0]['Items']:
            del item['pfilter']
            del item['nfilter']
            item['word'] = item['Word']
            del item['Word']
            self._writerow(item)

    async def write_pquery(self, amodel: ParadigmaticQueryActionModel, data: List[PqueryDataLine], args: SavePQueryArgs):
        for item in data:
            tmp = item.to_dict()
            tmp['str'] = tmp['value']
            del tmp['value']
            self._writerow(tmp)

    async def write_wordlist(self, amodel: WordlistActionModel, data: List[Tuple[str, int]], args: WordlistSaveFormArgs):
        for item in data:
            self._writerow(dict(Word=[dict(n=item[0])], freq=item[1]))


def create_instance(locale: Locale):
    return JSONLExport(locale)
