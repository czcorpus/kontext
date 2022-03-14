import os
from typing import Optional, Dict, List, Any
from sanic import Blueprint
import logging
from dataclasses import asdict
from action.decorators import http_action
from action.krequest import KRequest
from action.response import KResponse
from action.errors import NotFoundException, UserActionException
from action.model.authorized import UserActionModel
from action.model.concordance import ConcActionModel
from action.argmapping import log_mapping, ConcArgsMapping, WidectxArgsMapping
from action.argmapping.conc import build_conc_form_args, QueryFormArgs, ShuffleFormArgs
from action.argmapping.conc.filter import FilterFormArgs, FirstHitsFilterFormArgs, QuickFilterArgsConv, SubHitsFilterFormArgs
from action.argmapping.conc.sort import SortFormArgs
from action.argmapping.conc.other import KwicSwitchArgs
from action.argmapping.analytics import CollFormArgs, FreqFormArgs, CTFreqFormArgs
from texttypes.model import TextTypeCollector
from plugin_types.query_persistence.error import QueryPersistenceRecNotFound
from plugin_types.conc_cache import ConcCacheStatusException
import conclib
from conclib.freq import one_level_crit
from conclib.search import get_conc
from conclib.errors import (
    ConcordanceException, ConcordanceQueryParamsError, ConcordanceSpecificationError, UnknownConcordanceAction, extract_manatee_error)
from conclib.empty import InitialConc
from kwiclib import KwicPageArgs, Kwic
import plugins
from main_menu import MainMenu, generate_main_menu
import settings


bp = Blueprint('concordance')


@bp.route('/query')
@http_action(template='query.html', page_model='query', action_model=ConcActionModel)
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

    qf_args = await amodel.fetch_prev_query('conc') if amodel._active_q_data is None else None
    if qf_args is None:
        qf_args = await QueryFormArgs.create(
            plugin_ctx=amodel.plugin_ctx,
            corpora=[amodel.args.corpname] + amodel.args.align,
            persist=False)
    amodel.add_conc_form_args(qf_args)
    await amodel.attach_query_params(out)
    await amodel.attach_aligned_query_params(out)
    amodel.export_subcorpora_list(
        amodel.args.corpname, amodel.args.usesubcorp, out)
    return out


@bp.route('/query_submit', methods=['POST'])
@http_action(
    mutates_result=True, action_log_mapper=log_mapping.query_submit, return_type='json', action_model=ConcActionModel)
async def query_submit(amodel: ConcActionModel, req: KRequest, resp: KResponse):

    def store_last_op(conc_ids: List[str], history_ts: Optional[int], _):
        if history_ts:
            amodel.store_last_search('conc', conc_ids[0])

    amodel.clear_prev_conc_params()
    ans = {}
    # 1) store query forms arguments for later reuse on client-side
    corpora = amodel.select_current_aligned_corpora(active_only=True)
    corpus_info = await amodel.get_corpus_info(corpora[0])
    qinfo = await QueryFormArgs.create(plugin_ctx=amodel.plugin_ctx, corpora=corpora, persist=True)
    qinfo.update_by_user_query(
        req.json, amodel.get_tt_bib_mapping(req.json['text_types']))
    amodel.add_conc_form_args(qinfo)
    # 2) process the query
    try:
        await amodel.set_first_query(
            [q['corpname'] for q in req.json['queries']], qinfo, corpus_info)
        if amodel.args.shuffle == 1 and 'f' not in amodel.args.q:
            amodel.args.shuffle = 0
            amodel.args.q.append('f')
            amodel.acknowledge_auto_generated_conc_op(
                len(amodel.args.q) - 1, ShuffleFormArgs(persist=True))
        logging.getLogger(__name__).debug('query: {}'.format(amodel.args.q))
        conc = await get_conc(
            corp=amodel.corp, user_id=amodel.session_get('user', 'id'), q=amodel.args.q,
            fromp=amodel.args.fromp, pagesize=amodel.args.pagesize, asnc=qinfo.data.asnc,
            samplesize=corpus_info.sample_size)
        ans['size'] = conc.size()
        ans['finished'] = conc.finished()
        amodel.on_conc_store = store_last_op
        resp.set_http_status(201)
    except (ConcordanceException, ConcCacheStatusException) as ex:
        ans['size'] = 0
        ans['finished'] = True
        if isinstance(ex, ConcordanceSpecificationError):
            raise UserActionException(ex, code=422)
        else:
            raise ex
    ans['conc_args'] = amodel.get_mapped_attrs(ConcArgsMapping)
    amodel.attach_query_overview(ans)
    return ans


async def _view(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    corpus_info = await amodel.get_corpus_info(amodel.args.corpname)
    if amodel.args.refs is None:  # user did not set this at all (!= user explicitly set '')
        amodel.args.refs = amodel.corp.get_conf('SHORTREF')

    if amodel.args.fromp < 1:
        raise UserActionException(req.translate('Invalid page number'))
    if amodel.args.pagesize < 1:
        raise UserActionException('Invalid page size')

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
    asnc = bool(int(req.args.get('asnc'))) if 'asnc' in req.args else False
    try:
        conc = await get_conc(
            corp=amodel.corp, user_id=req.session_get('user', 'id'), q=amodel.args.q,
            fromp=amodel.args.fromp, pagesize=amodel.args.pagesize, asnc=asnc,
            samplesize=corpus_info.sample_size)
        if conc:
            amodel.apply_linegroups(conc)
            conc.switch_aligned(os.path.basename(amodel.args.corpname))

            kwic_args = KwicPageArgs(asdict(amodel.args), base_attr=amodel.BASE_ATTR)
            kwic_args.speech_attr = await amodel.get_speech_segment()
            kwic_args.labelmap = {}
            kwic_args.alignlist = [amodel.cm.get_corpus(c) for c in amodel.args.align if c]
            kwic_args.structs = amodel.get_struct_opts()
            kwic = Kwic(amodel.corp, amodel.args.corpname, conc)

            out['Sort_idx'] = kwic.get_sort_idx(q=amodel.args.q, pagesize=amodel.args.pagesize)
            out.update(kwic.kwicpage(kwic_args))
            out.update(await amodel.get_conc_sizes(conc))
    except UnknownConcordanceAction as ex:
        raise UserActionException(str(ex))
    except TypeError as ex:
        amodel.add_system_message('error', str(ex))
        logging.getLogger(__name__).error(ex)
    except (ConcordanceException, RuntimeError) as ex:
        manatee_error = extract_manatee_error(ex)
        if isinstance(manatee_error, ConcordanceSpecificationError):
            raise UserActionException(manatee_error, code=422)
        else:
            raise ex

    if amodel.corp.get_conf('ALIGNED'):
        out['Aligned'] = [{'n': w,
                           'label': amodel.cm.get_corpus(w).get_conf(
                               'NAME') or w}
                          for w in amodel.corp.get_conf('ALIGNED').split(',')]
    if amodel.args.align and not amodel.args.maincorp:
        amodel.args.maincorp = amodel.args.corpname
    if conc.size() == 0 and conc.finished():
        msg = req.translate(
            'No result. Please make sure the query and selected query type are correct.')
        amodel.add_system_message('info', msg)

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
        'TXT', save_format='text',
        hint=req.translate('Saves at most {0} items. Use "Custom" for more options.'.format(
            amodel.CONC_QUICK_SAVE_MAX_LINES)))
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
    qf_args = await amodel.fetch_prev_query('conc:filter')
    if qf_args and qf_args.data.maincorp != amodel.args.corpname:
        qf_args = None
    await amodel.attach_query_params(out, filter=qf_args)
    out['coll_form_args'] = CollFormArgs().update(amodel.args).to_dict()
    out['freq_form_args'] = FreqFormArgs().update(amodel.args).to_dict()
    out['ctfreq_form_args'] = CTFreqFormArgs().update(amodel.args).to_dict()
    amodel.export_subcorpora_list(amodel.args.corpname, amodel.args.usesubcorp, out)

    out['fast_adhoc_ipm'] = await plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(
        amodel.plugin_ctx, [amodel.args.corpname] + amodel.args.align)
    out['running_calc'] = not out['finished']   # TODO running_calc is redundant
    out['chart_export_formats'] = []
    with plugins.runtime.CHART_EXPORT as ce:
        out['chart_export_formats'].extend(ce.get_supported_types())
    out['quick_save_row_limit'] = amodel.CONC_QUICK_SAVE_MAX_LINES
    if conc is not None and conc.get_conc_file():
        out['conc_cache_key'] = os.path.splitext(os.path.basename(conc.get_conc_file()))[0]
    else:
        out['conc_cache_key'] = None
    amodel.attach_query_overview(out)
    return out


# TODO vars=('orig_query', ) ??
@bp.route('/view')
@http_action(
    mutates_result=False, action_log_mapper=log_mapping.view, template='view.html', action_model=ConcActionModel)
async def view(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    KWIC view
    """
    return await _view(amodel, req, resp)


@bp.route('/create_view')
@http_action(mutates_result=True, template='view.html', page_model='view', action_log_mapper=log_mapping.view, action_model=ConcActionModel)
async def create_view(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    This is intended for direct conc. access via external pages (i.e. no query_submit + view and just directly
    to the result by providing raw CQL query
    """
    return await _view(amodel, req, resp)


@bp.route('/archive_concordance', ['POST'])
@http_action(access_level=1, return_type='json', action_model=UserActionModel)
async def archive_concordance(amodel: UserActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.QUERY_PERSISTENCE as cp:
        revoke = bool(int(req.args.get('revoke')))
        cn, row = cp.archive(amodel.session_get('user', 'id'),
                             req.args.get('code'), revoke=revoke)
    return dict(revoked=revoke, num_changes=cn, archived_conc=row)


@bp.route('/get_stored_conc_archived_status')
@http_action(access_level=1, return_type='json', action_model=UserActionModel)
async def get_stored_conc_archived_status(amodel: UserActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.QUERY_PERSISTENCE as cp:
        return {
            'is_archived': cp.is_archived(req.args.get('code')),
            'will_be_archived': cp.will_be_archived(amodel.plugin_ctx, req.args.get('code'))
        }


@bp.route('/restore_conc')
@http_action(mutates_result=True, action_model=ConcActionModel)
async def restore_conc(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    out = amodel.create_empty_conc_result_dict()
    out['result_shuffled'] = not conclib.conc_is_sorted(amodel.args.q)
    out['items_per_page'] = amodel.args.pagesize
    try:
        corpus_info = await amodel.get_corpus_info(amodel.args.corpname)
        conc = await get_conc(corp=amodel.corp, user_id=amodel.session_get('user', 'id'), q=amodel.args.q,
                              fromp=amodel.args.fromp, pagesize=amodel.args.pagesize, asnc=True,
                              samplesize=corpus_info.sample_size)
        if conc:
            amodel.apply_linegroups(conc)
            conc.switch_aligned(os.path.basename(amodel.args.corpname))

            kwic_args = KwicPageArgs(asdict(amodel.args), base_attr=amodel.BASE_ATTR)
            kwic_args.speech_attr = await amodel.get_speech_segment()
            kwic_args.labelmap = {}
            kwic_args.alignlist = [amodel.cm.get_corpus(c) for c in amodel.args.align if c]
            kwic_args.structs = amodel.get_struct_opts()

            kwic = Kwic(amodel.corp, amodel.args.corpname, conc)

            out['Sort_idx'] = kwic.get_sort_idx(q=amodel.args.q, pagesize=amodel.args.pagesize)
            out.update(kwic.kwicpage(kwic_args))
            out.update(await amodel.get_conc_sizes(conc))
            if req.args.get('next') == 'freqs':
                out['next_action'] = 'freqs'
                out['next_action_args'] = {
                    'fcrit': req.args.get('fcrit'),
                    'fcrit_async': req.args.getlist('fcrit_async'),
                    'flimit': req.args.get('flimit'),
                    # client does not always fills this
                    'freq_sort': req.args.get('freq_sort', 'freq'),
                    'freq_type': req.args.get('freq_type'),
                    'force_cache': req.args.get('force_cache', '0')}
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
                    'ctattr1': amodel.args.ctattr1,
                    'ctfcrit1': amodel.args.ctfcrit1,
                    'ctattr2': amodel.args.ctattr2,
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
    except TypeError as ex:
        amodel.add_system_message('error', str(ex))
        logging.getLogger(__name__).error(ex)
    except ConcCacheStatusException as ex:
        if 'syntax error' in f'{ex}'.lower():
            amodel.add_system_message(
                'error', req.translate('Syntax error. Please check the query and its type.'))
        else:
            raise ex
    return out


@bp.route('/save_query', ['POST'])
@http_action(access_level=1, return_type='json', action_model=UserActionModel)
async def save_query(amodel: UserActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.QUERY_HISTORY as qh, plugins.runtime.QUERY_PERSISTENCE as qp:
        _, data = qp.archive(amodel.session_get('user', 'id'), req.json['query_id'])
        if qp.stored_form_type(data) == 'pquery':
            for conc_id in data.get('form', {}).get('conc_ids', []):
                cn, _ = qp.archive(amodel.session_get('user', 'id'), conc_id)

        hsave = qh.make_persistent(
            amodel.session_get('user', 'id'),
            req.json['query_id'],
            qp.stored_query_supertype(data),
            req.json.get('created'),
            req.json['name'],
        )
    return dict(saved=hsave)


@bp.route('/unsave_query', ['POST'])
@http_action(access_level=1, return_type='json', action_model=UserActionModel)
async def unsave_query(amodel: UserActionModel, req: KRequest, resp: KResponse):
    # as opposed to the 'save_query' method which also performs archiving of conc params,
    # this method keeps the conc params as they are because we assume that user just does
    # not want to keep the query in their history
    with plugins.runtime.QUERY_HISTORY as qh:
        ans = qh.make_transient(
            amodel.session_get('user', 'id'),
            req.json['query_id'],
            req.json['created'],
            req.json['name'],
        )
    return dict(deleted=ans)


@bp.route('/delete_query', ['POST'])
@http_action(access_level=1, return_type='json', action_model=UserActionModel)
async def delete_query(amodel: UserActionModel, req: KRequest, resp: KResponse):
    # remove query from history (respective results are kept)
    with plugins.runtime.QUERY_HISTORY as qh:
        ans = qh.delete(
            amodel.session_get('user', 'id'),
            req.json['query_id'],
            int(req.json['created'])
        )
    return dict(num_deleted=ans)


@bp.route('/concdesc_json')
@http_action(return_type='json', action_model=ConcActionModel)
async def concdesc_json(amodel: ConcActionModel, req: KRequest, resp: KResponse) -> Dict[str, List[Dict[str, Any]]]:
    return {'Desc': amodel.concdesc_json()}


@bp.route('/ajax_fetch_conc_form_args')
@http_action(return_type='json', action_model=ConcActionModel)
async def ajax_fetch_conc_form_args(amodel: ConcActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    try:
        # we must include only regular (i.e. the ones visible in the breadcrumb-like
        # navigation bar) operations - otherwise the indices would not match.
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            stored_ops = qp.load_pipeline_ops(
                amodel.plugin_ctx, req.args.get('last_key'), build_conc_form_args)
        pipeline = [x for x in stored_ops if x.form_type != 'nop']
        op_data = pipeline[int(req.args.get('idx'))]
        return op_data.to_dict()
    except (IndexError, KeyError, QueryPersistenceRecNotFound) as ex:
        raise NotFoundException(req.translate('Query information not stored: {}').format(ex))


@bp.route('/widectx')
@http_action(access_level=0, action_log_mapper=log_mapping.widectx, action_model=ConcActionModel)
async def widectx(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    display a hit in a wider context
    """
    pos = int(req.args.get('pos', '0'))
    p_attrs = amodel.args.attrs.split(',')
    # prefer 'word' but allow other attr if word is off
    attrs = ['word'] if 'word' in p_attrs else p_attrs[0:1]
    left_ctx = int(req.args.get('detail_left_ctx', 40))
    right_ctx = int(req.args.get('detail_right_ctx', 40))
    data = conclib.get_detail_context(
        corp=amodel.corp, pos=pos, attrs=attrs, structs=amodel.args.structs, hitlen=amodel.args.hitlen,
        detail_left_ctx=left_ctx, detail_right_ctx=right_ctx)
    if left_ctx >= int(data['maxdetail']):
        data['expand_left_args'] = None
    if right_ctx >= int(data['maxdetail']):
        data['expand_right_args'] = None
    data['widectx_globals'] = amodel.get_mapped_attrs(
        WidectxArgsMapping, dict(structs=amodel.get_struct_opts()))
    return data


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
        alcorp = amodel.cm.get_corpus(al)
        avail_al_corp.append(dict(label=alcorp.get_conf('NAME') or al, n=al))
        if al in amodel.args.align:
            align_common_posattrs.intersection_update(alcorp.get_posattrs())

    tmp_out = dict(
        uses_corp_instance=True,
        corpname=amodel.args.corpname,
        usesubcorp=amodel.args.usesubcorp,
        undo_q=[]
    )

    tmp_out['AttrList'] = [{
        'label': amodel.corp.get_conf(f'{n}.LABEL') or n,
        'n': n,
        'multisep': amodel.corp.get_conf(f'{n}.MULTISEP')
    } for n in attrlist if n]

    tmp_out['StructAttrList'] = [{'label': amodel.corp.get_conf(f'{n}.LABEL') or n, 'n': n}
                                 for n in amodel.corp.get_structattrs()
                                 if n]
    tmp_out['StructList'] = amodel.corp.get_structs()
    sref = amodel.corp.get_conf('SHORTREF')
    tmp_out['fcrit_shortref'] = '+'.join([a.strip('=') + ' 0' for a in sref.split(',')])

    if amodel.corp.get_conf('FREQTTATTRS'):
        ttcrit_attrs = amodel.corp.get_conf('FREQTTATTRS')
    else:
        ttcrit_attrs = amodel.corp.get_conf('SUBCORPATTRS')
    tmp_out['ttcrit'] = [f'{a} 0' for a in ttcrit_attrs.replace('|', ',').split(',') if a]

    amodel.add_conc_form_args(
        await QueryFormArgs.create(
            plugin_ctx=amodel.plugin_ctx,
            corpora=amodel.select_current_aligned_corpora(
                active_only=False),
            persist=False))
    await amodel.attach_query_params(tmp_out)
    await amodel.attach_aligned_query_params(tmp_out)
    amodel.export_subcorpora_list(amodel.args.corpname, amodel.args.usesubcorp, tmp_out)
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
    ans = dict(
        corpname=amodel.args.corpname,
        subcorpname=amodel.corp.subcname if amodel.corp.is_subcorpus else None,
        baseAttr=amodel.BASE_ATTR,
        tagsets=[tagset.to_dict() for tagset in corpus_info.tagsets],
        humanCorpname=amodel.human_readable_corpname(),
        corpusIdent=dict(
            id=amodel.args.corpname, name=amodel.human_readable_corpname(),
            variant=amodel.corpus_variant,
            usesubcorp=amodel.args.usesubcorp if amodel.args.usesubcorp else None,
            origSubcorpName=amodel.corp.orig_subcname,
            foreignSubcorp=(amodel.corp.author_id is not None and
                            amodel.session_get('user', 'id') != amodel.corp.author_id),
            size=amodel.corp.size,
            searchSize=amodel.corp.search_size),
        currentArgs=conc_args,
        concPersistenceOpId=None,
        alignedCorpora=amodel.args.align,
        availableAlignedCorpora=avail_al_corp,
        activePlugins=plg_status['active_plugins'],
        queryOverview=[],
        numQueryOps=0,
        textTypesData=await amodel.tt.export_with_norms(ret_nums=True),
        Wposlist=[{'n': x.pos, 'v': x.pattern} for x in poslist],
        AttrList=tmp_out['AttrList'],
        AlignCommonPosAttrs=list(align_common_posattrs),
        StructAttrList=tmp_out['StructAttrList'],
        StructList=tmp_out['StructList'],
        InputLanguages=tmp_out['input_languages'],
        ConcFormsArgs=tmp_out['conc_forms_args'],
        CurrentSubcorp=amodel.args.usesubcorp,
        SubcorpList=tmp_out['SubcorpList'],
        TextTypesNotes=corpus_info.metadata.desc,
        TextDirectionRTL=True if amodel.corp.get_conf('RIGHTTOLEFT') else False,
        structsAndAttrs=await amodel.get_structs_and_attrs(),
        DefaultVirtKeyboard=corpus_info.metadata.default_virt_keyboard,
        SimpleQueryDefaultAttrs=corpus_info.simple_query_default_attrs,
        QSEnabled=amodel.args.qs_enabled,
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
    amodel.add_conc_form_args(ksargs)
    return await _view(amodel, req, resp)


@bp.route('/filter', methods=['POST'])
@http_action(access_level=1, mutates_result=True, return_type='json', action_model=ConcActionModel)
async def filter(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    Positive/Negative filter
    """
    def store_last_op(conc_ids: List[str], history_ts: Optional[int], _):
        if history_ts:
            amodel.store_last_search('conc:filter', conc_ids[0])

    if len(amodel.lines_groups) > 0:
        raise UserActionException('Cannot apply a filter once a group of lines has been saved')

    maincorp = amodel.args.maincorp if amodel.args.maincorp else amodel.args.corpname
    ff_args = await FilterFormArgs.create(amodel.plugin_ctx, maincorp, True)
    ff_args.update_by_user_query(req.json)
    err = ff_args.validate()
    if err is not None:
        raise UserActionException(err)

    amodel.add_conc_form_args(ff_args)
    rank = dict(f=1, l=-1).get(ff_args.data.filfl, 1)
    texttypes = TextTypeCollector(amodel.corp, {}).get_query()
    try:
        # TODO get rid of private method
        query = amodel._compile_query(form=ff_args, corpus=maincorp)
        if query is None:
            raise ConcordanceQueryParamsError(req.translate('No query entered.'))
    except ConcordanceQueryParamsError:
        if texttypes:
            query = '[]'
            ff_args.filfpos = '0'
            ff_args.filtpos = '0'
        else:
            raise ConcordanceQueryParamsError(req.translate('No query entered.'))
    query += ' '.join([f'within <{nq[0]} {nq[1]} />' for nq in texttypes])
    if ff_args.data.within:
        wquery = f' within {maincorp}:({query})'
        amodel.args.q[0] += wquery
        amodel.args.q.append(f'x-{maincorp}')
    else:
        wquery = ''
        amodel.args.q.append(
            f'{ff_args.data.pnfilter}{ff_args.data.filfpos} {ff_args.data.filtpos} {rank} {query}')

    amodel.on_conc_store = store_last_op
    resp.set_http_status(201)
    try:
        return await _view(amodel, req, resp)
    except Exception as ex:
        logging.getLogger(__name__).error(f'Failed to apply filter: {ex}')
        if ff_args.data.within:
            amodel.args.q[0] = amodel.args.q[0][:-len(wquery)]
        else:
            del amodel.args.q[-1]
        raise


@bp.route('/quick_filter', methods=['POST'])
@http_action(template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def quick_filter(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    A filter generated directly from a link (e.g. "p"/"n" links on freqs/colls/pquery pages).
    """
    new_q = req.args.getlist('q2')
    q_conv = QuickFilterArgsConv(amodel.plugin_ctx, amodel.args)

    op_idx = len(amodel.args.q)
    if len(new_q) > 0:
        ff_args = q_conv(new_q[0])
        amodel.add_conc_form_args(ff_args)
        amodel.args.q.append(new_q[0])
        op_idx += 1
    for q in new_q[1:]:
        ff_args = q_conv(q)
        amodel.acknowledge_auto_generated_conc_op(op_idx, ff_args)
        amodel.args.q.append(q)
        op_idx += 1
    return await _view(amodel, req, resp)


@bp.route('/filter_subhits')
@http_action(access_level=0, template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def filter_subhits(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    if len(amodel.lines_groups) > 0:
        raise UserActionException(
            'Cannot apply the function once a group of lines has been saved')
    amodel.add_conc_form_args(SubHitsFilterFormArgs(persist=True))
    amodel.args.q.append('D')
    return await _view(amodel, req, resp)


@bp.route('/filter_firsthits', ['POST'])
@http_action(access_level=0, template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def filter_firsthits(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    if len(amodel.lines_groups) > 0:
        raise UserActionException(
            'Cannot apply the function once a group of lines has been saved')
    elif len(amodel.args.align) > 0:
        raise UserActionException('The function is not supported for aligned corpora')
    amodel.add_conc_form_args(FirstHitsFilterFormArgs(
        persist=True, doc_struct=amodel.corp.get_conf('DOCSTRUCTURE')))
    amodel.args.q.append('F{0}'.format(req.args.get('fh_struct')))
    return await _view(amodel, req, resp)


@bp.route('/sortx', ['POST'])
@http_action(access_level=1, template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def sortx(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    simple sort concordance
    """
    amodel.disabled_menu_items = ()

    if len(amodel.lines_groups) > 0:
        raise UserActionException('Cannot apply a sorting once a group of lines has been saved')

    qinfo = SortFormArgs(persist=True)
    qinfo.update_by_user_query(req.json)
    amodel.add_conc_form_args(qinfo)

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
    return await _view(amodel, req, resp)


@bp.route('/mlsortx', ['POST'])
@http_action(access_level=1, template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def mlsortx(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    """
    multiple level sort concordance
    """
    qinfo = SortFormArgs(persist=True)
    qinfo.update_by_user_query(req.json)
    amodel.add_conc_form_args(qinfo)

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
    return await _view(amodel, req, resp)


@bp.route('/shuffle')
@http_action(access_level=0, template='view.html', page_model='view', mutates_result=True, action_model=ConcActionModel)
async def shuffle(amodel: ConcActionModel, req: KRequest, resp: KResponse):
    if len(amodel.lines_groups) > 0:
        raise UserActionException('Cannot apply a shuffle once a group of lines has been saved')
    amodel.add_conc_form_args(ShuffleFormArgs(persist=True))
    amodel.args.q.append('f')
    return await _view(amodel, req, resp)
