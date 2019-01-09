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

from controller.kontext import LinesGroups, Kontext
from controller import exposed
from controller.errors import UserActionException
from argmapping.query import (FilterFormArgs, QueryFormArgs, SortFormArgs, SampleFormArgs, ShuffleFormArgs,
                              LgroupOpArgs, LockedOpFormsArgs, ContextFilterArgsConv, QuickFilterArgsConv,
                              KwicSwitchArgs, SubHitsFilterFormArgs, FirstHitsFilterFormArgs)
from argmapping.analytics import CollFormArgs, FreqFormArgs, CTFreqFormArgs
from argmapping import ConcArgsMapping
import settings
import conclib
import corplib
from bgcalc import freq_calc, coll_calc
import plugins
from kwiclib import Kwic, KwicPageArgs
import l10n
from l10n import import_string, corpus_get_conf
from translation import ugettext as translate
from argmapping import WidectxArgsMapping
from texttypes import TextTypeCollector, get_tt
from main_menu import MenuGenerator, MainMenu
from controller.querying import Querying
import templating
import mailing


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

    def __init__(self, request, ui_lang):
        """
        arguments:
        request -- werkzeug's Request obj.
        ui_lang -- a language code in which current action's result will be presented
        """
        super(Actions, self).__init__(request=request, ui_lang=ui_lang)
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
        super(Actions, self).add_globals(result, methodname, action_metadata)

        conc_args = templating.StateGlobals(self._get_mapped_attrs(ConcArgsMapping))
        conc_args.set('q', [q for q in result.get('Q')])
        if corplib.is_subcorpus(self.corp):
            conc_args.set('usesubcorp', self.corp.subcname)
        args = {}
        if self.args.align:
            for aligned_lang in self.args.align:
                args.update(self.export_aligned_form_params(aligned_lang, state_only=True))
        result['Globals'] = conc_args.update(args)
        result['query_overview'] = self.concdesc_json().get('Desc', [])
        result['conc_dashboard_modules'] = settings.get_list('global', 'conc_dashboard_modules')
        if len(result['query_overview']) > 0:
            result['page_title'] = u'{0} / {1}'.format(self._human_readable_corpname(),
                                                       result['query_overview'][0].get('nicearg'))

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
        corpus_name = l10n.import_string(self.corp.get_conf('NAME'),
                                         from_encoding=self.corp.get_conf('ENCODING'))
        if contains_within:
            return translate('related to the subset defined by the selected text types')
        elif hasattr(self.corp, 'subcname'):
            return (translate(u'related to the whole %s') % (corpus_name,)) + \
                ':%s' % self.corp.subcname
        else:
            return translate(u'related to the whole %s') % corpus_name

    @staticmethod
    def onelevelcrit(prefix, attr, ctx, pos, fcode, icase, bward='', empty=''):
        fromcode = {'lc': '<0', 'rc': '>0', 'kl': '<0', 'kr': '>0'}
        attrpart = '%s%s/%s%s%s ' % (prefix, attr, icase, bward, empty)
        if not ctx:
            ctx = '%i%s' % (pos, fromcode.get(fcode, '0'))
        if '~' in ctx and '.' in attr:
            ctx = ctx.split('~')[0]
        return attrpart + ctx

    @staticmethod
    def _create_empty_conc_result_dict():
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

    @exposed(vars=('orig_query', ), mutates_conc=True)
    def view(self, _=None):
        """
        KWIC view
        """
        corpus_info = self.get_corpus_info(self.args.corpname)
        if self.args.refs is None:  # user did not set this at all (!= user explicitly set '')
            self.args.refs = self.corp.get_conf('SHORTREF')

        self._apply_viewmode(corpus_info['sentence_struct'])

        i = 0
        while i < len(self.args.q):
            if self.args.q[i].startswith('s*') or self.args.q[i][0] == 'e':
                del self.args.q[i]
            i += 1
        out = self._create_empty_conc_result_dict()
        conc = None
        try:
            conc = self.call_function(conclib.get_conc, (self.corp, self.session_get('user', 'id')),
                                      samplesize=corpus_info.sample_size)
            if conc:
                self._apply_linegroups(conc)
                conc.switch_aligned(os.path.basename(self.args.corpname))

                kwic = Kwic(self.corp, self.args.corpname, conc)
                kwic_args = KwicPageArgs(self.args, base_attr=Kontext.BASE_ATTR)
                kwic_args.speech_attr = self._get_speech_segment()
                kwic_args.labelmap = {}
                kwic_args.alignlist = [self.cm.get_Corpus(c) for c in self.args.align if c]
                kwic_args.structs = self._get_struct_opts()
                out['Sort_idx'] = self.call_function(kwic.get_sort_idx, (), enc=self.corp_encoding)
                out.update(kwic.kwicpage(kwic_args))
                out.update(self.get_conc_sizes(conc))
            out['result_shuffled'] = not conclib.conc_is_sorted(self.args.q)
        except Exception as ex:
            self.add_system_message('error', ex.message)
            logging.getLogger(__name__).error(ex)

        if self.args.viewmode == 'sen':
            corplib.add_block_items(out['Lines'], block_size=1)
        if self.corp.get_conf('ALIGNED'):
            out['Aligned'] = [{'n': w,
                               'label': corplib.open_corpus(w).get_conf(
                                   'NAME') or w}
                              for w in self.corp.get_conf('ALIGNED').split(',')]
        if self.args.align and not self.args.maincorp:
            self.args.maincorp = self.args.corpname
        if len(out['Lines']) == 0:
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
        out['line_numbers'] = bool(int(self.args.line_numbers if self.args.line_numbers else 0))
        out['speech_segment'] = self.get_speech_segment()
        out['speaker_id_attr'] = corpus_info.speaker_id_attr.split(
            '.') if corpus_info.speaker_id_attr else None
        out['speech_overlap_attr'] = corpus_info.speech_overlap_attr.split(
            '.') if corpus_info.speech_overlap_attr else None
        out['speech_overlap_val'] = corpus_info.speech_overlap_val
        out['conc_use_safe_font'] = corpus_info.use_safe_font
        speaker_struct = corpus_info.speaker_id_attr.split(
            '.')[0] if corpus_info.speaker_id_attr else None
        out['speech_attrs'] = map(lambda x: x[1],
                                  filter(lambda x: x[0] == speaker_struct,
                                         map(lambda x: x.split('.'), self.corp.get_conf('STRUCTATTRLIST').split(','))))
        out['struct_ctx'] = self.corp.get_conf('STRUCTCTX')

        # query form data
        out['text_types_data'] = get_tt(
            self.corp, self._plugin_api).export_with_norms(ret_nums=True)
        self._attach_query_params(out)
        out['coll_form_args'] = CollFormArgs().update(self.args).to_dict()
        out['freq_form_args'] = FreqFormArgs().update(self.args).to_dict()
        out['ctfreq_form_args'] = CTFreqFormArgs().update(self.args).to_dict()
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, out)

        out['query_history_page_num_records'] = int(
            settings.get('plugins', 'query_storage')['page_num_records'])
        out['fast_adhoc_ipm'] = plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(
            self._plugin_api, self.args.corpname)
        # TODO - this condition is ridiculous - can we make it somewhat simpler/less-redundant???
        out['running_calc'] = not out['finished'] and self.args.async and self.args.save and not out['sampled_size']
        out['chart_export_formats'] = []
        with plugins.runtime.CHART_EXPORT as ce:
            out['chart_export_formats'].extend(ce.get_supported_types())
        out['quick_save_row_limit'] = self.CONC_QUICK_SAVE_MAX_LINES
        if conc is not None and conc.get_conc_file():
            out['conc_cache_key'] = os.path.splitext(os.path.basename(conc.get_conc_file()))[0]
        else:
            out['conc_cache_key'] = None
        return out

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

    @exposed(access_level=1, return_type='json', http_method='POST')
    def delete_query(self, request):
        with plugins.runtime.QUERY_STORAGE as qs:
            ans = qs.delete(self.session_get('user', 'id'), request.form['query_id'])
        return dict(deleted=ans)

    @exposed(apply_semi_persist_args=True)
    def first_form(self, request):
        self.disabled_menu_items = (MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
                                    MainMenu.VIEW('kwic-sentence'))
        out = {}

        if len(self.get_available_aligned_corpora()) == 1:
            self.args.align = []
        else:
            self.args.align = [
                ac for ac in self.args.align if ac in self.get_available_aligned_corpora()]

        if self.args.corpname in self.args.align:
            self.args.align = list(set(self.args.align).difference(set([self.args.corpname])))
            self.redirect(self.create_url('first_form', [('corpname', self.args.corpname)] +
                                          [('align', a) for a in self.args.align]))

        out['aligned_corpora'] = self.args.align
        tt_data = get_tt(self.corp, self._plugin_api).export_with_norms(ret_nums=True)
        out['Normslist'] = tt_data['Normslist']
        out['text_types_data'] = tt_data

        corp_info = self.get_corpus_info(self.args.corpname)
        out['text_types_notes'] = corp_info.metadata.desc

        qf_args = QueryFormArgs(corpora=self._select_current_aligned_corpora(
            active_only=False), persist=False)
        cid = self.args.corpname
        if self.args.queryselector:
            q_type = self.args.queryselector[:-3]
            qf_args.curr_query_types[cid] = q_type
            qf_args.curr_queries[cid] = getattr(self.args, q_type)
            qf_args.curr_lpos_values[cid] = request.args.get('lpos')
            qf_args.curr_qmcase_values[cid] = bool(int(request.args.get('qmcase', '0')))
            qf_args.curr_pcq_pos_neg_values[cid] = request.args.get('pcq_pos_neg')
            # the value of 'include_empty' does not matter form primary corp actually
            qf_args.curr_include_empty_values[cid] = False
            qf_args.curr_default_attr_values[cid] = request.args.get('default_attr')
            qf_args.selected_text_types, qf_args.bib_mapping = self._get_checked_text_types(request)

        for item in self.args.align:
            q_type = request.args.get('queryselector_{0}'.format(item), '')[:-3]
            qf_args.curr_query_types[item] = q_type
            qf_args.curr_queries[item] = request.args.get('{0}_{1}'.format(q_type, item))
            qf_args.curr_lpos_values[item] = request.args.get('lpos_{0}'.format(item))
            qf_args.curr_qmcase_values[item] = bool(
                int(request.args.get('qmcase_{0}'.format(item), '0')))
            qf_args.curr_pcq_pos_neg_values[item] = request.args.get('pcq_pos_neg_{0}'.format(item))
            qf_args.curr_include_empty_values[item] = bool(
                int(request.args.get('include_empty_{0}'.format(item), '0')))
            qf_args.curr_default_attr_values[item] = request.args.get(
                'default_attr_{0}'.format(item))

        self._store_semi_persistent_attrs(('align', 'corpname', 'queryselector'))
        self.add_conc_form_args(qf_args)
        self._attach_query_params(out)
        self._attach_aligned_query_params(out)
        self._export_subcorpora_list(self.args.corpname, self.args.usesubcorp, out)
        out['query_history_page_num_records'] = int(
            settings.get('plugins', 'query_storage')['page_num_records'])
        out['StructAttrList'] = [{'label': corpus_get_conf(self.corp, n + '.LABEL') or n, 'n': n}
                                 for n in corpus_get_conf(self.corp, 'StructAttrList'.upper()).split(',') if n]
        return out

    @exposed(return_type='json')
    def get_cached_conc_sizes(self, _):
        from concworker import GeneralWorker
        self._headers['Content-Type'] = 'text/plain'
        return self.call_function(GeneralWorker().get_cached_conc_sizes, (self.corp,))

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
            orig_conc = self.call_function(conclib.get_conc, (self.corp, self.session_get('user', 'id')),
                                           q=self.args.q[:i])
            concsize = orig_conc.size()
            fullsize = orig_conc.fullsize()

        return dict(sampled_size=sampled_size, concsize=concsize,
                    relconcsize=1e6 * fullsize / self.corp.search_size(),
                    fullsize=fullsize, finished=conc.finished())

    @exposed(access_level=1, template='view.tmpl', page_model='view', func_arg_mapped=True, mutates_conc=True)
    def sortx(self, sattr='word', skey='rc', spos=3, sicase='', sbward=''):
        """
        simple sort concordance
        """
        self.disabled_menu_items = ()

        if len(self._lines_groups) > 0:
            raise UserActionException('Cannot apply a sorting once a group of lines has been saved')

        qinfo = SortFormArgs(persist=True)
        qinfo.sattr = self.args.sattr
        qinfo.sbward = self.args.sbward
        qinfo.sicase = self.args.sicase
        qinfo.skey = self.args.skey
        qinfo.spos = self.args.spos
        qinfo.form_action = 'sortx'
        self.add_conc_form_args(qinfo)

        if skey == 'lc':
            ctx = '-1<0~-%i<0' % spos
        elif skey == 'kw':
            ctx = '0<0~0>0'
        elif skey == 'rc':
            ctx = '1>0~%i>0' % spos
        else:
            ctx = ''
        if '.' in sattr:
            ctx = ctx.split('~')[0]

        self.args.q.append('s%s/%s%s %s' % (sattr, sicase, sbward, ctx))
        return self.view()

    @exposed(access_level=1, template='view.tmpl', page_model='view', mutates_conc=True)
    def mlsortx(self, _):
        """
        multiple level sort concordance
        """
        qinfo = SortFormArgs(persist=True)
        qinfo.form_action = 'mlsortx'
        qinfo.sortlevel = self.args.sortlevel
        qinfo.ml1attr = self.args.ml1attr
        qinfo.ml2attr = self.args.ml2attr
        qinfo.ml3attr = self.args.ml3attr
        qinfo.ml4attr = self.args.ml4attr
        qinfo.ml1bward = self.args.ml1bward
        qinfo.ml2bward = self.args.ml2bward
        qinfo.ml3bward = self.args.ml3bward
        qinfo.ml4bward = self.args.ml4bward
        qinfo.ml1ctx = self.args.ml1ctx
        qinfo.ml2ctx = self.args.ml2ctx
        qinfo.ml3ctx = self.args.ml3ctx
        qinfo.ml4ctx = self.args.ml4ctx
        qinfo.ml1icase = self.args.ml1icase
        qinfo.ml2icase = self.args.ml2icase
        qinfo.ml3icase = self.args.ml3icase
        qinfo.ml4icase = self.args.ml4icase
        qinfo.ml1pos = self.args.ml1pos
        qinfo.ml2pos = self.args.ml2pos
        qinfo.ml3pos = self.args.ml3pos
        qinfo.ml4pos = self.args.ml4pos
        self.add_conc_form_args(qinfo)

        mlxfcode = 'rc'
        crit = self.onelevelcrit('s', self.args.ml1attr, self.args.ml1ctx, self.args.ml1pos, mlxfcode,
                                 self.args.ml1icase, self.args.ml1bward)
        if self.args.sortlevel > 1:
            crit += self.onelevelcrit(' ', self.args.ml2attr, self.args.ml2ctx, self.args.ml2pos, mlxfcode,
                                      self.args.ml2icase, self.args.ml2bward)
            if self.args.sortlevel > 2:
                crit += self.onelevelcrit(' ', self.args.ml3attr, self.args.ml3ctx, self.args.ml3pos, mlxfcode,
                                          self.args.ml3icase, self.args.ml3bward)
        self.args.q.append(crit)
        return self.view()

    def _is_err_corpus(self):
        availstruct = self.corp.get_conf('STRUCTLIST').split(',')
        return 'err' in availstruct and 'corr' in availstruct

    def _compile_basic_query(self, qtype=None, suff='', cname=''):
        queryselector = getattr(self.args, 'queryselector' + suff)
        iquery = getattr(self.args, 'iquery' + suff, '')
        lemma = getattr(self.args, 'lemma' + suff, '')
        lpos = getattr(self.args, 'lpos' + suff, '')
        phrase = getattr(self.args, 'phrase' + suff, '')
        qmcase = getattr(self.args, 'qmcase' + suff, '')
        word = getattr(self.args, 'word' + suff, '')
        wpos = getattr(self.args, 'wpos' + suff, '')
        char = getattr(self.args, 'char' + suff, '')
        cql = getattr(self.args, 'cql' + suff, '')

        queries = dict(
            cql='%(cql)s',
            lemma='[lempos="%(lemma)s%(lpos)s"]',
            wordform='[%(wordattr)s="%(word)s" & tag="%(wpos)s.*"]',
            wordformonly='[%(wordattr)s="%(word)s"]')
        for a in ('iquery', 'word', 'lemma', 'phrase', 'cql'):
            if queryselector == a + 'row':
                if getattr(self.args, a + suff, ''):
                    setattr(self.args, a + suff, getattr(self.args, a + suff).strip())
                elif suff:
                    return ''
                else:
                    raise ConcError(translate('No query entered.'))
        if qtype:
            return queries[qtype] % self.clone_args()
        thecorp = cname and self.cm.get_Corpus(cname) or self.corp
        attrlist = thecorp.get_conf('ATTRLIST').split(',')
        wposlist = dict(self.cm.corpconf_pairs(thecorp, 'WPOSLIST'))
        lposlist = dict(self.cm.corpconf_pairs(thecorp, 'LPOSLIST'))

        if queryselector == 'iqueryrow':
            if 'lc' in attrlist:
                if 'lemma_lc' in attrlist:
                    qitem = '[lc="%(q)s"|lemma_lc="%(q)s"]'
                elif 'lemma' in attrlist:
                    qitem = '[lc="%(q)s"|lemma="(?i)%(q)s"]'
                else:
                    qitem = '[lc="%(q)s"]'
            else:
                if 'lemma' in attrlist:
                    qitem = '[word="(?i)%(q)s"|lemma="(?i)%(q)s"]'
                else:
                    qitem = '[word="(?i)%(q)s"]'

            if '--' not in iquery:
                return ''.join([qitem % {'q': l10n.escape(q)}
                                for q in iquery.split()])
            else:
                def split_tridash(word, qitem):
                    if '--' not in word:
                        return qitem % {'q': word}
                    w1, w2 = word.split('--', 1)
                    return "( %s | %s %s | %s )" % (qitem % {'q': w1 + w2},
                                                    qitem % {'q': w1},
                                                    qitem % {'q': w2},
                                                    qitem % {'q': w1 + '-' + w2})

                return ''.join([split_tridash(l10n.escape(q), qitem)
                                for q in iquery.split()])

        elif queryselector == 'lemmarow':
            if not lpos:
                return '[lemma="%s"]' % lemma
            elif 'lempos' in attrlist:
                try:
                    if not lpos in lposlist.values():
                        lpos = lposlist[lpos]
                except KeyError:
                    raise ConcError(translate('Undefined lemma PoS') + ' "%s"' % lpos)
                return '[lempos="%s%s"]' % (lemma, lpos)
            else:  # XXX WTF?
                try:
                    if lpos in wposlist.values():
                        wpos = lpos
                    else:
                        wpos = wposlist[lpos]
                except KeyError:
                    raise ConcError(translate('Undefined word form PoS')
                                    + ' "%s"' % lpos)
                return '[lemma="%s" & tag="%s"]' % (lemma, wpos)
        elif queryselector == 'phraserow':
            if self.args.qmcase:
                return ' '.join(['"%s"' % p for p in phrase.split()])
            else:
                return ' '.join(['"(?i)%s"' % p for p in phrase.split()])
        elif queryselector == 'wordrow':
            if qmcase:
                wordattr = 'word="%s"' % word
            else:
                if 'lc' in attrlist:
                    wordattr = 'lc="%s"' % word
                else:
                    wordattr = 'word="(?i)%s"' % word
            if not wpos:
                return '[%s]' % wordattr
            try:
                if not wpos in wposlist.values():
                    wpos = wposlist[wpos]
            except KeyError:
                raise ConcError(translate('Undefined word form PoS') + ' "%s"' % wpos)
            return '[%s & tag="%s"]' % (wordattr, wpos)
        elif queryselector == 'charrow':
            if not char:
                raise ConcError(translate('No char entered'))
            return '[word=".*%s.*"]' % char
        elif queryselector == 'tag':
            return '[tag="%s"]' % self.args.tag
        else:
            return re.sub(r'[\n\r]+', ' ', cql).strip()

    def _compile_query(self, qtype=None, cname=''):
        if self._is_err_corpus():
            from controller.errors import FunctionNotSupported
            raise FunctionNotSupported()
        return self._compile_basic_query(qtype, cname=cname)

    def _set_first_query(self, fc_lemword_window_type='',
                         fc_lemword_wsize=0,
                         fc_lemword_type='',
                         fc_lemword='',
                         fc_pos_window_type='',
                         fc_pos_wsize=0,
                         fc_pos_type='',
                         fc_pos=()):
        """
        first query screen
        """
        def append_form_filter_op(opIdx, attrname, items, ctx, fctxtype):
            filter_args = ContextFilterArgsConv(self.args)(attrname, items, ctx, fctxtype)
            self.acknowledge_auto_generated_conc_op(opIdx, filter_args)

        def ctx_to_str(ctx):
            return ' '.join(str(x) for x in ctx)

        def append_filter(attrname, items, ctx, fctxtype):
            if not items:
                return
            if fctxtype == 'any':
                self.args.q.append('P%s [%s]' %
                                   (ctx_to_str(ctx), '|'.join(['%s="%s"' % (attrname, i) for i in items])))
                append_form_filter_op(1, attrname, items, ctx, fctxtype)
            elif fctxtype == 'none':
                self.args.q.append('N%s [%s]' %
                                   (ctx_to_str(ctx), '|'.join(['%s="%s"' % (attrname, i) for i in items])))
                append_form_filter_op(1, attrname, items, ctx, fctxtype)
            elif fctxtype == 'all':
                for i, v in enumerate(items):
                    self.args.q.append('P%s [%s="%s"]' % (ctx_to_str(ctx), attrname, v))
                    append_form_filter_op(1 + i, attrname, [v], ctx, fctxtype)

        if 'lemma' in self.corp.get_conf('ATTRLIST').split(','):
            lemmaattr = 'lemma'
        else:
            lemmaattr = 'word'
        wposlist = dict(self.cm.corpconf_pairs(self.corp, 'WPOSLIST'))
        if self.args.queryselector == 'phraserow':
            self.args.default_attr = 'word'  # XXX to be removed with new first form
        if self.args.default_attr:
            qbase = 'a%s,' % self.args.default_attr
        else:
            qbase = 'q'
        texttypes = TextTypeCollector(self.corp, self.args).get_query()
        if texttypes:
            ttquery = import_string(' '.join(['within <%s %s />' % nq for nq in texttypes]),
                                    from_encoding=self.corp.get_conf('ENCODING'))
        else:
            ttquery = u''
        par_query = ''
        nopq = []
        for al_corpname in self.args.align:
            pcq_args = self.export_aligned_form_params(al_corpname, state_only=False,
                                                       name_filter=lambda v: v.startswith('pcq_pos_neg'))
            wnot = '' if pcq_args.get('pcq_pos_neg_' + al_corpname) == 'pos' else '!'
            pq = self._compile_basic_query(suff='_' + al_corpname,
                                           cname=al_corpname)
            if pq:
                par_query += ' within%s %s:%s' % (wnot, al_corpname, pq)
            if not pq or wnot:
                nopq.append(al_corpname)
        self.args.q = [qbase + self._compile_query() + ttquery + par_query]
        if fc_lemword_window_type == 'left':
            append_filter(lemmaattr,
                          fc_lemword.split(),
                          (-fc_lemword_wsize, -1, -1),
                          fc_lemword_type)
        elif fc_lemword_window_type == 'right':
            append_filter(lemmaattr,
                          fc_lemword.split(),
                          (1, fc_lemword_wsize, 1),
                          fc_lemword_type)
        elif fc_lemword_window_type == 'both':
            append_filter(lemmaattr,
                          fc_lemword.split(),
                          (-fc_lemword_wsize, fc_lemword_wsize, 1),
                          fc_lemword_type)
        if fc_pos_window_type == 'left':
            append_filter('tag',
                          [wposlist.get(t, '') for t in fc_pos],
                          (-fc_pos_wsize, -1, -1),
                          fc_pos_type)
        elif fc_pos_window_type == 'right':
            append_filter('tag',
                          [wposlist.get(t, '') for t in fc_pos],
                          (1, fc_pos_wsize, 1),
                          fc_pos_type)
        elif fc_pos_window_type == 'both':
            append_filter('tag',
                          [wposlist.get(t, '') for t in fc_pos],
                          (-fc_pos_wsize, fc_pos_wsize, 1),
                          fc_pos_type)
        for al_corpname in self.args.align:
            if al_corpname in nopq and not int(getattr(self.args, 'include_empty_' + al_corpname, '0')):
                if corplib.manatee_min_version('2.130.6'):
                    self.args.q.append('X%s' % al_corpname)
                else:
                    self.args.q.append('x-%s' % al_corpname)
                    self.args.q.append('p0 0 1 []')
                    self.args.q.append('x-%s' % self.args.corpname)

    @exposed(template='view.tmpl', page_model='view', mutates_conc=True, http_method=('GET', 'POST'))
    def first(self, request):
        self._clear_prev_conc_params()
        self._store_semi_persistent_attrs(('align', 'corpname', 'queryselector'))

        ans = {}
        # 1) store query forms arguments for later reuse on client-side
        corpora = self._select_current_aligned_corpora(active_only=True)
        qinfo = QueryFormArgs(corpora=corpora, persist=True)
        for i, corp in enumerate(corpora):
            suffix = '_{0}'.format(corp) if i > 0 else ''
            qtype = self.import_qs(getattr(self.args, 'queryselector' + suffix, None))
            qinfo.curr_query_types[corp] = qtype
            qinfo.curr_queries[corp] = getattr(
                self.args, qtype + suffix, None) if qtype is not None else None
            qinfo.curr_pcq_pos_neg_values[corp] = getattr(self.args, 'pcq_pos_neg' + suffix, None)
            qinfo.curr_include_empty_values[corp] = bool(
                int(getattr(self.args, 'include_empty' + suffix, '0')))
            qinfo.curr_lpos_values[corp] = getattr(self.args, 'lpos' + suffix, None)
            qinfo.curr_qmcase_values[corp] = bool(int(getattr(self.args, 'qmcase' + suffix, '0')))
            qinfo.curr_default_attr_values[corp] = getattr(
                self.args, 'default_attr' + suffix, 'word')
            qinfo.selected_text_types, qinfo.bib_mapping = self._get_checked_text_types(
                self._request)
        self.add_conc_form_args(qinfo)
        # 2) process the query
        try:
            self._set_first_query(self.args.fc_lemword_window_type,
                                  self.args.fc_lemword_wsize,
                                  self.args.fc_lemword_type,
                                  self.args.fc_lemword,
                                  self.args.fc_pos_window_type,
                                  self.args.fc_pos_wsize,
                                  self.args.fc_pos_type,
                                  self.args.fc_pos)
            if self.args.shuffle == 1 and 'f' not in self.args.q:
                self.args.shuffle = 0
                self.args.q.append('f')
                self.acknowledge_auto_generated_conc_op(
                    len(self.args.q) - 1, ShuffleFormArgs(persist=True))
            ans['replicable_query'] = False if self.get_http_method() == 'POST' else True
            ans['TextTypeSel'] = get_tt(
                self.corp, self._plugin_api).export_with_norms(ret_nums=False)
        except ConcError as e:
            self.add_system_message('warning', e.message)
        ans.update(self.view())
        return ans

    @exposed(template='view.tmpl', page_model='view', mutates_conc=True)
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
        return self.view()

    @exposed(template='view.tmpl', page_model='view')
    def switch_main_corp(self, request):
        maincorp = request.args['maincorp']
        self.args.q.append('x-{0}'.format(maincorp))
        ksargs = KwicSwitchArgs(maincorp=maincorp, persist=True)
        self.add_conc_form_args(ksargs)
        return self.view()

    @exposed(access_level=1, template='view.tmpl', vars=('orig_query', ), page_model='view', mutates_conc=True)
    def filter(self, request):
        """
        Positive/Negative filter
        """
        if len(self._lines_groups) > 0:
            raise UserActionException('Cannot apply a filter once a group of lines has been saved')

        pnfilter = request.args.get('pnfilter', '')
        filfl = request.args.get('filfl', 'f')
        filfpos = request.args.get('filfpos', '-5')
        filtpos = request.args.get('filtpos', '5')
        inclkwic = request.args.get('inclkwic', '0')
        within = request.args.get('within', '0')

        qtype = self.import_qs(self.args.queryselector)
        ff_args = FilterFormArgs(maincorp=self.args.maincorp if self.args.maincorp else self.args.corpname,
                                 persist=True)
        ff_args.query_type = qtype
        ff_args.query = getattr(self.args, qtype, None) if qtype is not None else None
        ff_args.maincorp = self.args.maincorp if self.args.maincorp else self.args.corpname
        ff_args.pnfilter = self.args.pnfilter
        ff_args.filfl = self.args.filfl
        ff_args.filfpos = self.args.filfpos
        ff_args.filtpos = self.args.filtpos
        ff_args.inclkwic = bool(int(inclkwic))
        ff_args.qmcase = self.args.qmcase
        ff_args.default_attr = self.args.default_attr
        self.add_conc_form_args(ff_args)

        self._store_semi_persistent_attrs(('queryselector', 'filfpos', 'filtpos'))
        if pnfilter not in ('p', 'n'):
            raise ConcError(translate('Select Positive or Negative filter type'))
        if not int(inclkwic):
            pnfilter = pnfilter.upper()
        rank = dict(f=1, l=-1).get(filfl, 1)
        texttypes = TextTypeCollector(self.corp, self.args).get_query()
        try:
            query = self._compile_query(cname=self.args.maincorp)
        except ConcError:
            if texttypes:
                query = '[]'
                filfpos = '0'
                filtpos = '0'
            else:
                raise ConcError(translate('No query entered.'))
        query += ' '.join(['within <%s %s />' % nq for nq in texttypes])
        query = import_string(query, from_encoding=self.corp.get_conf('ENCODING'))
        if int(within):
            wquery = ' within %s:(%s)' % (self.args.maincorp or self.args.corpname, query)
            self.args.q[0] += wquery
            self.args.q.append('x-' + (self.args.maincorp or self.args.corpname))
        else:
            self.args.q.append('%s%s %s %i %s' % (pnfilter, filfpos, filtpos, rank, query))
        try:
            return self.view()
        except:
            if int(within):
                self.args.q[0] = self.args.q[0][:-len(wquery)]
            else:
                del self.args.q[-1]
            raise

    @exposed(access_level=0, template='view.tmpl', vars=('concsize',), page_model='view', mutates_conc=True)
    def reduce(self, _):
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
        return self.view()

    @exposed(access_level=0, template='view.tmpl', page_model='view', mutates_conc=True)
    def shuffle(self, _):
        if len(self._lines_groups) > 0:
            raise UserActionException('Cannot apply a shuffle once a group of lines has been saved')
        self.add_conc_form_args(ShuffleFormArgs(persist=True))
        self.args.q.append('f')
        return self.view()

    @exposed(access_level=0, template='view.tmpl', page_model='view', mutates_conc=True)
    def filter_subhits(self, _):
        if len(self._lines_groups) > 0:
            raise UserActionException('Cannot apply a shuffle once a group of lines has been saved')
        self.add_conc_form_args(SubHitsFilterFormArgs(persist=True))
        self.args.q.append('D')
        return self.view()

    @exposed(access_level=0, template='view.tmpl', page_model='view', func_arg_mapped=False,
             mutates_conc=True)
    def filter_firsthits(self, request):
        if len(self._lines_groups) > 0:
            raise UserActionException('Cannot apply a shuffle once a group of lines has been saved')
        self.add_conc_form_args(FirstHitsFilterFormArgs(
            persist=True, doc_struct=self.corp.get_conf('DOCSTRUCTURE')))
        self.args.q.append('F{0}'.format(request.args.get('fh_struct')))
        return self.view()

    @exposed(access_level=0, func_arg_mapped=True, page_model='freq')
    def freqs(self, fcrit=(), flimit=0, freq_sort='', ml=0, line_offset=0, force_cache=0):
        """
        display a frequency list
        """
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
        args.minsize = None
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
            logging.getLogger(__name__).warn('freqs - empty list: %s' % (result,))
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
                                                   % (attr, icase, l10n.escape(w)) for w in wwords])
                            else:  # structure number
                                fquery = '0 0 1 [] within <%s #%s/>' % \
                                         (attr, item['Word'][0]['n'].split('#')[1])
                        else:  # text types
                            structname, attrname = attr.split('.')
                            if self.corp.get_conf(structname + '.NESTED'):
                                block['unprecise'] = True
                            fquery = '0 0 1 [] within <%s %s="%s" />' \
                                     % (structname, attrname,
                                        l10n.escape(item['Word'][0]['n']))
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
                cc = self.call_function(conclib.get_conc,
                                        (self.corp, self.session_get('user', 'id')),
                                        q=self.args.q + [pfilter[0][1]])
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
        result['text_types_data'] = get_tt(
            self.corp, self._plugin_api).export_with_norms(ret_nums=True)
        result['quick_save_row_limit'] = self.FREQ_QUICK_SAVE_MAX_LINES
        self._attach_query_params(result)
        return result

    def _make_wl_query(self):
        qparts = []
        if self.args.wlpat:
            qparts.append(u'%s="%s"' % (self.args.wlattr, self.args.wlpat))
        if not self.args.include_nonwords:
            qparts.append(u'%s!="%s"' % (self.args.wlattr,
                                         self.corp.get_conf('NONWORDRE')))

        whitelist = [w for w in re.split('\s+', self.args.wlwords.strip()) if w]
        blacklist = [w for w in re.split('\s+', self.args.blacklist.strip()) if w]
        if len(whitelist) > 0:
            qq = [u'%s=="%s"' % (self.args.wlattr, w.strip()) for w in whitelist]
            qparts.append('(' + '|'.join(qq) + ')')
        for w in blacklist:
            qparts.append(u'%s!=="%s"' % (self.args.wlattr, w.strip()))
        self.args.q = [u'q[' + '&'.join(qparts) + ']']

    @exposed(access_level=1, func_arg_mapped=True, template='txtexport/savefreq.tmpl', return_type='plain')
    def savefreq(self, fcrit=(), flimit=0, freq_sort='', ml=0,
                 saveformat='text', from_line=1, to_line='', colheaders=0, heading=0):
        """
        save a frequency list
        """
        from_line = int(from_line)
        to_line = int(to_line) if to_line else sys.maxint

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
        elif saveformat in ('csv', 'xml', 'xlsx'):
            def mkfilename(suffix): return '%s-freq-distrib.%s' % (self.args.corpname, suffix)
            writer = plugins.runtime.EXPORT.instance.load_plugin(saveformat, subtype='freq')

            # Here we expect that when saving multi-block items, all the block have
            # the same number of columns which is quite bad. But currently there is
            # no better common 'denominator'.
            num_word_cols = len(result['Blocks'][0].get('Items', [{'Word': []}])[0].get('Word'))
            writer.set_col_types(*([int] + num_word_cols * [unicode] + [float, float]))

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

    @exposed(access_level=0, template='freqs.tmpl', page_model='freq', accept_kwargs=True, func_arg_mapped=True)
    def freqml(self, flimit=0, freqlevel=1, **kwargs):
        """
        multilevel frequency list
        """
        fcrit = ' '.join([self.onelevelcrit('', kwargs.get('ml%dattr' % i, 'word'), kwargs.get('ml%dctx' % i, '0'),
                                            kwargs.get('ml%dpos' % i, 1), kwargs.get(
                                                'ml%dfcode' % i, 'rc'),
                                            kwargs.get('ml%dicase' % i, ''), 'e')
                          for i in range(1, freqlevel + 1)])
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

    @exposed(access_level=1, template='freqs.tmpl', page_model='freq', func_arg_mapped=True)
    def freqtt(self, flimit=0, fttattr=()):
        if not fttattr:
            raise ConcError(translate('No text type selected'))
        return self.freqs(['%s 0' % a for a in fttattr], flimit)

    @exposed(access_level=1, page_model='freq', template='freqs.tmpl')
    def freqct(self, request):
        """
        """

        args = freq_calc.CTFreqCalcArgs()
        args.corpname = self.corp.corpname
        args.subcname = getattr(self.corp, 'subcname', None)
        args.subcpath = self.subcpath
        args.user_id = self.session_get('user', 'id')
        args.minsize = None
        args.q = self.args.q
        args.ctminfreq = int(request.args.get('ctminfreq', '1'))
        args.ctminfreq_type = request.args.get('ctminfreq_type')
        args.fcrit = '{0} {1} {2} {3}'.format(self.args.ctattr1, self.args.ctfcrit1,
                                              self.args.ctattr2, self.args.ctfcrit2)
        try:
            freq_data = freq_calc.calculate_freqs_ct(args)
        except UserActionException as ex:
            freq_data = dict(data=[], full_size=0)
            self.add_system_message('error', ex.message)

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
        ans['text_types_data'] = get_tt(
            self.corp, self._plugin_api).export_with_norms(ret_nums=True)
        ans['quick_save_row_limit'] = 0
        self._attach_query_params(ans)
        return ans

    @exposed(access_level=1, return_type='plain')
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
        self.disabled_menu_items = (MainMenu.CONCORDANCE('query-save-as'), MainMenu.VIEW('kwic-sent-switch'),
                                    MainMenu.CONCORDANCE('query-overview'))
        self._save_options(self.LOCAL_COLL_OPTIONS, self.args.corpname)
        if self.args.csortfn == '':
            self.args.csortfn = 't'
        logging.getLogger(__name__).debug('self.args.csortfn: {0}'.format(self.args.csortfn))

        calc_args = coll_calc.CollCalcArgs()
        calc_args.corpus_encoding = self.corp.get_conf('ENCODING')
        calc_args.corpname = self.args.corpname
        calc_args.subcname = getattr(self.corp, 'subcname', None)
        calc_args.subcpath = self.subcpath
        calc_args.user_id = self.session_get('user', 'id')
        calc_args.q = self.args.q
        calc_args.minsize = None  # TODO ??
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
        ans['text_types_data'] = get_tt(
            self.corp, self._plugin_api).export_with_norms(ret_nums=True)
        ans['quick_save_row_limit'] = self.COLLS_QUICK_SAVE_MAX_LINES
        ans['savecoll_max_lines'] = self.SAVECOLL_MAX_LINES
        return ans

    @exposed(access_level=1, vars=('concsize',), func_arg_mapped=True, template='txtexport/savecoll.tmpl',
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
        elif saveformat in ('csv', 'xml', 'xlsx'):
            def mkfilename(suffix): return '%s-collocations.%s' % (self.args.corpname, suffix)
            writer = plugins.runtime.EXPORT.instance.load_plugin(saveformat, subtype='coll')
            writer.set_col_types(int, unicode, *(8 * (float,)))

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

    @exposed(access_level=0)
    def widectx(self, request):
        """
        display a hit in a wider context
        """
        pos = int(request.args.get('pos', '0'))
        p_attrs = self.args.attrs.split(',')
        # prefer 'word' but allow other attr if word is off
        attrs = ['word'] if 'word' in p_attrs else p_attrs[0:1]
        data = self.call_function(conclib.get_detail_context, (self.corp, pos), attrs=attrs)
        if int(getattr(self.args, 'detail_left_ctx', 0)) >= int(data['maxdetail']):
            data['expand_left_args'] = None
        if int(getattr(self.args, 'detail_right_ctx', 0)) >= int(data['maxdetail']):
            data['expand_right_args'] = None
        data['widectx_globals'] = self._get_mapped_attrs(WidectxArgsMapping,
                                                         dict(structs=self._get_struct_opts()))
        return data

    @exposed(access_level=0, return_type='json')
    def fullref(self, request):
        """
        display a full reference
        """
        pos = int(request.args.get('pos', '0'))
        return self.call_function(conclib.get_full_ref, (self.corp, pos))

    @exposed(access_level=1, vars=('concsize',), func_arg_mapped=True, template='txtexport/saveconc.tmpl',
             return_type='plain')
    def saveconc(self, saveformat='text', from_line=0, to_line='', heading=0, numbering=0):

        def merge_conc_line_parts(items):
            """
            converts a list of dicts of the format [{'class': u'col0 coll', 'str': u' \u0159ekl'},
                {'class': u'attr', 'str': u'/j\xe1/PH-S3--1--------'},...] to a CSV compatible form
            """
            ans = ''
            for item in items:
                if 'class' in item and item['class'] != 'attr':
                    ans += ' %s' % item['str'].strip()
                else:
                    ans += '%s' % item['str'].strip()
            return ans.strip()

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

            conc = self.call_function(conclib.get_conc, (self.corp, self.session_get('user', 'id'),
                                                         corpus_info.sample_size))
            self._apply_linegroups(conc)
            kwic = Kwic(self.corp, self.args.corpname, conc)
            conc.switch_aligned(os.path.basename(self.args.corpname))
            from_line = int(from_line)
            to_line = min(int(to_line), conc.size())
            output = {'from_line': from_line, 'to_line': to_line}

            kwic_args = KwicPageArgs(self.args, base_attr=Kontext.BASE_ATTR)
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

            def mkfilename(suffix): return '%s-concordance.%s' % (self.args.corpname, suffix)
            if saveformat == 'text':
                self._headers['Content-Type'] = 'text/plain'
                self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                    mkfilename('txt'),)
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
                        writer.write_ref_headings(used_refs)

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
        path = os.path.join(settings.get('corpora', 'speech_files_path'), self.args.corpname, chunk)
        rpath = os.path.realpath(path)
        if os.path.isfile(rpath) and rpath.startswith(settings.get('corpora', 'speech_files_path')):
            with open(rpath, 'r') as f:
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
            'attr_allpos': self.args.attr_allpos,
            'ctxattrs': self.args.ctxattrs,
            'structs': self.args.structs,
            'refs': self.args.refs,
            'viewmode': self.args.viewmode
        }
        if self.args.usesubcorp:
            params['usesubcorp'] = self.args.usesubcorp
        if self.args.align:
            params['align'] = self.args.align
        return params

    @staticmethod
    def _filter_lines(data, pnfilter):
        def expand(x, n):
            return range(x, x + n)

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
        with plugins.rumtime.AUTH as auth:
            user_info = auth.get_user_info(self._plugin_api)
            user_email = user_info['email']
            username = user_info['username']
            smtp_server = mailing.smtp_factory()
            url = request.form.get('url')
            recip_email = request.form.get('email')

            text = translate('KonText user %s has sent a concordance link to you') % (username,) + ':'
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
        return ans

    @exposed(return_type='json', http_method='POST', mutates_conc=True)
    def ajax_rename_line_group(self, request):
        from_num = int(request.form.get('from_num', '0'))
        to_num = int(request.form.get('to_num', '-1'))
        new_groups = filter(lambda v: v[2] != from_num or to_num != -1, self._lines_groups)
        if to_num > 0:
            new_groups = map(lambda v: v if v[2] != from_num else (v[0], v[1], to_num), new_groups)
        self._lines_groups = LinesGroups(data=new_groups)
        self.add_conc_form_args(LgroupOpArgs(persist=True))
        return {}

    @exposed(access_level=1, return_type='plain')
    def export_line_groups_chart(self, request):
        with plugins.runtime.CHART_EXPORT as ce:
            format = request.args.get('cformat')
            filename = 'line-groups-{0}.{1}'.format(self.args.corpname, ce.get_suffix(format))
            self._headers['Content-Type'] = ce.get_content_type(format)
            self._headers['Content-Disposition'] = 'attachment; filename="{0}"'.format(filename)
            data = sorted(json.loads(request.args.get('data', '{}')
                                     ).items(), key=lambda x: int(x[0]))
            total = sum(x[1] for x in data)
            data = [('#{0} ({1}%)'.format(x[0], round(x[1] / float(total) * 100, 1)), x[1])
                    for x in data]
            return ce.export_pie_chart(data=data, title=request.args.get('title', '??'), format=format)

    @exposed(return_type='json', http_method='POST')
    def ajax_get_within_max_hits(self, request):
        if plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(self._plugin_api, self.args.corpname):
            # a faster solution based on liveattrs
            with plugins.runtime.LIVE_ATTRIBUTES as liveatt:
                attr_map = TextTypeCollector(self.corp, request).get_attrmap()
                size = liveatt.get_subc_size(self._plugin_api, self.corp, attr_map)
                return dict(total=size)
        else:
            tt_query = TextTypeCollector(self.corp, request).get_query()
            query = 'aword,[] within %s' % (
                ' '.join('<{0} {1} />'.format(k, v) for k, v in tt_query),)
            query = import_string(query, from_encoding=self.corp.get_conf('ENCODING'))
            self.args.q = [query]
            conc = self.call_function(
                conclib.get_conc, (self.corp, self.session_get('user', 'id')), async=0)
            conc.sync()
            return dict(total=conc.fullsize() if conc else None)

    @exposed(return_type='json', http_method='POST')
    def ajax_switch_corpus(self, _):
        self.disabled_menu_items = (MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
                                    MainMenu.VIEW('kwic-sentence'))

        avail_al_corp = []
        for al in filter(lambda x: len(x) > 0, self.corp.get_conf('ALIGNED').split(',')):
            alcorp = corplib.open_corpus(al)
            avail_al_corp.append(dict(label=alcorp.get_conf('NAME') or al, n=al))

        tmp_out = dict(
            uses_corp_instance=True,
            corpname=self.args.corpname,
            usesubcorp=self.args.usesubcorp,
            undo_q=[]
        )

        attrlist = corpus_get_conf(self.corp, 'ATTRLIST').split(',')
        tmp_out['AttrList'] = [{'label': corpus_get_conf(
            self.corp, n + '.LABEL') or n, 'n': n} for n in attrlist if n]

        tmp_out['StructAttrList'] = [{'label': corpus_get_conf(self.corp, n + '.LABEL') or n, 'n': n}
                                     for n in corpus_get_conf(self.corp, 'StructAttrList'.upper()).split(',')
                                     if n]
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

        ans = dict(
            corpname=self.args.corpname,
            subcorpname=self.corp.subcname if corplib.is_subcorpus(self.corp) else None,
            baseAttr=Kontext.BASE_ATTR,
            humanCorpname=self._human_readable_corpname(),
            corpusIdent=dict(
                id=self.args.corpname, name=self._human_readable_corpname(),
                variant=self._corpus_variant,
                usesubcorp=self.args.usesubcorp,
                origSubcorpName=getattr(self.corp, 'orig_subcname', self.args.usesubcorp),
                foreignSubcorp=(self.corp.author_id is not None and
                                self.session_get('user', 'id') != self.corp.author_id)),
            currentArgs=[['corpname', self.args.corpname]],
            compiledQuery=[],
            concPersistenceOpId=None,
            alignedCorpora=self.args.align,
            availableAlignedCorpora=avail_al_corp,
            activePlugins=plg_status['active_plugins'],
            queryOverview=[],
            numQueryOps=0,
            textTypesData=get_tt(self.corp, self._plugin_api).export_with_norms(ret_nums=True),
            menuData=MenuGenerator(tmp_out, self.args, self._plugin_api).generate(
                disabled_items=self.disabled_menu_items,
                save_items=self._save_menu,
                corpus_dependent=tmp_out['uses_corp_instance'],
                ui_lang=self.ui_lang),
            Wposlist=[{'n': x[0], 'v': x[1]} for x in poslist],
            Lposlist=[{'n': x[0], 'v': x[1]} for x in lposlist],
            AttrList=tmp_out['AttrList'],
            StructAttrList=tmp_out['StructAttrList'],
            InputLanguages=tmp_out['input_languages'],
            ConcFormsArgs=tmp_out['conc_forms_args'],
            CurrentSubcorp=self.args.usesubcorp,
            SubcorpList=tmp_out['SubcorpList'],
            TextTypesNotes=corpus_info.metadata.desc,
            TextDirectionRTL=True if self.corp.get_conf('RIGHTTOLEFT') else False,
            structsAndAttrs=self._get_structs_and_attrs()
        )
        self._configure_auth_urls(ans)
        return ans

    @exposed(http_method='GET', return_type='json')
    def load_query_pipeline(self, _):
        pipeline = self.load_pipeline_ops(self._q_code)
        return dict(ops=[dict(id=x.op_key, form_args=x.to_dict()) for x in pipeline])
