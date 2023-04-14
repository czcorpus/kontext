# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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
import time

import settings
from action.argmapping import log_mapping
from action.argmapping.keywords import KeywordsFormArgs
from action.control import http_action
from action.errors import ImmediateRedirectException
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


@bp.route('/form')
@http_action(access_level=2, template='keywords/form.html', page_model='keywordsForm', action_model=KeywordsActionModel)
async def form(amodel: KeywordsActionModel, _: KRequest, __: KResponse):
    amodel.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                  MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
    out = {}
    await amodel.export_subcorpora_list(out)
    amodel.export_form_args(out)

    # initial reference corpus data
    if out['keywords_form'] is not None and out['keywords_form']['ref_corpname']:
        if out['keywords_form']['ref_usesubcorp']:
            ref_corp_id = SubcorpusIdent(
                out['keywords_form']['ref_usesubcorp'], out['keywords_form']['ref_corpname'])
        else:
            ref_corp_id = out['keywords_form']['ref_corpname']
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
        args=(amodel.corp.portable_ident, ref_corp_ident, form_args.to_dict(), amodel.corp.size))
    bg_result = async_res.get()
    if isinstance(bg_result, MissingSubCorpFreqFile):
        data_calc = await build_arf_db(
            amodel.session_get('user', 'id'), amodel.corp, form_args.wlattr)
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

    async def on_query_store(query_ids, history_ts, result):
        result['kw_query_id'] = query_ids[0]
        if history_ts:
            amodel.store_last_search('kwords', query_ids[0])

    amodel.on_query_store(on_query_store)
    return ans


async def view_result(amodel: KeywordsActionModel, req: KRequest):
    amodel.disabled_menu_items = (
        MainMenu.VIEW('kwic-sent-switch', 'structs-attrs'),
        MainMenu.FILTER,
        MainMenu.FREQUENCY,
        MainMenu.COLLOCATIONS,
        MainMenu.CONCORDANCE)

    kwsort = req.args.get('kwsort', 'f')
    rev = bool(int(req.args.get('reverse', '1')))
    page = int(req.args.get('kwpage', '1'))
    offset = (page - 1) * amodel.args.kwpagesize

    try:
        total, data = await require_existing_keywords(
            form=amodel.curr_kwform_args, reverse=rev, offset=offset,
            limit=amodel.args.kwpagesize, kwsort=kwsort,
            collator_locale=(await amodel.get_corpus_info(amodel.corp.corpname)).collator_locale)
    except KeywordsResultNotFound:
        raise ImmediateRedirectException(req.create_url(
            'keywords/restore', dict(q=req.args_getlist('q')[0])))

    result = dict(
        data=data, total=total, form=amodel.curr_kwform_args.to_dict(),
        query_id=amodel.curr_kwform_args.id, reverse=rev, wlsort=kwsort, kwpage=page,
        kwpagesize=amodel.args.kwpagesize)
    try:
        result['wlattr_label'] = (
            amodel.corp.get_conf(amodel.curr_kwform_args.wlattr + '.LABEL') or amodel.curr_kwform_args.wlattr)
    except Exception as e:
        result['wlattr_label'] = amodel.curr_kwform_args.wlattr
        logging.getLogger(__name__).warning(f'wlattr_label set failed: {e}')

    result['tasks'] = []
    result['SubcorpList'] = []
    result['query_id'] = amodel.q_code
    result['keywords_form'] = amodel.curr_kwform_args.to_dict()

    result['total'] = total
    result['kwsort'] = kwsort
    result['reverse'] = rev
    result['kwpage'] = page
    result['kwpagesize'] = amodel.args.kwpagesize

    await amodel.export_subcorpora_list(result)
    return result


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
    async_res = await worker.send_task(
        'get_keywords', object.__class__,
        args=(amodel.corp.portable_ident, ref_corp_ident, amodel.curr_kwform_args.to_dict(), amodel.corp.size))

    async def on_query_store(query_ids, history_ts, result):
        async_task = AsyncTaskStatus(
            status=async_res.status, ident=async_res.id,
            category=AsyncTaskStatus.CATEGORY_KWORDS,
            label=query_ids[0],
            args=dict(query_id=query_ids[0], last_update=time.time()),
            url=req.create_url('keywords/result', dict(q=f'~{query_ids[0]}')),
            auto_redirect=True)
        await amodel.store_async_task(async_task)
        result['task'] = async_task.to_dict()

    amodel.on_query_store(on_query_store)

    return {
        'finished': False,
        'next_action': '',
        'next_action_args': {}}
