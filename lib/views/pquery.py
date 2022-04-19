# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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

import sys
import time
from dataclasses import dataclass
from typing import Optional

import bgcalc
import plugins
import settings
from action.argmapping.pquery import PqueryFormArgs
from action.decorators import http_action
from action.errors import NotFoundException
from action.krequest import KRequest
from action.model.pquery import ParadigmaticQueryActionModel
from action.response import KResponse
from bgcalc.pquery.errors import PqueryResultNotFound
from bgcalc.pquery.storage import require_existing_pquery
from bgcalc.task import AsyncTaskStatus
from main_menu import MainMenu
from main_menu.model import MenuItemInternal
from sanic import Blueprint

bp = Blueprint('pquery', url_prefix='pquery')


@bp.route('/index')
@http_action(template='pquery/index.html', page_model='pquery', action_model=ParadigmaticQueryActionModel)
async def index(amodel: ParadigmaticQueryActionModel, req: KRequest, resp: KResponse):
    amodel.disabled_menu_items = (MainMenu.FILTER, MainMenu.FREQUENCY,
                                  MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
                                  MainMenu.VIEW('kwic-sent-switch'))
    ans = {
        'corpname': amodel.args.corpname,
        'tagsets': await amodel.get_tagsets(),
        'pquery_default_attr': amodel.get_default_attr(),
    }
    await amodel.export_form_args(ans)
    amodel.export_subcorpora_list(amodel.args.corpname, amodel.args.usesubcorp, ans)
    amodel.add_save_menu()
    return ans


@bp.route('/result')
@http_action(template='pquery/result.html', page_model='pqueryResult', action_model=ParadigmaticQueryActionModel)
async def result(amodel: ParadigmaticQueryActionModel, req: KRequest, resp: KResponse):
    pagesize = amodel.args.pqueryitemsperpage
    page = 1
    offset = (page - 1) * pagesize
    corp_info = await amodel.get_corpus_info(amodel.args.corpname)
    try:
        total_num_lines, freqs = await require_existing_pquery(
            amodel._curr_pquery_args, offset, pagesize, corp_info.collator_locale, 'freq', True)
        data_ready = True
    except PqueryResultNotFound:
        total_num_lines = 0
        freqs = []
        data_ready = False
    ans = {
        'corpname': amodel.args.corpname,
        'usesubcorp': amodel.args.usesubcorp,
        'query_id': amodel.q_code,
        'freqs': freqs,
        'page': page,
        'pagesize': pagesize,
        'total_num_lines': total_num_lines,
        'data_ready': data_ready
    }
    await amodel.export_form_args(ans)
    amodel.export_subcorpora_list(amodel.args.corpname, amodel.args.usesubcorp, ans)
    amodel.add_save_menu()
    amodel.disabled_menu_items = (
        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS,
        MainMenu.VIEW('kwic-sent-switch'))
    for i, conc_id in enumerate(amodel._curr_pquery_args.conc_ids):
        amodel.dynamic_menu_items.append(
            MenuItemInternal(
                MainMenu.CONCORDANCE, req.translate(
                    'Go to the constituent concordance #{}').format(i + 1), 'view'
            ).add_args(('q', f'~{conc_id}'))
        )
    return ans


@bp.route('/freq_intersection', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=ParadigmaticQueryActionModel)
async def freq_intersection(amodel: ParadigmaticQueryActionModel, req: KRequest, resp: KResponse):
    """
    Run a paradigmatic query out of existing concordances.

    submitted JSON structure - see models.pquery.common.FreqIntersectionArgs
    """
    worker = bgcalc.calc_backend_client(settings)
    corp_info = await amodel.get_corpus_info(amodel.args.corpname)

    amodel._curr_pquery_args = PqueryFormArgs(
        corpname=amodel.corp.corpname,
        attr=amodel.get_default_attr(),
        position='0<0~0>0')
    amodel._curr_pquery_args.update_by_user_query(req.json)
    conc_forms, raw_queries = await amodel.load_conc_queries(
        amodel._curr_pquery_args.conc_ids, amodel.args.corpname, 'query')
    if amodel._curr_pquery_args.conc_subset_complements:
        conc_forms2, raw_queries2 = await amodel.load_conc_queries(
            amodel._curr_pquery_args.conc_subset_complements.conc_ids, amodel.args.corpname, 'query')
        raw_queries.update(raw_queries2)
    if amodel._curr_pquery_args.conc_superset:
        conc_forms3, raw_queries3 = await amodel.load_conc_queries(
            [amodel._curr_pquery_args.conc_superset.conc_id], amodel.args.corpname, 'query')
        raw_queries.update(raw_queries3)

    calc_args = (
        amodel._curr_pquery_args,
        raw_queries,
        amodel.subcpath,
        amodel.session_get('user', 'id'),
        corp_info.collator_locale if corp_info.collator_locale else 'en_US')
    task_status = await worker.send_task(
        'calc_merged_freqs', object.__class__, args=calc_args, time_limit=amodel.TASK_TIME_LIMIT)
    sq_items = []
    for conc_id in amodel._curr_pquery_args.conc_ids:
        sq_items.append(conc_forms[conc_id]['curr_queries'][amodel.args.corpname])
    shortened_q = ' && '.join(f'{{{q}}}' for q in sq_items)
    shortened_q = f'{shortened_q} -> {amodel._curr_pquery_args.attr}'

    def on_query_store(query_ids, history_ts, result):
        async_task = AsyncTaskStatus(
            status=task_status.status, ident=task_status.id,
            category=AsyncTaskStatus.CATEGORY_PQUERY,
            label=shortened_q,
            args=dict(query_id=query_ids[0], last_update=time.time()),
            url=req.create_url('pquery/result', dict(q=f'~{query_ids[0]}')))
        amodel.store_async_task(async_task)
        result['task'] = async_task.to_dict()
        if history_ts:
            amodel.store_last_search('pquery', query_ids[0])

    amodel.on_query_store(on_query_store)
    return {}


@bp.route('/get_results')
@http_action(return_type='json', action_model=ParadigmaticQueryActionModel)
async def get_results(amodel: ParadigmaticQueryActionModel, req: KRequest, resp: KResponse):
    page_id = int(req.args.get('page')) - 1
    sort = req.args.get('sort')
    reverse = bool(int(req.args.get('reverse')))
    offset = page_id * amodel.args.pqueryitemsperpage
    corp_info = await amodel.get_corpus_info(amodel.args.corpname)
    try:
        total_num_lines, freqs = await require_existing_pquery(
            amodel._curr_pquery_args, offset, amodel.args.pqueryitemsperpage, corp_info.collator_locale, sort, reverse)
    except PqueryResultNotFound:
        raise NotFoundException('pquery__result_no_more_avail_for_download_pls_update')
    return dict(rows=freqs)


@dataclass
class SavePQueryArgs:
    from_line: int = 1
    to_line: Optional[int] = None
    saveformat: str = ''
    reverse: bool = False
    sort: str = 'value'
    heading: bool = False
    colheaders: bool = False


@bp.route('/download')
@http_action(access_level=1, return_type='plain', action_model=ParadigmaticQueryActionModel, mapped_args=SavePQueryArgs)
async def download(amodel: ParadigmaticQueryActionModel, req: KRequest[SavePQueryArgs], resp: KResponse):
    """
    dawnload a paradigmatic query results
    """
    from_line = req.mapped_args.from_line - 1
    to_line = req.mapped_args.to_line if req.mapped_args.to_line else sys.maxsize
    corp_info = await amodel.get_corpus_info(amodel.args.corpname)
    try:
        _, freqs = await require_existing_pquery(
            amodel._curr_pquery_args, from_line, to_line - from_line,
            corp_info.collator_locale, req.mapped_args.sort, req.mapped_args.reverse)
    except PqueryResultNotFound:
        raise NotFoundException('pquery__result_no_more_avail_for_download_pls_update')

    def mkfilename(suffix): return f'{amodel.args.corpname}-pquery.{suffix}'
    with plugins.runtime.EXPORT as export:
        writer = export.load_plugin(req.mapped_args.saveformat, req.translate)

        resp.set_header('Content-Type', writer.content_type())
        resp.set_header('Content-Disposition',
                        f'attachment; filename="{mkfilename(req.mapped_args.saveformat)}"')

        await writer.write_pquery(amodel, freqs, req.mapped_args)
        output = writer.raw_content()

    return output
