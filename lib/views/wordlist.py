# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2021 Martin Zimandl <martin.zimandl@gmail.com>
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
from typing import List

import plugins
import settings
from action.argmapping import log_mapping
from action.argmapping.wordlist import WordlistFormArgs, WordlistSaveFormArgs
from action.control import http_action
from action.errors import ImmediateRedirectException
from action.krequest import KRequest
from action.model.wordlist import WordlistActionModel, WordlistError
from action.response import KResponse
from bgcalc import calc_backend_client
from bgcalc.errors import BgCalcError
from bgcalc.freqs import build_arf_db, build_arf_db_status
from bgcalc.task import AsyncTaskStatus
from bgcalc.wordlist import make_wl_query, require_existing_wordlist
from bgcalc.wordlist.errors import WordlistResultNotFound
from corplib.errors import MissingSubCorpFreqFile
from main_menu import MainMenu
from sanic import Blueprint

bp = Blueprint('wordlist', url_prefix='wordlist')


@bp.route('/form')
@http_action(access_level=2, template='wordlist/form.html', page_model='wordlistForm', action_model=WordlistActionModel)
async def form(amodel: WordlistActionModel, _: KRequest, __: KResponse):
    """
    Word List Form
    """
    amodel.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                  MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
    out = dict(freq_figures=amodel.FREQ_FIGURES)
    await amodel.export_subcorpora_list(out)
    amodel.export_form_args(out)
    return out


async def create_result(amodel: WordlistActionModel, form_args: WordlistFormArgs):
    worker = calc_backend_client(settings)
    ans = dict(
        corpname=amodel.args.corpname, usesubcorp=amodel.args.usesubcorp, freq_files_avail=True, subtasks=[])
    async_res = await worker.send_task(
        'get_wordlist', object.__class__,
        args=(amodel.corp.portable_ident, form_args.to_dict(), amodel.corp.size))
    bg_result = await async_res.get()
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
            raise WordlistError('The data calculation is already running')
    elif isinstance(bg_result, Exception):
        raise bg_result
    # TODO get rid of private variable
    amodel.set_curr_wlform_args(form_args)

    async def on_query_store(query_ids, history_ts, result):
        result['wl_query_id'] = query_ids[0]
        if history_ts:
            amodel.store_last_search('wlist', query_ids[0])

    amodel.on_query_store(on_query_store)
    return ans


@bp.route('/submit', ['POST'])
@http_action(
    access_level=2, return_type='json', page_model='wordlist', mutates_result=True,
    action_log_mapper=log_mapping.wordlist, action_model=WordlistActionModel)
async def submit(amodel: WordlistActionModel, req: KRequest, _: KResponse):
    form_args = WordlistFormArgs()
    form_args.update_by_user_query(req.json)
    return await create_result(amodel, form_args)


@bp.route('/restore')
@http_action(
    access_level=2, template='wordlist/restore.html', page_model='restoreWordlist',
    mutates_result=True, action_log_mapper=log_mapping.wordlist, action_model=WordlistActionModel)
async def restore(amodel: WordlistActionModel, req: KRequest, _: KResponse):
    worker = calc_backend_client(settings)
    async_res = await worker.send_task(
        'get_wordlist', object.__class__,
        args=(amodel.corp.portable_ident, amodel.curr_wlform_args.to_dict(), amodel.corp.size))

    async def on_query_store(query_ids, history_ts, result):
        async_task = AsyncTaskStatus(
            status=async_res.status, ident=async_res.id,
            category=AsyncTaskStatus.CATEGORY_WORDLIST,
            label=query_ids[0],
            args=dict(query_id=query_ids[0], last_update=time.time()),
            url=req.create_url('wordlist/result', dict(q=f'~{query_ids[0]}')),
            auto_redirect=True)
        await amodel.store_async_task(async_task)
        result['task'] = async_task.to_dict()

    amodel.on_query_store(on_query_store)

    return {
        'finished': False,
        'next_action': '',
        'next_action_args': {}}


async def view_result(amodel: WordlistActionModel, req: KRequest):
    amodel.disabled_menu_items = (
        MainMenu.VIEW('kwic-sent-switch', 'structs-attrs'),
        MainMenu.FILTER,
        MainMenu.FREQUENCY,
        MainMenu.COLLOCATIONS,
        MainMenu.CONCORDANCE)

    wlsort = req.args.get('wlsort', 'f')
    rev = bool(int(req.args.get('reverse', '1')))
    page = int(req.args.get('wlpage', '1'))
    offset = (page - 1) * amodel.args.wlpagesize

    try:
        total, data = await require_existing_wordlist(
            form=amodel.curr_wlform_args, reverse=rev, offset=offset,
            limit=amodel.args.wlpagesize, wlsort=wlsort,
            collator_locale=(await amodel.get_corpus_info(amodel.corp.corpname)).collator_locale)
    except WordlistResultNotFound:
        raise ImmediateRedirectException(req.create_url(
            'wordlist/restore', dict(q=req.args_getlist('q')[0])))

    result = dict(
        data=data, total=total, form=amodel.curr_wlform_args.to_dict(),
        query_id=amodel.curr_wlform_args.id, reverse=rev, wlsort=wlsort, wlpage=page,
        wlpagesize=amodel.args.wlpagesize)
    try:
        result['wlattr_label'] = (
            amodel.corp.get_conf(amodel.curr_wlform_args.wlattr + '.LABEL') or amodel.curr_wlform_args.wlattr)
    except Exception as e:
        result['wlattr_label'] = amodel.curr_wlform_args.wlattr
        logging.getLogger(__name__).warning(f'wlattr_label set failed: {e}')

    result['freq_figure'] = req.translate(amodel.FREQ_FIGURES.get('frq', '?'))

    amodel.add_save_menu_item(
        'CSV', save_format='csv',
        hint=req.translate(
            'Saves at most {0} items. Use "Custom" for more options.'.format(
                amodel.WORDLIST_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(
        'XLSX', save_format='xlsx',
        hint=req.translate(
            'Saves at most {0} items. Use "Custom" for more options.'.format(
                amodel.WORDLIST_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(
        'XML', save_format='xml',
        hint=req.translate(
            'Saves at most {0} items. Use "Custom" for more options.'.format(
                amodel.WORDLIST_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(
        'TXT', save_format='txt',
        hint=req.translate(
            'Saves at most {0} items. Use "Custom" for more options.'.format(
                amodel.WORDLIST_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(req.translate('Custom'))
    # custom save is solved in templates because of compatibility issues
    result['tasks'] = []
    result['SubcorpList'] = []
    result['quick_save_row_limit'] = amodel.WORDLIST_QUICK_SAVE_MAX_LINES
    result['query_id'] = amodel.q_code
    await amodel.export_subcorpora_list(result)
    return result


@bp.route('/result')
@http_action(
    access_level=2, template='wordlist/result.html', page_model='wordlist',
    action_log_mapper=log_mapping.wordlist, action_model=WordlistActionModel)
async def result(amodel: WordlistActionModel, req: KRequest, _: KResponse):
    return await view_result(amodel, req)


@bp.route('/struct_result', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=WordlistActionModel)
async def struct_result(amodel: WordlistActionModel, req: KRequest, resp: KResponse):
    form_args = WordlistFormArgs()
    form_args.update_by_user_query(req.json)
    amodel.set_curr_wlform_args(form_args)

    if amodel.args.fcrit:
        amodel.args.q = make_wl_query(
            wlattr=form_args.wlattr, wlpat=form_args.wlpat,
            include_nonwords=form_args.include_nonwords,
            pfilter_words=form_args.pfilter_words,
            nfilter_words=form_args.nfilter_words,
            non_word_re=amodel.corp.get_conf('NONWORDRE'))
        args = [('corpname', form_args.corpname), ('usesubcorp', form_args.usesubcorp),
                ('fcrit', amodel.args.fcrit), ('flimit', amodel.args.flimit),
                ('freq_sort', amodel.args.freq_sort), ('next', 'freqs')] + [('q', q) for q in amodel.args.q]
        return dict(location=req.create_url('restore_conc', args))
    if '.' in form_args.wlattr:
        raise WordlistError('Text types are limited to Simple output')
    if form_args.wlnums != 'frq':
        raise WordlistError('Multilevel lists are limited to Word counts frequencies')
    if len(form_args.wlposattrs) == 0:
        raise WordlistError(req.translate('No output attribute specified'))
    if not form_args.wlpat and len(form_args.pfilter_words) == 0:
        raise WordlistError(
            req.translate('You must specify either a pattern or a file to get the multilevel wordlist'))
    amodel.args.q = make_wl_query(
        wlattr=form_args.wlattr, wlpat=form_args.wlpat,
        include_nonwords=form_args.include_nonwords,
        pfilter_words=form_args.pfilter_words,
        nfilter_words=form_args.nfilter_words,
        non_word_re=amodel.corp.get_conf('NONWORDRE'))
    amodel.args.flimit = form_args.wlminfreq
    args = [('corpname', form_args.corpname), ('usesubcorp', form_args.usesubcorp),
            ('flimit', amodel.args.flimit), ('freqlevel', len(form_args.wlposattrs)),
            ('ml1attr', form_args.get_wlposattr(0)),
            ('ml2attr', form_args.get_wlposattr(1)),
            ('ml3attr', form_args.get_wlposattr(2)),
            ('next', 'freqml')] + [('q', q) for q in amodel.args.q]
    if req.args.get('format') == 'json':  # => explicit JSON format specification from URL
        args.append(('format', 'json'))
    target_url = req.create_url('restore_conc', args)
    resp.set_http_status(201)
    resp.set_header('Location', target_url)
    return dict(location=target_url)


@bp.route('/savewl')
@http_action(access_level=2, return_type='plain', action_model=WordlistActionModel, mapped_args=WordlistSaveFormArgs)
async def savewl(amodel: WordlistActionModel, req: KRequest[WordlistSaveFormArgs], resp: KResponse):
    """
    save word list
    """
    args = req.mapped_args
    if args.to_line < 0:
        args.to_line = amodel.corp.size
    num_lines = args.to_line - args.from_line + 1
    total, data = await require_existing_wordlist(
        form=amodel.curr_wlform_args, reverse=args.reverse == 1, offset=args.from_line - 1, limit=num_lines,
        wlsort=args.wlsort, collator_locale=(await amodel.get_corpus_info(amodel.corp.corpname)).collator_locale)

    def mkfilename(suffix): return f'{amodel.args.corpname}-word-list.{suffix}'
    with plugins.runtime.EXPORT as export:
        writer = export.load_plugin(args.saveformat, req.locale)

        resp.set_header('Content-Type', writer.content_type())
        resp.set_header(
            'Content-Disposition', f'attachment; filename="{mkfilename(args.saveformat)}"')

        await writer.write_wordlist(amodel, data, args)
        output = writer.raw_content()
    return output


@bp.route('/process')
@http_action(return_type='json', action_model=WordlistActionModel)
async def process(amodel: WordlistActionModel, req: KRequest, _: KResponse):
    worker_tasks: List[str] = req.args.get('worker_tasks')
    backend = settings.get('calc_backend', 'type')
    if worker_tasks and backend in ['rq']:
        import bgcalc
        worker = bgcalc.calc_backend_client(settings)
        for t in worker_tasks:
            tr = worker.AsyncResult(t)
            if tr.status == 'FAILURE':
                raise BgCalcError(f'Task {t} failed')
    return {'status': await build_arf_db_status(amodel.corp, req.args.get('attrname', ''))}
