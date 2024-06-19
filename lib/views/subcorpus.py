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
import math
import os
from dataclasses import asdict, dataclass
from typing import Any, Dict, List

import l10n
import plugins
import settings
from action.argmapping import log_mapping
from action.argmapping.action import IntOpt
from action.control import http_action
from action.errors import UserReadableException
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.model.subcorpus import SubcorpusActionModel, SubcorpusError
from action.model.user import UserActionModel
from action.response import KResponse
from bgcalc.task import AsyncTaskStatus
from corplib.abstract import SubcorpusIdent
from corplib.errors import CorpusInstantiationError
from corplib.subcorpus import KSubcorpus, SubcorpusRecord
from main_menu.model import MainMenu
from plugin_types.subc_storage import (
    AbstractSubcArchive, SubcListFilterArgs, SubcListFilterClientArgs)
from sanic import Blueprint

bp = Blueprint('subcorpus', url_prefix='subcorpus')


@bp.route('/properties')
@http_action(
    access_level=2, return_type='json', action_model=CorpusActionModel)
async def properties(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    corp_ident = amodel.corp.portable_ident
    struct_and_attrs = await amodel.get_structs_and_attrs()
    with plugins.runtime.SUBC_STORAGE as sr:
        info = await sr.get_info(corp_ident.id)
    live_attrs_enabled = False
    with plugins.runtime.LIVE_ATTRIBUTES as la:
        live_attrs_enabled = info.text_types is not None and await la.is_enabled_for(amodel.plugin_ctx, [corp_ident.corpus_name])

    availableAligned = []
    for al in amodel.get_available_aligned_corpora()[1:]:
        alcorp = await amodel.cf.get_corpus(al)
        availableAligned.append(dict(label=alcorp.get_conf('NAME') or al, n=al))

    return {
        'data': info.to_dict(),
        'textTypes': await amodel.tt.export_with_norms(),
        'structsAndAttrs': {k: [x.to_dict() for x in item] for k, item in struct_and_attrs.items()},
        'liveAttrsEnabled': live_attrs_enabled,
        'availableAligned': availableAligned,
    }


@bp.route('/create', ['POST'])
@http_action(
    access_level=2, return_type='json', action_log_mapper=log_mapping.new_subcorpus, action_model=SubcorpusActionModel)
async def create(amodel: SubcorpusActionModel, req: KRequest, resp: KResponse):
    try:
        return await amodel.create_subcorpus()
    except (SubcorpusError, RuntimeError) as e:
        raise UserReadableException(str(e)) from e


@bp.route('/create_draft', ['POST'])
@http_action(
    access_level=2, return_type='json', action_model=SubcorpusActionModel)
async def create_draft(amodel: SubcorpusActionModel, req: KRequest, resp: KResponse):
    try:
        return await amodel.create_subcorpus_draft()
    except (SubcorpusError, RuntimeError) as e:
        raise UserReadableException(str(e)) from e


@bp.route('/new')
@http_action(access_level=2, template='subcorpus/new.html', page_model='subcorpForm', action_model=CorpusActionModel)
async def new(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    """
    Displays a form to create a new subcorpus
    """
    amodel.disabled_menu_items = amodel.CONCORDANCE_ACTIONS + (MainMenu.VIEW, )
    method = req.form.get('method', 'gui')
    subcnorm = req.args.get('subcnorm', 'tokens')

    try:
        tt_sel = await amodel.tt.export_with_norms(subcnorm=subcnorm)
    except UserReadableException as e:
        tt_sel = {'Normslist': [], 'Blocks': []}
        resp.add_system_message('warning', e)

    out = dict(SubcorpList=(), subcorpus_name=None, subcorpus_desc=None,
               selected_text_types={}, within_cond=None)
    await amodel.attach_aligned_query_params(out)
    corpus_info = await amodel.get_corpus_info(amodel.args.corpname)
    if isinstance(amodel.corp, KSubcorpus):
        if not amodel.corp.is_draft:
            raise UserReadableException('Cannot edit finished subcorpus', 400)
        with plugins.runtime.SUBC_STORAGE as sr:
            info = await sr.get_info(amodel.corp.subcorpus_id)
        out.update(dict(
            selected_text_types=info.text_types,
            within_cond=info.within_cond,
            subcorpus_name=amodel.corp.subcorpus_name,
            subcorpus_desc=info.public_description_raw
        ))
        # draft subcorpus should not be projected to main menu links...
        out['usesubcorp'] = None
        out['aligned_corpora'] = info.aligned
    else:
        out['aligned_corpora'] = amodel.args.align
    out.update(dict(
        Normslist=tt_sel['Normslist'],
        text_types_data=tt_sel,
        method=method,
        id_attr=corpus_info.metadata.id_attr,
    ))
    return out


@bp.route('/archive', ['POST'])
@http_action(access_level=2, return_type='json', action_model=UserActionModel)
async def archive(amodel: UserActionModel, req: KRequest, resp: KResponse):
    ans = []
    for item in req.json['items']:
        with plugins.runtime.SUBC_STORAGE(AbstractSubcArchive) as sr:
            dt = await sr.archive(amodel.plugin_ctx.user_id, item['corpname'], item['subcname'])
        ans.append({'archived': dt.timestamp(),
                    'subcname': item['subcname'], 'corpname': item['corpname']})
    return {'archived': ans}


@bp.route('/restore', ['POST'])
@http_action(access_level=2, return_type='json', action_model=CorpusActionModel)
async def restore(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    corp_ident = amodel.corp.portable_ident
    if isinstance(corp_ident, SubcorpusIdent):
        with plugins.runtime.SUBC_STORAGE(AbstractSubcArchive) as sr:
            await sr.restore(amodel.plugin_ctx.user_id, corp_ident.corpus_name, corp_ident.id)

    return {}


async def _filter_subcorpora(amodel: UserActionModel, req: KRequest, ignore_no_subc_corpus: bool = True):
    active_only = False if bool(int(req.args.get('show_archived', 0))) else True
    page = int(req.args.get('page', 1))
    pagesize = int(req.args.get('pagesize', amodel.args.subcpagesize))
    corpus_name = None if req.args.get('corpname') == '' else req.args.get('corpname')
    filter_args = SubcListFilterArgs(
        active_only=active_only,
        archived_only=False,
        pattern=req.args.get('pattern'))

    full_list: List[SubcorpusRecord] = []
    with plugins.runtime.SUBC_STORAGE(AbstractSubcArchive) as sr:
        related_corpora = await sr.list_corpora(amodel.plugin_ctx.user_id)
        if related_corpora:
            # if no data for specified corpus and backup enabled, change to None corpus
            if not ignore_no_subc_corpus and corpus_name is not None and corpus_name not in related_corpora:
                corpus_name = None

            if corpus_name is None or corpus_name in related_corpora:
                full_list = await sr.list(amodel.plugin_ctx.user_id, filter_args, corpname=corpus_name, include_drafts=True)

    sort = req.args.get('sort', '-created')
    sort_key, rev = amodel.parse_sorting_param(sort)
    total_pages = 1
    if full_list:
        if sort_key in ('size', 'created'):
            full_list = sorted(full_list, key=lambda x: getattr(x, sort_key), reverse=rev)
        else:
            full_list = l10n.sort(full_list, loc=req.ui_lang,
                                  key=lambda x: getattr(x, sort_key), reverse=rev)

        total_pages = math.ceil(len(full_list) / pagesize)
        full_list = full_list[(page - 1) * pagesize:page * pagesize]

    client_filter_args = SubcListFilterClientArgs(
        active_only=active_only,
        archived_only=False,
        pattern=req.args.get('pattern', ''),
        corpname='' if corpus_name is None else corpus_name,
        page=IntOpt(page),
        pagesize=IntOpt(pagesize))
    return dict(
        SubcorpList=[],   # this is used by subcorpus SELECT element; no need for that here
        subcorp_list=[x.to_dict() for x in full_list],
        sort_key=dict(name=sort_key, reverse=rev),
        filter=asdict(client_filter_args),
        processed_subc=[
            v.to_dict()
            for v in (await amodel.get_async_tasks(category=AsyncTaskStatus.CATEGORY_SUBCORPUS))
        ],
        related_corpora=related_corpora,
        total_pages=total_pages,
    )


@bp.route('/list')
@http_action(access_level=2, template='subcorpus/list.html', page_model='subcorpList', action_model=UserActionModel)
async def list_subcorpora(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    amodel.disabled_menu_items = (
        MainMenu.VIEW('kwic-sent-switch'),
        MainMenu.VIEW('structs-attrs'),
        MainMenu.FILTER, MainMenu.FREQUENCY,
        MainMenu.COLLOCATIONS,
        MainMenu.SAVE, MainMenu.CONCORDANCE)

    ans = await _filter_subcorpora(amodel, req, False)
    ans['uses_live_attrs'] = plugins.runtime.LIVE_ATTRIBUTES.exists
    return ans


@bp.route('/ajax_list')
@http_action(access_level=2, return_type='json', action_model=UserActionModel)
async def ajax_list_subcorpora(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    """
    Used for updating subcorpora page information.
    """
    return await _filter_subcorpora(amodel, req)


@bp.route('/delete', ['POST'])
@http_action(access_level=2, return_type='json', action_model=UserActionModel)
async def delete(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    num_wiped = 0
    with plugins.runtime.SUBC_STORAGE as sr, plugins.runtime.USER_ITEMS as ui:
        user_items = {x.subcorpus_id: x.ident for x in (await ui.get_user_items(amodel.plugin_ctx))}
        for item in req.json['items']:
            await sr.delete_query(amodel.session_get('user', 'id'), item['corpname'], item['subcname'])
            try:
                subc = await amodel.cf.get_corpus(await sr.get_info(item['subcname']))
                os.unlink(os.path.join(settings.get('corpora', 'subcorpora_dir'),
                                       subc.portable_ident.data_path))
                if item['subcname'] in user_items:
                    await ui.delete_user_item(amodel.plugin_ctx, user_items[item['subcname']])
            except (CorpusInstantiationError, IOError) as e:
                logging.getLogger(__name__).warning(e)

            num_wiped += 1
    return {'num_wiped': num_wiped}


@bp.route('/update_name_and_public_desc', ['POST'])
@http_action(access_level=2, return_type='json', action_model=CorpusActionModel)
async def update_name_and_public_desc(amodel: CorpusActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    with plugins.runtime.SUBC_STORAGE as sa:
        preview_only = req.args.get('preview-only') == '1'
        preview = await sa.update_name_and_description(
            amodel.session_get('user', 'id'), amodel.corp.subcorpus_id, req.form.get('subcname'), req.form.get('description'), preview_only)
    return dict(preview=preview, saved=not preview_only)


@dataclass
class PublicListArgs(SubcListFilterArgs):
    offset: IntOpt = 0
    limit: IntOpt = 20
    published_only: IntOpt = 1


@bp.route('/list_published')
@http_action(
    template='subcorpus/list_published.html', page_model='pubSubcorpList', action_model=UserActionModel,
    mapped_args=PublicListArgs)
async def list_published(amodel: UserActionModel, req: KRequest[PublicListArgs], resp: KResponse) -> Dict[str, Any]:
    amodel.disabled_menu_items = (
        MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
    min_query_size = 3
    with plugins.runtime.SUBC_STORAGE as sr:
        if not req.mapped_args.ia_query or len(req.mapped_args.ia_query) < 3:
            items = []
        else:
            items = await sr.list(None, req.mapped_args, None, req.mapped_args.offset, req.mapped_args.limit)
    return dict(data=[v.to_dict() for v in items], min_query_size=min_query_size)
