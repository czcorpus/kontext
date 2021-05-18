# Copyright (c) 2003-2009  Pavel Rychly
# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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
import sys
import re
import json
from collections import defaultdict
import time
from typing import Dict, Any, List, Union

from controller.kontext import LinesGroups, Kontext
from controller import exposed
from controller.errors import UserActionException, ImmediateRedirectException, NotFoundException
from argmapping.query import (FilterFormArgs, QueryFormArgs, SortFormArgs, SampleFormArgs, ShuffleFormArgs,
                              LgroupOpArgs, LockedOpFormsArgs, ContextFilterArgsConv, QuickFilterArgsConv,
                              KwicSwitchArgs, SubHitsFilterFormArgs, FirstHitsFilterFormArgs)
from argmapping import log_mapping
from argmapping.analytics import CollFormArgs, FreqFormArgs, CTFreqFormArgs
from argmapping import ConcArgsMapping
import settings
import conclib
from conclib.empty import InitialConc
from conclib.search import get_conc
from conclib.calc import cancel_conc_task, require_existing_conc, ConcNotFoundException
from conclib.errors import UnknownConcordanceAction
import corplib
from bgcalc import freq_calc, coll_calc, calc_backend_client
from bgcalc.errors import CalcTaskNotFoundError
import plugins
from kwiclib import Kwic, KwicPageArgs
from l10n import corpus_get_conf
from translation import ugettext as translate
from argmapping import WidectxArgsMapping
from texttypes import TextTypeCollector
from texttypes.cache import TextTypesCache
from main_menu import MenuGenerator, MainMenu
from controller.querying import Querying
import templating
import mailing
import attr
from conclib.freq import one_level_crit, multi_level_crit
from strings import re_escape, escape_attr_val
import plugins.abstract.conc_cache


class ConcError(UserActionException):
    pass


class Actions(Querying):
    """
    KonText actions are specified here
    """

    SAVECOLL_MAX_LINES = 1000000
    CONC_QUICK_SAVE_MAX_LINES = 10000
    FREQ_QUICK_SAVE_MAX_LINES = 10000
    COLLS_QUICK_SAVE_MAX_LINES = 10000

    """
    This class specifies all the actions KonText offers to a user via HTTP
    """

    def __init__(self, request, ui_lang, tt_cache: TextTypesCache):
        """
        arguments:
        request -- werkzeug's Request obj.
        ui_lang -- a language code in which current action's result will be presented
        """
        super(Actions, self).__init__(request=request, ui_lang=ui_lang, tt_cache=tt_cache)
        self.disabled_menu_items = ()

    def get_mapping_url_prefix(self):
        """
        This is required as it maps the controller to request URLs
        """
        return '/'

    def get_speech_segment(self):
        """
        Returns a speech segment (= structural attribute, e.g. 'sp.audio')
        if the current corpus has one configured.

        Returns:
            str: segment name if speech_segment is configured in 'corpora.xml' and it actually exists; else None
        """
        speech_struct = self.get_corpus_info(self.args.corpname).get('speech_segment')
        if speech_struct is not None:
            return tuple(speech_struct.split('.'))
        else:
            return None

    def _get_speech_segment(self):
        """
        Returns:
            tuple (structname, attr_name)
        """
        segment_str = self.get_corpus_info(self.args.corpname).get('speech_segment')
        if segment_str:
            return tuple(segment_str.split('.'))
        return None

    def add_globals(self, result, methodname, action_metadata):
        super().add_globals(result, methodname, action_metadata)
        conc_args = templating.StateGlobals(self._get_mapped_attrs(ConcArgsMapping))
        conc_args.set('q', [q for q in result.get('Q')])
        args = {}
        result['Globals'] = conc_args.update(args)
        result['conc_dashboard_modules'] = settings.get_list('global', 'conc_dashboard_modules')

    def _apply_linegroups(self, conc):
        """
        Applies user-defined line groups stored in conc_persistence
        to the provided concordance instance.
        """
        if self._lines_groups.is_defined():
            for lg in self._lines_groups:
                conc.set_linegroup_at_pos(lg[0], lg[2])
            if self._lines_groups.sorted:
                conclib.sort_line_groups(conc, [x[2] for x in self._lines_groups])

    def _get_ipm_base_set_desc(self, contains_within):
        """
        Generates a proper description for i.p.m. depending on the
        method used to select texts:
        1 - whole corpus
        2 - a named subcorpus
        3 - an ad-hoc subcorpus
        """
        corpus_name = self.corp.get_conf('NAME')
        if contains_within:
            return translate('related to the subset defined by the selected text types')
        elif hasattr(self.corp, 'subcname'):
            return (translate('related to the whole %s') % (corpus_name,)) + \
                ':%s' % self.corp.subcname
        else:
            return translate('related to the whole %s') % corpus_name

    @staticmethod
    def _create_empty_conc_result_dict() -> Dict[str, Any]:
        """
        Create a minimal concordance result data required by the client-side app to operate properly.
        """
        pagination = dict(lastPage=0, prevPage=None, nextPage=None, firstPage=0)
        return dict(Lines=[], CorporaColumns=[], KWICCorps=[], pagination=pagination, Sort_idx=[],
                    concsize=0, fullsize=0, sampled_size=0, result_relative_freq=0, result_arf=0,
                    result_shuffled=False, finished=True)

    def _apply_viewmode(self, sentence_struct):
        if self.args.viewmode == 'kwic':
            self.args.leftctx = self.args.kwicleftctx
            self.args.rightctx = self.args.kwicrightctx
        elif self.args.viewmode == 'align' and self.args.align:
            self.args.leftctx = 'a,%s' % os.path.basename(self.args.corpname)
            self.args.rightctx = 'a,%s' % os.path.basename(self.args.corpname)
        else:
            self.args.leftctx = self.args.senleftctx_tpl % sentence_struct
            self.args.rightctx = self.args.senrightctx_tpl % sentence_struct

    def _attach_query_overview(self, out):
        out['query_overview'] = self.concdesc_json().get('Desc', [])
        if len(out['query_overview']) > 0:
            out['page_title'] = '{0} / {1}'.format(self._human_readable_corpname(),
                                                   out['query_overview'][0].get('nicearg'))

    @exposed(vars=('orig_query', ), mutates_conc=False, action_log_mapper=log_mapping.view)
    def view(self, request):
        """
        KWIC view
        """
        corpus_info = self.get_corpus_info(self.args.corpname)
        if self.args.refs is None:  # user did not set this at all (!= user explicitly set '')
            self.args.refs = self.corp.get_conf('SHORTREF')

        if self.args.fromp < 1:
            raise UserActionException(translate('Invalid page number'))
        if self.args.pagesize < 1:
            raise UserActionException('Invalid page size')

        self._apply_viewmode(corpus_info['sentence_struct'])

        i = 0
        while i < len(self.args.q):
            if self.args.q[i].startswith('s*') or self.args.q[i][0] == 'e':
                del self.args.q[i]
            i += 1
        out = self._create_empty_conc_result_dict()
        out['result_shuffled'] = not conclib.conc_is_sorted(self.args.q)
        out['items_per_page'] = self.args.pagesize
        conc = InitialConc(self.corp, None)
        asnc = bool(int(request.args['asnc'])) if 'asnc' in request.args else False
        try:
            conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'), q=self.args.q,
                            fromp=self.args.fromp, pagesize=self.args.pagesize, asnc=asnc,
                            save=self.args.save, samplesize=corpus_info.sample_size)
            if conc:
                self._apply_linegroups(conc)
                conc.switch_aligned(os.path.basename(self.args.corpname))

                kwic_args = KwicPageArgs(attr.asdict(self.args), base_attr=Kontext.BASE_ATTR)
                kwic_args.speech_attr = self._get_speech_segment()
                kwic_args.labelmap = {}
                kwic_args.alignlist = [self.cm.get_Corpus(c) for c in self.args.align if c]
                kwic_args.structs = self._get_struct_opts()
                kwic = Kwic(self.corp, self.args.corpname, conc)

                out['Sort_idx'] = kwic.get_sort_idx(q=self.args.q, pagesize=self.args.pagesize)
                out.update(kwic.kwicpage(kwic_args))
                out.update(self.get_conc_sizes(conc))
        except TypeError as ex:
            self.add_system_message('error', str(ex))
            logging.getLogger(__name__).error(ex)
        except (plugins.abstract.conc_cache.CalcStatusException, RuntimeError) as ex:
            if 'syntax error' in f'{ex}'.lower():
                self.add_system_message(
                    'error', translate('Syntax error. Please check the query and its type.'))
            elif 'AttrNotFound' in str(ex):
                raise UserActionException(ex)
            else:
                raise ex
        except UnknownConcordanceAction as ex:
            raise UserActionException(str(ex))

        if self.args.viewmode == 'sen':
            corplib.add_block_items(out['Lines'], block_size=1)
        if self.corp.get_conf('ALIGNED'):
            out['Aligned'] = [{'n': w,
                               'label': corplib.open_corpus(w).get_conf(
                                   'NAME') or w}
                              for w in self.corp.get_conf('ALIGNED').split(',')]
        if self.args.align and not self.args.maincorp:
            self.args.maincorp = self.args.corpname
        if conc.size() == 0 and conc.finished():
            msg = translate(
                'No result. Please make sure the query and selected query type are correct.')
            self.add_system_message('info', msg)

        self._add_save_menu_item('CSV', save_format='csv',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XLSX', save_format='xlsx',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XML', save_format='xml',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('TXT', save_format='text',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item(translate('Custom'))

        # unlike 'globals' 'widectx_globals' stores full structs+structattrs information
        # to be able to display extended context with all set structural attributes
        out['widectx_globals'] = self._get_mapped_attrs(
            WidectxArgsMapping, dict(structs=self._get_struct_opts()))
        out['conc_line_max_group_num'] = settings.get_int('global', 'conc_line_max_group_num', 99)
        out['aligned_corpora'] = self.args.align
        out['line_numbers'] = self.args.line_numbers if self.args.line_numbers else False
        out['speech_segment'] = self.get_speech_segment()
        out['speaker_id_attr'] = corpus_info.speaker_id_attr.split(
            '.') if corpus_info.speaker_id_attr else None
        out['speech_overlap_attr'] = corpus_info.speech_overlap_attr.split(
            '.') if corpus_info.speech_overlap_attr else None
        out['speech_overlap_val'] = corpus_info.speech_overlap_val
        out['conc_use_safe_font'] = corpus_info.use_safe_font
        speaker_struct = corpus_info.speaker_id_attr.split(
            '.')[0] if corpus_info.speaker_id_attr else None
        out['speech_attrs'] = [x[1] for x in [x for x in [x.split('.') for x in self.corp.get_conf(
            'STRUCTATTRLIST').split(',')] if x[0] == speaker_struct]]
        out['struct_ctx'] = self.corp.get_conf('STRUCTCTX')

        # query form data
        out['text_types_data'] = self.tt.export_with_norms(ret_nums=True)
        self._attach_query_params(out)
        out['coll_form_args'] = CollFormArgs().update(self.args).to_dict()
        out['freq_form_args'] = FreqFormArgs().update(self.args).to_dict()
        out['ctfreq_form_args'] = CTFreqFormArgs().update(self.args).to_dict()
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, out)

        out['fast_adhoc_ipm'] = plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(
            self._plugin_api, self.args.corpname)
        out['running_calc'] = not out['finished']   # TODO running_calc is redundant
        out['chart_export_formats'] = []
        with plugins.runtime.CHART_EXPORT as ce:
            out['chart_export_formats'].extend(ce.get_supported_types())
        out['quick_save_row_limit'] = self.CONC_QUICK_SAVE_MAX_LINES
        if conc is not None and conc.get_conc_file():
            out['conc_cache_key'] = os.path.splitext(os.path.basename(conc.get_conc_file()))[0]
        else:
            out['conc_cache_key'] = None
        self._attach_query_overview(out)
        return out

    @exposed(mutates_conc=True, template='view.html', page_model='view', action_log_mapper=log_mapping.view)
    def create_view(self, request):
        """
        This is intended for direct conc. access via external pages (i.e. no query_submit + view and just directly
        to the result by providing raw CQL query
        """
        return self.view(request)

    @exposed(access_level=1, return_type='json', http_method='POST', skip_corpus_init=True)
    def archive_concordance(self, request):
        with plugins.runtime.CONC_PERSISTENCE as cp:
            revoke = bool(int(request.args['revoke']))
            cn, row = cp.archive(self.session_get('user', 'id'),
                                 request.args['code'], revoke=revoke)
        return dict(revoked=revoke, num_changes=cn, archived_conc=row)

    @exposed(access_level=1, return_type='json', skip_corpus_init=True)
    def get_stored_conc_archived_status(self, request):
        with plugins.runtime.CONC_PERSISTENCE as cp:
            return dict(is_archived=cp.is_archived(request.args['code']))

    @exposed(access_level=1, return_type='json', http_method='POST', skip_corpus_init=True)
    def save_query(self, request):
        with plugins.runtime.QUERY_STORAGE as qs:
            ans = qs.make_persistent(self.session_get('user', 'id'), request.form['query_id'],
                                     request.form['name'])
        return dict(saved=ans)

    @exposed(access_level=1, return_type='json', http_method='POST', skip_corpus_init=True)
    def delete_query(self, request):
        with plugins.runtime.QUERY_STORAGE as qs:
            ans = qs.delete(self.session_get('user', 'id'), request.form['query_id'])
        return dict(deleted=ans)

    @exposed()
    def first_form(self, request):
        self.redirect(self.create_url('query', request.args), code=301)
        return {}

    @exposed(apply_semi_persist_args=True, action_log_mapper=log_mapping.query)
    def query(self, request):
        self.disabled_menu_items = (MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
                                    MainMenu.VIEW('kwic-sentence'))
        out = {}
        out['aligned_corpora'] = self.args.align
        tt_data = self.tt.export_with_norms(ret_nums=True)
        out['Normslist'] = tt_data['Normslist']
        out['text_types_data'] = tt_data

        corp_info = self.get_corpus_info(self.args.corpname)
        out['text_types_notes'] = corp_info.metadata.desc
        out['default_virt_keyboard'] = corp_info.metadata.default_virt_keyboard

        last_op = self.session_get('last_submitted_op')
        qf_args = QueryFormArgs(corpora=self._select_current_aligned_corpora(
            active_only=False), persist=False)
        with plugins.runtime.QUERY_STORAGE as qs:
            qdata = qs.find_by_qkey(last_op)
            if qdata is not None:
                prev_corpora = qdata.get('corpora', [])
                prev_subcorp = qdata.get('usesubcorp', None)
                curr_corpora = [self.args.corpname] + self.args.align
                curr_subcorp = self.args.usesubcorp

                args = [('corpname', prev_corpora[0])]
                if len(prev_corpora) > 1 and len(curr_corpora) == 1 and prev_corpora[0] == curr_corpora[0]:
                    args += [('align', a) for a in prev_corpora[1:]]
                if prev_subcorp and not curr_subcorp:
                    args += [('usesubcorp', prev_subcorp)]
                if len(args) > 1:
                    raise ImmediateRedirectException(self.create_url('query', args))

                try:
                    qf_args.apply_last_used_opts(
                        data=qdata.get('lastop_form', {}),
                        prev_corpora=prev_corpora,
                        curr_corpora=curr_corpora,
                        curr_posattrs=self.corp.get_conf('ATTRLIST').split(','))
                except Exception as ex:
                    logging.getLogger(__name__).warning(
                        'Cannot restore prev. query form: {}'.format(ex))
            qdata = qs.find_by_qkey(request.args.get('qkey'))
            if qdata is not None:
                qf_args = qf_args.updated(qdata.get('lastop_form', {}), request.args.get('qkey'))
        # TODO xx reuse selections from last submit
        self.add_conc_form_args(qf_args)
        self._attach_query_params(out)
        self._attach_aligned_query_params(out)
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, out)
        return out

    @exposed(return_type='json')
    def get_conc_cache_status(self, _):
        self._headers['Content-Type'] = 'text/plain'
        cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(self.corp)
        q = tuple(self.args.q)
        subchash = getattr(self.corp, 'subchash', None)
        try:
            cache_status = cache_map.get_calc_status(subchash, q)
            if cache_status is None:  # conc is not cached nor calculated
                raise NotFoundException('Concordance calculation is lost')
            elif not cache_status.finished and cache_status.task_id:
                # we must also test directly a respective task as might have been killed
                # and thus failed to store info to cache metadata
                app = calc_backend_client(settings)
                err = app.get_task_error(cache_status.task_id)
                if err is not None:
                    raise err
            return dict(
                finished=cache_status.finished,
                concsize=cache_status.concsize,
                fullsize=cache_status.fullsize,
                relconcsize=cache_status.relconcsize,
                arf=cache_status.arf)
        except CalcTaskNotFoundError as ex:
            cancel_conc_task(cache_map, subchash, q)
            raise NotFoundException(f'Concordance calculation is lost: {ex}')
        except Exception as ex:
            cancel_conc_task(cache_map, subchash, q)
            raise ex

    def get_conc_sizes(self, conc):
        i = 1
        concsize = conc.size()
        fullsize = conc.fullsize()
        sampled_size = 0
        while i < len(self.args.q) and not self.args.q[i].startswith('r'):
            i += 1
        if i < len(self.args.q):
            sampled_size = concsize

        for j in range(i + 1, len(self.args.q)):
            if self.args.q[j][0] in ('p', 'n'):
                return dict(concsize=concsize, sampled_size=0, relconcsize=0, fullsize=fullsize,
                            finished=conc.finished())
        if sampled_size:
            orig_conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'),
                                 q=self.args.q[:i], fromp=self.args.fromp, pagesize=self.args.pagesize,
                                 asnc=False, save=self.args.save)
            concsize = orig_conc.size()
            fullsize = orig_conc.fullsize()

        return dict(sampled_size=sampled_size, concsize=concsize,
                    relconcsize=1e6 * fullsize / self.corp.search_size(),
                    fullsize=fullsize, finished=conc.finished())

    @exposed(access_level=1, template='view.html', page_model='view', mutates_conc=True, http_method='POST')
    def sortx(self, request):
        """
        simple sort concordance
        """
        self.disabled_menu_items = ()

        if len(self._lines_groups) > 0:
            raise UserActionException('Cannot apply a sorting once a group of lines has been saved')

        qinfo = SortFormArgs(persist=True)
        qinfo.update_by_user_query(request.json)
        self.add_conc_form_args(qinfo)

        if qinfo.skey == 'lc':
            ctx = f'-1<0~-{qinfo.spos}<0'
        elif qinfo.skey == 'kw':
            ctx = '0<0~0>0'
        elif qinfo.skey == 'rc':
            ctx = f'1>0~{qinfo.spos}>0'
        else:
            ctx = ''
        if '.' in qinfo.sattr:
            ctx = ctx.split('~')[0]

        self.args.q.append(f's{qinfo.sattr}/{qinfo.sicase}{qinfo.sbward} {ctx}')
        return self.view(request)

    @exposed(access_level=1, template='view.html', page_model='view', mutates_conc=True, http_method='POST')
    def mlsortx(self, request):
        """
        multiple level sort concordance
        """
        qinfo = SortFormArgs(persist=True)
        qinfo.update_by_user_query(request.json)
        self.add_conc_form_args(qinfo)

        mlxfcode = 'rc'
        crit = one_level_crit('s', qinfo.ml1attr, qinfo.ml1ctx, qinfo.ml1pos, mlxfcode,
                              qinfo.ml1icase, qinfo.ml1bward)
        if qinfo.sortlevel > 1:
            crit += one_level_crit(' ', qinfo.ml2attr, qinfo.ml2ctx, qinfo.ml2pos, mlxfcode,
                                   qinfo.ml2icase, qinfo.ml2bward)
            if qinfo.sortlevel > 2:
                crit += one_level_crit(' ', qinfo.ml3attr, qinfo.ml3ctx, qinfo.ml3pos, mlxfcode,
                                       qinfo.ml3icase, qinfo.ml3bward)
        self.args.q.append(crit)
        return self.view(request)

    def _is_err_corpus(self):
        availstruct = self.corp.get_conf('STRUCTLIST').split(',')
        return 'err' in availstruct and 'corr' in availstruct

    def _compile_query(self, corpus: str, data: Union[QueryFormArgs, FilterFormArgs]):
        if isinstance(data, QueryFormArgs):
            qtype = data.curr_query_types[corpus]
            query = data.curr_queries[corpus]
            icase = '' if data.curr_qmcase_values[corpus] else '(?i)'
            attr = data.curr_default_attr_values[corpus]
            use_regexp = data.curr_use_regexp_values[corpus]
            query_parsed = [x for x, _ in data.curr_parsed_queries[corpus]]
        else:
            qtype = data.query_type
            query = data.query
            icase = '' if data.qmcase else '(?i)'
            attr = data.default_attr
            use_regexp = data.use_regexp
            query_parsed = [x for x, _ in data.parsed_query]

        if query.strip() == '':
            return None

        def mk_query_val(q):
            if qtype == 'advanced' or use_regexp:
                return q.strip()
            return icase + re_escape(q.strip())

        def stringify_parsed_query(q: List[List[str]]):
            expr = []
            for token_args in q:
                position = []
                for tok_attr, val in token_args:
                    if type(tok_attr) is str:
                        position.append(f'{tok_attr}="{mk_query_val(val)}"')
                    else:
                        position.append('({})'.format(' | '.join(
                            [f'{a2}="{mk_query_val(val)}"' for a2 in tok_attr])))
                expr.append('[' + ' & '.join(position) + ']')
            return ' '.join(expr)

        if qtype == 'simple':
            if query_parsed:
                return stringify_parsed_query(query_parsed)
            else:
                return ' '.join([f'[{attr}="{mk_query_val(part)}"]' for part in query.split(' ')])
        else:
            return re.sub(r'[\n\r]+', ' ', query).strip()

    def _set_first_query(self, corpora: List[str], data: QueryFormArgs):

        def append_form_filter_op(opIdx, attrname, items, ctx, fctxtype):
            filter_args = ContextFilterArgsConv(data)(corpora[0], attrname, items, ctx, fctxtype)
            self.acknowledge_auto_generated_conc_op(opIdx, filter_args)

        def ctx_to_str(ctx):
            return ' '.join(str(x) for x in ctx)

        def append_filter(idx: int, attrname, items, ctx, fctxtype) -> int:
            """
            return next idx of a new acknowledged auto-operation idx (to be able to continue
            with appending of other ops). I.e. if the last operation appended
            here has idx of 7 then the returned value will be 8.
            """
            if not items:
                return idx
            if fctxtype == 'any':
                self.args.q.append('P%s [%s]' %
                                   (ctx_to_str(ctx), '|'.join(['%s="%s"' % (attrname, i) for i in items])))
                append_form_filter_op(idx, attrname, items, ctx, fctxtype)
                return idx + 1
            elif fctxtype == 'none':
                self.args.q.append('N%s [%s]' %
                                   (ctx_to_str(ctx), '|'.join(['%s="%s"' % (attrname, i) for i in items])))
                append_form_filter_op(idx, attrname, items, ctx, fctxtype)
                return idx + 1
            elif fctxtype == 'all':
                for i, v in enumerate(items):
                    self.args.q.append('P%s [%s="%s"]' % (ctx_to_str(ctx), attrname, v))
                    append_form_filter_op(idx + i, attrname, [v], ctx, fctxtype)
                return idx + len(items)

        if 'lemma' in self.corp.get_conf('ATTRLIST').split(','):
            lemmaattr = 'lemma'
        else:
            lemmaattr = 'word'
        wposlist = dict(self.cm.corpconf_pairs(self.corp, 'WPOSLIST'))

        if data.curr_default_attr_values[corpora[0]]:
            qbase = f'a{data.curr_default_attr_values[corpora[0]]},'
        else:
            qbase = 'q'

        texttypes = TextTypeCollector(self.corp, data.selected_text_types).get_query()
        if texttypes:
            ttquery = ' '.join(['within <%s %s />' % nq for nq in texttypes])
        else:
            ttquery = ''
        par_query = ''
        nopq = []
        for al_corpname in corpora[1:]:
            wnot = '' if data.curr_pcq_pos_neg_values[al_corpname] == 'pos' else '!'
            pq = self._compile_query(corpus=al_corpname, data=data)
            if pq:
                par_query += 'within%s %s:%s' % (wnot, al_corpname, pq)
            if not pq or wnot:
                nopq.append(al_corpname)

        self.args.q = [
            ' '.join(x for x in [qbase + self._compile_query(corpora[0], data), ttquery, par_query] if x)]

        ag_op_idx = 1  # an initial index of auto-generated conc. operations
        ag_op_idx = append_filter(ag_op_idx,
                                  lemmaattr,
                                  data.fc_lemword.split(),
                                  (data.fc_lemword_wsize[0], data.fc_lemword_wsize[1], 1),
                                  data.fc_lemword_type)
        append_filter(ag_op_idx,
                      'tag',
                      [wposlist.get(t, '') for t in data.fc_pos],
                      (data.fc_pos_wsize[0], data.fc_pos_wsize[1], 1),
                      data.fc_pos_type)

        for al_corpname in corpora[1:]:
            if al_corpname in nopq and not int(data.curr_include_empty_values[al_corpname]):
                self.args.q.append('X%s' % al_corpname)
        if len(corpora) > 1:
            self.args.viewmode = 'align'

    @exposed(mutates_conc=True, http_method=('POST',), action_log_mapper=log_mapping.query_submit,
             return_type='json')
    def query_submit(self, request):

        def store_last_op(conc_ids: List[str]):
            self._session['last_submitted_op'] = conc_ids[0]

        self._clear_prev_conc_params()
        ans = {}
        # 1) store query forms arguments for later reuse on client-side
        corpora = self._select_current_aligned_corpora(active_only=True)
        corpus_info = self.get_corpus_info(corpora[0])
        qinfo = QueryFormArgs(corpora=corpora, persist=True)
        qinfo.update_by_user_query(
            request.json, self._get_tt_bib_mapping(request.json['text_types']))
        self.add_conc_form_args(qinfo)
        # 2) process the query
        try:
            self._set_first_query([q['corpname'] for q in request.json['queries']], qinfo)
            if self.args.shuffle == 1 and 'f' not in self.args.q:
                self.args.shuffle = 0
                self.args.q.append('f')
                self.acknowledge_auto_generated_conc_op(
                    len(self.args.q) - 1, ShuffleFormArgs(persist=True))
            logging.getLogger(__name__).debug('query: {}'.format(self.args.q))
            conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'), q=self.args.q,
                            fromp=self.args.fromp, pagesize=self.args.pagesize, asnc=qinfo.asnc,
                            save=self.args.save, samplesize=corpus_info.sample_size)
            ans['size'] = conc.size()
            ans['finished'] = conc.finished()
            self.on_conc_store = store_last_op
            self._status = 201
        except ConcError as e:
            ans['size'] = 0
            ans['finished'] = True
            self.add_system_message('warning', str(e))
        except plugins.abstract.conc_cache.CalcStatusException as ex:
            ans['size'] = 0
            ans['finished'] = True
            if 'syntax error' in f'{ex}'.lower():
                raise UserActionException(
                    translate('Syntax error. Please check the query and its type.'))
            elif 'AttrNotFound' in str(ex):
                raise UserActionException(ex)
            else:
                raise ex
        ans['conc_args'] = templating.StateGlobals(self._get_mapped_attrs(ConcArgsMapping)).export()
        self._attach_query_overview(ans)
        return ans

    @exposed(template='view.html', page_model='view', mutates_conc=True, http_method='POST')
    def quick_filter(self, request):
        """
        A filter generated directly from a link (e.g. "p"/"n" links on freqs/colls pages).
        """
        new_q = request.args.getlist('q2')
        q_conv = QuickFilterArgsConv(self.args)

        op_idx = len(self.args.q)
        if len(new_q) > 0:
            ff_args = q_conv(new_q[0])
            self.add_conc_form_args(ff_args)
            self.args.q.append(new_q[0])
            op_idx += 1
        for q in new_q[1:]:
            ff_args = q_conv(q)
            self.acknowledge_auto_generated_conc_op(op_idx, ff_args)
            self.args.q.append(q)
            op_idx += 1
        return self.view(request)

    @exposed(http_method='POST', template='view.html', page_model='view', mutates_conc=True)
    def switch_main_corp(self, request):
        maincorp = request.args['maincorp']
        self.args.q.append('x-{0}'.format(maincorp))
        ksargs = KwicSwitchArgs(maincorp=maincorp, persist=True)
        self.add_conc_form_args(ksargs)
        return self.view(request)

    @exposed(access_level=1, mutates_conc=True, http_method='POST', return_type='json')
    def filter(self, request):
        """
        Positive/Negative filter
        """
        if len(self._lines_groups) > 0:
            raise UserActionException('Cannot apply a filter once a group of lines has been saved')

        ff_args = FilterFormArgs(maincorp=self.args.maincorp if self.args.maincorp else self.args.corpname,
                                 persist=True)
        ff_args.update_by_user_query(request.json)
        err = ff_args.validate()
        if err is not None:
            raise UserActionException(err)
        self.add_conc_form_args(ff_args)
        rank = dict(f=1, l=-1).get(ff_args.filfl, 1)
        texttypes = TextTypeCollector(self.corp, {}).get_query()
        maincorp = self.args.maincorp if self.args.maincorp else self.args.corpname
        try:
            query = self._compile_query(data=ff_args, corpus=maincorp)
            if query is None:
                raise ConcError(translate('No query entered.'))
        except ConcError:
            if texttypes:
                query = '[]'
                ff_args.filfpos = '0'
                ff_args.filtpos = '0'
            else:
                raise ConcError(translate('No query entered.'))
        query += ' '.join(['within <%s %s />' % nq for nq in texttypes])
        if ff_args.within:
            wquery = f' within {maincorp}:({query})'
            self.args.q[0] += wquery
            self.args.q.append(f'x-{maincorp}')
        else:
            wquery = ''
            self.args.q.append(
                f'{ff_args.pnfilter}{ff_args.filfpos} {ff_args.filtpos} {rank} {query}')
        self._status = 201
        try:
            return self.view(request)
        except Exception as ex:
            logging.getLogger(__name__).error('Failed to apply filter: {}'.format(ex))
            if ff_args.within:
                self.args.q[0] = self.args.q[0][:-len(wquery)]
            else:
                del self.args.q[-1]
            raise

    @exposed(access_level=0, template='view.html', vars=('concsize',), page_model='view', mutates_conc=True, http_method='POST')
    def reduce(self, request):
        """
        random sample
        """
        if len(self._lines_groups) > 0:
            raise UserActionException(
                'Cannot apply a random sample once a group of lines has been saved')
        qinfo = SampleFormArgs(persist=True)
        qinfo.rlines = self.args.rlines
        self.add_conc_form_args(qinfo)
        self.args.q.append('r' + self.args.rlines)
        return self.view(request)

    @exposed(access_level=0, template='view.html', page_model='view', mutates_conc=True)
    def shuffle(self, request):
        if len(self._lines_groups) > 0:
            raise UserActionException('Cannot apply a shuffle once a group of lines has been saved')
        self.add_conc_form_args(ShuffleFormArgs(persist=True))
        self.args.q.append('f')
        return self.view(request)

    @exposed(access_level=0, template='view.html', page_model='view', mutates_conc=True)
    def filter_subhits(self, request):
        if len(self._lines_groups) > 0:
            raise UserActionException(
                'Cannot apply the function once a group of lines has been saved')
        self.add_conc_form_args(SubHitsFilterFormArgs(persist=True))
        self.args.q.append('D')
        return self.view(request)

    @exposed(access_level=0, template='view.html', page_model='view', func_arg_mapped=False,
             mutates_conc=True, http_method='POST')
    def filter_firsthits(self, request):
        if len(self._lines_groups) > 0:
            raise UserActionException(
                'Cannot apply the function once a group of lines has been saved')
        elif len(self.args.align) > 0:
            raise UserActionException('The function is not supported for aligned corpora')
        self.add_conc_form_args(FirstHitsFilterFormArgs(
            persist=True, doc_struct=self.corp.get_conf('DOCSTRUCTURE')))
        self.args.q.append('F{0}'.format(request.args.get('fh_struct')))
        return self.view(request)

    @exposed(mutates_conc=True)
    def restore_conc(self, request):
        out = self._create_empty_conc_result_dict()
        out['result_shuffled'] = not conclib.conc_is_sorted(self.args.q)
        out['items_per_page'] = self.args.pagesize
        try:
            corpus_info = self.get_corpus_info(self.args.corpname)
            conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'), q=self.args.q,
                            fromp=self.args.fromp, pagesize=self.args.pagesize, asnc=True,
                            save=self.args.save, samplesize=corpus_info.sample_size)
            if conc:
                self._apply_linegroups(conc)
                conc.switch_aligned(os.path.basename(self.args.corpname))

                kwic_args = KwicPageArgs(attr.asdict(self.args), base_attr=Kontext.BASE_ATTR)
                kwic_args.speech_attr = self._get_speech_segment()
                kwic_args.labelmap = {}
                kwic_args.alignlist = [self.cm.get_Corpus(c) for c in self.args.align if c]
                kwic_args.structs = self._get_struct_opts()

                kwic = Kwic(self.corp, self.args.corpname, conc)

                out['Sort_idx'] = kwic.get_sort_idx(q=self.args.q, pagesize=self.args.pagesize)
                out.update(kwic.kwicpage(kwic_args))
                out.update(self.get_conc_sizes(conc))
                if request.args.get('next') == 'freqs':
                    out['next_action'] = 'freqs'
                    out['next_action_args'] = {
                        'fcrit': request.args.get('fcrit'),
                        'flimit': request.args.get('flimit'),
                        'freq_sort': request.args.get('freq_sort'),
                        'ml': request.args.get('ml'),
                        'line_offset': request.args.get('line_offset'),
                        'force_cache': request.args.get('force_cache', '0')}
                elif request.args.get('next') == 'freqml':
                    out['next_action'] = 'freqml'
                    out['next_action_args'] = {
                        'flimit': request.args.get('flimit'),
                        'freqlevel': request.args.get('freqlevel'),
                        'ml1attr': request.args.get('ml1attr'),
                        'ml2attr': request.args.get('ml2attr'),
                        'ml3attr': request.args.get('ml3attr')
                    }
                elif request.args.get('next') == 'freqct':
                    out['next_action'] = 'freqct'
                    out['next_action_args'] = {
                        'ctminfreq': request.args.get('ctminfreq', '1'),
                        'ctminfreq_type': request.args.get('ctminfreq_type'),
                        'ctattr1': self.args.ctattr1,
                        'ctfcrit1': self.args.ctfcrit1,
                        'ctattr2': self.args.ctattr2,
                        'ctfcrit2': self.args.ctfcrit2}
                elif request.args.get('next') == 'collx':
                    out['next_action'] = 'collx'
                    out['next_action_args'] = {
                        'cattr': request.args.get('cattr'),
                        'csortfn': request.args.get('csortfn'),
                        'cbgrfns':  ''.join(request.args.get('cbgrfns')),
                        'cfromw': request.args.get('cfromw'),
                        'ctow': request.args.get('ctow'),
                        'cminbgr': request.args.get('cminbgr'),
                        'cminfreq': request.args.get('cminfreq'),
                        'citemsperpage': request.args.get('citemsperpage'),
                        'collpage': request.args.get('collpage'),
                        'line_offset': request.args.get('line_offset'),
                        'num_lines': request.args.get('num_lines')}
        except TypeError as ex:
            self.add_system_message('error', str(ex))
            logging.getLogger(__name__).error(ex)
        except plugins.abstract.conc_cache.CalcStatusException as ex:
            if 'syntax error' in f'{ex}'.lower():
                self.add_system_message(
                    'error', translate('Syntax error. Please check the query and its type.'))
            else:
                raise ex
        return out

    @exposed(access_level=0, func_arg_mapped=True, page_model='freq')
    def freqs(self, fcrit=(), flimit=0, freq_sort='', ml=0, line_offset=0, force_cache=0):
        """
        display a frequency list
        """
        try:
            require_existing_conc(self.corp, self.args.q)
            return self._freqs(fcrit, flimit, freq_sort, ml, line_offset, force_cache)
        except ConcNotFoundException:
            args = list(self._request.args.items()) + [('next', 'freqs')]
            raise ImmediateRedirectException(self.create_url('restore_conc', args))

    def _freqs(self, fcrit=(), flimit=0, freq_sort='', ml=0, line_offset=0, force_cache=0):

        self.disabled_menu_items = (MainMenu.CONCORDANCE('query-save-as'), MainMenu.VIEW('kwic-sent-switch'),
                                    MainMenu.CONCORDANCE('query-overview'))

        def parse_fcrit(fcrit):
            attrs, marks, ranges = [], [], []
            for i, item in enumerate(fcrit.split()):
                if i % 2 == 0:
                    attrs.append(item)
                if i % 2 == 1:
                    ranges.append(item)
            return attrs, ranges

        def is_non_structural_attr(criteria):
            crit_attrs = set(re.findall(r'(\w+)/\s+-?[0-9]+[<>][0-9]+\s*', criteria))
            if len(crit_attrs) == 0:
                crit_attrs = set(re.findall(r'(\w+\.\w+)\s+[0-9]+', criteria))
            attr_list = set(self.corp.get_conf('ATTRLIST').split(','))
            return crit_attrs <= attr_list

        result = {}
        fcrit_is_all_nonstruct = True
        for fcrit_item in fcrit:
            fcrit_is_all_nonstruct = (fcrit_is_all_nonstruct and is_non_structural_attr(fcrit_item))
        if fcrit_is_all_nonstruct:
            rel_mode = 1
        else:
            rel_mode = 0
        corp_info = self.get_corpus_info(self.args.corpname)

        args = freq_calc.FreqCalsArgs()
        args.corpname = self.corp.corpname
        args.subcname = getattr(self.corp, 'subcname', None)
        args.subcpath = self.subcpath
        args.user_id = self.session_get('user', 'id')
        args.q = self.args.q
        args.fromp = self.args.fromp
        args.pagesize = self.args.pagesize
        args.save = self.args.save
        args.samplesize = 0
        args.flimit = flimit
        args.fcrit = fcrit
        args.freq_sort = freq_sort
        args.ml = ml
        args.ftt_include_empty = self.args.ftt_include_empty
        args.rel_mode = rel_mode
        args.collator_locale = corp_info.collator_locale
        args.fmaxitems = self.args.fmaxitems
        args.fpage = self.args.fpage
        args.line_offset = line_offset
        args.force_cache = True if force_cache else False

        calc_result = freq_calc.calculate_freqs(args)
        result.update(
            fcrit=[('fcrit', cr) for cr in fcrit],
            FCrit=[{'fcrit': cr} for cr in fcrit],
            Blocks=calc_result['data'],
            paging=0,
            concsize=calc_result['conc_size'],
            fmaxitems=self.args.fmaxitems,
            quick_from_line=1,
            quick_to_line=None)

        if not result['Blocks'][0]:
            logging.getLogger(__name__).warning('freqs - empty list: %s' % (result,))
            result.update(
                message=('error', translate('Empty list')),
                Blocks=[],
                paging=0,
                quick_from_line=None,
                quick_to_line=None,
                FCrit=[],
                fcrit=[]
            )
        else:
            if len(result['Blocks']) == 1:  # paging
                result['paging'] = 1
                result['lastpage'] = calc_result['lastpage']

            for b in result['Blocks']:
                for item in b['Items']:
                    item['pfilter'] = []
                    item['nfilter'] = []
                    # generating positive and negative filter references
            for b_index, block in enumerate(result['Blocks']):
                curr_fcrit = fcrit[b_index]
                attrs, ranges = parse_fcrit(curr_fcrit)
                for level, (attr, range) in enumerate(zip(attrs, ranges)):
                    try:
                        begin, end = range.split('~')
                    except ValueError:
                        begin = end = range
                    attr = attr.split('/')
                    icase = '(?i)' if len(attr) > 1 and "i" in attr[1] else ''
                    attr = attr[0]
                    for ii, item in enumerate(block['Items']):
                        if not item['freq']:
                            continue
                        if '.' not in attr:
                            if attr in self.corp.get_conf('ATTRLIST').split(','):
                                wwords = item['Word'][level]['n'].split('  ')  # two spaces
                                fquery = '%s %s 0 ' % (begin, end)
                                fquery += ''.join(['[%s="%s%s"]'
                                                   % (attr, icase, escape_attr_val(w)) for w in wwords])
                            else:  # structure number
                                fquery = '0 0 1 [] within <%s #%s/>' % \
                                         (attr, item['Word'][0]['n'].split('#')[1])
                        else:  # text types
                            structname, attrname = attr.split('.')
                            if self.corp.get_conf(structname + '.NESTED'):
                                block['unprecise'] = True
                            fquery = '0 0 1 [] within <%s %s="%s" />' \
                                     % (structname, attrname,
                                        escape_attr_val(item['Word'][0]['n']))
                        if not item['freq']:
                            continue
                        item['pfilter'].append(('q2', 'p%s' % fquery))
                        if len(attrs) == 1 and item['freq'] <= calc_result['conc_size']:
                            item['nfilter'].append(('q2', 'n%s' % fquery))
                            # adding no error, no correction (originally for CUP)
            errs, corrs, err_block, corr_block = 0, 0, -1, -1
            for b_index, block in enumerate(result['Blocks']):
                curr_fcrit = fcrit[b_index]
                if curr_fcrit.split()[0] == 'err.type':
                    err_block = b_index
                    for item in block['Items']:
                        errs += item['freq']
                elif curr_fcrit.split()[0] == 'corr.type':
                    corr_block = b_index
                    for item in block['Items']:
                        corrs += item['freq']
            freq = calc_result['conc_size'] - errs - corrs
            if freq > 0 and err_block > -1 and corr_block > -1:
                pfilter = [('q', 'p0 0 1 ([] within ! <err/>) within ! <corr/>')]
                cc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'),
                              q=self.args.q + [pfilter[0][1]], fromp=self.args.fromp,
                              pagesize=self.args.pagesize, asnc=False, save=self.args.save)
                freq = cc.size()
                err_nfilter, corr_nfilter = '', ''
                if freq != calc_result['conc_size']:
                    # TODO err/corr stuff is untested
                    err_nfilter = ('q', 'p0 0 1 ([] within <err/>) within ! <corr/>')
                    corr_nfilter = ('q', 'p0 0 1 ([] within ! <err/>) within <corr/>')
                result['Blocks'][err_block]['Items'].append(
                    {'Word': [{'n': 'no error'}], 'freq': freq,
                     'pfilter': pfilter, 'nfilter': err_nfilter,
                     'norel': 1, 'fbar': 0})
                result['Blocks'][corr_block]['Items'].append(
                    {'Word': [{'n': 'no correction'}], 'freq': freq,
                     'pfilter': pfilter, 'nfilter': corr_nfilter,
                     'norel': 1, 'fbar': 0})

            self._add_save_menu_item('CSV', save_format='csv',
                                     hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                         self.CONC_QUICK_SAVE_MAX_LINES)))
            self._add_save_menu_item('XLSX', save_format='xlsx',
                                     hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                         self.CONC_QUICK_SAVE_MAX_LINES)))
            self._add_save_menu_item('XML', save_format='xml',
                                     hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                         self.CONC_QUICK_SAVE_MAX_LINES)))
            self._add_save_menu_item('TXT', save_format='text',
                                     hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                         self.CONC_QUICK_SAVE_MAX_LINES)))
            self._add_save_menu_item(translate('Custom'))

        result['freq_type'] = 'ml' if ml > 0 else 'tt'
        result['coll_form_args'] = CollFormArgs().update(self.args).to_dict()
        result['freq_form_args'] = FreqFormArgs().update(self.args).to_dict()
        result['ctfreq_form_args'] = CTFreqFormArgs().update(self.args).to_dict()
        result['text_types_data'] = self.tt.export_with_norms(ret_nums=True)
        result['quick_save_row_limit'] = self.FREQ_QUICK_SAVE_MAX_LINES
        self._attach_query_params(result)
        self._attach_query_overview(result)
        return result

    def _make_wl_query(self):
        qparts = []
        if self.args.wlpat:
            qparts.append('%s="%s"' % (self.args.wlattr, self.args.wlpat))
        if not self.args.include_nonwords:
            qparts.append('%s!="%s"' % (self.args.wlattr,
                                        self.corp.get_conf('NONWORDRE')))

        whitelist = [w for w in re.split('\s+', self.args.wlwords.strip()) if w]
        blacklist = [w for w in re.split('\s+', self.args.blacklist.strip()) if w]
        if len(whitelist) > 0:
            qq = ['%s=="%s"' % (self.args.wlattr, w.strip()) for w in whitelist]
            qparts.append('(' + '|'.join(qq) + ')')
        for w in blacklist:
            qparts.append('%s!=="%s"' % (self.args.wlattr, w.strip()))
        self.args.q = ['q[' + '&'.join(qparts) + ']']

    @exposed(access_level=1, func_arg_mapped=True, template='txtexport/savefreq.html', return_type='plain')
    def savefreq(self, fcrit=(), flimit=0, freq_sort='', ml=0,
                 saveformat='text', from_line=1, to_line='', colheaders=0, heading=0):
        """
        save a frequency list
        """
        from_line = int(from_line)
        to_line = int(to_line) if to_line else sys.maxsize

        self.args.fpage = 1
        self.args.fmaxitems = to_line - from_line + 1
        if self.args.wlattr:
            self._make_wl_query()  # multilevel wordlist

        # following piece of sh.t has hidden parameter dependencies
        result = self.freqs(fcrit, flimit, freq_sort, ml)
        saved_filename = self.args.corpname
        output = None
        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-frequencies.txt"' % \
                                                   saved_filename
            output = result
            output['Desc'] = self.concdesc_json()['Desc']
            output['fcrit'] = fcrit
            output['flimit'] = flimit
            output['freq_sort'] = freq_sort
            output['ml'] = ml
            output['saveformat'] = saveformat
            output['from_line'] = from_line
            output['to_line'] = to_line
            output['colheaders'] = colheaders
            output['heading'] = heading
        elif saveformat in ('csv', 'xml', 'xlsx'):
            def mkfilename(suffix): return '%s-freq-distrib.%s' % (self.args.corpname, suffix)
            writer = plugins.runtime.EXPORT.instance.load_plugin(saveformat, subtype='freq')

            # Here we expect that when saving multi-block items, all the block have
            # the same number of columns which is quite bad. But currently there is
            # no better common 'denominator'.
            num_word_cols = len(result['Blocks'][0].get('Items', [{'Word': []}])[0].get('Word'))
            writer.set_col_types(*([int] + num_word_cols * [str] + [float, float]))

            self._headers['Content-Type'] = writer.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                mkfilename(saveformat),)

            for block in result['Blocks']:
                col_names = [item['n'] for item in block['Head'][:-2]] + ['freq', 'freq [%]']
                if saveformat == 'xml':
                    col_names.insert(0, 'str')
                if hasattr(writer, 'add_block'):
                    writer.add_block('')  # TODO block name

                if colheaders or heading:
                    writer.writeheading([''] + [item['n'] for item in block['Head'][:-2]] +
                                        ['freq', 'freq [%]'])
                i = 1
                for item in block['Items']:
                    writer.writerow(i, [w['n'] for w in item['Word']] + [str(item['freq']),
                                                                         str(item.get('rel', ''))])
                    i += 1
            output = writer.raw_content()
        return output

    @exposed(access_level=0, template='freqs.html', page_model='freq', accept_kwargs=True, func_arg_mapped=True)
    def freqml(self, flimit=0, freqlevel=1, **kwargs):
        try:
            require_existing_conc(self.corp, self.args.q)
            return self._freqml(flimit, freqlevel, **kwargs)
        except ConcNotFoundException:
            args = list(self._request.args.items()) + [('next', 'freqml')]
            raise ImmediateRedirectException(self.create_url('restore_conc', args))

    def _freqml(self, flimit=0, freqlevel=1, **kwargs):
        """
        multilevel frequency list
        """
        fcrit = multi_level_crit(freqlevel, **kwargs)
        result = self.freqs([fcrit], flimit, '', 1)
        result['ml'] = 1
        self._session['last_freq_level'] = freqlevel
        tmp = defaultdict(lambda: [])
        for i in range(1, freqlevel + 1):
            tmp['mlxattr'].append(kwargs.get('ml{0}attr'.format(i), 'word'))
            tmp['mlxctx'].append(kwargs.get('ml{0}ctx'.format(i), '0'))
            tmp['mlxpos'].append(kwargs.get('ml{0}pos'.format(i), 1))
            tmp['mlxicase'].append(kwargs.get('ml{0}icase'.format(i), ''))
            tmp['flimit'] = flimit
            tmp['freq_sort'] = self.args.freq_sort
        result['freq_form_args'] = tmp
        return result

    @exposed(access_level=1, template='freqs.html', page_model='freq', func_arg_mapped=True)
    def freqtt(self, flimit=0, fttattr=()):
        if not fttattr:
            raise ConcError(translate('No text type selected'))
        return self.freqs(['%s 0' % a for a in fttattr], flimit)

    @exposed(access_level=1, page_model='freq', template='freqs.html')
    def freqct(self, request):
        """
        """
        try:
            require_existing_conc(self.corp, self.args.q)
            return self._freqct(request)
        except ConcNotFoundException:
            args = list(self._request.args.items()) + [('next', 'freqct')]
            raise ImmediateRedirectException(self.create_url('restore_conc', args))

    def _freqct(self, request):
        args = freq_calc.CTFreqCalcArgs()
        args.corpname = self.corp.corpname
        args.subcname = getattr(self.corp, 'subcname', None)
        args.subcpath = self.subcpath
        args.user_id = self.session_get('user', 'id')
        args.q = self.args.q
        args.ctminfreq = int(request.args.get('ctminfreq', '1'))
        args.ctminfreq_type = request.args.get('ctminfreq_type')
        args.fcrit = '{0} {1} {2} {3}'.format(self.args.ctattr1, self.args.ctfcrit1,
                                              self.args.ctattr2, self.args.ctfcrit2)
        try:
            freq_data = freq_calc.calculate_freqs_ct(args)
        except UserActionException as ex:
            freq_data = dict(data=[], full_size=0)
            self.add_system_message('error', str(e))

        self._add_save_menu_item('XLSX', save_format='xlsx')

        ans = dict(
            freq_type='ct',
            attr1=self.args.ctattr1,
            attr2=self.args.ctattr2,
            data=freq_data,
            freq_form_args=FreqFormArgs().update(self.args).to_dict(),
            coll_form_args=CollFormArgs().update(self.args).to_dict(),
            ctfreq_form_args=CTFreqFormArgs().update(self.args).to_dict()
        )
        ans['text_types_data'] = self.tt.export_with_norms(ret_nums=True)
        ans['quick_save_row_limit'] = 0
        self._attach_query_params(ans)
        return ans

    @exposed(access_level=1, return_type='plain', http_method='POST', skip_corpus_init=True)
    def export_freqct(self, request):
        with plugins.runtime.EXPORT_FREQ2D as plg:
            data = json.loads(request.form['data'])
            exporter = plg.load_plugin(request.args['saveformat'])
            if request.args['savemode'] == 'table':
                exporter.set_content(attr1=data['attr1'], attr2=data['attr2'],
                                     labels1=data.get('labels1', []), labels2=data.get('labels2', []),
                                     alpha_level=data['alphaLevel'], min_freq=data['minFreq'],
                                     min_freq_type=data['minFreqType'], data=data['data'])
            elif request.args['savemode'] == 'flat':
                exporter.set_content_flat(headings=data.get('headings', []), alpha_level=data['alphaLevel'],
                                          min_freq=data['minFreq'], min_freq_type=data['minFreqType'],
                                          data=data['data'])
            self._headers['Content-Type'] = exporter.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="{0}-2dfreq-distrib.xlsx"'.format(
                self.args.corpname)
        return exporter.raw_content()

    @exposed(access_level=1, vars=('concsize',), func_arg_mapped=True, page_model='coll')
    def collx(self, line_offset=0, num_lines=0):
        """
        list collocations
        """
        try:
            require_existing_conc(self.corp, self.args.q)
            return self._collx(line_offset, num_lines)
        except ConcNotFoundException:
            args = list(self._request.args.items()) + [('next', 'collx')]
            raise ImmediateRedirectException(self.create_url('restore_conc', args))

    def _collx(self, line_offset=0, num_lines=0):
        self.disabled_menu_items = (MainMenu.CONCORDANCE('query-save-as'), MainMenu.VIEW('kwic-sent-switch'),
                                    MainMenu.CONCORDANCE('query-overview'))
        self._save_options(self.LOCAL_COLL_OPTIONS, self.args.corpname)
        if self.args.csortfn == '':
            self.args.csortfn = 't'

        calc_args = coll_calc.CollCalcArgs()
        calc_args.corpus_encoding = self.corp.get_conf('ENCODING')
        calc_args.corpname = self.args.corpname
        calc_args.subcname = getattr(self.corp, 'subcname', None)
        calc_args.subcpath = self.subcpath
        calc_args.user_id = self.session_get('user', 'id')
        calc_args.q = self.args.q
        calc_args.save = self.args.save
        calc_args.samplesize = 0  # TODO (check also freqs)
        calc_args.cattr = self.args.cattr
        calc_args.csortfn = self.args.csortfn
        calc_args.cbgrfns = ''.join(self.args.cbgrfns)
        calc_args.cfromw = self.args.cfromw
        calc_args.ctow = self.args.ctow
        calc_args.cminbgr = self.args.cminbgr
        calc_args.cminfreq = self.args.cminfreq
        calc_args.line_offset = line_offset
        calc_args.num_lines = num_lines
        calc_args.citemsperpage = self.args.citemsperpage
        calc_args.collpage = self.args.collpage

        self._add_save_menu_item('CSV', save_format='csv',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XLSX', save_format='xlsx',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('XML', save_format='xml',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item('TXT', save_format='text',
                                 hint=translate('Saves at most {0} items. Use "Custom" for more options.'.format(
                                     self.CONC_QUICK_SAVE_MAX_LINES)))
        self._add_save_menu_item(translate('Custom'))

        ans = coll_calc.calculate_colls(calc_args)
        ans['coll_form_args'] = CollFormArgs().update(self.args).to_dict()
        ans['freq_form_args'] = FreqFormArgs().update(self.args).to_dict()
        ans['ctfreq_form_args'] = CTFreqFormArgs().update(self.args).to_dict()
        ans['save_line_limit'] = self.COLLS_QUICK_SAVE_MAX_LINES
        ans['text_types_data'] = self.tt.export_with_norms(ret_nums=True)
        ans['quick_save_row_limit'] = self.COLLS_QUICK_SAVE_MAX_LINES
        ans['savecoll_max_lines'] = self.SAVECOLL_MAX_LINES
        self._attach_query_overview(ans)
        return ans

    @exposed(access_level=1, vars=('concsize',), func_arg_mapped=True, template='txtexport/savecoll.html',
             return_type='plain')
    def savecoll(self, from_line=1, to_line='', saveformat='text', heading=0, colheaders=0):
        """
        save collocations
        """
        from_line = int(from_line)
        if to_line == '':
            to_line = Actions.SAVECOLL_MAX_LINES
        else:
            to_line = int(to_line)
        num_lines = to_line - from_line + 1
        self.args.collpage = 1
        self.args.citemsperpage = Actions.SAVECOLL_MAX_LINES   # we need a one big page when saving
        result = self.collx(line_offset=(from_line - 1), num_lines=num_lines)
        saved_filename = self.args.corpname
        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-collocations.txt"' % (
                saved_filename,)
            out_data = result
            out_data['Desc'] = self.concdesc_json()['Desc']
            out_data['saveformat'] = saveformat
            out_data['from_line'] = from_line
            out_data['to_line'] = to_line
            out_data['heading'] = heading
            out_data['colheaders'] = colheaders
        elif saveformat in ('csv', 'xml', 'xlsx'):
            def mkfilename(suffix): return '%s-collocations.%s' % (self.args.corpname, suffix)
            writer = plugins.runtime.EXPORT.instance.load_plugin(saveformat, subtype='coll')
            writer.set_col_types(int, str, *(8 * (float,)))

            self._headers['Content-Type'] = writer.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                mkfilename(saveformat),)

            if colheaders or heading:
                writer.writeheading([''] + [item['n'] for item in result['Head']])
            i = 1
            for item in result['Items']:
                writer.writerow(i, (item['str'],
                                    str(item['freq'])) + tuple([str(stat['s']) for stat in item['Stats']]))
                i += 1
            out_data = writer.raw_content()
        else:
            raise UserActionException('Unknown format: %s' % (saveformat,))
        return out_data

    @exposed(access_level=1, func_arg_mapped=True, return_type='json')
    def structctx(self, pos=0, struct='doc'):
        """
        display a hit in a context of a structure"
        """
        s = self.corp.get_struct(struct)
        struct_id = s.num_at_pos(pos)
        beg, end = s.beg(struct_id), s.end(struct_id)
        self.args.detail_left_ctx = pos - beg
        self.args.detail_right_ctx = end - pos - 1
        result = self.widectx(pos)
        return result

    @exposed(access_level=0, action_log_mapper=log_mapping.widectx)
    def widectx(self, request):
        """
        display a hit in a wider context
        """
        pos = int(request.args.get('pos', '0'))
        p_attrs = self.args.attrs.split(',')
        # prefer 'word' but allow other attr if word is off
        attrs = ['word'] if 'word' in p_attrs else p_attrs[0:1]
        left_ctx = int(request.args.get('detail_left_ctx', 40))
        right_ctx = int(request.args.get('detail_right_ctx', 40))
        data = conclib.get_detail_context(
            corp=self.corp, pos=pos, attrs=attrs, structs=self.args.structs, hitlen=self.args.hitlen,
            detail_left_ctx=left_ctx, detail_right_ctx=right_ctx)
        if left_ctx >= int(data['maxdetail']):
            data['expand_left_args'] = None
        if right_ctx >= int(data['maxdetail']):
            data['expand_right_args'] = None
        data['widectx_globals'] = self._get_mapped_attrs(WidectxArgsMapping,
                                                         dict(structs=self._get_struct_opts()))
        return data

    @exposed(access_level=0, return_type='json')
    def fullref(self, request):
        """
        display a full reference
        """
        return conclib.get_full_ref(corp=self.corp, pos=int(request.args.get('pos', '0')))

    @exposed(access_level=1, vars=('concsize',), func_arg_mapped=True, template='txtexport/saveconc.html',
             return_type='plain')
    def saveconc(self, saveformat='text', from_line=0, to_line='', heading=0, numbering=0):

        def merge_conc_line_parts(items):
            """
            converts a list of dicts of the format [{'class': u'col0 coll', 'str': u' \\u0159ekl'},
                {'class': u'attr', 'str': u'/j\xe1/PH-S3--1--------'},...] to a CSV compatible form
            """
            ans = []
            for item in items:
                if 'class' in item and item['class'] != 'attr':
                    ans.append(' {}'.format(item['str'].strip()))
                else:
                    ans.append('{}'.format(item['str'].strip()))
                for tp in item.get('tail_posattrs', []):
                    ans.append('/{}'.format(tp))
            return ''.join(ans).strip()

        def process_lang(root, left_key, kwic_key, right_key, add_linegroup):
            if type(root) is dict:
                root = (root,)

            ans = []
            for item in root:
                ans_item = {}
                if 'ref' in item:
                    ans_item['ref'] = item['ref']
                if add_linegroup:
                    ans_item['linegroup'] = item.get('linegroup', '')
                ans_item['left_context'] = merge_conc_line_parts(item[left_key])
                ans_item['kwic'] = merge_conc_line_parts(item[kwic_key])
                ans_item['right_context'] = merge_conc_line_parts(item[right_key])
                ans.append(ans_item)
            return ans

        try:
            corpus_info = self.get_corpus_info(self.args.corpname)
            self._apply_viewmode(corpus_info['sentence_struct'])

            conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'),
                            q=self.args.q, fromp=self.args.fromp, pagesize=self.args.pagesize,
                            asnc=False, save=self.args.save, samplesize=corpus_info.sample_size)
            self._apply_linegroups(conc)
            kwic = Kwic(self.corp, self.args.corpname, conc)
            conc.switch_aligned(os.path.basename(self.args.corpname))
            from_line = int(from_line)
            to_line = min(int(to_line), conc.size())
            output = {
                'from_line': from_line,
                'to_line': to_line,
                'heading': heading,
                'numbering': numbering
            }

            kwic_args = KwicPageArgs(attr.asdict(self.args), base_attr=Kontext.BASE_ATTR)
            kwic_args.speech_attr = self._get_speech_segment()
            kwic_args.fromp = 1
            kwic_args.pagesize = to_line - (from_line - 1)
            kwic_args.line_offset = (from_line - 1)
            kwic_args.labelmap = {}
            kwic_args.align = ()
            kwic_args.alignlist = [self.cm.get_Corpus(c) for c in self.args.align if c]
            kwic_args.leftctx = self.args.leftctx
            kwic_args.rightctx = self.args.rightctx
            kwic_args.structs = self._get_struct_opts()

            data = kwic.kwicpage(kwic_args)

            def mkfilename(suffix): return f'{self.args.corpname}-concordance.{suffix}'
            if saveformat == 'text':
                self._headers['Content-Type'] = 'text/plain'
                self._headers['Content-Disposition'] = 'attachment; filename="{}"'.format(
                    mkfilename('txt'))
                output.update(data)
                for item in data['Lines']:
                    item['ref'] = ', '.join(item['ref'])
                # we must set contains_within = False as it is impossible (in the current user interface)
                # to offer a custom i.p.m. calculation before the download starts
                output['result_relative_freq_rel_to'] = self._get_ipm_base_set_desc(
                    contains_within=False)
                output['Desc'] = self.concdesc_json()['Desc']
            elif saveformat in ('csv', 'xlsx', 'xml'):
                writer = plugins.runtime.EXPORT.instance.load_plugin(
                    saveformat, subtype='concordance')

                self._headers['Content-Type'] = writer.content_type()
                self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                    mkfilename(saveformat),)

                if len(data['Lines']) > 0:
                    aligned_corpora = [self.corp] + \
                                      [self.cm.get_Corpus(c) for c in self.args.align if c]
                    writer.set_corpnames([c.get_conf('NAME') or c.get_conffile()
                                          for c in aligned_corpora])

                    if heading:
                        writer.writeheading({
                            'corpus': self._human_readable_corpname(),
                            'subcorpus': self.args.usesubcorp,
                            'concordance_size': data['concsize'],
                            'arf': data['result_arf'],
                            'query': ['%s: %s (%s)' % (x['op'], x['arg'], x['size'])
                                      for x in self.concdesc_json().get('Desc', [])]
                        })

                        doc_struct = self.corp.get_conf('DOCSTRUCTURE')
                        refs_args = [x.strip('=') for x in self.args.refs.split(',')]
                        used_refs = ([('#', translate('Token number')), (doc_struct, translate('Document number'))] +
                                     [(x, x) for x in self.corp.get_conf('STRUCTATTRLIST').split(',')])
                        used_refs = [x[1] for x in used_refs if x[0] in refs_args]
                        writer.write_ref_headings([''] + used_refs if numbering else used_refs)

                    if 'Left' in data['Lines'][0]:
                        left_key = 'Left'
                        kwic_key = 'Kwic'
                        right_key = 'Right'
                    elif 'Sen_Left' in data['Lines'][0]:
                        left_key = 'Sen_Left'
                        kwic_key = 'Kwic'
                        right_key = 'Sen_Right'
                    else:
                        raise ConcError(translate('Invalid data'))

                    for i in range(len(data['Lines'])):
                        line = data['Lines'][i]
                        if numbering:
                            row_num = str(i + from_line)
                        else:
                            row_num = None

                        lang_rows = process_lang(line, left_key, kwic_key, right_key,
                                                 add_linegroup=self._lines_groups.is_defined())
                        if 'Align' in line:
                            lang_rows += process_lang(line['Align'], left_key, kwic_key, right_key,
                                                      add_linegroup=False)
                        writer.writerow(row_num, *lang_rows)
                output = writer.raw_content()
            else:
                raise UserActionException(translate('Unknown export data type'))
            return output
        except Exception as e:
            self._headers['Content-Type'] = 'text/html'
            if 'Content-Disposition' in self._headers:
                del (self._headers['Content-Disposition'])
            raise e

    @exposed(access_level=0)
    def audio(self, request):
        """
        Provides access to audio-files containing speech segments.
        Access rights are per-corpus (i.e. if a user has a permission to
        access corpus 'X' then all related audio files are accessible).
        """
        chunk = request.args.get('chunk', '')
        rpath = os.path.realpath(os.path.join(settings.get(
            'corpora', 'speech_files_path'), self.args.corpname, chunk))
        basepath = os.path.realpath(settings.get('corpora', 'speech_files_path'))
        if os.path.isfile(rpath) and rpath.startswith(basepath):
            with open(rpath, 'rb') as f:
                file_size = os.path.getsize(rpath)
                self._headers['Content-Type'] = 'audio/mpeg'
                self._headers['Content-Length'] = '%s' % file_size
                self._headers['Accept-Ranges'] = 'none'
                if self.environ.get('HTTP_RANGE', None):
                    self._headers['Content-Range'] = 'bytes 0-%s/%s' % (
                        os.path.getsize(rpath) - 1, os.path.getsize(rpath))
                ans = f.read()
                return lambda: ans
        else:
            self.set_not_found()
            return lambda: None

    def _collect_conc_next_url_params(self, query_id):
        params = {
            'corpname': self.args.corpname,
            'q': '~%s' % query_id,
            'viewmode': self.args.viewmode,
            'attrs': self.args.attrs,
            'structs': self.args.structs,
            'refs': self.args.refs,
            'attr_vmode': self.args.attr_vmode
        }
        if self.args.usesubcorp:
            params['usesubcorp'] = self.args.usesubcorp
        if self.args.align:
            params['align'] = self.args.align
        return params

    @staticmethod
    def _filter_lines(data, pnfilter):
        def expand(x, n):
            return list(range(x, x + n))

        sel_lines = []
        for item in data:
            sel_lines.append(''.join(['[#%d]' % x2 for x2 in expand(item[0], item[1])]))
        return '%s%s %s %i %s' % (pnfilter, 0, 0, 0, '|'.join(sel_lines))

    @exposed(return_type='json', http_method='POST', mutates_conc=True)
    def ajax_unset_lines_groups(self, _):
        pipeline = self.load_pipeline_ops(self._q_code)
        i = len(pipeline) - 1
        # we have to go back before the current block
        # of lines-groups operations and find an
        # operation to start a new query pipeline
        while i >= 0 and pipeline[i].form_type == 'lgroup':
            i -= 1
        if i < 0:
            raise Exception('Broken operation chain')
        self._clear_prev_conc_params()  # we do not want to chain next state with the current one
        self._lines_groups = LinesGroups(data=[])
        pipeline[i].make_saveable()  # drop old opKey, set as persistent
        self.add_conc_form_args(pipeline[i])
        return {}

    @exposed(return_type='json', http_method='POST', mutates_conc=True)
    def ajax_apply_lines_groups(self, request):
        rows = request.form.get('rows')
        self._lines_groups = LinesGroups(data=json.loads(rows))
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return {}

    @exposed(return_type='json', http_method='POST', mutates_conc=True)
    def ajax_remove_non_group_lines(self, _):
        self.args.q.append(self._filter_lines([(x[0], x[1]) for x in self._lines_groups], 'p'))
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return {}

    @exposed(return_type='json', http_method='POST', mutates_conc=True)
    def ajax_sort_group_lines(self, _):
        self._lines_groups.sorted = True
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return {}

    @exposed(return_type='json', http_method='POST', mutates_conc=True)
    def ajax_remove_selected_lines(self, request):
        pnfilter = request.args.get('pnfilter', 'p')
        rows = request.form.get('rows', '')
        data = json.loads(rows)
        self.args.q.append(self._filter_lines(data, pnfilter))
        self.add_conc_form_args(LockedOpFormsArgs(persist=True))
        return {}

    @exposed(return_type='json', http_method='POST', func_arg_mapped=False)
    def ajax_send_group_selection_link_to_mail(self, request):
        with plugins.runtime.AUTH as auth:
            user_info = auth.get_user_info(self._plugin_api)
            user_email = user_info['email']
            username = user_info['username']
            smtp_server = mailing.smtp_factory()
            url = request.args.get('url')
            recip_email = request.args.get('email')

            text = translate('KonText user %s has sent a concordance link to you') % (
                username,) + ':'
            text += '\n\n'
            text += url + '\n\n'
            text += '\n---------------------\n'
            text += time.strftime('%d.%m. %Y %H:%M')
            text += '\n'

            msg = mailing.message_factory(
                recipients=[recip_email],
                subject=translate('KonText concordance link'),
                text=text,
                reply_to=user_email)
            return dict(ok=mailing.send_mail(smtp_server, msg, [recip_email]))

    @exposed(return_type='json', http_method='POST', mutates_conc=True)
    def ajax_reedit_line_selection(self, _):
        ans = self._lines_groups.as_list()
        self._lines_groups = LinesGroups(data=[])
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return dict(selection=ans)

    @exposed(return_type='json')
    def ajax_get_line_groups_stats(self, _):
        ans = defaultdict(lambda: 0)
        for item in self._lines_groups:
            ans[item[2]] += 1
        return dict(groups=ans)

    @exposed(return_type='json', http_method='POST', mutates_conc=True)
    def ajax_rename_line_group(self, request):
        from_num = int(request.form.get('from_num', '0'))
        to_num = int(request.form.get('to_num', '-1'))
        new_groups = [v for v in self._lines_groups if v[2] != from_num or to_num != -1]
        if to_num > 0:
            new_groups = [v if v[2] != from_num else (v[0], v[1], to_num) for v in new_groups]
        self._lines_groups = LinesGroups(data=new_groups)
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return {}

    @exposed(access_level=1, return_type='plain', http_method='POST')
    def export_line_groups_chart(self, request):
        with plugins.runtime.CHART_EXPORT as ce:
            format = request.args.get('cformat')
            filename = 'line-groups-{0}.{1}'.format(self.args.corpname, ce.get_suffix(format))
            self._headers['Content-Type'] = ce.get_content_type(format)
            self._headers['Content-Disposition'] = 'attachment; filename="{0}"'.format(filename)
            data = sorted(json.loads(request.form.get('data', '{}')), key=lambda x: int(x[0]))
            total = sum(x[1] for x in data)
            data = [('#{0} ({1}%)'.format(x[0], round(x[1] / float(total) * 100, 1)), x[1])
                    for x in data]
            return ce.export_pie_chart(data=data, title=request.form.get('title', '??'), format=format)

    @exposed(return_type='json', http_method='POST')
    def get_adhoc_subcorp_size(self, request):
        if plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(self._plugin_api, self.args.corpname):
            # a faster solution based on liveattrs
            with plugins.runtime.LIVE_ATTRIBUTES as liveatt:
                attr_map = TextTypeCollector(self.corp, request.json['text_types']).get_attrmap()
                size = liveatt.get_subc_size(self._plugin_api, self.corp, attr_map)
                return dict(total=size)
        else:
            tt_query = TextTypeCollector(self.corp, request.json['text_types']).get_query()
            query = 'aword,[] within {}'.format(
                ' '.join('<{0} {1} />'.format(k, v) for k, v in tt_query))
            self.args.q = [query]
            conc = get_conc(corp=self.corp, user_id=self.session_get('user', 'id'), q=self.args.q,
                            fromp=self.args.fromp, pagesize=self.args.pagesize, asnc=0, save=self.args.save)
            return dict(total=conc.fullsize() if conc else None)

    @exposed(return_type='json', http_method='POST')
    def ajax_switch_corpus(self, _):
        self.disabled_menu_items = (MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
                                    MainMenu.VIEW('kwic-sentence'))

        avail_al_corp = []
        for al in [x for x in self.corp.get_conf('ALIGNED').split(',') if len(x) > 0]:
            alcorp = corplib.open_corpus(al)
            avail_al_corp.append(dict(label=alcorp.get_conf('NAME') or al, n=al))

        tmp_out = dict(
            uses_corp_instance=True,
            corpname=self.args.corpname,
            usesubcorp=self.args.usesubcorp,
            undo_q=[]
        )

        attrlist = corpus_get_conf(self.corp, 'ATTRLIST').split(',')
        tmp_out['AttrList'] = [{
            'label': corpus_get_conf(self.corp, n + '.LABEL') or n,
            'n': n,
            'multisep': corpus_get_conf(self.corp, n + '.MULTISEP')
        } for n in attrlist if n]

        tmp_out['StructAttrList'] = [{'label': corpus_get_conf(self.corp, n + '.LABEL') or n, 'n': n}
                                     for n in corpus_get_conf(self.corp, 'STRUCTATTRLIST').split(',')
                                     if n]
        tmp_out['StructList'] = corpus_get_conf(self.corp, 'STRUCTLIST').split(',')
        sref = corpus_get_conf(self.corp, 'SHORTREF')
        tmp_out['fcrit_shortref'] = '+'.join([a.strip('=') + ' 0' for a in sref.split(',')])

        if corpus_get_conf(self.corp, 'FREQTTATTRS'):
            ttcrit_attrs = corpus_get_conf(self.corp, 'FREQTTATTRS')
        else:
            ttcrit_attrs = corpus_get_conf(self.corp, 'SUBCORPATTRS')
        tmp_out['ttcrit'] = [('fcrit', '%s 0' % a)
                             for a in ttcrit_attrs.replace('|', ',').split(',') if a]

        poslist = self.cm.corpconf_pairs(self.corp, 'WPOSLIST')
        lposlist = self.cm.corpconf_pairs(self.corp, 'LPOSLIST')

        self.add_conc_form_args(QueryFormArgs(corpora=self._select_current_aligned_corpora(active_only=False),
                                              persist=False))
        self._attach_query_params(tmp_out)
        self._attach_aligned_query_params(tmp_out)
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, tmp_out)
        corpus_info = self.get_corpus_info(self.args.corpname)
        plg_status = {}
        self._setup_optional_plugins_js(plg_status)
        conc_args = templating.StateGlobals(self._get_mapped_attrs(ConcArgsMapping))

        ans = dict(
            corpname=self.args.corpname,
            subcorpname=self.corp.subcname if corplib.is_subcorpus(self.corp) else None,
            baseAttr=Kontext.BASE_ATTR,
            tagsets=[dict(ident=tagset.tagset_name, posAttr=tagset.pos_attr, featAttr=tagset.feat_attr,
                          docUrlLocal=tagset.doc_url_local, docUrlEn=tagset.doc_url_en)
                     for tagset in corpus_info.tagsets],
            humanCorpname=self._human_readable_corpname(),
            corpusIdent=dict(
                id=self.args.corpname, name=self._human_readable_corpname(),
                variant=self._corpus_variant,
                usesubcorp=self.args.usesubcorp,
                origSubcorpName=getattr(self.corp, 'orig_subcname', self.args.usesubcorp),
                foreignSubcorp=(self.corp.author_id is not None and
                                self.session_get('user', 'id') != self.corp.author_id)),
            currentArgs=conc_args.export(),
            compiledQuery=[],
            concPersistenceOpId=None,
            alignedCorpora=self.args.align,
            availableAlignedCorpora=avail_al_corp,
            activePlugins=plg_status['active_plugins'],
            queryOverview=[],
            numQueryOps=0,
            textTypesData=self.tt.export_with_norms(ret_nums=True),
            menuData=MenuGenerator(tmp_out, self.args, self._plugin_api).generate(
                disabled_items=self.disabled_menu_items,
                save_items=self._save_menu,
                corpus_dependent=tmp_out['uses_corp_instance'],
                ui_lang=self.ui_lang),
            Wposlist=[{'n': x[0], 'v': x[1]} for x in poslist],
            Lposlist=[{'n': x[0], 'v': x[1]} for x in lposlist],
            AttrList=tmp_out['AttrList'],
            StructAttrList=tmp_out['StructAttrList'],
            StructList=tmp_out['StructList'],
            InputLanguages=tmp_out['input_languages'],
            ConcFormsArgs=tmp_out['conc_forms_args'],
            CurrentSubcorp=self.args.usesubcorp,
            SubcorpList=tmp_out['SubcorpList'],
            TextTypesNotes=corpus_info.metadata.desc,
            TextDirectionRTL=True if self.corp.get_conf('RIGHTTOLEFT') else False,
            structsAndAttrs=self._get_structs_and_attrs(),
            DefaultVirtKeyboard=corpus_info.metadata.default_virt_keyboard,
            SimpleQueryDefaultAttrs=corpus_info.simple_query_default_attrs,
            QSEnabled=self.args.qs_enabled
        )
        self._attach_plugin_exports(ans, direct=True)
        self._configure_auth_urls(ans)
        return ans

    @exposed(http_method='GET', return_type='json')
    def load_query_pipeline(self, _):
        pipeline = self.load_pipeline_ops(self._q_code)
        ans = dict(ops=[dict(id=x.op_key, form_args=x.to_dict()) for x in pipeline])
        self._attach_query_overview(ans)
        return ans

    @exposed(http_method='GET', return_type='json')
    def matching_structattr(self, request):
        def is_invalid(v):
            return re.search(r'[<>\]\[]', v) is not None

        if (is_invalid(request.args.get('struct')) or is_invalid(request.args.get('attr')) or
                is_invalid(request.args.get('attr_val')) or is_invalid(request.args.get('search_attr'))):
            raise UserActionException('Invalid character in attribute/structure name/value')

        ans, found, used = corplib.matching_structattr(
            self.corp, request.args.get('struct'), request.args.get(
                'attr'), request.args.get('attr_val'),
            request.args.get('search_attr'))
        if len(ans) == 0:
            self._status = 404
        return dict(result=ans, conc_size=found, lines_used=used)
