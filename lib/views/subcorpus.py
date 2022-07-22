# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
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
import os
from dataclasses import asdict
from typing import Any, Dict

import l10n
import plugins
from action.argmapping import log_mapping
from action.decorators import http_action
from action.errors import UserActionException
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.model.subcorpus import SubcorpusActionModel, SubcorpusError
from action.model.user import UserActionModel
from action.response import KResponse
from bgcalc.task import AsyncTaskStatus
from corplib.corpus import list_public_subcorpora
from main_menu.model import MainMenu
from plugin_types.subc_restore import AbstractSubcArchive, SubcListFilterArgs
from sanic import Blueprint
from texttypes.model import TextTypeCollector

bp = Blueprint('subcorpus', url_prefix='subcorpus')


@bp.route('/properties')
@http_action(
    access_level=1, return_type='json', page_model='subcorpList', action_model=SubcorpusActionModel)
async def properties(amodel: SubcorpusActionModel, req: KRequest, resp: KResponse):
    struct_and_attrs = await amodel.get_structs_and_attrs()
    data = {
        'corpname': amodel.corp.corpname,
        'subcname': amodel.corp.subcorpus_id,
        'size': amodel.corp.size
    }

    with plugins.runtime.SUBC_RESTORE as sr:
        info = await sr.get_info(amodel.plugin_ctx.user_id, amodel.corp.corpname, amodel.corp.subcorpus_id)
        if info:
            data['created'] = info.created.isoformat()
            if info.text_types is not None:
                data['selections'] = info.text_types
            elif info.within_cond is not None:
                data['selections'] = info.within_cond
            elif info.cql is not None:
                data['selections'] = info.cql

    liveAttrsEnabled = False
    with plugins.runtime.LIVE_ATTRIBUTES as la:
        liveAttrsEnabled = 'selections' in data and info.text_types is not None and await la.is_enabled_for(amodel.plugin_ctx, [amodel.corp.corpname])

    if 'created' not in data and amodel.corp.created:
        data['created'] = amodel.corp.created.isoformat()
    if amodel.corp.description:
        data['description'] = amodel.corp.description

    return {
        'data': data,
        'textTypes': await amodel.tt.export_with_norms(),
        'structsAndAttrs': {k: [x.to_dict() for x in item] for k, item in struct_and_attrs.items()},
        'liveAttrsEnabled': liveAttrsEnabled,
    }


@bp.route('/create', ['POST'])
@http_action(
    access_level=1, return_type='json', action_log_mapper=log_mapping.new_subcorpus, action_model=SubcorpusActionModel)
async def create(amodel: SubcorpusActionModel, req: KRequest, resp: KResponse):
    try:
        return await amodel.create_subcorpus()
    except (SubcorpusError, RuntimeError) as e:
        raise UserActionException(str(e)) from e


@bp.route('/new')
@http_action(access_level=1, template='subcorpus/new.html', page_model='subcorpForm', action_model=CorpusActionModel)
async def new(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    """
    Displays a form to create a new subcorpus
    """
    amodel.disabled_menu_items = amodel.CONCORDANCE_ACTIONS + (MainMenu.VIEW, )
    method = req.form.get('method', 'gui')
    subcname = req.form.get('subcname', None)
    subcnorm = req.args.get('subcnorm', 'tokens')

    try:
        tt_sel = await amodel.tt.export_with_norms(subcnorm=subcnorm)
    except UserActionException as e:
        tt_sel = {'Normslist': [], 'Blocks': []}
        resp.add_system_message('warning', e)

    out = dict(SubcorpList=())
    await amodel.attach_aligned_query_params(out)
    corpus_info = await amodel.get_corpus_info(amodel.args.corpname)

    out.update(dict(
        Normslist=tt_sel['Normslist'],
        text_types_data=tt_sel,
        selected_text_types=TextTypeCollector(amodel.corp, req).get_attrmap(),
        method=method,
        subcnorm=subcnorm,
        id_attr=corpus_info.metadata.id_attr,
        subcname=subcname,
        aligned_corpora=req.form_getlist('aligned_corpora')
    ))
    return out


@bp.route('/ajax_create_subcorpus', ['POST'])
@http_action(access_level=1, return_type='json', action_model=SubcorpusActionModel)
async def ajax_create_subcorpus(amodel: SubcorpusActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    return await amodel.create_subcorpus()


@bp.route('/delete', ['POST'])
@http_action(access_level=1, return_type='json', action_model=CorpusActionModel)
async def delete(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    if amodel.corp.spath:
        try:
            os.unlink(amodel.corp.spath)
        except IOError as e:
            logging.getLogger(__name__).warning(e)
    return {}


@bp.route('/list')
@http_action(access_level=1, template='subcorpus/list.html', page_model='subcorpList', action_model=UserActionModel)
async def list(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    """
    Displays a list of user subcorpora. In case there is a 'subc_restore' plug-in
    installed then the list is enriched by additional re-use/undelete information.
    """
    amodel.disabled_menu_items = (
        MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)

    involved_corpora = []
    # TODO show deleted, etc
    # filter_args = dict(show_deleted=bool(int(req.args.get('show_deleted', 0))),
    #                   corpname=req.args.get('corpname'))
    filter_args = SubcListFilterArgs(corpus=req.args.get('corpname'))

    with plugins.runtime.SUBC_RESTORE(AbstractSubcArchive) as sr:
        try:
            full_list = await sr.list(amodel.plugin_ctx.user_id, filter_args)
        except Exception as e:
            logging.getLogger(__name__).error(
                'subc_restore plug-in failed to list queries: %s' % e)

    sort = req.args.get('sort', '-created')
    sort_key, rev = amodel.parse_sorting_param(sort)
    if sort_key in ('size', 'created'):
        full_list = sorted(full_list, key=lambda x: getattr(x, sort_key), reverse=rev)
    else:
        full_list = l10n.sort(full_list, loc=req.ui_lang,
                              key=lambda x: getattr(x, sort_key), reverse=rev)

    if filter_args.corpus is None:
        filter_args.corpus = ''  # JS code requires non-null value

    ans = dict(
        SubcorpList=[],   # this is used by subcorpus SELECT element; no need for that here
        subcorp_list=[x.to_dict() for x in full_list],
        sort_key=dict(name=sort_key, reverse=rev),
        filter=asdict(filter_args),
        processed_subc=[
            v.to_dict()
            for v in amodel.get_async_tasks(category=AsyncTaskStatus.CATEGORY_SUBCORPUS)
        ],
        related_corpora=sorted(involved_corpora),
        uses_subc_restore=plugins.runtime.SUBC_RESTORE.exists,
        uses_live_attrs=plugins.runtime.LIVE_ATTRIBUTES.exists,
    )
    return ans


@bp.route('/ajax_wipe_subcorpus', ['POST'])
@http_action(access_level=1, return_type='json', action_model=UserActionModel)
async def ajax_wipe_subcorpus(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    if plugins.runtime.SUBC_RESTORE.exists:
        corpus_id = req.form.get('corpname')
        subcorp_name = req.form.get('subcname')
        with plugins.runtime.SUBC_RESTORE as sr:
            await sr.delete_query(amodel.session_get('user', 'id'), corpus_id, subcorp_name)
        resp.add_system_message(
            'info',
            req.translate(f'Subcorpus {subcorp_name} has been deleted permanently.')
        )
    else:
        resp.add_system_message(
            'error',
            req.translate('Unsupported operation (plug-in not present)')
        )
    return {}


@bp.route('/update_public_desc', ['POST'])
@http_action(access_level=1, return_type='json', action_model=CorpusActionModel)
async def update_public_desc(amodel: CorpusActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    await amodel.corp.save_subc_description(req.form.get('description'))
    return {}


@bp.route('/list_published')
@http_action(template='subcorpus/list_published.html', page_model='pubSubcorpList', action_model=UserActionModel)
async def list_published(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    amodel.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                  MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)

    min_query_size = 3
    query = req.args.get('query', '')
    offset = int(req.args.get('offset', '0'))
    limit = int(req.args.get('limit', '20'))
    if len(query) >= min_query_size:
        subclist = await list_public_subcorpora(
            amodel.subcpath[-1], value_prefix=query, offset=offset, limit=limit)
    else:
        subclist = []
    return dict(data=subclist, min_query_size=min_query_size)
