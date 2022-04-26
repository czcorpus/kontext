# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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


import logging
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from typing import List, Tuple

import plugins
from action.argmapping.analytics import (CollFormArgs, CTFreqFormArgs,
                                         FreqFormArgs)
from action.decorators import IntOpt, ListStrOpt, StrOpt, http_action
from action.errors import UserActionException
from action.krequest import KRequest
from action.model.concordance import ConcActionModel
from action.model.user import UserActionModel
from action.response import KResponse
from bgcalc import freq_calc
from conclib.calc import require_existing_conc
from conclib.errors import ConcNotFoundException, ConcordanceQueryParamsError
from conclib.freq import MLFreqArgs, multi_level_crit
from conclib.search import get_conc
from main_menu import MainMenu
from sanic import Blueprint
from strings import escape_attr_val

bp = Blueprint('freqs')


@dataclass
class MLFreqRequestArgs(MLFreqArgs):
    flimit: IntOpt = 0
    freqlevel: IntOpt = 1
    freq_sort: StrOpt = ''


@dataclass
class GeneralFreqArgs:
    fcrit: List[str]
    fcrit_async: ListStrOpt = field(default_factory=list)
    flimit: IntOpt = 0
    freq_sort: StrOpt = ''
    force_cache: IntOpt = 0
    freq_type: StrOpt = ''
    format: StrOpt = ''


@bp.route('/freqs')
@http_action(
    access_level=0, action_model=ConcActionModel, page_model='freq', template='freqs.html', mapped_args=GeneralFreqArgs)
async def freqs(amodel: ConcActionModel, req: KRequest[GeneralFreqArgs], resp: KResponse):
    """
    Display a frequency list (tokens, text types) based on more low-level arguments. In case the
    function runs in HTML return mode, 'freq_type' must be specified so the client part is able
    to determine proper views.

    Alternatively, 'freqml', 'freqtt' actions can be used for more high-level access.
    """
    try:
        await require_existing_conc(amodel.corp, amodel.args.q, req.translate)
        ans = await _freqs(
            amodel,
            req,
            fcrit=req.mapped_args.fcrit, fcrit_async=req.mapped_args.fcrit_async, flimit=req.mapped_args.flimit,
            freq_sort=req.mapped_args.freq_sort, force_cache=req.mapped_args.force_cache)
        if req.mapped_args.freq_type not in ('tokens', 'text-types', '2-attribute') and req.mapped_args.format != 'json':
            raise UserActionException(f'Unknown freq type {req.mapped_args.freq_type}', code=422)
        ans['freq_type'] = req.mapped_args.freq_type
        return ans
    except ConcNotFoundException:
        amodel.go_to_restore_conc('freqs')


async def _freqs(
        amodel: ConcActionModel,
        req: KRequest[GeneralFreqArgs],
        fcrit: Tuple[str, ...],
        fcrit_async: Tuple[str, ...],
        flimit: int,
        freq_sort: str,
        force_cache: int):

    amodel.disabled_menu_items = (
        MainMenu.CONCORDANCE('query-save-as'),
        MainMenu.VIEW('kwic-sent-switch'),
        MainMenu.CONCORDANCE('query-overview'))

    def parse_fcrit(fcrit):
        attrs, marks, ranges = [], [], []
        for i, item in enumerate(fcrit.split()):
            if i % 2 == 0:
                attrs.append(item)
            if i % 2 == 1:
                ranges.append(item)
        return attrs, ranges

    def is_non_structural_attr(criteria):
        crit_attrs = set(re.findall(r'(\w+)/\s+-?[0-9]+[<>][0-9]+\s*', criteria))
        if len(crit_attrs) == 0:
            crit_attrs = set(re.findall(r'(\w+\.\w+)\s+[0-9]+', criteria))
        attr_list = set(amodel.corp.get_posattrs())
        return crit_attrs <= attr_list

    result = {}
    fcrit_is_all_nonstruct = True
    for fcrit_item in fcrit:
        fcrit_is_all_nonstruct = (fcrit_is_all_nonstruct and is_non_structural_attr(fcrit_item))
    if fcrit_is_all_nonstruct:
        rel_mode = 1
    else:
        rel_mode = 0
    corp_info = await amodel.get_corpus_info(amodel.args.corpname)

    args = freq_calc.FreqCalcArgs(
        corpname=amodel.corp.corpname,
        subcname=amodel.corp.subcname,
        subcpath=amodel.subcpath,
        user_id=req.session_get('user', 'id'),
        q=amodel.args.q,
        pagesize=amodel.args.pagesize,
        samplesize=0,
        flimit=flimit,
        fcrit=fcrit,
        freq_sort=freq_sort,
        ftt_include_empty=amodel.args.ftt_include_empty,
        rel_mode=rel_mode,
        collator_locale=corp_info.collator_locale,
        fmaxitems=amodel.args.fmaxitems,
        fpage=amodel.args.fpage,
        force_cache=True if force_cache else False)

    calc_result = await freq_calc.calculate_freqs(args)
    result.update(
        fcrit=[dict(n=f, label=f.split(' ', 1)[0]) for f in fcrit],
        fcrit_async=[dict(n=f, label=f.split(' ', 1)[0]) for f in fcrit_async],
        Blocks=calc_result['data'],
        paging=0,
        concsize=calc_result['conc_size'],
        fmaxitems=amodel.args.fmaxitems,
        quick_from_line=1,
        quick_to_line=None)

    if not result['Blocks'][0]:
        logging.getLogger(__name__).warning('freqs - empty list: %s' % (result,))
        result.update(
            message=('error', req.translate('Empty list')),
            Blocks=[],
            paging=0,
            quick_from_line=None,
            quick_to_line=None,
            FCrit=[],
            fcrit=[],
            fcrit_async=[]
        )
    else:
        if len(result['Blocks']) == 1:  # paging
            result['paging'] = 1
            result['lastpage'] = calc_result['lastpage']

        for b in result['Blocks']:
            for item in b['Items']:
                item['pfilter'] = {}
                item['nfilter'] = {}
                # generating positive and negative filter references
        for b_index, block in enumerate(result['Blocks']):
            curr_fcrit = fcrit[b_index]
            attrs, ranges = parse_fcrit(curr_fcrit)
            for level, (attr, range) in enumerate(zip(attrs, ranges)):
                try:
                    begin, end = range.split('~')
                except ValueError:
                    begin = end = range
                attr = attr.split('/')
                icase = '(?i)' if len(attr) > 1 and "i" in attr[1] else ''
                attr = attr[0]
                for ii, item in enumerate(block['Items']):
                    if not item['freq']:
                        continue
                    if '.' not in attr:
                        if attr in amodel.corp.get_posattrs():
                            wwords = item['Word'][level]['n'].split('  ')  # two spaces
                            fquery = f'{begin} {end} 0 '
                            fquery += ''.join([f'[{attr}="{icase}{escape_attr_val(w)}"]' for w in wwords])
                        else:  # structure number
                            fquery = '0 0 1 [] within <{} #{}/>'.format(
                                attr, item['Word'][0]['n'].split('#')[1])
                    else:  # text types
                        structname, attrname = attr.split('.')
                        if amodel.corp.get_conf(structname + '.NESTED'):
                            block['unprecise'] = True
                        fquery = '0 0 1 [] within <{} {}="{}" />'.format(
                            structname, attrname, escape_attr_val(item['Word'][0]['n']))
                    if not item['freq']:
                        continue
                    item['pfilter']['q2'] = f'p{fquery}'
                    if len(attrs) == 1 and item['freq'] <= calc_result['conc_size']:
                        item['nfilter']['q2'] = f'n{fquery}'
                        # adding no error, no correction (originally for CUP)
        errs, corrs, err_block, corr_block = 0, 0, -1, -1
        for b_index, block in enumerate(result['Blocks']):
            curr_fcrit = fcrit[b_index]
            if curr_fcrit.split()[0] == 'err.type':
                err_block = b_index
                for item in block['Items']:
                    errs += item['freq']
            elif curr_fcrit.split()[0] == 'corr.type':
                corr_block = b_index
                for item in block['Items']:
                    corrs += item['freq']
        freq = calc_result['conc_size'] - errs - corrs
        if freq > 0 and err_block > -1 and corr_block > -1:
            pfilter = {'q': 'p0 0 1 ([] within ! <err/>) within ! <corr/>'}
            cc = await get_conc(
                corp=amodel.corp, user_id=req.session_get('user', 'id'),
                q=amodel.args.q + [pfilter[0][1]], fromp=amodel.args.fromp,
                pagesize=amodel.args.pagesize, asnc=False, translate=req.translate)
            freq = cc.size()
            err_nfilter, corr_nfilter = {}, {}
            if freq != calc_result['conc_size']:
                # TODO err/corr stuff is untested
                err_nfilter = {'q': 'p0 0 1 ([] within <err/>) within ! <corr/>'}
                corr_nfilter = {'q': 'p0 0 1 ([] within ! <err/>) within <corr/>'}
            result['NoRelSorting'] = True
            result['Blocks'][err_block]['Items'].append(
                {'Word': [{'n': 'no error'}], 'freq': freq,
                 'pfilter': pfilter, 'nfilter': err_nfilter})
            result['Blocks'][corr_block]['Items'].append(
                {'Word': [{'n': 'no correction'}], 'freq': freq,
                 'pfilter': pfilter, 'nfilter': corr_nfilter})

        amodel.add_save_menu_item(
            'CSV', save_format='csv',
            hint=req.translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                amodel.CONC_QUICK_SAVE_MAX_LINES)))
        amodel.add_save_menu_item(
            'XLSX', save_format='xlsx',
            hint=req.translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                amodel.CONC_QUICK_SAVE_MAX_LINES)))
        amodel.add_save_menu_item(
            'XML', save_format='xml',
            hint=req.translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                amodel.CONC_QUICK_SAVE_MAX_LINES)))
        amodel.add_save_menu_item(
            'TXT', save_format='txt',
            hint=req.translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                amodel.CONC_QUICK_SAVE_MAX_LINES)))
        amodel.add_save_menu_item(req.translate('Custom'))

    result['coll_form_args'] = CollFormArgs().update(amodel.args).to_dict()
    result['freq_form_args'] = FreqFormArgs().update(amodel.args).to_dict()
    result['ctfreq_form_args'] = CTFreqFormArgs().update(amodel.args).to_dict()
    result['text_types_data'] = await amodel.tt.export_with_norms(ret_nums=True)
    result['quick_save_row_limit'] = amodel.FREQ_QUICK_SAVE_MAX_LINES
    await amodel.attach_query_params(result)
    await amodel.attach_query_overview(result)
    return result


async def _freqml(amodel: ConcActionModel, req: KRequest[MLFreqRequestArgs], resp: KResponse):
    """
    multilevel frequency list
    """
    args = req.mapped_args
    fcrit = multi_level_crit(args.freqlevel, args)
    result = await _freqs(
        amodel,
        req,
        fcrit=(fcrit,), fcrit_async=(), flimit=args.flimit, freq_sort='', force_cache=1)
    result['ml'] = 1
    req.session['last_freq_level'] = args.freqlevel
    tmp = defaultdict(lambda: [])
    for i in range(1, args.freqlevel + 1):
        tmp['mlxattr'].append(getattr(args, 'ml{0}attr'.format(i), 'word'))
        tmp['mlxctx'].append(getattr(args, 'ml{0}ctx'.format(i), '0'))
        tmp['mlxpos'].append(getattr(args, 'ml{0}pos'.format(i), 1))
        tmp['mlxicase'].append(getattr(args, 'ml{0}icase'.format(i), ''))
        tmp['flimit'] = args.flimit
        tmp['freq_sort'] = args.freq_sort
    result['freq_form_args'] = tmp
    result['freq_type'] = 'tokens'
    return result


@bp.route('/freqml')
@http_action(
    access_level=0, template='freqs.html', page_model='freq', action_model=ConcActionModel,
    mapped_args=MLFreqRequestArgs)
async def freqml(amodel: ConcActionModel, req: KRequest[MLFreqRequestArgs], resp: KResponse):
    try:
        await require_existing_conc(amodel.corp, amodel.args.q, req.translate)
        return await _freqml(amodel, req, resp)
    except ConcNotFoundException:
        amodel.go_to_restore_conc('freqml')


@dataclass
class FreqttActionArgs:
    flimit: IntOpt = 0
    fttattr: ListStrOpt = field(default_factory=list)
    fttattr_async: ListStrOpt = field(default_factory=list)


@bp.route('/freqtt')
@http_action(
    access_level=1, template='freqs.html', action_model=ConcActionModel, page_model='freq',
    mapped_args=FreqttActionArgs)
async def freqtt(amodel: ConcActionModel, req: KRequest[FreqttActionArgs], resp: KResponse):
    if not req.mapped_args.fttattr:
        raise ConcordanceQueryParamsError(req.translate('No text type selected'))
    ans = await _freqs(
        amodel, req, resp,
        fcrit=tuple(f'{a} 0' for a in req.mapped_args.fttattr),
        fcrit_async=[f'{a} 0' for a in req.mapped_args.fttattr_async],
        flimit=req.mapped_args.flimit,
        freq_type='text-types')
    ans['freq_type'] = 'text-types'
    return ans


async def _freqct(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    args = freq_calc.Freq2DCalcArgs(
        corpname=amodel.corp.corpname,
        subcname=getattr(amodel.corp, 'subcname', None),
        subcpath=amodel.subcpath,
        user_id=req.session_get('user', 'id'),
        q=amodel.args.q,
        ctminfreq=int(req.args.get('ctminfreq', '1')),
        ctminfreq_type=req.args.get('ctminfreq_type'),
        fcrit=f'{amodel.args.ctattr1} {amodel.args.ctfcrit1} {amodel.args.ctattr2} {amodel.args.ctfcrit2}')

    try:
        freq_data = await freq_calc.calculate_freq2d(args)
    except UserActionException as ex:
        freq_data = dict(data=[], full_size=0)
        resp.add_system_message('error', str(ex))
    amodel.add_save_menu_item('XLSX', save_format='xlsx')

    ans = dict(
        freq_type='2-attribute',
        attr1=amodel.args.ctattr1,
        attr2=amodel.args.ctattr2,
        data=freq_data,
        freq_form_args=FreqFormArgs().update(amodel.args).to_dict(),
        coll_form_args=CollFormArgs().update(amodel.args).to_dict(),
        ctfreq_form_args=CTFreqFormArgs().update(amodel.args).to_dict()
    )
    ans['text_types_data'] = await amodel.tt.export_with_norms(ret_nums=True)
    ans['quick_save_row_limit'] = 0
    await amodel.attach_query_params(ans)
    return ans


@bp.route('/freqct')
@http_action(action_model=ConcActionModel, access_level=1, page_model='freq', template='freqs.html')
async def freqct(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    """
    try:
        await require_existing_conc(amodel.corp, amodel.args.q)
        return await _freqct(amodel, req, resp)
    except ConcNotFoundException:
        amodel.go_to_restore_conc('freqct')


@bp.route('/export_freqct', methods=['POST'])
@http_action(action_model=UserActionModel, access_level=1, return_type='plain')
def export_freqct(self, request):
    with plugins.runtime.EXPORT_FREQ2D as plg:
        data = request.json
        exporter = plg.load_plugin(request.args.get('saveformat'))
        if request.args.get('savemode') == 'table':
            exporter.set_content(attr1=data['attr1'], attr2=data['attr2'],
                                 labels1=data.get('labels1', []), labels2=data.get('labels2', []),
                                 alpha_level=data['alphaLevel'], min_freq=data['minFreq'],
                                 min_freq_type=data['minFreqType'], data=data['data'])
        elif request.args.get('savemode') == 'flat':
            exporter.set_content_flat(headings=data.get('headings', []), alpha_level=data['alphaLevel'],
                                      min_freq=data['minFreq'], min_freq_type=data['minFreqType'],
                                      data=data['data'])
        self._response.set_header('Content-Type', exporter.content_type())
        self._response.set_header(
            'Content-Disposition',
            f'attachment; filename="{self.args.corpname}-2dfreq-distrib.xlsx"')
    return exporter.raw_content()


@dataclass
class SavefreqArgs:
    fcrit: List[str]
    flimit: IntOpt = 0
    freq_sort: StrOpt = ''
    saveformat: StrOpt = 'txt'
    from_line: IntOpt = 1
    to_line: IntOpt = field(default_factory=lambda: sys.maxsize)
    colheaders: IntOpt = 0
    heading: IntOpt = 0
    multi_sheet_file: IntOpt = 0


@bp.route('/savefreq')
@http_action(
    access_level=1, action_model=ConcActionModel, mapped_args=SavefreqArgs, return_type='plain')
async def savefreq(amodel: ConcActionModel, req: KRequest[SavefreqArgs], resp: KResponse):
    """
    save a frequency list
    """
    amodel.args.fpage = 1
    amodel.args.fmaxitems = req.mapped_args.to_line - req.mapped_args.from_line + 1

    # following piece of sh.t has hidden parameter dependencies
    result = await _freqs(
        amodel, req, fcrit=req.mapped_args.fcrit, flimit=req.mapped_args.flimit,
        freq_sort=req.mapped_args.freq_sort, force_cache=False, fcrit_async=())

    def mkfilename(suffix): return f'{amodel.args.corpname}-freq-distrib.{suffix}'
    with plugins.runtime.EXPORT as export:
        writer = export.load_plugin(req.mapped_args.saveformat, req.locale)

        resp.set_header('Content-Type', writer.content_type())
        resp.set_header(
            'Content-Disposition', f'attachment; filename="{mkfilename(req.mapped_args.saveformat)}"')

        await writer.write_freq(amodel, result, req.mapped_args)
        output = writer.raw_content()

    return output
