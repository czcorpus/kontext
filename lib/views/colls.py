# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

from dataclasses import asdict, dataclass

import plugins
from action.argmapping.analytics import (CollFormArgs, CTFreqFormArgs,
                                         FreqFormArgs)
from action.control import http_action
from action.argmapping.action import IntOpt
from action.krequest import KRequest
from action.model.concordance import ConcActionModel
from action.response import KResponse
from bgcalc.coll_calc import (CalculateCollsResult, CollCalcArgs,
                              calculate_colls)
from conclib.calc import require_existing_conc
from conclib.errors import ConcNotFoundException
from main_menu import MainMenu
from sanic import Blueprint

bp = Blueprint('colls')


@bp.route('/collx')
@http_action(action_model=ConcActionModel, access_level=2, template='collx.html', page_model='coll')
async def collx(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    list collocations
    """
    amodel.disabled_menu_items = (
        MainMenu.CONCORDANCE('query-save-as'), MainMenu.VIEW('kwic-sent-switch'),
        MainMenu.CONCORDANCE('query-overview'))
    amodel.add_save_menu_item(
        'CSV', save_format='csv',
        hint=req.translate(
            'Saves at most {0} items. Use "Custom" for more options.'.format(amodel.CONC_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(
        'XLSX', save_format='xlsx',
        hint=req.translate(
            'Saves at most {0} items. Use "Custom" for more options.'.format(amodel.CONC_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(
        'XML', save_format='xml',
        hint=req.translate(
            'Saves at most {0} items. Use "Custom" for more options.'.format(amodel.CONC_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(
        'TXT', save_format='txt',
        hint=req.translate(
            'Saves at most {0} items. Use "Custom" for more options.'.format(amodel.CONC_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(req.translate('Custom'))
    await amodel.save_options(amodel.LOCAL_COLL_OPTIONS, amodel.args.corpname)

    try:
        await require_existing_conc(amodel.corp, amodel.args.q, amodel.args.cutoff)
        ans = asdict(await _collx(
            amodel, req.session_get('user', 'id'), amodel.args.collpage, amodel.args.citemsperpage))
        ans['coll_form_args'] = CollFormArgs().update(amodel.args).to_dict()
        ans['freq_form_args'] = FreqFormArgs().update(amodel.args).to_dict()
        ans['ctfreq_form_args'] = CTFreqFormArgs().update(amodel.args).to_dict()
        ans['save_line_limit'] = amodel.COLLS_QUICK_SAVE_MAX_LINES
        ans['text_types_data'] = await amodel.tt.export_with_norms(ret_nums=True)
        ans['quick_save_row_limit'] = amodel.COLLS_QUICK_SAVE_MAX_LINES
        await amodel.export_query_forms(ans)
        return ans
    except ConcNotFoundException:
        amodel.go_to_restore_conc('collx')


async def _collx(amodel: ConcActionModel, user_id: int, collpage: int, citemsperpage: int) -> CalculateCollsResult:

    if amodel.args.csortfn == '':
        amodel.args.csortfn = 't'

    return await calculate_colls(CollCalcArgs(
        corpus_encoding=amodel.corp.get_conf('ENCODING'),
        corpname=amodel.args.corpname,
        subcorpus_id=amodel.corp.subcorpus_id,
        subcorpora_dir=amodel.subcpath,
        user_id=user_id,
        q=amodel.args.q,
        cutoff=0,  # TODO (check also freqs)
        cattr=amodel.args.cattr,
        csortfn=amodel.args.csortfn,
        cbgrfns=''.join(amodel.args.cbgrfns),
        cfromw=amodel.args.cfromw,
        ctow=amodel.args.ctow,
        cminbgr=amodel.args.cminbgr,
        cminfreq=amodel.args.cminfreq,
        citemsperpage=citemsperpage,
        collpage=collpage))


@dataclass
class SavecollArgs:
    from_line: int = 1
    to_line: IntOpt = -1
    saveformat: str = 'txt'
    heading: int = 0
    colheaders: int = 0


@bp.route('/savecoll')
@http_action(
    action_model=ConcActionModel, mapped_args=SavecollArgs, access_level=2, return_type='plain')
async def savecoll(amodel: ConcActionModel, req: KRequest[SavecollArgs], resp: KResponse):
    """
    save collocations
    """
    try:
        await require_existing_conc(amodel.corp, tuple(amodel.args.q), amodel.args.cutoff)
        from_line = req.mapped_args.from_line
        # 'corp.size' below is just a safe max value for to_line
        to_line = amodel.corp.size if req.mapped_args.to_line < 0 else req.mapped_args.to_line
        result = await _collx(amodel, collpage=1, citemsperpage=to_line, user_id=req.session_get('user', 'id'))
        result.Items = result.Items[from_line - 1:]

        def mk_filename(suffix): return f'{amodel.args.corpname}-collocations.{suffix}'
        with plugins.runtime.EXPORT as export:
            writer = export.load_plugin(req.mapped_args.saveformat, req.locale)

            resp.set_header('Content-Type', writer.content_type())
            resp.set_header(
                'Content-Disposition',
                f'attachment; filename="{mk_filename(req.mapped_args.saveformat)}"')

            await writer.write_coll(amodel, result, req.mapped_args)
            out_data = writer.raw_content()

        return out_data

    except ConcNotFoundException:
        amodel.go_to_restore_conc('collx')
