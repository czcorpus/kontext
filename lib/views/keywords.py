# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2023 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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
import sys
import time
from dataclasses import dataclass

import plugins
import settings
from action.argmapping import IntOpt, log_mapping
from action.argmapping.keywords import KeywordsFormArgs
from action.control import http_action
from action.errors import ImmediateRedirectException, NotFoundException
from action.krequest import KRequest
from action.model.keywords import KeywordsActionModel, KeywordsError
from action.response import KResponse
from bgcalc import calc_backend_client
from bgcalc.freqs import build_arf_db
from bgcalc.keywords import KeywordsResultNotFound, require_existing_keywords
from bgcalc.task import AsyncTaskStatus
from corplib.abstract import SubcorpusIdent
from corplib.errors import MissingSubCorpFreqFile
from main_menu.model import MainMenu
from sanic import Blueprint

bp = Blueprint('keywords', url_prefix='keywords')
KW_MAX_LIST_SIZE = 1000


@bp.route('/form')
@http_action(access_level=2, template='keywords/form.html', page_model='keywordsForm', action_model=KeywordsActionModel)
async def form(amodel: KeywordsActionModel, req: KRequest, _: KResponse):
    if req.args.get('ref_corpname') is None:
        raise ImmediateRedirectException(
            req.updated_current_url({'ref_corpname': amodel.args.corpname}), code=302)
    amodel.disabled_menu_items = (
        MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
        MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
    out = {}
    if amodel.curr_kwform_args is None:
        amodel.set_curr_kwform_args(
            KeywordsFormArgs(
                ref_corpname=req.args.get('ref_corpname'),
                ref_usesubcorp=req.args.get('ref_usesubcorp'),
                wlattr='',
                wlpat='.*',
                score_type='din'))
    await amodel.export_subcorpora_list(out)

    # initial reference corpus data
    if amodel.curr_kwform_args.ref_corpname:
        if amodel.curr_kwform_args.ref_usesubcorp:
            ref_corp_id = SubcorpusIdent(
                amodel.curr_kwform_args.ref_usesubcorp, amodel.curr_kwform_args.ref_corpname)
        else:
            ref_corp_id = amodel.curr_kwform_args.ref_corpname
    else:
        ref_corp_id = amodel.corp.corpname
    ref_corp = await amodel.plugin_ctx.corpus_factory.get_corpus(ref_corp_id)
    out['ref_corpus_ident'] = dict(
        id=ref_corp.corpname,
        variant='',
        name=ref_corp.human_readable_corpname,
        usesubcorp=ref_corp.subcorpus_id,
        origSubcorpName=ref_corp.subcorpus_name,
        foreignSubcorp=amodel.session_get('user', 'id') != ref_corp.author_id,
        size=ref_corp.size,
        searchSize=ref_corp.search_size,
    )
    out['available_ref_subcorpora'] = await amodel.get_subcorpora_list(ref_corp)
    cattrs = [attr for attr in amodel.corp.get_posattrs() if attr in ref_corp.get_posattrs()]
    out['CommonAttrList'] = [{
        'label': amodel.corp.get_conf(f'{n}.LABEL') or n,
        'n': n,
        'multisep': amodel.corp.get_conf(f'{n}.MULTISEP'),
    } for n in cattrs]

    if not amodel.curr_kwform_args.wlattr:
        amodel.curr_kwform_args.wlattr = cattrs[0]
    amodel.export_form_args(out)
    return out


@bp.route('/submit', ['POST'])
@http_action(
    access_level=2, return_type='json', mutates_result=True,
    action_log_mapper=log_mapping.keywords, action_model=KeywordsActionModel)
async def submit(amodel: KeywordsActionModel, req: KRequest, _: KResponse):
    form_args = KeywordsFormArgs()
    form_args.update_by_user_query(req.json)
    return await create_result(amodel, form_args)


async def create_result(amodel: KeywordsActionModel, form_args: KeywordsFormArgs):
    worker = calc_backend_client(settings)
    ans = dict(
        corpname=amodel.args.corpname, usesubcorp=amodel.args.usesubcorp, freq_files_avail=True, subtasks=[])
    ref_corp_ident = SubcorpusIdent(
        form_args.ref_usesubcorp, form_args.ref_corpname) if form_args.ref_usesubcorp else form_args.ref_corpname
    async_res = await worker.send_task(
        'get_keywords', object.__class__,
        args=(amodel.corp.portable_ident, ref_corp_ident, form_args.to_dict(), KW_MAX_LIST_SIZE))
    bg_result = await async_res.get()

    if isinstance(bg_result, MissingSubCorpFreqFile):
        corp = await amodel.cf.get_corpus(
            bg_result.corpname
            if bg_result.usesubcorp is None else
            SubcorpusIdent(bg_result.usesubcorp, bg_result.corpname)
        )
        data_calc = await build_arf_db(
            amodel.session_get('user', 'id'), corp, form_args.wlattr)
        if type(data_calc) is list:
            for subtask in data_calc:
                # TODO get rid of private method
                await amodel.store_async_task(subtask)
                ans['subtasks'].append(subtask.to_dict())
            ans['freq_files_avail'] = False
        else:
            # TODO we should join the current calculation here instead of throwing an error
            raise KeywordsError('The data calculation is already running')

    elif isinstance(bg_result, Exception):
        raise bg_result

    amodel.set_curr_kwform_args(form_args)

    async def on_query_store(query_ids, history_ts, resp):
        resp.result['kw_query_id'] = query_ids[0]
        if history_ts:
            amodel.store_last_search('kwords', query_ids[0])

    amodel.on_query_store(on_query_store)
    return ans


async def view_result(amodel: KeywordsActionModel, req: KRequest):
    amodel.add_save_menu()
    amodel.disabled_menu_items = (
        MainMenu.VIEW('kwic-sent-switch', 'structs-attrs'),
        MainMenu.FILTER,
        MainMenu.FREQUENCY,
        MainMenu.COLLOCATIONS,
        MainMenu.CONCORDANCE)

    page = int(req.args.get('kwpage', '1'))
    offset = (page - 1) * amodel.args.kwpagesize
    kwsort = req.args.get('kwsort', None)
    if kwsort is not None:
        amodel.curr_kwform_args.score_type = kwsort
    else:
        kwsort = amodel.curr_kwform_args.score_type

    try:
        result = await require_existing_keywords(amodel.curr_kwform_args, offset, amodel.args.kwpagesize)
    except KeywordsResultNotFound:
        raise ImmediateRedirectException(req.create_url(
            'keywords/restore', dict(q=req.args_getlist('q')[0], kwsort=kwsort)))

    ans = result.to_dict()
    ans['keywords_form'] = amodel.curr_kwform_args.to_dict()
    try:
        ans['wlattr_label'] = (
            amodel.corp.get_conf(amodel.curr_kwform_args.wlattr + '.LABEL') or amodel.curr_kwform_args.wlattr)
    except Exception as e:
        ans['wlattr_label'] = amodel.curr_kwform_args.wlattr
        logging.getLogger(__name__).warning(f'wlattr_label set failed: {e}')

    ans['tasks'] = []
    ans['SubcorpList'] = []
    ans['query_id'] = amodel.q_code

    ans['kwpage'] = page
    ans['kwpagesize'] = amodel.args.kwpagesize
    ans['kwsort'] = kwsort
    ans['kw_max_items'] = KW_MAX_LIST_SIZE

    await amodel.export_subcorpora_list(ans)
    return ans


@bp.route('/result')
@http_action(
    access_level=2, template='keywords/result.html', page_model='keywords',
    action_log_mapper=log_mapping.keywords, action_model=KeywordsActionModel)
async def result(amodel: KeywordsActionModel, req: KRequest, _: KResponse):
    return await view_result(amodel, req)


@bp.route('/restore')
@http_action(
    access_level=2, template='keywords/restore.html', page_model='restoreKeywords',
    mutates_result=True, action_log_mapper=log_mapping.wordlist, action_model=KeywordsActionModel)
async def restore(amodel: KeywordsActionModel, req: KRequest, _: KResponse):
    worker = calc_backend_client(settings)
    ref_corp_ident = SubcorpusIdent(
        amodel.curr_kwform_args.ref_usesubcorp,
        amodel.curr_kwform_args.ref_corpname) if amodel.curr_kwform_args.ref_usesubcorp else amodel.curr_kwform_args.ref_corpname
    amodel.curr_kwform_args.score_type = req.args.get('kwsort', amodel.curr_kwform_args.score_type)
    async_res = await worker.send_task(
        'get_keywords', object.__class__,
        args=(amodel.corp.portable_ident, ref_corp_ident, amodel.curr_kwform_args.to_dict(), KW_MAX_LIST_SIZE))

    async def on_query_store(query_ids, history_ts, resp):
        async_task = AsyncTaskStatus(
            status=async_res.status, ident=async_res.id,
            category=AsyncTaskStatus.CATEGORY_KWORDS,
            label=query_ids[0],
            args=dict(query_id=query_ids[0], last_update=time.time()),
            url=req.create_url('keywords/result', dict(q=f'~{query_ids[0]}')),
            auto_redirect=True)
        await amodel.store_async_task(async_task)
        resp.result['task'] = async_task.to_dict()

    amodel.on_query_store(on_query_store)

    return {
        'finished': False,
        'next_action': '',
        'next_action_args': {}}


@dataclass
class SaveKeywordsArgs:
    from_line: int = 1
    to_line: IntOpt = -1
    saveformat: str = ''
    heading: bool = False
    colheaders: bool = False


@bp.route('/download')
@http_action(access_level=2, return_type='plain', action_model=KeywordsActionModel, mapped_args=SaveKeywordsArgs)
async def download(amodel: KeywordsActionModel, req: KRequest[SaveKeywordsArgs], resp: KResponse):
    """
    download a keywords results
    """
    from_line = req.mapped_args.from_line - 1
    to_line = sys.maxsize if req.mapped_args.to_line < 0 else req.mapped_args.to_line

    try:
        result = await require_existing_keywords(amodel.curr_kwform_args, from_line, to_line - from_line)
    except KeywordsResultNotFound:
        raise NotFoundException('global__result_no_more_avail_for_download_pls_update')

    def mkfilename(suffix): return f'{amodel.args.corpname}-keywords.{suffix}'
    with plugins.runtime.EXPORT as export:
        writer = export.load_plugin(req.mapped_args.saveformat, req.locale)

        resp.set_header('Content-Type', writer.content_type())
        resp.set_header('Content-Disposition',
                        f'attachment; filename="{mkfilename(req.mapped_args.saveformat)}"')

        if len(result.data) > 0:
            await writer.write_keywords(amodel, result, req.mapped_args)
        output = writer.raw_content()

    return output
