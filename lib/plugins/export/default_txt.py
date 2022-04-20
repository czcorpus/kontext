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
from action.model.pquery import ParadigmaticQueryActionModel
from action.model.wordlist import WordlistActionModel
from bgcalc.coll_calc import CalculateCollsResult
from jinja2 import Environment, FileSystemLoader
from kwiclib import KwicPageData
from views.colls import SavecollArgs
from views.concordance import SaveConcArgs, _get_ipm_base_set_desc
from views.freqs import SavefreqArgs
from views.pquery import SavePQueryArgs

from . import AbstractExport


class TXTExport(AbstractExport):
    """
    A plug-in itself
    """

    def __init__(self):
        self._template_dir: str = os.path.realpath(
            os.path.join(os.path.dirname(__file__), 'templates'))
        self._template_env = Environment(
            loader=FileSystemLoader(self._template_dir), enable_async=True)
        self._data: str = ''

    def content_type(self):
        return 'text/plain'

    def raw_content(self):
        return self._data

    async def write_conc(self, amodel: ConcActionModel, data: KwicPageData, args: SaveConcArgs):
        output = {
            'from_line': int(args.from_line),
            'to_line': min(args.to_line, data.concsize),
            'heading': args.heading,
            'numbering': args.numbering,
            'align_kwic': args.align_kwic,
            'human_corpname': amodel.corp.corpname,
            'usesubcorp': amodel.corp.subcname,
            **asdict(data),
        }
        for line in data.Lines:
            line['ref'] = ', '.join(line['ref'])
        # we must set contains_within = False as it is impossible (in the current user interface)
        # to offer a custom i.p.m. calculation before the download starts
        output['result_relative_freq_rel_to'] = _get_ipm_base_set_desc(
            amodel.corp, contains_within=False, translate=amodel.plugin_ctx.translate)
        output['Desc'] = await amodel.concdesc_json()
        amodel.update_output_with_group_info(output)

        template = self._template_env.get_template('txt_conc.jinja2')
        self._data = await template.render_async(output)

    async def write_coll(self, amodel: ConcActionModel, data: CalculateCollsResult, args: SavecollArgs):
        output = asdict(data)
        output['Desc'] = await amodel.concdesc_json()
        output['saveformat'] = args.saveformat
        output['from_line'] = args.from_line
        output['to_line'] = amodel.corp.size if args.to_line is None else args.to_line
        output['heading'] = args.heading
        output['colheaders'] = args.colheaders
        output['human_corpname'] = amodel.corp.corpname
        output['usesubcorp'] = amodel.corp.subcname

        template = self._template_env.get_template('txt_coll.jinja2')
        self._data = await template.render_async(output)

    async def write_freq(self, amodel: ConcActionModel, data: Dict[str, Any], args: SavefreqArgs):
        data['Desc'] = await amodel.concdesc_json()
        data['fcrit'] = args.fcrit
        data['flimit'] = args.flimit
        data['freq_sort'] = args.freq_sort
        data['saveformat'] = args.saveformat
        data['from_line'] = args.from_line
        data['to_line'] = args.to_line
        data['colheaders'] = args.colheaders
        data['heading'] = args.heading

        template = self._template_env.get_template('txt_freq.jinja2')
        self._data = await template.render_async(data)

    async def write_pquery(self, amodel: ParadigmaticQueryActionModel, data: Tuple[int, List[Tuple[str, int]]], args: SavePQueryArgs):
        # TODO perhaps
        raise NotImplementedError

    async def write_wordlist(self, amodel: WordlistActionModel, data: List[Tuple[str, int]], args: WordlistSaveFormArgs):
        output = dict(Items=data,
                      pattern=amodel.curr_wlform_args.wlpat,
                      from_line=args.from_line,
                      to_line=args.to_line,
                      usesubcorp=args.usesubcorp,
                      saveformat=args.saveformat,
                      colheaders=args.colheaders,
                      heading=args.heading)

        template = self._template_env.get_template('txt_wlist.jinja2')
        self._data = await template.render_async(output)


def create_instance():
    return TXTExport()
