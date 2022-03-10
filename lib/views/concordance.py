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
from main_menu import MainMenu, generate_main_menu
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


@bp.route('/widectx')
@http_action(access_level=0, action_log_mapper=log_mapping.widectx, action_model=ConcActionModel)
async def widectx(amodel, req, resp):
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
async def ajax_switch_corpus(amodel, req, resp):
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
        QueryFormArgs(
            plugin_ctx=amodel.plugin_ctx,
            corpora=amodel.select_current_aligned_corpora(
                active_only=False),
            persist=False))
    amodel.attach_query_params(tmp_out)
    amodel.attach_aligned_query_params(tmp_out)
    amodel.export_subcorpora_list(amodel.args.corpname, amodel.args.usesubcorp, tmp_out)
    corpus_info = amodel.get_corpus_info(amodel.args.corpname)
    plg_status = {}
    amodel.export_optional_plugins_conf(plg_status)
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
        textTypesData=amodel.tt.export_with_norms(ret_nums=True),
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
        structsAndAttrs=amodel.get_structs_and_attrs(),
        DefaultVirtKeyboard=corpus_info.metadata.default_virt_keyboard,
        SimpleQueryDefaultAttrs=corpus_info.simple_query_default_attrs,
        QSEnabled=amodel.args.qs_enabled,
    )
    amodel.attach_plugin_exports(ans, direct=True)
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
