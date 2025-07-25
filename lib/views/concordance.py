# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Department of Linguistics
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


import collections
import logging
import os
import re
import time
from dataclasses import asdict, dataclass
from typing import Any, Callable, Dict, List, Optional, Union

import conclib
import corplib
import mailing
import plugins
import settings
import ujson as json
from action.argmapping import ConcArgsMapping, WidectxArgsMapping, log_mapping
from action.argmapping.action import IntOpt, StrOpt
from action.argmapping.analytics import (
    CollFormArgs, CTFreqFormArgs, FreqFormArgs)
from action.argmapping.conc import (
    QueryFormArgs, ShuffleFormArgs, build_conc_form_args, decode_raw_query)
from action.argmapping.conc.filter import (
    FilterFormArgs, FirstHitsFilterFormArgs, QuickFilterArgsConv,
    SubHitsFilterFormArgs)
from action.argmapping.conc.other import (
    KwicSwitchArgs, LgroupOpArgs, LockedOpFormsArgs, SampleFormArgs)
from action.argmapping.conc.sort import SortFormArgs
from action.control import http_action
from action.errors import (
    ImmediateRedirectException, NotFoundException, UnavailableForLegalReasons,
    UserReadableException)
from action.krequest import KRequest
from action.model.base import BaseActionModel
from action.model.concordance import ConcActionModel
from action.model.concordance.linesel import LinesGroups
from action.model.corpus import CorpusActionModel
from action.model.user import UserActionModel
from action.response import KResponse, bytes_stream
from action.result.concordance import QueryAction
from bgcalc import calc_backend_client
from bgcalc.errors import CalcTaskNotFoundError
from conclib.calc import cancel_conc_task
from conclib.empty import InitialConc
from conclib.errors import (
    ConcordanceException, ConcordanceQueryParamsError,
    ConcordanceSpecificationError, UnknownConcordanceAction,
    ConcordanceQuerySyntaxError, extract_manatee_error)
from conclib.freq import one_level_crit
from conclib.search import get_conc
from corplib.abstract import SubcorpusIdent
from corplib.corpus import AbstractKCorpus
from corplib.subcorpus import TextTypesType
from kwiclib import Kwic, KwicPageArgs
from main_menu import MainMenu, generate_main_menu
from plugin_types.conc_cache import ConcCacheStatusException
from plugin_types.query_persistence.error import QueryPersistenceRecNotFound
from sanic import Blueprint
from texttypes.model import TextTypeCollector

bp = Blueprint('concordance')


MAX_SINGLE_CHUNK_SAVE_CONC_SIZE = 10000
SAVE_CONC_CHUNK_SIZE = 2000



@bp.route('/first_form')
@http_action(action_model=BaseActionModel)
async def first_form(_, req: KRequest, resp: KResponse):
    resp.redirect(req.create_url('query', req.args), code=301)


@bp.route('/query')
@http_action(template='query.html', page_model=QueryAction, action_model=ConcActionModel)
async def query(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    amodel.disabled_menu_items = (
        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
        MainMenu.VIEW('kwic-sent-switch'))
    out = {'aligned_corpora': amodel.args.align}
    tt_data = await amodel.tt.export_with_norms(ret_nums=True)
    out['Normslist'] = tt_data['Normslist']
    out['text_types_data'] = tt_data

    corp_info = await amodel.get_corpus_info(amodel.args.corpname)
    out['text_types_notes'] = corp_info.metadata.desc
    out['default_virt_keyboard'] = corp_info.metadata.default_virt_keyboard

    out['subcorp_tt_structure'] = None
    out['subcorp_aligned'] = []
    corp_ident = amodel.corp.portable_ident
    if isinstance(corp_ident, SubcorpusIdent):
        with plugins.runtime.SUBC_STORAGE as sr:
            info = await sr.get_info(corp_ident.id)
            out['subcorp_aligned'] = info.aligned
            if set(info.aligned) != set(amodel.args.align):
                args = dict(req.args)
                args['align'] = info.aligned
                raise ImmediateRedirectException(
                    req.updated_current_url(dict(align=info.aligned))
                )
            if info.text_types:
                out['subcorp_tt_structure'] = info.text_types

    qf_args = await amodel.fetch_prev_query('conc') if amodel.active_q_data is None else None
    if qf_args is None:
        qf_args = await QueryFormArgs.create(
            plugin_ctx=amodel.plugin_ctx,
            corpora=[amodel.args.corpname] + amodel.args.align,
            persist=False)
    amodel.set_curr_conc_form_args(qf_args)
    await amodel.export_query_forms(out)
    await amodel.attach_aligned_query_params(out)
    await amodel.export_subcorpora_list(out)
    resp.set_result(out)


@bp.route('/query_submit', methods=['POST'])
@http_action(
    mutates_result=True,
    action_log_mapper=log_mapping.mk_query_submit(
        settings.get_bool('logging', 'log_queries', False)),
    return_type='json',
    action_model=ConcActionModel)
async def query_submit(amodel: ConcActionModel, req: KRequest, resp: KResponse):

    async def store_last_op(conc_ids: List[str], history_ts: Optional[int], _):
        if history_ts:
            amodel.store_last_search('conc', conc_ids[0])

    amodel.clear_prev_conc_params()
    ans = {}
    # 1) store query forms arguments for later reuse on client-side
    corpora = amodel.select_current_aligned_corpora(active_only=True)
    corpus_info = await amodel.get_corpus_info(corpora[0])
    qinfo = await QueryFormArgs.create(plugin_ctx=amodel.plugin_ctx, corpora=corpora, persist=True)
    qinfo.update_by_user_query(
        req.json, await amodel.get_tt_bib_mapping(req.json.get('text_types', {})))
    amodel.set_curr_conc_form_args(qinfo)
    # 2) process the query
    try:
        await amodel.set_first_query(
            [q['corpname'] for q in req.json['queries']], qinfo, corpus_info)
        if qinfo.data.shuffle and 'f' not in amodel.args.q:
            amodel.args.q.append('f')
            amodel.acknowledge_auto_generated_conc_op(
                len(amodel.args.q) - 1, ShuffleFormArgs(persist=True))
        if int(qinfo.data.shuffle) != amodel.args.shuffle:
            amodel.args.shuffle = int(qinfo.data.shuffle)
            await amodel.save_options(['shuffle'])
        logging.getLogger(__name__).debug('query: {}'.format(amodel.args.q))
        conc = await get_conc(
            corp=amodel.corp, user_id=amodel.session_get('user', 'id'), q=amodel.args.q,
            fromp=amodel.args.fromp, pagesize=amodel.args.pagesize, asnc=qinfo.data.asnc,
            cutoff=qinfo.data.cutoff)
        ans['size'] = conc.size()
        ans['finished'] = conc.finished()
        amodel.on_query_store(store_last_op)
        resp.set_http_status(201)
    except ConcordanceQuerySyntaxError as ex:
        # we want queries with syntax errors to be saved, so we suppress
        # the error a bit to make amodel.post_dispatch do its work
        ans['size'] = 0
        ans['finished'] = True
        resp.add_system_message('error', str(ex))
    except (ConcordanceException, ConcCacheStatusException) as ex:
        ans['size'] = 0
        ans['finished'] = True
        if isinstance(ex, ConcordanceSpecificationError):
            raise UserReadableException(ex, code=422)
        else:
            raise ex
    ans['conc_args'] = amodel.get_mapped_attrs(ConcArgsMapping)
    ans['conc_args']['cutoff'] = amodel.args.cutoff
    url = req.create_url('view', ans['conc_args'])
    resp.set_header('Location', url)
    return ans


async def _get_conc_cache_status(amodel: ConcActionModel):
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(amodel.corp)
    q = tuple(amodel.args.q)
    corp_cache_key = amodel.corp.cache_key
    corpus_info = await amodel.get_corpus_info(amodel.corp.corpname)

    try:
        cache_status = await cache_map.get_calc_status(corp_cache_key, q, amodel.args.cutoff)
        if cache_status is None:  # conc is not cached nor calculated
            raise NotFoundException('Concordance calculation is lost')
        elif not cache_status.finished and cache_status.task_id:
            # we must also test directly a respective task as it might have been killed
            # and thus failed to store info to cache metadata
            worker = calc_backend_client(settings)
            err = worker.get_task_error(cache_status.task_id)
            if err is not None:
                raise err
        elif cache_status.normalized_error is not None:
            raise cache_status.normalized_error
        return dict(
            finished=cache_status.finished,
            concsize=cache_status.concsize,
            fullsize=cache_status.fullsize,
            relconcsize=cache_status.relconcsize,
            arf=cache_status.arf)
    except CalcTaskNotFoundError as ex:
        await cancel_conc_task(cache_map, corp_cache_key, q, amodel.args.cutoff)
        raise NotFoundException(f'Concordance calculation is lost: {ex}')
    except Exception as ex:
        await cancel_conc_task(cache_map, corp_cache_key, q, amodel.args.cutoff)
        raise ex


@bp.route('/get_conc_cache_status')
@http_action(return_type='json', action_model=ConcActionModel)
async def get_conc_cache_status(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    return await _get_conc_cache_status(amodel)


async def view_conc(
        amodel: ConcActionModel, req: KRequest, resp: KResponse, asnc: int, user_id: int, disable_auclp=False):
    """
    Args:
        amodel:
        req:
        resp:
        asnc:
        user_id:
        disable_auclp: specifies whether the "please sign in to see more features" pop-up should
                       be disabled - no matter what says user auth. status or application config.
                       I.e. setting this to true turns the pop-up off.
    Returns:

    """
    corpus_info = await amodel.get_corpus_info(amodel.args.corpname)
    ml_position_filters = {}
    if corpus_info.part_of_ml_corpus:
        ml_position_filters = {amodel.args.corpname: corpus_info.ml_position_filter}
        for align in amodel.args.align:
            align_info = await amodel.get_corpus_info(align)
            if align_info.part_of_ml_corpus:
                ml_position_filters[align] = corpus_info.ml_position_filter

    if amodel.args.fromp < 1:
        raise UserReadableException(req.translate('Invalid page number'))
    if amodel.args.pagesize < 1:
        raise UserReadableException('Invalid page size')

    amodel.apply_viewmode(corpus_info.sentence_struct)

    i = 0
    while i < len(amodel.args.q):
        if amodel.args.q[i].startswith('s*') or amodel.args.q[i][0] == 'e':
            del amodel.args.q[i]
        i += 1
    out = amodel.create_empty_conc_result_dict()
    out['result_shuffled'] = not conclib.conc_is_sorted(amodel.args.q)
    out['items_per_page'] = amodel.args.pagesize

    conc = InitialConc(amodel.corp, None)
    try:
        conc = await get_conc(
            corp=amodel.corp, user_id=user_id, q=amodel.args.q,
            fromp=amodel.args.fromp, pagesize=amodel.args.pagesize, asnc=asnc,
            cutoff=amodel.args.cutoff)
        if conc:
            amodel.apply_linegroups(conc)
            conc.switch_aligned(os.path.basename(amodel.args.corpname))

            kwic_args = KwicPageArgs(asdict(amodel.args), base_attr=amodel.BASE_ATTR)
            kwic_args.speech_attr = await amodel.get_speech_segment()
            kwic_args.labelmap = {}
            kwic_args.alignlist = [(await amodel.cf.get_corpus(c)) for c in amodel.args.align if c]
            kwic_args.structs = amodel.get_struct_opts()
            kwic_args.ml_position_filters = ml_position_filters
            with plugins.runtime.TOKENS_LINKING as tl:
                kwic_args.internal_attrs = await tl.get_required_attrs(
                    amodel.plugin_ctx, corpus_info.tokens_linking.providers,
                    [amodel.args.corpname] + amodel.args.align)

            kwic = Kwic(amodel.corp, conc)

            out['Sort_idx'] = kwic.get_sort_idx(q=amodel.args.q, pagesize=amodel.args.pagesize)
            out.update(asdict(kwic.kwicpage(kwic_args)))
            out.update(await amodel.get_conc_sizes(conc))
    except UnknownConcordanceAction as ex:
        raise UserReadableException(str(ex))
    except TypeError as ex:
        resp.add_system_message('error', str(ex))
        logging.getLogger(__name__).error(ex)
    except (ConcordanceException, RuntimeError) as ex:
        manatee_error = extract_manatee_error(ex)
        if isinstance(manatee_error, ConcordanceSpecificationError):
            raise UserReadableException(manatee_error, code=422)
        else:
            raise ex

    if amodel.corp.get_conf('ALIGNED'):
        out['Aligned'] = [
            {'n': w, 'label': (await amodel.cf.get_corpus(w)).human_readable_corpname}
            for w in amodel.corp.get_conf('ALIGNED').split(',')]
    if amodel.args.align and not amodel.args.maincorp:
        amodel.args.maincorp = amodel.args.corpname
    if conc.size() == 0 and conc.finished():
        msg = req.translate(
            'No result. Please make sure the query and selected query type are correct.')
        resp.add_system_message('info', msg)

    amodel.add_save_menu_item(
        'CSV', save_format='csv',
        hint=req.translate('Saves at most {0} items. Use "Custom" for more options.').format(
            amodel.CONC_QUICK_SAVE_MAX_LINES))
    amodel.add_save_menu_item(
        'XLSX', save_format='xlsx',
        hint=req.translate('Saves at most {0} items. Use "Custom" for more options.').format(
            amodel.CONC_QUICK_SAVE_MAX_LINES))
    amodel.add_save_menu_item(
        'XML', save_format='xml',
        hint=req.translate('Saves at most {0} items. Use "Custom" for more options.').format(
            amodel.CONC_QUICK_SAVE_MAX_LINES))
    amodel.add_save_menu_item(
        'TXT', save_format='txt',
        hint=req.translate('Saves at most {0} items. Use "Custom" for more options.').format(
            amodel.CONC_QUICK_SAVE_MAX_LINES))
    amodel.add_save_menu_item(req.translate('Custom'))

    # unlike 'globals' 'widectx_globals' stores full structs+structattrs information
    # to be able to display extended context with all set structural attributes
    out['widectx_globals'] = amodel.get_mapped_attrs(
        WidectxArgsMapping, dict(structs=amodel.get_struct_opts()))
    out['conc_line_max_group_num'] = settings.get_int('global', 'conc_line_max_group_num', 99)
    out['aligned_corpora'] = amodel.args.align
    out['line_numbers'] = amodel.args.line_numbers if amodel.args.line_numbers else False
    out['speech_segment'] = await amodel.get_speech_segment()
    out['speaker_id_attr'] = corpus_info.speaker_id_attr.split(
        '.') if corpus_info.speaker_id_attr else None
    out['speech_overlap_attr'] = corpus_info.speech_overlap_attr.split(
        '.') if corpus_info.speech_overlap_attr else None
    out['speech_overlap_val'] = corpus_info.speech_overlap_val
    out['conc_use_safe_font'] = corpus_info.use_safe_font
    speaker_struct = corpus_info.speaker_id_attr.split(
        '.')[0] if corpus_info.speaker_id_attr else None
    out['speech_attrs'] = [x[1] for x in [x for x in [
        x.split('.') for x in amodel.corp.get_structattrs()] if x[0] == speaker_struct]]
    out['struct_ctx'] = amodel.corp.get_conf('STRUCTCTX')

    # query form data
    out['text_types_data'] = await amodel.tt.export_with_norms(ret_nums=True)
    out['coll_form_args'] = CollFormArgs().update(amodel.args).to_dict()
    out['freq_form_args'] = FreqFormArgs().update(amodel.args).to_dict()
    out['ctfreq_form_args'] = CTFreqFormArgs().update(amodel.args).to_dict()
    await amodel.export_subcorpora_list(out)
    await amodel.export_query_forms(out)

    out['fast_adhoc_ipm'] = await plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(
        amodel.plugin_ctx, [amodel.args.corpname] + amodel.args.align)
    out['chart_export_formats'] = []
    with plugins.runtime.CHART_EXPORT as ce:
        out['chart_export_formats'].extend(ce.get_supported_types())
    out['quick_save_row_limit'] = amodel.CONC_QUICK_SAVE_MAX_LINES
    if conc is not None and conc.get_conc_file():
        out['conc_cache_key'] = os.path.splitext(os.path.basename(conc.get_conc_file()))[0]
    else:
        out['conc_cache_key'] = None
    out['disable_auclp'] = disable_auclp
    return out


@bp.route('/view')
@http_action(
    mutates_result=False, action_log_mapper=log_mapping.view, template='view.html', action_model=ConcActionModel)
async def view(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    Concordance view
    """
    asnc = int(req.args.get('asnc')) if 'asnc' in req.args else 0
    return await view_conc(
        amodel, req, resp, asnc, req.session_get('user', 'id'))


@bp.route('/create_view')
@http_action(mutates_result=True, template='view.html', page_model='view', action_log_mapper=log_mapping.view, action_model=ConcActionModel)
async def create_view(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    This is intended for direct conc. access via external pages (i.e. no query_submit + view and just directly
    to the result by providing raw CQL query
    """
    form_args = await decode_raw_query(amodel.plugin_ctx, [amodel.args.corpname], req.args.getlist('q'))
    await amodel.store_unbound_query_chain(form_args)
    asnc = int(req.args.get('asnc')) if 'asnc' in req.args else 0
    return await view_conc(amodel, req, resp, asnc, req.session_get('user', 'id'))


@bp.route('/create_lazy_view')
@http_action(mutates_result=True, template='view.html', page_model='view', action_log_mapper=log_mapping.view,
             action_model=ConcActionModel)
async def create_lazy_view(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    form_args = await QueryFormArgs.create(amodel.plugin_ctx, [amodel.args.corpname], True)
    form_args.data.curr_queries = {amodel.args.corpname: amodel.args.q[len(
        amodel.args.q) - 1][1:]}  # 1: = we strip 'q' prefix
    form_args.data.curr_query_types = {amodel.args.corpname: 'advanced'}
    amodel.set_curr_conc_form_args(form_args)
    return await view_conc(amodel, req, resp, 2, req.session_get('user', 'id'))


@bp.route('/query_id_available', ['GET'])
@http_action(access_level=2, return_type='json', action_model=UserActionModel)
async def query_id_available(amodel: UserActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.QUERY_PERSISTENCE as qp:
        id = req.args.get('id')
        reserved = await qp.id_reserved(id)
        if reserved:
            return dict(id=id, available=False)
        exists = await qp.id_exists(id)
    return dict(id=id, available=not exists)


@bp.route('/create_query_id', ['POST'])
@http_action(access_level=2, return_type='json', action_model=UserActionModel)
async def create_query_id(amodel: UserActionModel, req: KRequest, resp: KResponse):
    old_id = req.json['old']
    new_id = req.json['new']
    with plugins.runtime.QUERY_PERSISTENCE as qp:
        reserved = await qp.id_reserved(new_id)
        if reserved:
            raise ValueError(req.translate('ID {} is not available').format(new_id))
        await qp.clone_with_id(old_id, new_id)
    return dict(id=new_id, ok=True)


@bp.route('/restore_conc')
@http_action(mutates_result=True, action_model=ConcActionModel, template='restore_conc.html')
async def restore_conc(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    out = amodel.create_empty_conc_result_dict()
    out['result_shuffled'] = not conclib.conc_is_sorted(amodel.args.q)
    out['items_per_page'] = amodel.args.pagesize
    try:
        conc = await get_conc(
            corp=amodel.corp, user_id=amodel.session_get('user', 'id'), q=amodel.args.q,
            fromp=amodel.args.fromp, pagesize=amodel.args.pagesize, asnc=True,
            cutoff=amodel.args.cutoff)
        if conc:
            amodel.apply_linegroups(conc)
            conc.switch_aligned(os.path.basename(amodel.args.corpname))
            kwic_args = KwicPageArgs(asdict(amodel.args), base_attr=amodel.BASE_ATTR)
            kwic_args.speech_attr = await amodel.get_speech_segment()
            kwic_args.labelmap = {}
            kwic_args.alignlist = [(await amodel.cf.get_corpus(c)) for c in amodel.args.align if c]
            kwic_args.structs = amodel.get_struct_opts()
            corpus_info = await amodel.get_corpus_info(amodel.args.corpname)
            with plugins.runtime.TOKENS_LINKING as tl:
                kwic_args.internal_attrs = await tl.get_required_attrs(
                    amodel.plugin_ctx, corpus_info.tokens_linking.providers,
                    [amodel.args.corpname] + amodel.args.align)
            kwic = Kwic(amodel.corp, conc)
            out['Sort_idx'] = kwic.get_sort_idx(q=amodel.args.q, pagesize=amodel.args.pagesize)
            out.update(asdict(kwic.kwicpage(kwic_args)))
            out.update(await amodel.get_conc_sizes(conc))
            if req.args.get('next') == 'freqs':
                out['next_action'] = 'freqs'
                out['next_action_args'] = {
                    'fcrit': req.args.get('fcrit'),
                    'fcrit_async': req.args_getlist('fcrit_async'),
                    'flimit': req.args.get('flimit'),
                    # client does not always fill this
                    'freq_sort': req.args.get('freq_sort', 'freq'),
                    'freq_type': req.args.get('freq_type')}
            elif req.args.get('next') == 'shared_freqs':
                out['next_action'] = 'shared_freqs'
                out['next_action_args'] = {
                    'fcrit': req.args.get('fcrit'),
                    'flimit': req.args.get('flimit'),
                    'alpha_level': req.args.get('alpha_level'),
                    'fpage': req.args.get('fpage'),
                    'fdefault_view': req.args.get('fdefault_view'),
                    'freqlevel': req.args.get('freqlevel'),
                    # client does not always fill this
                    'freq_sort': req.args.get('freq_sort'),
                    'freq_type': req.args.get('freq_type'),
                }
            elif req.args.get('next') == 'freqml':
                out['next_action'] = 'freqml'
                out['next_action_args'] = {
                    'flimit': req.args.get('flimit'),
                    'freqlevel': req.args.get('freqlevel'),
                    'ml1attr': req.args.get('ml1attr'),
                    'ml2attr': req.args.get('ml2attr'),
                    'ml3attr': req.args.get('ml3attr')
                }
            elif req.args.get('next') == 'freqct':
                out['next_action'] = 'freqct'
                out['next_action_args'] = {
                    'ctminfreq': req.args.get('ctminfreq', '1'),
                    'ctminfreq_type': req.args.get('ctminfreq_type'),
                    'ctattr1': req.args.get('ctattr1'),
                    'ctfcrit1': amodel.args.ctfcrit1,
                    'ctattr2': req.args.get('ctattr2'),
                    'ctfcrit2': amodel.args.ctfcrit2}
            elif req.args.get('next') == 'collx':
                out['next_action'] = 'collx'
                out['next_action_args'] = {
                    'cattr': req.args.get('cattr'),
                    'csortfn': req.args.get('csortfn'),
                    'cbgrfns':  ''.join(req.args.get('cbgrfns')),
                    'cfromw': req.args.get('cfromw'),
                    'ctow': req.args.get('ctow'),
                    'cminbgr': req.args.get('cminbgr'),
                    'cminfreq': req.args.get('cminfreq'),
                    'citemsperpage': req.args.get('citemsperpage'),
                    'collpage': req.args.get('collpage'),
                    'num_lines': req.args.get('num_lines')}
            elif req.args.get('next') == 'dispersion':
                out['next_action'] = 'dispersion'
                out['next_action_args'] = {}
            if amodel.args.format == 'json':
                out['next_action_args']['format'] = 'json'
    except TypeError as ex:
        resp.add_system_message('error', str(ex))
        logging.getLogger(__name__).error(ex)
    except ConcCacheStatusException as ex:
        if 'syntax error' in f'{ex}'.lower():
            resp.add_system_message(
                'error', req.translate('Syntax error. Please check the query and its type.'))
        else:
            raise ex
    return out


@bp.route('/save_query', ['POST'])
@http_action(access_level=2, return_type='json', action_model=UserActionModel)
async def save_query(amodel: UserActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
        data = await qp.archive(req.json['query_id'], True)
        if qp.stored_form_type(data) == 'pquery':
            for conc_id in data.get('form', {}).get('conc_ids', []):
                await qp.archive(conc_id, True)

        hsave = await qh.make_persistent(
            amodel.plugin_ctx,
            amodel.session_get('user', 'id'),
            req.json['query_id'],
            qp.stored_query_supertype(data),
            req.json.get('created'),
            req.json['name'],
        )
    return dict(saved=hsave)


@bp.route('/unsave_query', ['POST'])
@http_action(access_level=2, return_type='json', action_model=UserActionModel)
async def unsave_query(amodel: UserActionModel, req: KRequest, resp: KResponse):
    # as opposed to the 'save_query' method which also performs archiving of conc params,
    # this method keeps the conc params as they are because we assume that user just does
    # not want to keep the query in their history
    with plugins.runtime.QUERY_HISTORY as qh:
        ans = await qh.make_transient(
            amodel.plugin_ctx,
            amodel.session_get('user', 'id'),
            req.json['query_id'],
            req.json['created'],
            req.json['name'],
        )
    return dict(deleted=ans)


@bp.route('/delete_query', ['POST'])
@http_action(access_level=2, return_type='json', action_model=UserActionModel)
async def delete_query(amodel: UserActionModel, req: KRequest, resp: KResponse):
    # remove query from history (respective results are kept)
    with plugins.runtime.QUERY_HISTORY as qh:
        ans = await qh.delete(
            amodel.plugin_ctx,
            amodel.session_get('user', 'id'),
            req.json['query_id'],
            int(req.json['created'])
        )
    return dict(num_deleted=ans)


@bp.route('/normalize_conc_form_args_arch', ['POST'])
@http_action(return_type='json', action_model=ConcActionModel)
async def normalize_conc_form_args_arch(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    last_id = req.args.get('last_id')

    with plugins.runtime.QUERY_PERSISTENCE as qp:
        data = await qp.open(last_id)
        chain = [last_id]
        prev_id = data.get('prev_id')
        author_id = data.get('user_id')
        hard_limit = 100
        while prev_id is not None and hard_limit > 0:
            data = await qp.open(prev_id)
            chain.append(prev_id)
            curr_author_id = data.get('user_id')
            if amodel.is_anonymous_id(curr_author_id) or curr_author_id is None:
                data['user_id'] = author_id
                await qp.update(data)
            prev_id = data.get('prev_id')
            hard_limit -= 1
    logging.getLogger(__name__).debug('normalizing query chain {}, with author_id {}'.format(
        ' -> '.join(chain), author_id))
    return dict(author_id=author_id)


@bp.route('/permanent_link', ['POST'])
@http_action(return_type='json', action_model=ConcActionModel)
async def permanent_link(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.QUERY_PERSISTENCE as qp:
        await qp.archive(req.args.get('conc_id'), True)


@bp.route('/concdesc_json')
@http_action(return_type='json', action_model=ConcActionModel)
async def concdesc_json(amodel: ConcActionModel, req: KRequest, resp: KResponse) -> Dict[str, List[Dict[str, Any]]]:
    with plugins.runtime.QUERY_PERSISTENCE as qp:
        pipeline = await qp.load_pipeline_ops(amodel.plugin_ctx, amodel.q_code, build_conc_form_args)
    conc_desc = await amodel.concdesc_json()
    for i, cd_item in enumerate(conc_desc):
        form = pipeline[i]
        if isinstance(form, QueryFormArgs):
            if len(form.data.curr_queries) == 1:
                cd_item.nicearg = list(form.data.curr_queries.values())[0]
            else:
                cd_item.nicearg = ', '.join(
                    f'{k}: {v}' for k, v in form.data.curr_queries.items())
        elif isinstance(form, FilterFormArgs):
            cd_item.nicearg = form.data.query
        elif isinstance(form, FirstHitsFilterFormArgs):
            cd_item.nicearg = form.data.struct
        cd_item.conc_persistence_op_id = pipeline[i].op_key
    return {'Desc': [x.to_dict() for x in conc_desc]}


@bp.route('/ajax_fetch_conc_form_args')
@http_action(return_type='json', action_model=CorpusActionModel)
async def ajax_fetch_conc_form_args(
        amodel: ConcActionModel,
        req: KRequest,
        resp: KResponse
) -> Union[List[Dict[str, Any]], Dict[str, Any]]:
    try:
        # we must include only regular (i.e. the ones visible in the breadcrumb-like
        # navigation bar) operations - otherwise the indices would not match.
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            stored_ops = await qp.load_pipeline_ops(
                amodel.plugin_ctx, req.args.get('last_key'), build_conc_form_args)
        pipeline = [x for x in stored_ops if x.form_type != 'nop']
        op_idx_arg = req.args.get('idx')
        if op_idx_arg is not None:
            op_data = pipeline[int(op_idx_arg)]
            return op_data.to_dict()
        return dict(operations=[item.to_dict() for item in pipeline])
    except (IndexError, KeyError, QueryPersistenceRecNotFound) as ex:
        raise NotFoundException(req.translate('Query information not stored: {}').format(ex))


def _widectx(amodel: ConcActionModel, position: int, left_ctx: int, right_ctx: int):
    p_attrs = amodel.args.attrs.split(',')
    # prefer 'word' but allow other attr if word is off
    attrs = ['word'] if 'word' in p_attrs else p_attrs[0:1]
    data = conclib.get_detail_context(
        corp=amodel.corp, pos=position, attrs=attrs, structs=amodel.args.structs, hitlen=amodel.args.hitlen,
        detail_left_ctx=left_ctx, detail_right_ctx=right_ctx)
    if left_ctx >= int(data['maxdetail']):
        data['expand_left_args'] = None
    if right_ctx >= int(data['maxdetail']):
        data['expand_right_args'] = None
    data['widectx_globals'] = amodel.get_mapped_attrs(
        WidectxArgsMapping, dict(structs=amodel.get_struct_opts()))
    return data


@bp.route('/widectx')
@http_action(action_log_mapper=log_mapping.widectx, action_model=ConcActionModel)
async def widectx(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    display a hit in a wider context
    """
    pos = int(req.args.get('pos', '0'))
    left_ctx = int(req.args.get('detail_left_ctx', 40))
    right_ctx = int(req.args.get('detail_right_ctx', 40))
    return _widectx(amodel, pos, left_ctx, right_ctx)


@bp.route('/ajax_switch_corpus', methods=['POST'])
@http_action(return_type='json', action_model=ConcActionModel)
async def ajax_switch_corpus(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    amodel.disabled_menu_items = (
        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
        MainMenu.VIEW('kwic-sent-switch'))

    attrlist = amodel.corp.get_posattrs()
    align_common_posattrs = set(attrlist)

    avail_al_corp = []
    for al in [x for x in amodel.corp.get_conf('ALIGNED').split(',') if len(x) > 0]:
        alcorp = await amodel.cf.get_corpus(al)
        avail_al_corp.append(dict(label=alcorp.get_conf('NAME') or al, n=al))
        if al in amodel.args.align:
            align_common_posattrs.intersection_update(alcorp.get_posattrs())

    tmp_out = dict(
        uses_corp_instance=True,
        corpname=amodel.args.corpname,
        usesubcorp=amodel.args.usesubcorp
    )

    tmp_out['AttrList'] = [{
        'label': amodel.corp.get_conf(f'{n}.LABEL') or n,
        'n': n,
        'multisep': amodel.corp.get_conf(f'{n}.MULTISEP')
    } for n in attrlist if n]

    sref = amodel.corp.get_conf('SHORTREF')
    tmp_out['fcrit_shortref'] = '+'.join([a.strip('=') + ' 0' for a in sref.split(',')])

    if amodel.corp.get_conf('FREQTTATTRS'):
        ttcrit_attrs = amodel.corp.get_conf('FREQTTATTRS')
    else:
        ttcrit_attrs = amodel.corp.get_conf('SUBCORPATTRS')
    tmp_out['ttcrit'] = [f'{a} 0' for a in ttcrit_attrs.replace('|', ',').split(',') if a]

    amodel.set_curr_conc_form_args(
        await QueryFormArgs.create(
            plugin_ctx=amodel.plugin_ctx,
            corpora=amodel.select_current_aligned_corpora(
                active_only=False),
            persist=False))
    await amodel.export_query_forms(tmp_out)
    await amodel.attach_aligned_query_params(tmp_out)
    await amodel.export_subcorpora_list(tmp_out)
    corpus_info = await amodel.get_corpus_info(amodel.args.corpname)
    plg_status = {}
    await amodel.export_optional_plugins_conf(plg_status)
    conc_args = amodel.get_mapped_attrs(ConcArgsMapping)
    conc_args['q'] = []

    poslist = []
    for tagset in corpus_info.tagsets:
        if tagset.ident == corpus_info.default_tagset:
            poslist = tagset.pos_category
            break

    struct_and_attrs_tmp = await amodel.get_structs_and_attrs()
    struct_and_attrs = {k: [sa.to_dict() for sa in v] for k, v in struct_and_attrs_tmp.items()}

    subcorp_tt_structure: Optional[TextTypesType] = None
    corp_ident = amodel.corp.portable_ident
    if isinstance(corp_ident, SubcorpusIdent):
        with plugins.runtime.SUBC_STORAGE as sr:
            info = await sr.get_info(corp_ident.id)
            if info.text_types:
                subcorp_tt_structure = info.text_types
            subc_aligned = info.aligned
    else:
        subc_aligned = []
    if len(subc_aligned) > 0 and set(amodel.args.align) != set(subc_aligned):
        true_aligned = subc_aligned
    else:
        true_aligned = amodel.args.align

    ans = dict(
        corpname=amodel.args.corpname,
        subcorpname=amodel.corp.subcorpus_id,
        baseAttr=amodel.BASE_ATTR,
        tagsets=[tagset.to_dict() for tagset in corpus_info.tagsets],
        humanCorpname=amodel.corp.human_readable_corpname,
        corpusIdent=dict(
            id=amodel.args.corpname, name=amodel.corp.human_readable_corpname,
            variant=amodel.corpus_variant,
            usesubcorp=amodel.args.usesubcorp if amodel.args.usesubcorp else None,
            subcName=amodel.corp.subcorpus_name,
            foreignSubcorp=amodel.session_get('user', 'id') != amodel.corp.author_id,
            size=amodel.corp.size,
            searchSize=amodel.corp.search_size),
        currentArgs=conc_args,
        concPersistenceOpId=None,
        ShuffleConcByDefault=amodel.args.shuffle,
        alignedCorpora=true_aligned,
        availableAlignedCorpora=avail_al_corp,
        activePlugins=plg_status['active_plugins'],
        queryOverview=[],
        numQueryOps=0,
        textTypesData=await amodel.tt.export_with_norms(ret_nums=True),
        Wposlist=[{'n': x.pos, 'v': x.pattern} for x in poslist],
        AttrList=tmp_out['AttrList'],
        AlignCommonPosAttrs=list(align_common_posattrs),
        InputLanguages=tmp_out['input_languages'],
        ConcFormsArgs=tmp_out['conc_forms_args'],
        CurrentSubcorp=amodel.args.usesubcorp,
        SubcorpList=tmp_out['SubcorpList'],
        TextTypesNotes=corpus_info.metadata.desc,
        TextDirectionRTL=True if amodel.corp.get_conf('RIGHTTOLEFT') else False,
        structsAndAttrs=struct_and_attrs,
        SimpleQueryDefaultAttrs=corpus_info.simple_query_default_attrs,
        QSEnabled=amodel.args.qs_enabled,
        SubcorpTTStructure=subcorp_tt_structure,
        SubcorpAligned=subc_aligned
    )
    await amodel.attach_plugin_exports(ans, direct=True)
    amodel.configure_auth_urls(ans)

    def rtrn():
        ans['menuData'] = generate_main_menu(
            tpl_data=tmp_out,
            args=amodel.args,
            disabled_items=amodel.disabled_menu_items,
            dynamic_items=amodel.dynamic_menu_items,
            corpus_dependent=tmp_out['uses_corp_instance'],
            plugin_ctx=amodel.plugin_ctx)
        return ans
    return rtrn


@bp.route('/switch_main_corp', methods=['POST'])
@http_action(template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def switch_main_corp(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    maincorp = req.form.get('maincorp')
    amodel.args.q.append('x-{0}'.format(maincorp))
    ksargs = KwicSwitchArgs(maincorp=maincorp, persist=True)
    amodel.set_curr_conc_form_args(ksargs)
    return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'))


@bp.route('/filter', methods=['POST'])
@http_action(access_level=2, mutates_result=True, return_type='json', action_model=ConcActionModel)
async def filter(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    Positive/Negative filter
    """
    async def store_last_op(conc_ids: List[str], history_ts: Optional[int], _):
        if history_ts:
            amodel.store_last_search('conc:filter', conc_ids[0])

    if len(amodel.lines_groups) > 0:
        raise UserReadableException('Cannot apply a filter once a group of lines has been saved')

    maincorp = amodel.args.maincorp if amodel.args.maincorp else amodel.args.corpname
    ff_args = await FilterFormArgs.create(amodel.plugin_ctx, maincorp, True)
    ff_args.update_by_user_query(req.json)
    err = ff_args.validate()
    if err is not None:
        raise UserReadableException(err)

    amodel.set_curr_conc_form_args(ff_args)
    rank = dict(f=1, l=-1).get(ff_args.data.filfl, 1)
    texttypes = TextTypeCollector(amodel.corp, {}).get_query()
    try:
        # TODO get rid of private method
        cql_query = amodel.compile_query(form=ff_args, corpus=maincorp)
        if cql_query is None:
            raise ConcordanceQueryParamsError(req.translate('No query entered.'))
    except ConcordanceQueryParamsError:
        if texttypes:
            cql_query = '[]'
            ff_args.filfpos = '0'
            ff_args.filtpos = '0'
        else:
            raise ConcordanceQueryParamsError(req.translate('No query entered.'))
    cql_query += ' '.join([f'within <{nq[0]} {nq[1]} />' for nq in texttypes])
    amodel.args.q.append(
        f'{ff_args.data.pnfilter}{ff_args.data.filfpos}{ff_args.data.filfpos_unit} {ff_args.data.filtpos}{ff_args.data.filtpos_unit} {rank} {cql_query}')

    amodel.on_query_store(store_last_op)
    resp.set_http_status(201)
    try:
        return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'))
    except Exception as ex:
        logging.getLogger(__name__).error(f'Failed to apply filter: {ex}')
        del amodel.args.q[-1]
        raise ex


@bp.route('/quick_filter', methods=['POST'])
@http_action(template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def quick_filter(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    A filter generated directly from a link (e.g. "p"/"n" links on freqs/colls/pquery pages).
    """
    new_q = req.args_getlist('q2')
    q_conv = QuickFilterArgsConv(amodel.plugin_ctx, amodel.args)

    op_idx = len(amodel.args.q)
    if len(new_q) > 0:
        ff_args = q_conv(new_q[0])
        amodel.set_curr_conc_form_args(ff_args)
        amodel.args.q.append(new_q[0])
        op_idx += 1
    for q in new_q[1:]:
        ff_args = q_conv(q)
        amodel.acknowledge_auto_generated_conc_op(op_idx, ff_args)
        amodel.args.q.append(q)
        op_idx += 1
    return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'))


@bp.route('/filter_subhits')
@http_action(template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def filter_subhits(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    if len(amodel.lines_groups) > 0:
        raise UserReadableException(
            'Cannot apply the function once a group of lines has been saved')
    amodel.set_curr_conc_form_args(SubHitsFilterFormArgs(persist=True))
    amodel.args.q.append('D')
    return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'))


@bp.route('/filter_firsthits', ['POST'])
@http_action(template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def filter_firsthits(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    if len(amodel.lines_groups) > 0:
        raise UserReadableException(
            'Cannot apply the function once a group of lines has been saved')
    elif len(amodel.args.align) > 0:
        raise UserReadableException('The function is not supported for aligned corpora')
    amodel.set_curr_conc_form_args(FirstHitsFilterFormArgs(
        persist=True, struct=req.args.get('fh_struct')))
    amodel.args.q.append('F{0}'.format(req.args.get('fh_struct')))
    return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'))


@bp.route('/sortx', ['POST'])
@http_action(access_level=2, template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def sortx(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    simple sort concordance
    """
    amodel.disabled_menu_items = ()

    if len(amodel.lines_groups) > 0:
        raise UserReadableException('Cannot apply a sorting once a group of lines has been saved')

    qinfo = SortFormArgs(persist=True)
    qinfo.update_by_user_query(req.json)
    amodel.set_curr_conc_form_args(qinfo)

    if qinfo.data.skey == 'lc':
        ctx = f'-1<0~-{qinfo.data.spos}<0'
    elif qinfo.data.skey == 'kw':
        ctx = '0<0~0>0'
    elif qinfo.data.skey == 'rc':
        ctx = f'1>0~{qinfo.data.spos}>0'
    else:
        ctx = ''
    if '.' in qinfo.data.sattr:
        ctx = ctx.split('~')[0]

    amodel.args.q.append(f's{qinfo.data.sattr}/{qinfo.data.sicase}{qinfo.data.sbward} {ctx}')
    return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'))


@bp.route('/mlsortx', ['POST'])
@http_action(access_level=2, template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def mlsortx(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    multiple level sort concordance
    """
    qinfo = SortFormArgs(persist=True)
    qinfo.update_by_user_query(req.json)
    amodel.set_curr_conc_form_args(qinfo)

    mlxfcode = 'rc'
    crit = one_level_crit('s', qinfo.data.ml1attr, qinfo.data.ml1ctx, qinfo.data.ml1pos, mlxfcode,
                          qinfo.data.ml1icase, qinfo.data.ml1bward)
    if qinfo.data.sortlevel > 1:
        crit += one_level_crit(' ', qinfo.data.ml2attr, qinfo.data.ml2ctx, qinfo.data.ml2pos, mlxfcode,
                               qinfo.data.ml2icase, qinfo.data.ml2bward)
        if qinfo.data.sortlevel > 2:
            crit += one_level_crit(' ', qinfo.data.ml3attr, qinfo.data.ml3ctx, qinfo.data.ml3pos, mlxfcode,
                                   qinfo.data.ml3icase, qinfo.data.ml3bward)
    amodel.args.q.append(crit)
    return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'))


@bp.route('/shuffle')
@http_action(template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def shuffle(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    if len(amodel.lines_groups) > 0:
        raise UserReadableException('Cannot apply a shuffle once a group of lines has been saved')
    amodel.set_curr_conc_form_args(ShuffleFormArgs(persist=True))
    amodel.args.q.append('f')
    return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'))


@bp.route('/ajax_apply_lines_groups', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=ConcActionModel)
async def ajax_apply_lines_groups(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    rows = req.form.get('rows')
    amodel.lines_groups = LinesGroups(data=json.loads(rows))
    amodel.set_curr_conc_form_args(LgroupOpArgs(persist=True))
    return {}


@bp.route('/ajax_get_line_groups_stats')
@http_action(return_type='json', action_model=ConcActionModel)
async def ajax_get_line_groups_stats(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    ans = collections.defaultdict(lambda: 0)
    for item in amodel.lines_groups:
        ans[item[2]] += 1

    return dict(groups=ans)


@bp.route('/ajax_unset_lines_groups', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=ConcActionModel)
async def ajax_unset_lines_groups(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.QUERY_PERSISTENCE as qp:
        pipeline = await qp.load_pipeline_ops(amodel.plugin_ctx, amodel.q_code, build_conc_form_args)
    i = len(pipeline) - 1
    # we have to go back before the current block
    # of lines-groups operations and find an
    # operation to start a new query pipeline
    while i >= 0 and pipeline[i].form_type == 'lgroup':
        i -= 1
    if i < 0:
        raise Exception('Broken operation chain')
    amodel.clear_prev_conc_params()  # we do not want to chain next state with the current one
    amodel._lines_groups = LinesGroups(data=[])
    pipeline[i].make_saveable()  # drop old opKey, set as persistent
    amodel.set_curr_conc_form_args(pipeline[i])
    return {}


@bp.route('/ajax_remove_non_group_lines', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=ConcActionModel)
async def ajax_remove_non_group_lines(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    amodel.args.q.append(amodel.filter_lines([(x[0], x[1]) for x in amodel.lines_groups], 'p'))
    amodel.set_curr_conc_form_args(LgroupOpArgs(persist=True))
    return {}


@bp.route('/ajax_sort_group_lines', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=ConcActionModel)
async def ajax_sort_group_lines(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    amodel.lines_groups.sorted = True
    amodel.set_curr_conc_form_args(LgroupOpArgs(persist=True))
    return {}


@bp.route('/ajax_remove_selected_lines', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=ConcActionModel)
async def ajax_remove_selected_lines(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    pnfilter = req.args.get('pnfilter', 'p')
    rows = req.form.get('rows', '')
    data = json.loads(rows)
    amodel.args.q.append(amodel.filter_lines(data, pnfilter))
    amodel.set_curr_conc_form_args(LockedOpFormsArgs(persist=True))
    return {}


@bp.route('/ajax_send_group_selection_link_to_mail', ['POST'])
@http_action(return_type='json', action_model=ConcActionModel)
async def ajax_send_group_selection_link_to_mail(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.AUTH as auth:
        user_info = await auth.get_user_info(amodel.plugin_ctx)
        user_email = user_info['email']
        username = user_info['username']
        smtp_server = mailing.smtp_factory()
        url = req.args.get('url')
        recip_email = req.args.get('email')

        text = req.translate('KonText user %s has sent a concordance link to you') % (
            username,) + ':'
        text += '\n\n'
        text += url + '\n\n'
        text += '\n---------------------\n'
        text += time.strftime('%d.%m. %Y %H:%M')
        text += '\n'

        msg = mailing.message_factory(
            recipients=[recip_email],
            subject=req.translate('KonText concordance link'),
            text=text,
            reply_to=user_email)
        return dict(ok=mailing.send_mail(smtp_server, msg, [recip_email]))


@bp.route('/ajax_reedit_line_selection', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=ConcActionModel)
async def ajax_reedit_line_selection(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    ans = amodel.lines_groups.as_list()
    amodel.lines_groups = LinesGroups(data=[])
    amodel.set_curr_conc_form_args(LgroupOpArgs(persist=True))
    return dict(selection=ans)


@bp.route('/ajax_get_first_line_select_page')
@http_action(return_type='json', action_model=ConcActionModel)
async def ajax_get_first_line_select_page(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    conc = await get_conc(
        corp=amodel.corp, user_id=amodel.session_get('user', 'id'),
        q=amodel.args.q, fromp=amodel.args.fromp, pagesize=amodel.args.pagesize,
        asnc=False, cutoff=amodel.args.cutoff)
    amodel.apply_linegroups(conc)
    kwic = Kwic(amodel.corp, conc)
    return {'first_page': int((kwic.get_groups_first_line() - 1) / amodel.args.pagesize) + 1}


@bp.route('/ajax_rename_line_group', ['POST'])
@http_action(return_type='json', mutates_result=True, action_model=ConcActionModel)
async def ajax_rename_line_group(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    from_num = int(req.form.get('from_num', '0'))
    to_num = int(req.form.get('to_num', '-1'))
    new_groups = [v for v in amodel.lines_groups if v[2] != from_num or to_num != -1]
    if to_num > 0:
        new_groups = [v if v[2] != from_num else (v[0], v[1], to_num) for v in new_groups]
    amodel.lines_groups = LinesGroups(data=new_groups)
    amodel.set_curr_conc_form_args(LgroupOpArgs(persist=True))
    return {}


@bp.route('/export_line_groups_chart', ['POST'])
@http_action(access_level=2, return_type='plain', mutates_result=True, action_model=ConcActionModel)
async def export_line_groups_chart(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.CHART_EXPORT as ce:
        format = req.json.get('cformat')
        filename = 'line-groups-{0}.{1}'.format(amodel.args.corpname, ce.get_suffix(format))
        resp.set_header('Content-Type', ce.get_content_type(format))
        resp.set_header('Content-Disposition', f'attachment; filename="{filename}.{format}"')
        data = sorted(req.json.get('data', {}), key=lambda x: int(x['groupId']))
        total = sum(x['count'] for x in data)
        data = [('#{0} ({1}%)'.format(x['groupId'], round(x['count'] / float(total) * 100, 1)), x['count'])
                for x in data]
        return ce.export_pie_chart(data=data, title=req.form.get('title', '??'), format=format)


@bp.route('/fullref')
@http_action(return_type='json', action_model=ConcActionModel)
async def fullref(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    display a full reference
    """
    return conclib.get_full_ref(corp=amodel.corp, pos=int(req.args.get('pos', '0')))


# TODO is corpus model enough?
@bp.route('/audio')
@http_action(return_type='plain', action_model=CorpusActionModel)
async def audio(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    """
    Provides access to audio-files containing speech segments.
    Access rights are per-corpus (i.e. if a user has a permission to
    access corpus 'X' then all related audio files are accessible).
    """
    with plugins.runtime.AUDIO_PROVIDER as audiop:
        headers, ans = await audiop.get_audio(amodel.plugin_ctx, req)
        for h, v in headers.items():
            resp.set_header(h, v)
        return ans


@bp.route('/audio_waveform')
@http_action(return_type='json', action_model=CorpusActionModel)
async def audio_waveform(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.AUDIO_PROVIDER as audiop:
        return await audiop.get_waveform(amodel.plugin_ctx, req)


@bp.route('/get_adhoc_subcorp_size', methods=['POST'])
@http_action(return_type='json', action_model=ConcActionModel)
async def get_adhoc_subcorp_size(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    if (await plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(
            amodel.plugin_ctx, [amodel.args.corpname] + amodel.args.align)):
        # a faster solution based on liveattrs
        with plugins.runtime.LIVE_ATTRIBUTES as liveatt:
            attr_map = TextTypeCollector(amodel.corp, req.json['text_types']).get_attrmap()
            involved_corpora = [amodel.args.corpname] + amodel.args.align[:]
            size = await liveatt.get_subc_size(amodel.plugin_ctx, involved_corpora, attr_map)
            return dict(total=size)
    else:
        tt_query = TextTypeCollector(amodel.corp, req.json['text_types']).get_query()
        query = 'aword,[] within {}'.format(
            ' '.join('<{0} {1} />'.format(k, v) for k, v in tt_query))
        amodel.args.q = [query]
        conc = await get_conc(
            corp=amodel.corp, user_id=amodel.session_get('user', 'id'), q=amodel.args.q,
            fromp=amodel.args.fromp, pagesize=amodel.args.pagesize, asnc=0)
        return dict(total=conc.fullsize() if conc else None)


@bp.route('/load_query_pipeline')
@http_action(return_type='json', action_model=ConcActionModel)
async def load_query_pipeline(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.QUERY_PERSISTENCE as qp:
        pipeline = await qp.load_pipeline_ops(amodel.plugin_ctx, amodel.q_code, build_conc_form_args)
        concdesc = await amodel.concdesc_json()
    return dict(
        ops=[dict(id=x.op_key, form_args=x.to_dict()) for x in pipeline],
        query_overview=[x.to_dict() for x in concdesc])


@bp.route('/matching_structattr')
@http_action(return_type='json', action_model=CorpusActionModel)
async def matching_structattr(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    def is_invalid(v):
        return re.search(r'[<>\]\[]', v) is not None

    if (is_invalid(req.args.get('struct')) or is_invalid(req.args.get('attr')) or
            is_invalid(req.args.get('attr_val')) or is_invalid(req.args.get('search_attr'))):
        raise UserReadableException('Invalid character in attribute/structure name/value')

    ans, found, used = corplib.matching_structattr(
        amodel.corp, req.args.get('struct'), req.args.get(
            'attr'), req.args.get('attr_val'),
        req.args.get('search_attr'))
    if len(ans) == 0:
        resp.set_http_status(404)
    return dict(result=ans, conc_size=found, lines_used=used)


@dataclass
class SaveConcArgs:
    saveformat: str = 'txt'
    heading: int = 0
    numbering: int = 0
    numbering_offset: int = 0
    align_kwic: int = 0
    from_line: int = 0
    to_line: IntOpt = -1


def _get_ipm_base_set_desc(corp: AbstractKCorpus, contains_within, translate: Callable[[str], str]):
    """
    Generates a proper description for i.p.m. depending on the
    method used to select texts:
    1 - whole corpus
    2 - a named subcorpus
    3 - an ad-hoc subcorpus
    """
    corpus_name = corp.get_conf('NAME')
    if contains_within:
        return translate('related to the subset defined by the selected text types')
    elif corp.subcorpus_id:
        return translate('related to the whole %s').format(corpus_name) + f'/{corp.subcorpus_id}'
    else:
        return translate('related to the whole %s').format(corpus_name)


@bp.route('/saveconc')
@http_action(
    access_level=2, action_model=ConcActionModel, mapped_args=SaveConcArgs, return_type='plain')
async def saveconc(amodel: ConcActionModel, req: KRequest[SaveConcArgs], resp: KResponse):
    def mkfilename(suffix):
        return f'{amodel.args.corpname}-concordance.{suffix}'

    try:
        corpus_info = await amodel.get_corpus_info(amodel.args.corpname)
        amodel.apply_viewmode(corpus_info.sentence_struct)

        conc = await get_conc(
            corp=amodel.corp, user_id=req.session_get('user', 'id'), q=amodel.args.q, fromp=amodel.args.fromp,
            pagesize=amodel.args.pagesize, asnc=False, cutoff=amodel.args.cutoff)
        amodel.apply_linegroups(conc)
        kwic = Kwic(amodel.corp, conc)
        conc.switch_aligned(os.path.basename(amodel.args.corpname))

        if len(amodel.args.align) == 0 and conc.size() < MAX_SINGLE_CHUNK_SAVE_CONC_SIZE:
            line_range_chunks = [(
                int(req.mapped_args.from_line) - 1,
                conc.size() - 1 if req.mapped_args.to_line < 0 else min(req.mapped_args.to_line, conc.size()) - 1
            )]
        else:
            line_range_chunks = []
            for i in range(req.mapped_args.from_line-1, req.mapped_args.to_line-1, SAVE_CONC_CHUNK_SIZE):
                line_range_chunks.append((i, i+SAVE_CONC_CHUNK_SIZE))

        with plugins.runtime.EXPORT as export:
            writer = export.load_plugin(req.mapped_args.saveformat, req.locale)

            resp.set_header('Content-Type', writer.content_type())
            resp.set_header(
                'Content-Disposition',
                f'attachment; filename="{mkfilename(req.mapped_args.saveformat)}"')

            for from_line, to_line in line_range_chunks:
                if from_line > 0:
                    req.mapped_args.heading = 0
                req.mapped_args.numbering_offset = from_line
                kwic_args = KwicPageArgs(asdict(amodel.args), base_attr=amodel.BASE_ATTR)
                kwic_args.speech_attr = await amodel.get_speech_segment()
                kwic_args.fromp = 1
                kwic_args.pagesize = to_line - from_line
                kwic_args.line_offset = from_line
                kwic_args.labelmap = {}
                kwic_args.alignlist = [(await amodel.cf.get_corpus(c)) for c in amodel.args.align if c]
                kwic_args.leftctx = amodel.args.leftctx
                kwic_args.rightctx = amodel.args.rightctx
                kwic_args.structs = amodel.get_struct_opts()
                with plugins.runtime.TOKENS_LINKING as tl:
                    kwic_args.internal_attrs = await tl.get_required_attrs(
                        amodel.plugin_ctx,
                        corpus_info.tokens_linking.providers,
                        [amodel.args.corpname] + amodel.args.align)

                data = kwic.kwicpage(kwic_args)

                maxcontext = int(amodel.corp.get_conf('MAXCONTEXT'))
                if maxcontext:
                    for line in data.Lines:
                        if len(line["Kwic"]) > maxcontext:
                            raise UnavailableForLegalReasons('KWIC too large')
                if len(data.Lines) > 0:
                    await writer.write_conc(amodel, data, req.mapped_args)
            output = writer.raw_content()
        return bytes_stream(output)

    except Exception as e:
        resp.set_header('Content-Type', 'text/html')
        if resp.contains_header('Content-Disposition'):
            resp.remove_header('Content-Disposition')
        raise e


@bp.route('/reduce', methods=['POST'])
@http_action(
    action_model=ConcActionModel, template='view.html', page_model='view', mutates_result=True)
async def reduce(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    random sample
    """
    if len(amodel.lines_groups) > 0:
        raise UserReadableException(
            'Cannot apply a random sample once a group of lines has been saved')
    qinfo = SampleFormArgs(persist=True)
    qinfo.rlines = amodel.args.rlines
    amodel.set_curr_conc_form_args(qinfo)
    amodel.args.q.append('r' + amodel.args.rlines)
    return await view_conc(amodel, req, resp, 0, req.session_get('user', 'id'))


@dataclass
class StructctxArgs:
    pos: IntOpt = 0
    struct: StrOpt = 'doc'
    left_ctx: IntOpt = -5
    right_ctx: IntOpt = 5


@bp.route('/structctx')
@http_action(action_model=ConcActionModel, mapped_args=StructctxArgs, access_level=2, return_type='json')
def structctx(amodel: ConcActionModel, req: KRequest[StructctxArgs], resp: KResponse):
    """
    display a hit in a context of a structure"
    """
    s = amodel.corp.get_struct(req.mapped_args.struct)
    struct_id = s.num_at_pos(req.mapped_args.pos)
    beg, end = s.beg(struct_id), s.end(struct_id)
    amodel.args.detail_left_ctx = req.mapped_args.pos - beg
    amodel.args.detail_right_ctx = end - req.mapped_args.pos - 1
    result = _widectx(amodel, req.mapped_args.pos,
                      req.mapped_args.left_ctx, req.mapped_args.right_ctx)
    return result
