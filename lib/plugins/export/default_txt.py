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
like data can be used) to TXT format.
"""

import os
from dataclasses import asdict
from typing import Any, Dict, List, Tuple

from action.argmapping.wordlist import WordlistSaveFormArgs
from action.model.concordance import ConcActionModel
from action.model.keywords import KeywordsActionModel
from action.model.pquery import ParadigmaticQueryActionModel
from action.model.wordlist import WordlistActionModel
from babel import Locale
from babel.numbers import format_decimal
from bgcalc.coll_calc import CalculateCollsResult
from bgcalc.keywords import KeywordsResult
from bgcalc.pquery.storage import PqueryDataLine
from jinja2 import Environment, FileSystemLoader
from kwiclib.common import KwicPageData
from views.colls import SavecollArgs
from views.concordance import SaveConcArgs, _get_ipm_base_set_desc
from views.freqs import SavefreqArgs
from views.keywords import SaveKeywordsArgs
from views.pquery import SavePQueryArgs

from . import AbstractExport


class TXTExport(AbstractExport):
    """
    A plug-in itself
    """

    def __init__(self, locale: Locale):
        super().__init__(locale)
        self._template_dir: str = os.path.realpath(
            os.path.join(os.path.dirname(__file__), 'templates'))
        self._template_env = Environment(
            loader=FileSystemLoader(self._template_dir), enable_async=True)
        self._template_env.filters['formatnumber'] = lambda x: format_decimal(
            x, locale=self._locale, group_separator=False)
        self._data: str = ''

    def content_type(self):
        return 'text/plain'

    def raw_content(self):
        return self._data

    async def write_conc(self, amodel: ConcActionModel, data: KwicPageData, args: SaveConcArgs):
        output = asdict(data)
        output['from_line'] = int(args.from_line)
        output['to_line'] = min(args.to_line, data.concsize)
        output['heading'] = args.heading
        output['numbering'] = args.numbering
        output['numbering_offset'] = args.numbering_offset
        output['align_kwic'] = args.align_kwic
        output['human_corpname'] = amodel.corp.human_readable_corpname
        output['usesubcorp'] = amodel.args.usesubcorp
        if args.align_kwic:
            kwic_lengths = [len(' '.join(k['str'] for k in line['Kwic'])) for line in data.Lines]
            max_kwic_length = max(kwic_lengths)
            output['kwic_spaces'] = [' ' * (max_kwic_length - l) for l in kwic_lengths]

        for line in data.Lines:
            line['ref'] = ', '.join(line['ref'])
        # we must set contains_within = False as it is impossible (in the current user interface)
        # to offer a custom i.p.m. calculation before the download starts
        output['result_relative_freq_rel_to'] = _get_ipm_base_set_desc(
            amodel.corp, contains_within=False, translate=amodel.plugin_ctx.translate)
        output['Desc'] = await amodel.concdesc_json()
        amodel.update_output_with_group_info(output)

        template = self._template_env.get_template('txt_conc.jinja2')
        self._data += await template.render_async(output)

    async def write_coll(self, amodel: ConcActionModel, data: CalculateCollsResult, args: SavecollArgs):
        output = asdict(data)
        output['Desc'] = await amodel.concdesc_json()
        output['saveformat'] = args.saveformat
        output['from_line'] = args.from_line
        output['to_line'] = amodel.corp.size if args.to_line is None else args.to_line
        output['heading'] = args.heading
        output['colheaders'] = args.colheaders
        output['human_corpname'] = amodel.corp.human_readable_corpname
        output['usesubcorp'] = amodel.args.usesubcorp

        template = self._template_env.get_template('txt_coll.jinja2')
        self._data = await template.render_async(output)

    async def write_freq(self, amodel: ConcActionModel, data: Dict[str, Any], args: SavefreqArgs):
        output = {**data}
        output['Desc'] = await amodel.concdesc_json()
        output['fcrit'] = args.fcrit
        output['flimit'] = args.flimit
        output['freq_sort'] = args.freq_sort
        output['saveformat'] = args.saveformat
        output['from_line'] = args.from_line
        output['to_line'] = args.to_line
        output['colheaders'] = args.colheaders
        output['heading'] = args.heading
        output['human_corpname'] = amodel.corp.human_readable_corpname
        output['usesubcorp'] = amodel.args.usesubcorp

        template = self._template_env.get_template('txt_freq.jinja2')
        self._data = await template.render_async(output)

    async def write_pquery(self, amodel: ParadigmaticQueryActionModel, data: List[PqueryDataLine], args: SavePQueryArgs):
        # TODO perhaps
        raise NotImplementedError

    async def write_keywords(self, amodel: KeywordsActionModel, data: KeywordsResult, args: SaveKeywordsArgs):
        # TODO perhaps
        raise NotImplementedError

    async def write_wordlist(self, amodel: WordlistActionModel, data: List[Tuple[str, int]], args: WordlistSaveFormArgs):
        output = asdict(args)
        output['Items'] = data
        output['wlattr'] = amodel.curr_wlform_args.wlattr
        output['pattern'] = amodel.curr_wlform_args.wlpat
        output['human_corpname'] = amodel.corp.human_readable_corpname
        output['usesubcorp'] = amodel.args.usesubcorp

        template = self._template_env.get_template('txt_wlist.jinja2')
        self._data = await template.render_async(output)


def create_instance(locale: Locale):
    return TXTExport(locale)
