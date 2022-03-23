from typing import Dict, Any, Optional, List, Tuple
from sanic import Sanic, response, Blueprint
from sanic.views import HTTPMethodView
from sanic.response import text
from sanic.request import Request
from action.argmapping.analytics import CollFormArgs, FreqFormArgs, CTFreqFormArgs
from action.decorators import http_action
from action.errors import FunctionNotSupported, ImmediateRedirectException, CorpusForbiddenException, UserActionException
from action.model.concordance import ConcActionModel
from action.model.authorized import UserActionModel
from action.krequest import KRequest
from collections import defaultdict
from dataclasses import dataclass, field, asdict
import re
import sys
import logging

from conclib.errors import ConcNotFoundException, ConcordanceQueryParamsError
from conclib.freq import multi_level_crit, MLFreqArgs
from conclib.calc import require_existing_conc
from conclib.search import get_conc
from main_menu import MainMenu
from bgcalc import freq_calc
from bgcalc.coll_calc import CalculateCollsResult, CollCalcArgs, calculate_colls
from strings import escape_attr_val
import plugins

bp = Blueprint('colls')


@bp.route('/collx')
@http_action(action_model=ConcActionModel, access_level=1, page_model='coll')
async def collx(amodel, req: KRequest, resp):
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
        'TXT', save_format='text',
        hint=req.translate(
            'Saves at most {0} items. Use "Custom" for more options.'.format(amodel.CONC_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(req.translate('Custom'))
    amodel.save_options(amodel.LOCAL_COLL_OPTIONS, amodel.args.corpname)

    try:
        require_existing_conc(amodel.corp, amodel.args.q)
        ans = asdict(await _collx(
            amodel, req.session_get('user', 'id'), amodel.args.collpage, amodel.args.citemsperpage))
        ans['coll_form_args'] = CollFormArgs().update(amodel.args).to_dict()
        ans['freq_form_args'] = FreqFormArgs().update(amodel.args).to_dict()
        ans['ctfreq_form_args'] = CTFreqFormArgs().update(amodel.args).to_dict()
        ans['save_line_limit'] = amodel.COLLS_QUICK_SAVE_MAX_LINES
        ans['text_types_data'] = await amodel.tt.export_with_norms(ret_nums=True)
        ans['quick_save_row_limit'] = amodel.COLLS_QUICK_SAVE_MAX_LINES
        amodel.attach_query_overview(ans)
        return ans
    except ConcNotFoundException:
        amodel.go_to_restore_conc('collx')


async def _collx(amodel: ConcActionModel, user_id: int, collpage: int, citemsperpage: int) -> CalculateCollsResult:

    if amodel.args.csortfn == '':
        amodel.args.csortfn = 't'

    calc_args = CollCalcArgs(
        corpus_encoding=amodel.corp.get_conf('ENCODING'),
        corpname=amodel.args.corpname,
        subcname=getattr(amodel.corp, 'subcname', None),
        subcpath=amodel.subcpath,
        user_id=user_id,
        q=amodel.args.q,
        samplesize=0,  # TODO (check also freqs)
        cattr=amodel.args.cattr,
        csortfn=amodel.args.csortfn,
        cbgrfns=''.join(amodel.args.cbgrfns),
        cfromw=amodel.args.cfromw,
        ctow=amodel.args.ctow,
        cminbgr=amodel.args.cminbgr,
        cminfreq=amodel.args.cminfreq,
        citemsperpage=citemsperpage,
        collpage=collpage)
    return await calculate_colls(calc_args)


@dataclass
class SavecollArgs:
    from_line: Optional[int] = 1
    to_line: Optional[int] = None
    saveformat: Optional[str] = 'text'
    heading: Optional[int] = 0
    colheaders: Optional[int] = 0


@bp.route('/savecoll')
@http_action(
    action_model=ConcActionModel, mapped_args=SavecollArgs, access_level=1, template='txtexport/savecoll.html',
    return_type='plain')
async def savecoll(amodel, req: KRequest[SavecollArgs], resp):
    """
    save collocations
    """
    try:
        require_existing_conc(amodel.corp, tuple(amodel.args.q))
        from_line = req.mapped_args.from_line
        # 'corp.size' below is just a safe max value for to_line
        to_line = amodel.corp.size if req.mapped_args.to_line is None else req.mapped_args.to_line
        result = await _collx(amodel, collpage=1, citemsperpage=to_line, user_id=req.session_get('user', 'id'))
        result.Items = result.Items[from_line - 1:]
        saved_filename = amodel.args.corpname
        if req.mapped_args.saveformat == 'text':
            resp.set_header('Content-Type', 'application/text')
            resp.set_header(
                'Content-Disposition',
                f'attachment; filename="{saved_filename}-collocations.txt"')
            out_data = asdict(result)
            out_data['Desc'] = amodel.concdesc_json()['Desc']
            out_data['saveformat'] = req.mapped_args.saveformat
            out_data['from_line'] = from_line
            out_data['to_line'] = to_line
            out_data['heading'] = req.mapped_args.heading
            out_data['colheaders'] = req.mapped_args.colheaders
        elif req.mapped_args.saveformat in ('csv', 'xml', 'xlsx'):
            def mk_filename(suffix):
                return f'{amodel.args.corpname}-collocations.{suffix}'

            from translation import ugettext
            writer = plugins.runtime.EXPORT.instance.load_plugin(
                req.mapped_args.saveformat, subtype='coll', translate=ugettext)
            writer.set_col_types(int, str, *(8 * (float,)))

            resp.set_header('Content-Type', writer.content_type())
            resp.set_header(
                'Content-Disposition',
                f'attachment; filename="{mk_filename(req.mapped_args.saveformat)}"')
            if req.mapped_args.colheaders or req.mapped_args.heading:
                writer.writeheading([''] + [item['n'] for item in result.Head])
            i = 1
            for item in result.Items:
                writer.writerow(
                    i, (item['str'], str(item['freq'])) + tuple([str(stat['s']) for stat in item['Stats']]))
                i += 1
            out_data = writer.raw_content()
        else:
            raise UserActionException(f'Unknown format: {req.mapped_args.saveformat}')
        return out_data
    except ConcNotFoundException:
        amodel.go_to_restore_conc('collx')
