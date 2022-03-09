import os
from typing import Optional, Dict, List, Any
from sanic import Blueprint
import logging
from dataclasses import asdict
from action.decorators import http_action
from action.model.concordance import ConcActionModel
from action.argmapping.conc import build_conc_form_args, QueryFormArgs
from plugin_types.query_persistence.error import QueryPersistenceRecNotFound
from plugin_types.conc_cache import ConcCacheStatusException
from action.argmapping import log_mapping, ConcArgsMapping, WidectxArgsMapping
from action.argmapping.analytics import CollFormArgs, FreqFormArgs, CTFreqFormArgs
from action.argmapping.conc import ShuffleFormArgs
from action.errors import NotFoundException, UserActionException
from translation import ugettext
import conclib
from conclib.search import get_conc
from conclib.errors import (
    ConcordanceException, ConcordanceSpecificationError, UnknownConcordanceAction, extract_manatee_error)
from conclib.empty import InitialConc
from kwiclib import KwicPageArgs, Kwic
import plugins
from main_menu import MainMenu
import settings


bp = Blueprint('concordance')


@bp.route('/query')
@http_action(template='query.html', page_model='query', action_model=ConcActionModel)
async def query(action_model, req, resp):
    action_model.disabled_menu_items = (
        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
        MainMenu.VIEW('kwic-sent-switch'))
    out = {'aligned_corpora': action_model.args.align}
    tt_data = action_model.tt.export_with_norms(ret_nums=True)
    out['Normslist'] = tt_data['Normslist']
    out['text_types_data'] = tt_data

    corp_info = action_model.get_corpus_info(action_model.args.corpname)
    out['text_types_notes'] = corp_info.metadata.desc
    out['default_virt_keyboard'] = corp_info.metadata.default_virt_keyboard

    qf_args = action_model.fetch_prev_query('conc') if action_model._active_q_data is None else None
    if qf_args is None:
        qf_args = QueryFormArgs(
            plugin_ctx=action_model.plugin_ctx,
            corpora=[action_model.args.corpname] + action_model.args.align,
            persist=False)
    action_model.add_conc_form_args(qf_args)
    action_model.attach_query_params(out)
    action_model.attach_aligned_query_params(out)
    action_model.export_subcorpora_list(action_model.args.corpname, action_model.args.usesubcorp, out)
    return out


@bp.route('/query_submit', methods=['POST'])
@http_action(
    mutates_result=True, action_log_mapper=log_mapping.query_submit, return_type='json', action_model=ConcActionModel)
async def query_submit(amodel, req, resp):

    def store_last_op(conc_ids: List[str], history_ts: Optional[int], _):
        if history_ts:
            amodel.store_last_search('conc', conc_ids[0])

    amodel.clear_prev_conc_params()
    ans = {}
    # 1) store query forms arguments for later reuse on client-side
    corpora = amodel.select_current_aligned_corpora(active_only=True)
    corpus_info = amodel.get_corpus_info(corpora[0])
    qinfo = QueryFormArgs(plugin_ctx=amodel.plugin_ctx, corpora=corpora, persist=True)
    qinfo.update_by_user_query(
        req.json, amodel.get_tt_bib_mapping(req.json['text_types']))
    amodel.add_conc_form_args(qinfo)
    # 2) process the query
    try:
        amodel.set_first_query(
            [q['corpname'] for q in req.json['queries']], qinfo, corpus_info)
        if amodel.args.shuffle == 1 and 'f' not in amodel.args.q:
            amodel.args.shuffle = 0
            amodel.args.q.append('f')
            amodel.acknowledge_auto_generated_conc_op(
                len(amodel.args.q) - 1, ShuffleFormArgs(persist=True))
        logging.getLogger(__name__).debug('query: {}'.format(amodel.args.q))
        conc = get_conc(corp=amodel.corp, user_id=amodel.session_get('user', 'id'), q=amodel.args.q,
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


# TODO vars=('orig_query', ) ??
@bp.route('/view')
@http_action(
    mutates_result=False, action_log_mapper=log_mapping.view, template='view.html', action_model=ConcActionModel)
async def view(amodel, req, resp):
    """
    KWIC view
    """
    corpus_info = amodel.get_corpus_info(amodel.args.corpname)
    if amodel.args.refs is None:  # user did not set this at all (!= user explicitly set '')
        amodel.args.refs = amodel.corp.get_conf('SHORTREF')

    if amodel.args.fromp < 1:
        raise UserActionException(ugettext('Invalid page number'))
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
        conc = get_conc(
            corp=amodel.corp, user_id=req.session_get('user', 'id'), q=amodel.args.q,
            fromp=amodel.args.fromp, pagesize=amodel.args.pagesize, asnc=asnc,
            samplesize=corpus_info.sample_size)
        if conc:
            amodel.apply_linegroups(conc)
            conc.switch_aligned(os.path.basename(amodel.args.corpname))

            kwic_args = KwicPageArgs(asdict(amodel.args), base_attr=amodel.BASE_ATTR)
            kwic_args.speech_attr = amodel.get_speech_segment()
            kwic_args.labelmap = {}
            kwic_args.alignlist = [amodel.cm.get_corpus(c) for c in amodel.args.align if c]
            kwic_args.structs = amodel.get_struct_opts()
            kwic = Kwic(amodel.corp, amodel.args.corpname, conc)

            out['Sort_idx'] = kwic.get_sort_idx(q=amodel.args.q, pagesize=amodel.args.pagesize)
            out.update(kwic.kwicpage(kwic_args))
            out.update(amodel.get_conc_sizes(conc))
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
        msg = ugettext(
            'No result. Please make sure the query and selected query type are correct.')
        amodel.add_system_message('info', msg)

    amodel.add_save_menu_item(
        'CSV', save_format='csv',
        hint=ugettext('Saves at most {0} items. Use "Custom" for more options.'.format(
            amodel.CONC_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(
        'XLSX', save_format='xlsx',
        hint=ugettext('Saves at most {0} items. Use "Custom" for more options.'.format(
            amodel.CONC_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(
        'XML', save_format='xml',
        hint=ugettext('Saves at most {0} items. Use "Custom" for more options.'.format(
            amodel.CONC_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(
        'TXT', save_format='text',
        hint=ugettext('Saves at most {0} items. Use "Custom" for more options.'.format(
            amodel.CONC_QUICK_SAVE_MAX_LINES)))
    amodel.add_save_menu_item(ugettext('Custom'))

    # unlike 'globals' 'widectx_globals' stores full structs+structattrs information
    # to be able to display extended context with all set structural attributes
    out['widectx_globals'] = amodel.get_mapped_attrs(
        WidectxArgsMapping, dict(structs=amodel.get_struct_opts()))
    out['conc_line_max_group_num'] = settings.get_int('global', 'conc_line_max_group_num', 99)
    out['aligned_corpora'] = amodel.args.align
    out['line_numbers'] = amodel.args.line_numbers if amodel.args.line_numbers else False
    out['speech_segment'] = amodel.get_speech_segment()
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
    out['text_types_data'] = amodel.tt.export_with_norms(ret_nums=True)
    qf_args = amodel.fetch_prev_query('conc:filter')
    if qf_args and qf_args.data.maincorp != amodel.args.corpname:
        qf_args = None
    amodel.attach_query_params(out, filter=qf_args)
    out['coll_form_args'] = CollFormArgs().update(amodel.args).to_dict()
    out['freq_form_args'] = FreqFormArgs().update(amodel.args).to_dict()
    out['ctfreq_form_args'] = CTFreqFormArgs().update(amodel.args).to_dict()
    amodel.export_subcorpora_list(amodel.args.corpname, amodel.args.usesubcorp, out)

    out['fast_adhoc_ipm'] = plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(
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


@bp.route('/concdesc_json')
@http_action(return_type='json', action_model=ConcActionModel)
async def concdesc_json(amodel, req, resp) -> Dict[str, List[Dict[str, Any]]]:
    return {'Desc': amodel.concdesc_json()}


@bp.route('/ajax_fetch_conc_form_args')
@http_action(return_type='json', action_model=ConcActionModel)
async def ajax_fetch_conc_form_args(amodel, req, resp) -> Dict[str, Any]:
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
        raise NotFoundException(ugettext('Query information not stored: {}').format(ex))
