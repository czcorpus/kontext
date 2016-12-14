# Copyright (c) 2003-2009  Pavel Rychly
# Copyright (c) 2013  Institute of the Czech National Corpus
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

from werkzeug.datastructures import MultiDict
import manatee

from kontext import MainMenu, LinesGroups, Kontext
from controller import UserActionException, exposed
from querying import Querying
import settings
import conclib
import corplib
import freq_calc
import coll_calc
import plugins
import butils
from kwiclib import Kwic, KwicPageArgs
import l10n
from l10n import import_string, corpus_get_conf
from translation import ugettext as _
from argmapping import WidectxArgsMapping, Parameter
from texttypes import TextTypeCollector, get_tt


class ConcError(Exception):
    pass


class Actions(Querying):
    """
    KonText actions are specified here
    """

    FREQ_FIGURES = {'docf': 'Document counts', 'frq': 'Word counts', 'arf': 'ARF'}
    SAVECOLL_MAX_LINES = 1000000
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
        if speech_struct in corpus_get_conf(self.corp, 'STRUCTATTRLIST').split(','):
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

    def _add_globals(self, result, methodname, action_metadata):
        super(Actions, self)._add_globals(result, methodname, action_metadata)
        args = {}
        if self.args.align:
            for aligned_lang in self.args.align:
                args.update(self._export_aligned_form_params(aligned_lang, state_only=True))
        result['globals'] += '&' + self.urlencode(args)
        result['Globals'] = result['Globals'].update(args)
        result['query_overview'] = self.concdesc_json().get('Desc', [])

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
            return _('related to the subset defined by the selected text types')
        elif hasattr(self.corp, 'subcname'):
            return (_(u'related to the whole %s') % (corpus_name,)) + \
                    ':%s' % self.corp.subcname
        else:
            return _(u'related to the whole %s') % corpus_name

    @staticmethod
    def onelevelcrit(prefix, attr, ctx, pos, fcode, icase, bward='', empty=''):
        fromcode = {'lc': '<0', 'rc': '>0', 'kl': '<0', 'kr': '>0'}
        attrpart = '%s%s/%s%s%s ' % (prefix, attr, icase, bward, empty)
        if not ctx:
            ctx = '%i%s' % (pos, fromcode.get(fcode, '0'))
        if '~' in ctx and '.' in attr:
            ctx = ctx.split('~')[0]
        return attrpart + ctx

    @exposed(vars=('orig_query', ), legacy=True)
    def view(self):
        """
        KWIC view
        """
        corpus_info = self.get_corpus_info(self.args.corpname)
        if self.args.refs is None:  # user did not set this at all (!= user explicitly set '')
            self.args.refs = self.corp.get_conf('SHORTREF')

        self.args.righttoleft = False
        if self.corp.get_conf('RIGHTTOLEFT'):
            self.args.righttoleft = True
        if self.args.viewmode == 'kwic':
            self.args.leftctx = self.args.kwicleftctx
            self.args.rightctx = self.args.kwicrightctx
        elif self.args.viewmode == 'align' and self.args.align:
            self.args.leftctx = 'a,%s' % os.path.basename(self.args.corpname)
            self.args.rightctx = 'a,%s' % os.path.basename(self.args.corpname)
        else:
            sentence_struct = corpus_info['sentence_struct']
            self.args.leftctx = self.args.senleftctx_tpl % sentence_struct
            self.args.rightctx = self.args.senrightctx_tpl % sentence_struct

        i = 0
        while i < len(self.args.q):
            if self.args.q[i].startswith('s*') or self.args.q[i][0] == 'e':
                del self.args.q[i]
            i += 1

        conc = self.call_function(conclib.get_conc, (self.corp, self._session_get('user', 'user')),
                                  samplesize=corpus_info.sample_size)
        self._apply_linegroups(conc)
        conc.switch_aligned(os.path.basename(self.args.corpname))

        kwic = Kwic(self.corp, self.args.corpname, conc)
        kwic_args = KwicPageArgs(self.args, base_attr=Kontext.BASE_ATTR)
        kwic_args.speech_attr = self._get_speech_segment()
        kwic_args.labelmap = {}
        kwic_args.alignlist = [self.cm.get_Corpus(c) for c in self.args.align if c]
        kwic_args.structs = self._get_struct_opts()
        out = kwic.kwicpage(kwic_args)

        out['Sort_idx'] = self.call_function(kwic.get_sort_idx, (),
                                             enc=self.self_encoding())
        out['result_shuffled'] = not conclib.conc_is_sorted(self.args.q)
        out['query_contains_within'] = self._query_contains_within()

        out.update(self.get_conc_sizes(conc))
        if self.args.viewmode == 'sen':
            corplib.add_block_items(out['Lines'], block_size=1)
        if self.corp.get_conf('ALIGNED'):
            out['Aligned'] = [{'n': w,
                               'label': corplib.open_corpus(w).get_conf(
                                   'NAME') or w}
                              for w in self.corp.get_conf('ALIGNED').split(',')]
        if self.args.align and not self.args.maincorp:
            self.args.maincorp = os.path.basename(self.args.corpname)
        if len(out['Lines']) == 0:
            msg = _('No result. Please make sure the query and selected query type are correct.')
            self.add_system_message('info', msg)

        params = [
            ('pagesize', self.args.pagesize),
            ('leftctx', self.args.leftctx),
            ('rightctx', self.args.rightctx),
            ('heading', self.args.heading),
            ('numbering', self.args.numbering),
            ('align_kwic', self.args.align_kwic),
            ('from_line', 1),
            ('to_line', conc.size())
        ]
        self._add_save_menu_item('CSV', 'saveconc', params, save_format='csv')
        self._add_save_menu_item('XLSX', 'saveconc', params, save_format='xlsx')
        self._add_save_menu_item('XML', 'saveconc', params, save_format='xml')
        self._add_save_menu_item('TXT', 'saveconc', params, save_format='text')
        self._add_save_menu_item('%s...' % _('Custom'), 'saveconc_form',
                                 [('leftctx', self.args.leftctx), ('rightctx', self.args.rightctx)])
        # unlike 'globals' 'widectx_globals' stores full structs+structattrs information
        # to be able to display extended context with all set structural attributes
        out['widectx_globals'] = self._get_attrs(WidectxArgsMapping, dict(structs=self._get_struct_opts()))
        out['conc_line_max_group_num'] = settings.get_int('global', 'conc_line_max_group_num', 99)
        out['aligned_corpora'] = self.args.align
        out['line_numbers'] = bool(int(self.args.line_numbers if self.args.line_numbers else 0))
        out['speech_segment'] = self.get_speech_segment()
        out['speaker_id_attr'] = corpus_info.speaker_id_attr.split('.') if corpus_info.speaker_id_attr else None
        out['speech_overlap_attr'] = corpus_info.speech_overlap_attr.split('.') if corpus_info.speech_overlap_attr else None
        out['speech_overlap_val'] = corpus_info.speech_overlap_val
        speaker_struct = corpus_info.speaker_id_attr.split('.')[0] if corpus_info.speaker_id_attr else None
        out['speech_attrs'] = map(lambda x: x[1],
                                  filter(lambda x: x[0] == speaker_struct,
                                          map(lambda x: x.split('.'), self.corp.get_conf('STRUCTATTRLIST').split(','))))
        out['struct_ctx'] = self.corp.get_conf('STRUCTCTX')

        # query form data
        tt_data = get_tt(self.corp, self._plugin_api).export_with_norms(ret_nums=False)  # TODO deprecated
        out['text_types_data'] = json.dumps(tt_data)
        self._store_checked_text_types(self._request, out)
        self._attach_query_params(out)
        self._export_subcorpora_list(self.args.corpname, out)

        # TODO - this condition is ridiculous - can we make it somewhat simpler/less-redundant???
        if not out['finished'] and self.args.async and self.args.save and not out['sampled_size']:
            out['running_calc'] = True
        else:
            out['running_calc'] = False
        return out

    @exposed(apply_semi_persist_args=True)
    def first_form(self, request):
        self.disabled_menu_items = (MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE,
                                    MainMenu.VIEW('kwic-sentence'))
        out = {}
        self._store_checked_text_types(request, out)

        out['aligned_corpora'] = self.args.align
        tt_data = get_tt(self.corp, self._plugin_api).export_with_norms(ret_nums=False)  # TODO deprecated
        out['Normslist'] = tt_data['Normslist']
        out['text_types_data'] = json.dumps(tt_data)
        self._attach_aligned_query_params(out)
        self._attach_query_params(out)
        self._export_subcorpora_list(self.args.corpname, out)
        return out

    @exposed(return_type='json', legacy=True)
    def get_cached_conc_sizes(self):
        from concworker import GeneralWorker
        self._headers['Content-Type'] = 'text/plain'
        cs = self.call_function(GeneralWorker().get_cached_conc_sizes, (self.corp,))
        return {
            'finished': cs["finished"],
            'concsize': cs["concsize"],
            'relconcsize': cs["relconcsize"],
            'fullsize': cs["fullsize"]
        }

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
                return {'concsize': concsize, 'sampled_size': 0,
                        'relconcsize': 0, 'fullsize': fullsize,
                        'finished': conc.finished()}
        if sampled_size:
            orig_conc = self.call_function(conclib.get_conc, (self.corp, self._session_get('user', 'user')),
                                           q=self.args.q[:i])
            concsize = orig_conc.size()
            fullsize = orig_conc.fullsize()
        return dict(sampled_size=sampled_size, concsize=concsize,
                    relconcsize=1000000.0 * fullsize / self.corp.search_size(),
                    fullsize=fullsize, finished=conc.finished())

    @exposed(access_level=1, vars=('concsize', ), legacy=True)
    def sort(self):
        """
        sort concordance form
        """
        self.disabled_menu_items = (MainMenu.SAVE,)
        return {'Pos_ctxs': conclib.pos_ctxs(1, 1)}

    @exposed(access_level=1, template='view.tmpl', page_model='view', legacy=True)
    def sortx(self, sattr='word', skey='rc', spos=3, sicase='', sbward=''):
        """
        simple sort concordance
        """
        self.disabled_menu_items = ()

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

    @exposed(access_level=1, template='view.tmpl', page_model='view', legacy=True)
    def mlsortx(self,
                ml1attr='word', ml1pos=1, ml1icase='', ml1bward='', ml1fcode='rc',
                ml2attr='word', ml2pos=1, ml2icase='', ml2bward='', ml2fcode='rc',
                ml3attr='word', ml3pos=1, ml3icase='', ml3bward='', ml3fcode='rc',
                sortlevel=1, ml1ctx='', ml2ctx='', ml3ctx=''):
        """
        multiple level sort concordance
        """

        crit = self.onelevelcrit('s', ml1attr, ml1ctx, ml1pos, ml1fcode,
                                 ml1icase, ml1bward)
        if sortlevel > 1:
            crit += self.onelevelcrit(' ', ml2attr, ml2ctx, ml2pos, ml2fcode,
                                      ml2icase, ml2bward)
            if sortlevel > 2:
                crit += self.onelevelcrit(' ', ml3attr, ml3ctx, ml3pos, ml3fcode,
                                          ml3icase, ml3bward)
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

        queries = {
            'cql': '%(cql)s',
            'lemma': '[lempos="%(lemma)s%(lpos)s"]',
            'wordform': '[%(wordattr)s="%(word)s" & tag="%(wpos)s.*"]',
            'wordformonly': '[%(wordattr)s="%(word)s"]',
        }
        for a in ('iquery', 'word', 'lemma', 'phrase', 'cql'):
            if queryselector == a + 'row':
                if getattr(self.args, a + suff, ''):
                    setattr(self.args, a + suff, getattr(self.args, a + suff).strip())
                elif suff:
                    return ''
                else:
                    raise ConcError(_('No query entered.'))
        if qtype:
            return queries[qtype] % self.clone_args()
        thecorp = cname and self.cm.get_Corpus(cname) or self.corp
        attrlist = thecorp.get_conf('ATTRLIST').split(',')
        wposlist = dict(self.cm.corpconf_pairs(thecorp, 'WPOSLIST'))
        lposlist = dict(self.cm.corpconf_pairs(thecorp, 'LPOSLIST'))

        if queryselector == 'iqueryrow':
            self._save_query(iquery, 'iquery')
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
            self._save_query(lemma, 'lemma')
            if not lpos:
                return '[lemma="%s"]' % lemma
            elif 'lempos' in attrlist:
                try:
                    if not lpos in lposlist.values():
                        lpos = lposlist[lpos]
                except KeyError:
                    raise ConcError(_('Undefined lemma PoS') + ' "%s"' % lpos)
                return '[lempos="%s%s"]' % (lemma, lpos)
            else:  # XXX WTF?
                try:
                    if lpos in wposlist.values():
                        wpos = lpos
                    else:
                        wpos = wposlist[lpos]
                except KeyError:
                    raise ConcError(_('Undefined word form PoS')
                                    + ' "%s"' % lpos)
                return '[lemma="%s" & tag="%s"]' % (lemma, wpos)
        elif queryselector == 'phraserow':
            self._save_query(phrase, 'phrase')
            if self.args.qmcase:
                return ' '.join(['"%s"' % p for p in phrase.split()])
            else:
                return ' '.join(['"(?i)%s"' % p for p in phrase.split()])
        elif queryselector == 'wordrow':
            self._save_query(word, 'word')
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
                raise ConcError(_('Undefined word form PoS') + ' "%s"' % wpos)
            return '[%s & tag="%s"]' % (wordattr, wpos)
        elif queryselector == 'charrow':
            self._save_query(char, 'char')
            if not char:
                raise ConcError(_('No char entered'))
            return '[word=".*%s.*"]' % char
        elif queryselector == 'tag':
            self._save_query(self.args.tag, queryselector)
            return '[tag="%s"]' % self.args.tag
        else:
            self._save_query(cql, 'cql')
            return cql

    def _compile_query(self, qtype=None, cname=''):
        if self._is_err_corpus():
            from controller import FunctionNotSupported
            raise FunctionNotSupported()
        return self._compile_basic_query(qtype, cname=cname)

    @exposed(template='view.tmpl', page_model='view', legacy=True)
    def query(self, qtype='cql'):
        """
        perform query
        """
        if self.args.default_attr:
            qbase = 'a%s,' % self.args.default_attr
        else:
            qbase = 'q'
        self.args.q = [qbase + self._compile_query()]
        return self.view()

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

        def append_filter(attrname, items, ctx, fctxtype):
            if not items:
                return
            if fctxtype == 'any':
                self.args.q.append('P%s [%s]' %
                                   (ctx, '|'.join(['%s="%s"' % (attrname, i) for i in items])))
            elif fctxtype == 'none':
                self.args.q.append('N%s [%s]' %
                                   (ctx, '|'.join(['%s="%s"' % (attrname, i) for i in items])))
            elif fctxtype == 'all':
                for i in items:
                    self.args.q.append('P%s [%s="%s"]' % (ctx, attrname, i))

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
            pcq_args = self._export_aligned_form_params(al_corpname, state_only=False,
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
                          '-%i -1 -1' % fc_lemword_wsize,
                          fc_lemword_type)
        elif fc_lemword_window_type == 'right':
            append_filter(lemmaattr,
                          fc_lemword.split(),
                          '1 %i 1' % fc_lemword_wsize,
                          fc_lemword_type)
        elif fc_lemword_window_type == 'both':
            append_filter(lemmaattr,
                          fc_lemword.split(),
                          '-%i %i 1' % (fc_lemword_wsize, fc_lemword_wsize),
                          fc_lemword_type)
        if fc_pos_window_type == 'left':
            append_filter('tag',
                          [wposlist.get(t, '') for t in fc_pos],
                          '-%i -1 -1' % fc_pos_wsize,
                          fc_pos_type)
        elif fc_pos_window_type == 'right':
            append_filter('tag',
                          [wposlist.get(t, '') for t in fc_pos],
                          '1 %i 1' % fc_pos_wsize,
                          fc_pos_type)
        elif fc_pos_window_type == 'both':
            append_filter('tag',
                          [wposlist.get(t, '') for t in fc_pos],
                          '-%i %i 1' % (fc_pos_wsize, fc_pos_wsize),
                          fc_pos_type)
        for al_corpname in self.args.align:
            if al_corpname in nopq and not getattr(self.args,
                                                   'include_empty_' + al_corpname, ''):
                if butils.manatee_min_version('2.130.6'):
                    self.args.q.append('X%s' % al_corpname)
                else:
                    self.args.q.append('x-%s' % al_corpname)
                    self.args.q.append('p0 0 1 []')
                    self.args.q.append('x-%s' % self.args.corpname)

    @exposed(template='view.tmpl', page_model='view', legacy=True)
    def first(self):

        ans = {}
        self._store_semi_persistent_attrs(('align', 'corpname'))
        self._save_options(['queryselector'])
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
                self.args.q.append('f')
            ans['replicable_query'] = False if self.get_http_method() == 'POST' else True
            ans['TextTypeSel'] = get_tt(self.corp, self._plugin_api).export_with_norms(ret_nums=False)
            ans.update(self.view())
        except ConcError as e:
            raise UserActionException(e.message)
        return ans

    @exposed(access_level=1, legacy=True)
    def filter_form(self, within=0):
        self.disabled_menu_items = (MainMenu.SAVE,)

        self.args.lemma = ''
        self.args.lpos = ''
        out = {'within': within}
        if within and not self.contains_errors():
            self.add_system_message('warning', _('Please specify positive filter to switch'))
        self._attach_query_params(out)
        tt = get_tt(self.corp, self._plugin_api)
        tt_data = tt.export_with_norms(ret_nums=False, subcnorm=self.args.subcnorm)
        out['Normslist'] = tt_data['Normslist']
        out['text_types_data'] = json.dumps(tt_data)
        out['force_cql_default_attr'] = 'word'  # beucause filter form does not support custom implicit attrs
        out['checked_sca'] = {}
        return out

    @exposed(access_level=1, template='view.tmpl', vars=('orig_query', ), page_model='view',
             legacy=True)
    def filter(self, pnfilter='', filfl='f', filfpos='-5', filtpos='5',
               inclkwic=False, within=0):
        """
        Positive/Negative filter
        """
        self._store_semi_persistent_attrs(('queryselector', 'filfpos', 'filtpos'))
        if pnfilter not in ('p', 'n'):
            raise ConcError(_('Select Positive or Negative filter type'))
        if not inclkwic:
            pnfilter = pnfilter.upper()
        rank = {'f': 1, 'l': -1}.get(filfl, 1)
        texttypes = TextTypeCollector(self.corp, self.args).get_query()
        try:
            query = self._compile_query(cname=self.args.maincorp)
        except ConcError:
            if texttypes:
                query = '[]'
                filfpos = '0'
                filtpos = '0'
            else:
                raise ConcError(_('No query entered.'))
        query += ' '.join(['within <%s %s />' % nq for nq in texttypes])
        query = import_string(query, from_encoding=self.corp.get_conf('ENCODING'))
        if within:
            wquery = ' within %s:(%s)' % (self.args.maincorp or self.args.corpname, query)
            self.args.q[0] += wquery
            self.args.q.append('x-' + (self.args.maincorp or self.args.corpname))
        else:
            self.args.q.append('%s%s %s %i %s' % (pnfilter, filfpos, filtpos, rank, query))
        try:
            return self.view()
        except:
            if within:
                self.args.q[0] = self.args.q[0][:-len(wquery)]
            else:
                del self.args.q[-1]
            raise

    @exposed(legacy=True)
    def reduce_form(self):
        """
        """
        self.disabled_menu_items = (MainMenu.SAVE,)
        return {}

    @exposed(access_level=1, template='view.tmpl', vars=('concsize',), page_model='view',
             legacy=True)
    def reduce(self, rlines='250'):
        """
        random sample
        """
        self.args.q.append('r' + rlines)
        return self.view()

    @exposed(access_level=1, vars=('concsize',), legacy=True)
    def freq(self):
        """
        frequency list form
        """
        self.disabled_menu_items = (MainMenu.SAVE,)
        return {
            'Pos_ctxs': conclib.pos_ctxs(1, 1, 6),
            'multilevel_freq_dist_max_levels': settings.get('corpora',
                                                            'multilevel_freq_dist_max_levels', 1),
            'last_num_levels': self._session_get('last_freq_level')
        }

    @exposed(access_level=1, legacy=True)
    def freqs(self, fcrit=(), flimit=0, freq_sort='', ml=0, line_offset=0):
        """
        display a frequency list
        """
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
        args.user_id = self._session_get('user', 'user')
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

        calc_result = freq_calc.calculate_freqs(args)
        result = {
            'fcrit': [('fcrit', cr) for cr in fcrit],
            'FCrit': [{'fcrit': cr} for cr in fcrit],
            'Blocks': calc_result['data'],
            'paging': 0,
            'concsize': calc_result['conc_size'],
            'fmaxitems': self.args.fmaxitems,
            'quick_from_line': 1,
            'quick_to_line': None
        }

        if not result['Blocks'][0]:
            logging.getLogger(__name__).warn('freqs - empty list: %s' % (result,))
            return {'message': ('error', _('Empty list')), 'Blocks': [], 'paging': 0,
                    'quick_from_line': None, 'quick_to_line': None, 'FCrit': [], 'fcrit': []}

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
                begin = range.split('~')[0]
                if '~' in range:
                    end = range.split('~')[1]
                else:
                    end = begin
                attr = attr.split("/")
                if len(attr) > 1 and "i" in attr[1]:
                    icase = '(?i)'
                else:
                    icase = ''
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
                    item['pfilter'].append(('q', 'p%s' % fquery))
                    if len(attrs) == 1 and item['freq'] <= calc_result['conc_size']:
                        item['nfilter'].append(('q', 'n%s' % fquery))
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
            pfilter = [('q',  'p0 0 1 ([] within ! <err/>) within ! <corr/>')]
            cc = self.call_function(conclib.get_conc, (self.corp, self._session_get('user', 'user')),
                                    q=self.args.q + [pfilter[0][1]])
            freq = cc.size()
            err_nfilter, corr_nfilter = '', ''
            if freq != calc_result['conc_size']:
                err_nfilter = ';q=p0 0 1 ([] within <err/>) within ! <corr/>'
                corr_nfilter = ';q=p0 0 1 ([] within ! <err/>) within <corr/>'
            result['Blocks'][err_block]['Items'].append(
                {'Word': [{'n': 'no error'}], 'freq': freq,
                 'pfilter': pfilter, 'nfilter': err_nfilter,
                 'norel': 1, 'fbar': 0})
            result['Blocks'][corr_block]['Items'].append(
                {'Word': [{'n': 'no correction'}], 'freq': freq,
                 'pfilter': pfilter, 'nfilter': corr_nfilter,
                 'norel': 1, 'fbar': 0})

        params = [
            ('from_line', 1),
            ('to_line', self.FREQ_QUICK_SAVE_MAX_LINES),
            ('ml', self.args.ml),
            ('flimit', self.args.flimit),
            ('fcrit', fcrit),  # cannot use self.args.fcrit as freqs() is also called directly by other actions
            ('freq_sort', self.args.freq_sort),
            ('fpage', self.args.fpage),
            ('ftt_include_empty', self.args.ftt_include_empty)
        ]
        self._add_save_menu_item('CSV', 'savefreq', params, save_format='csv')
        self._add_save_menu_item('XLSX', 'savefreq', params, save_format='xlsx')
        self._add_save_menu_item('XML', 'savefreq', params, save_format='xml')
        self._add_save_menu_item('TXT', 'savefreq', params, save_format='text')
        params = params[:1] + params[2:]
        self._add_save_menu_item('%s...' % _('Custom'), 'savefreq_form', params)

        return result

    @exposed(access_level=1, vars=('concsize',), legacy=True)
    def savefreq_form(self, fcrit=(), flimit=0, freq_sort='', ml=0, saveformat='text', from_line=1,
                      to_line=''):
        """
        Displays a form to set-up the 'save frequencies' operation
        """
        self.disabled_menu_items = (MainMenu.SAVE, )
        result = self.freqs(fcrit, flimit, freq_sort, ml)
        is_multiblock = len(result['Blocks']) > 1
        if not to_line:
            if 'Total' in result['Blocks'][0]:
                to_line = result['Blocks'][0]['Total']
            else:
                to_line = len(result['Blocks'][0]['Items'])

        return {
            'FCrit': [{'fcrit': cr} for cr in fcrit],
            'from_line': from_line if not is_multiblock else '1',
            'to_line': to_line if not is_multiblock else 'auto',
            'is_multiblock': is_multiblock
        }

    @exposed(access_level=1, legacy=True)
    def savefreq(self, fcrit=(), flimit=0, freq_sort='', ml=0,
                 saveformat='text', from_line=1, to_line='', colheaders=0, heading=0):
        """
        save a frequency list
        """
        from_line = int(from_line)
        to_line = int(to_line) if to_line else sys.maxint
        err = self._validate_range((from_line, to_line), (1, None))
        if err is not None:
            raise err

        self.args.fpage = 1
        self.args.fmaxitems = to_line - from_line + 1
        self.args.wlwords, self.args.wlcache = self._get_wl_words(upl_file='wlfile',
                                                                  cache_file='wlcache')
        self.args.blacklist, self.args.blcache = self._get_wl_words(upl_file='wlblacklist',
                                                                    cache_file='blcache')
        if self.args.wlattr:
            self._make_wl_query()  # multilevel wordlist

        # following piece of sh.t has hidden parameter dependencies
        result = self.freqs(fcrit, flimit, freq_sort, ml)
        saved_filename = self._canonical_corpname(self.args.corpname)
        output = None
        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-frequencies.txt"' % \
                                                   saved_filename
            output = result
            output['Desc'] = self.concdesc_json()['Desc']
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-freq-distrib.%s' % (
                self._canonical_corpname(self.args.corpname), suffix)
            writer = plugins.get('export').load_plugin(saveformat, subtype='freq')

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

    @exposed(access_level=1, template='freqs.tmpl', accept_kwargs=True, legacy=True)
    def freqml(self, flimit=0, freqlevel=1, **kwargs):
        """
        multilevel frequency list
        """
        fcrit = ' '.join([self.onelevelcrit('', kwargs.get('ml%dattr' % i, 'word'), kwargs.get('ml%dctx' % i, '0'),
                                            kwargs.get('ml%dpos' % i, 1), kwargs.get('ml%dfcode' % i, 'rc'),
                                            kwargs.get('ml%dicase' % i, ''), 'e')
                          for i in range(1, freqlevel + 1)])
        result = self.freqs([fcrit], flimit, '', 1)
        result['ml'] = 1
        result['freqml_args'] = []
        self._session['last_freq_level'] = freqlevel
        return result

    @exposed(access_level=1, template='freqs.tmpl', legacy=True)
    def freqtt(self, flimit=0, fttattr=()):
        if not fttattr:
            self._exceptmethod = 'freq'
            raise ConcError(_('No text type selected'))
        return self.freqs(['%s 0' % a for a in fttattr], flimit)

    @exposed(access_level=1, vars=('concsize',), legacy=True)
    def coll(self):
        """
        collocations form
        """
        self.disabled_menu_items = (MainMenu.SAVE, )
        if self.args.maincorp:
            corp = corplib.open_corpus(self.args.maincorp)
        else:
            corp = self.corp
        corp_enc = corp.get_conf('ENCODING')
        colllist = corp.get_conf('ATTRLIST').split(',')
        out = {'Coll_attrlist': [{'n': n,
                                  'label': import_string(corp.get_conf(n + '.LABEL'), from_encoding=corp_enc) or n}
                                 for n in colllist],
               'Pos_ctxs': conclib.pos_ctxs(1, 1)}
        return out

    @exposed(access_level=1, vars=('concsize',), legacy=True, page_model='coll')
    def collx(self, line_offset=0, num_lines=0):
        """
        list collocations
        """
        self._save_options(self.LOCAL_COLL_OPTIONS, self.args.corpname)
        if self.args.csortfn == '' and self.args.cbgrfnscbgrfns:
            self.args.csortfn = self.args.cbgrfnscbgrfns[0]

        args = coll_calc.CollCalcArgs()
        args.corpus_encoding = self.corp.get_conf('ENCODING')
        args.corpname = self.args.corpname
        args.subcname = getattr(self.corp, 'subcname', None)
        args.subcpath = self.subcpath
        args.user_id = self._session_get('user', 'user')
        args.q = self.args.q
        args.minsize = None  # TODO ??
        args.save = self.args.save
        args.samplesize = 0  # TODO (check also freqs)
        args.cattr = self.args.cattr
        args.csortfn = self.args.csortfn
        args.cbgrfns = ''.join(self.args.cbgrfns)
        args.cfromw = self.args.cfromw
        args.ctow = self.args.ctow
        args.cminbgr = self.args.cminbgr
        args.cminfreq = self.args.cminfreq
        args.line_offset = line_offset
        args.num_lines = num_lines
        args.citemsperpage = self.args.citemsperpage
        args.collpage = self.args.collpage

        save_args = [
            ('cmaxitems', self.COLLS_QUICK_SAVE_MAX_LINES),
            ('cattr', self.args.cattr),
            ('cfromw', self.args.cfromw),
            ('ctow', self.args.ctow),
            ('cminfreq', self.args.cminfreq),
            ('cminbgr', self.args.cminbgr),
            ('csortfn', self.args.csortfn),
            ('collpage', self.args.collpage)
        ]
        save_args += [('cbgrfns', item) for item in self.args.cbgrfns]
        self._add_save_menu_item('CSV', 'savecoll', save_args, save_format='csv')
        self._add_save_menu_item('XLSX', 'savecoll', save_args, save_format='xlsx')
        self._add_save_menu_item('XML', 'savecoll', save_args, save_format='xml')
        self._add_save_menu_item('TXT', 'savecoll', save_args, save_format='text')
        save_args = save_args[1:]
        self._add_save_menu_item('%s...' % _('Custom'), 'savecoll_form', save_args)

        return coll_calc.calculate_colls(args)

    @exposed(access_level=1, legacy=True)
    def savecoll_form(self, from_line=1, to_line='', saveformat='text'):
        self.disabled_menu_items = (MainMenu.SAVE, )
        self.args.citemsperpage = sys.maxint
        self.args.collpage = 1  # we must reset this manually because user may have been on any page before

        if to_line == '':
            to_line = ''
        return dict(
            from_line=from_line,
            to_line=to_line,
            saveformat=saveformat,
            save_max_lines=Actions.SAVECOLL_MAX_LINES)

    @exposed(access_level=1, vars=('concsize',), legacy=True)
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
        err = self._validate_range((from_line, to_line), (1, None))
        if err is not None:
            raise err
        self.args.collpage = 1
        self.args.citemsperpage = Actions.SAVECOLL_MAX_LINES  # to make sure we include everything
        result = self.collx(line_offset=(from_line - 1), num_lines=num_lines)
        saved_filename = self._canonical_corpname(self.args.corpname)
        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-collocations.txt"' % (
                saved_filename,)
            out_data = result
            out_data['Desc'] = self.concdesc_json()['Desc']
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-collocations.%s' % (
                self._canonical_corpname(self.args.corpname), suffix)
            writer = plugins.get('export').load_plugin(saveformat, subtype='coll')
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

    @exposed(access_level=1, legacy=True, return_type='json')
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

    @exposed(access_level=0, legacy=True)
    def widectx(self, pos=0):
        """
        display a hit in a wider context
        """
        p_attrs = self.args.attrs.split(',')
        attrs = ['word'] if 'word' in p_attrs else p_attrs[0:1]  # prefer 'word' but allow other attr if word is off
        data = self.call_function(conclib.get_detail_context, (self.corp, pos), attrs=attrs)
        if int(getattr(self.args, 'detail_left_ctx', 0)) >= int(data['maxdetail']):
            data['expand_left_args'] = None
        if int(getattr(self.args, 'detail_right_ctx', 0)) >= int(data['maxdetail']):
            data['expand_right_args'] = None
        data['widectx_globals'] = self._get_attrs(WidectxArgsMapping,
                                                  dict(structs=self._get_struct_opts()))
        return data

    @exposed(access_level=0, return_type='json', legacy=True)
    def fullref(self, pos=0):
        """
        display a full reference
        """
        return self.call_function(conclib.get_full_ref, (self.corp, pos))

    @exposed(access_level=1, vars=('LastSubcorp',), legacy=True)
    def wordlist_form(self, ref_corpname=''):
        """
        Word List Form
        """
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
        out = {}
        if not ref_corpname:
            ref_corpname = self.args.corpname
        if hasattr(self, 'compatible_corpora'):
            out['CompatibleCorpora'] = plugins.get('corparch').get_list(self._plugin_api, self.permitted_corpora())
        refcm = corplib.CorpusManager(self.subcpath)
        out['RefSubcorp'] = refcm.subcorp_names(ref_corpname)
        out['ref_corpname'] = ref_corpname
        out['freq_figures'] = self.FREQ_FIGURES
        self._export_subcorpora_list(self.args.corpname, out)
        return out

    #(upl_file='wlfile', cache_file='wlcache')
    def _get_wl_words(self, upl_file, cache_file):
        """
        gets arbitrary list of words for wordlist
        """
        from hashlib import md5

        wl_cache_dir = settings.get('global', 'upload_cache_dir')
        if not os.path.isdir(wl_cache_dir):
            os.makedirs(wl_cache_dir)

        wlfile = self._request.files.get(upl_file)
        if wlfile:
            wlfile = wlfile.read()
        wlcache = getattr(self.args, cache_file, '')
        filename = wlcache
        wlwords = []
        if wlfile:  # save a cache file
            filename = os.path.join(wl_cache_dir, md5(wlfile).hexdigest() + '.wordlist')
            cache_file = open(filename, 'w')
            cache_file.write(wlfile)
            cache_file.close()
            wlwords = [w.strip().decode('utf-8') for w in wlfile.split('\n')]
        if wlcache:  # read from a cache file
            filename = os.path.join(wl_cache_dir, wlcache)
            cache_file = open(filename)
            wlwords = [w.strip() for w in cache_file]
            cache_file.close()
        return wlwords, os.path.basename(filename)

    @exposed(access_level=1, legacy=True)
    def wordlist(self, wlpat='', wltype='simple', usesubcorp='', ref_corpname='',
                 ref_usesubcorp='', paginate=True):
        """
        """
        self.disabled_menu_items = (MainMenu.VIEW('kwic-sentence', 'structs-attrs'),
                                    MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.CONCORDANCE)

        if not wlpat:
            self.args.wlpat = '.*'
        if '.' in self.args.wlattr:
            orig_wlnums = self.args.wlnums
            if self.args.wlnums == 'arf':
                raise ConcError(_('ARF cannot be used with text types'))
            elif self.args.wlnums == 'frq':
                self.args.wlnums = 'doc sizes'
            elif self.args.wlnums == 'docf':
                self.args.wlnums = 'docf'

        if paginate:
            wlmaxitems = self.args.wlpagesize * self.args.wlpage + 1
        else:
            wlmaxitems = sys.maxint
        wlstart = (self.args.wlpage - 1) * self.args.wlpagesize
        result = {
            'reload_url': self.create_url('wordlist', {
                'corpname': self.args.corpname, 'usesubcorp': self.args.usesubcorp,
                'wlattr': self.args.wlattr, 'wlpat': self.args.wlpat,
                'wlminfreq': self.args.wlminfreq, 'include_nonwords': self.args.include_nonwords,
                'wlsort': self.args.wlsort, 'wlnums': self.args.wlnums
            })
        }
        try:
            self.args.wlwords, self.args.wlcache = self._get_wl_words(upl_file='wlfile',
                                                                      cache_file='wlcache')
            self.args.blacklist, self.args.blcache = self._get_wl_words(upl_file='wlblacklist',
                                                                        cache_file='blcache')
            if wltype == 'keywords':
                args = (self.cm.get_Corpus(self.args.corpname, usesubcorp),
                        self.cm.get_Corpus(ref_corpname, ref_usesubcorp))
                kw_func = getattr(corplib, 'subc_keywords_onstr')
                args = args + (self.args.wlattr,)
                out = self.call_function(kw_func, args, wlmaxitems=wlmaxitems)[wlstart:]
                ref_name = self.cm.get_Corpus(ref_corpname).get_conf('NAME')
                result.update({'Keywords': [{'str': w, 'score': round(s, 1),
                                             'freq': round(f, 1),
                                             'freq_ref': round(fr, 1),
                                             'rel': round(rel, 1),
                                             'rel_ref': round(relref, 1)}
                                            for s, rel, relref, f, fr, w in out],
                               'ref_corp_full_name': ref_name
                })
                result_list = result['Keywords']
            else:  # ordinary list
                if hasattr(self, 'wlfile') and self.args.wlpat == '.*':
                    self.args.wlsort = ''
                result_list = self.call_function(corplib.wordlist,
                                                 (self.corp, self.args.wlwords),
                                                 wlmaxitems=wlmaxitems)[wlstart:]
                if self.args.wlwords:
                    result['wlcache'] = self.args.wlcache
                if self.args.blacklist:
                    result['blcache'] = self.args.blcache
                result['Items'] = result_list
            if len(result_list) < self.args.wlpagesize + 1:
                result['lastpage'] = 1
            else:
                result['lastpage'] = 0
                if paginate:
                    result_list = result_list[:-1]
            result['Items'] = result_list

            if '.' in self.args.wlattr:
                self.args.wlnums = orig_wlnums
            try:
                result['wlattr_label'] = (self.corp.get_conf(self.args.wlattr + '.LABEL') or
                                          self.args.wlattr)
            except Exception as e:
                result['wlattr_label'] = self.args.wlattr
                logging.getLogger(__name__).warning('wlattr_label set failed: %s' % e)

            result['freq_figure'] = _(self.FREQ_FIGURES.get(self.args.wlnums, '?'))
            result['processing'] = None

            params = {
                'colheaders': 0,
                'ref_usesubcorp': None,
                'wlattr': self.args.wlattr,
                'wlpat': wlpat,
                'wlsort': self.args.wlsort,
                'wlminfreq': self.args.wlminfreq,
                'wlnums': self.args.wlnums,
                'wlcache': self.args.wlcache,
                'blcache': self.args.blcache,
                'wltype': 'simple',
                'from_line': 1,
                'to_line': None,
                'include_nonwords': self.args.include_nonwords
            }

            self._add_save_menu_item('CSV', 'savewl', params, save_format='csv')
            self._add_save_menu_item('XLSX', 'savewl', params, save_format='xlsx')
            self._add_save_menu_item('XML', 'savewl', params, save_format='xml')
            self._add_save_menu_item('TXT', 'savewl', params, save_format='text')
            # custom save is solved in templates because of compatibility issues
            result['tasks'] = []
            return result

        except corplib.MissingSubCorpFreqFile as e:
            result.update({'attrname': self.args.cattr, 'tasks': []})
            out = freq_calc.build_arf_db(e.args[0], self.args.wlattr)
            if type(out) is list:
                processing = 0
                result['tasks'].extend(out)
            elif out:
                processing = out
            else:
                processing = 0
            result['processing'] = processing
            return result

    def _make_wl_query(self):
        qparts = []
        if self.args.wlpat:
            qparts.append(u'%s="%s"' % (self.args.wlattr, self.args.wlpat))
        if not self.args.include_nonwords:
            qparts.append(u'%s!="%s"' % (self.args.wlattr,
                                        self.corp.get_conf('NONWORDRE')))
        if self.args.wlwords:
            qq = [u'%s=="%s"' % (self.args.wlattr, w.strip()) for w in self.args.wlwords]
            qparts.append('(' + '|'.join(qq) + ')')
        for w in self.args.blacklist:
            qparts.append(u'%s!=="%s"' % (self.args.wlattr, w.strip()))
        self.args.q = [u'q[' + '&'.join(qparts) + ']']

    @exposed(template='freqs.tmpl', legacy=True)
    def struct_wordlist(self):
        self._exceptmethod = 'wordlist_form'
        if self.args.fcrit:
            self.args.wlwords, self.args.wlcache = self._get_wl_words(upl_file='wlfile',
                                                                      cache_file='wlcache')
            self.args.blacklist, self.args.blcache = self._get_wl_words(upl_file='wlblacklist',
                                                                        cache_file='blcache')
            self._make_wl_query()
            return self.freqs(self.args.fcrit, self.args.flimit, self.args.freq_sort, 1)

        if '.' in self.args.wlattr:
            raise ConcError('Text types are limited to Simple output')
        if self.args.wlnums != 'frq':
            raise ConcError('Multilevel lists are limited to Word counts frequencies')
        level = 3
        self.args.wlwords, self.args.wlcache = self._get_wl_words(upl_file='wlfile',
                                                                  cache_file='wlcache')
        self.args.blacklist, self.args.blcache = self._get_wl_words(upl_file='wlblacklist',
                                                                    cache_file='blcache')
        if not self.args.wlposattr1:
            raise ConcError(_('No output attribute specified'))
        if not self.args.wlposattr3:
            level = 2
        if not self.args.wlposattr2:
            level = 1
        if not self.args.wlpat and not self.args.wlwords:
            raise ConcError(
                _('You must specify either a pattern or a file to get the multilevel wordlist'))
        self._make_wl_query()
        self.args.flimit = self.args.wlminfreq
        return self.freqml(flimit=self.args.wlminfreq, freqlevel=level,
                           ml1attr=self.args.wlposattr1, ml2attr=self.args.wlposattr2,
                           ml3attr=self.args.wlposattr3)

    @exposed(access_level=1, legacy=True)
    def savewl_form(self, from_line=1, to_line=''):
        self.disabled_menu_items = (MainMenu.SAVE, )
        ans = {}
        ans['WlStateForm'] = json.dumps(dict(
            corpname=self.args.corpname,
            wlattr=self.args.wlattr,
            wlminfreq=self.args.wlminfreq,
            wlpat=self.args.wlpat,
            wlicase=self.args.wlicase,
            wlsort=self.args.wlsort,
            usesubcorp=self.args.usesubcorp,
            ref_corpname=self.args.ref_corpname,
            ref_usesubcorp=self.args.ref_usesubcorp,
            wlcache=self.args.wlcache,
            usearf=self.args.usearf,
            simple_n=self.args.simple_n,
            wltype=self.args.wltype,
            wlnums=self.args.wlnums,
            include_nonwords=self.args.include_nonwords,
            blcache=self.args.blcache
        ).items())
        return ans

    @exposed(access_level=1, legacy=True)
    def savewl(self, from_line=1, to_line='', wltype='simple', usesubcorp='',
               ref_corpname='', ref_usesubcorp='', saveformat='text', colheaders=0, heading=0):
        """
        save word list
        """
        from_line = int(from_line)
        to_line = int(to_line) if to_line else sys.maxint
        self.args.wlpage = 1
        ans = self.wordlist(wlpat=self.args.wlpat, wltype=wltype, usesubcorp=usesubcorp,
                            ref_corpname=ref_corpname, ref_usesubcorp=ref_usesubcorp,
                            paginate=False)
        err = self._validate_range((from_line, to_line), (1, None))
        if err is not None:
            raise err
        ans['Items'] = ans['Items'][:(to_line - from_line + 1)]

        saved_filename = self._canonical_corpname(self.args.corpname)

        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-word-list.txt"' % (
                saved_filename,)
            out_data = ans
            out_data['pattern'] = self.args.wlpat
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-word-list.%s' % (
                self._canonical_corpname(self.args.corpname), suffix)
            writer = plugins.get('export').load_plugin(saveformat, subtype='wordlist')
            writer.set_col_types(int, unicode, float)

            self._headers['Content-Type'] = writer.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                mkfilename(saveformat),)

            # write the header first, if required
            if colheaders:
                writer.writeheading(('', self.args.wlattr, 'freq'))
            elif heading:
                writer.writeheading({
                    'corpus': self._human_readable_corpname(),
                    'subcorpus': self.args.usesubcorp,
                    'pattern': self.args.wlpat
                })

            i = 1
            for item in ans['Items']:
                writer.writerow(i, (item['str'], str(item['freq'])))
                i += 1
            out_data = writer.raw_content()
        return out_data

    @exposed(legacy=True, return_type='json')
    def wordlist_process(self, attrname='', worker_tasks=None):
        backend, conf = settings.get_full('global', 'calc_backend')
        if worker_tasks and backend == 'celery':
            import task
            app = task.get_celery_app(conf['conf'])
            for t in worker_tasks:
                tr = app.AsyncResult(t)
                if tr.status == 'FAILURE':
                    raise task.ExternalTaskError('Task %s failed' % (t,))
        return {'status': freq_calc.build_arf_db_status(self.corp, attrname)}

    @exposed(legacy=True)
    def attr_vals(self, avattr='', avpat=''):
        self._headers['Content-Type'] = 'application/json'
        return corplib.attr_vals(self.args.corpname, avattr, avpat)

    @exposed(access_level=1, legacy=True)
    def saveconc_form(self, from_line=1, to_line=''):
        self.disabled_menu_items = (MainMenu.SAVE, )
        corpus_info = self.get_corpus_info(self.args.corpname)
        conc = self.call_function(conclib.get_conc, (self.corp, self._session_get('user', 'user'),
                                                     corpus_info.sample_size))
        if not to_line:
            to_line = conc.size()
            # TODO Save menu should be active here
        return {'from_line': from_line, 'to_line': to_line}

    @exposed(access_level=1, vars=('concsize',), legacy=True)
    def saveconc(self, saveformat='text', from_line=0, to_line='', heading=0, numbering=0,
                 leftctx='40', rightctx='40'):

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
            conc = self.call_function(conclib.get_conc, (self.corp, self._session_get('user', 'user'),
                                                         corpus_info.sample_size))
            self._apply_linegroups(conc)
            kwic = Kwic(self.corp, self.args.corpname, conc)
            conc.switch_aligned(os.path.basename(self.args.corpname))
            from_line = int(from_line)
            to_line = int(to_line)

            output = {'from_line': from_line, 'to_line': to_line}

            err = self._validate_range((from_line, to_line), (1, conc.size()))
            if err is not None:
                raise err

            kwic_args = KwicPageArgs(self.args, base_attr=Kontext.BASE_ATTR)
            kwic_args.speech_attr = self._get_speech_segment()
            kwic_args.fromp = 1
            kwic_args.pagesize = to_line - (from_line - 1)
            kwic_args.line_offset = (from_line - 1)
            kwic_args.labelmap = {}
            kwic_args.align = ()
            kwic_args.alignlist = [self.cm.get_Corpus(c) for c in self.args.align if c]
            kwic_args.leftctx = leftctx
            kwic_args.rightctx = rightctx
            kwic_args.structs = self._get_struct_opts()

            data = kwic.kwicpage(kwic_args)
            mkfilename = lambda suffix: '%s-concordance.%s' % (
                self._canonical_corpname(self.args.corpname), suffix)
            if saveformat == 'text':
                self._headers['Content-Type'] = 'text/plain'
                self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                    mkfilename('txt'),)
                output.update(data)
                # we must set contains_within = False as it is impossible (in the current user interface)
                # to offer a custom i.p.m. calculation before the download starts
                output['result_relative_freq_rel_to'] = self._get_ipm_base_set_desc(contains_within=False)
                output['Desc'] = self.concdesc_json()['Desc']
            elif saveformat in ('csv', 'xlsx', 'xml'):
                writer = plugins.get('export').load_plugin(saveformat, subtype='concordance')

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
                        raise ConcError(_('Invalid data'))

                    aligned_corpora = [self.corp] + \
                                      [self.cm.get_Corpus(c) for c in self.args.align if c]
                    writer.set_corpnames([c.get_conf('NAME') or c.get_conffile()
                                          for c in aligned_corpora])

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
                if heading:
                    writer.writeheading({
                        'corpus': self._human_readable_corpname(),
                        'subcorpus': self.args.usesubcorp,
                        'concordance_size': data['concsize'],
                        'arf': data['result_arf'],
                        'query': ['%s: %s (%s)' % (x['op'], x['arg'], x['size'])
                                  for x in self.concdesc_json().get('Desc', [])]
                    })
                output = writer.raw_content()
            else:
                raise UserActionException(_('Unknown export data type'))
            return output
        except Exception as e:
            self._headers['Content-Type'] = 'text/html'
            if 'Content-Disposition' in self._headers:
                del (self._headers['Content-Disposition'])
            raise e

    @exposed(access_level=0, legacy=True)
    def audio(self, chunk=''):
        """
        Provides access to audio-files containing speech segments.
        Access rights are per-corpus (i.e. if a user has a permission to
        access corpus 'X' then all related audio files are accessible).
        """
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
                return f.read()
        else:
            self._set_not_found()
            return None

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

    @exposed(return_type='json', http_method='POST', legacy=True)
    def ajax_unset_lines_groups(self):
        self._lines_groups = LinesGroups(data=[])
        q_id = self._store_conc_params()
        params = self._collect_conc_next_url_params(q_id)
        return {'id': q_id, 'next_url': self.create_url('view', params)}

    @exposed(return_type='json', http_method='POST', legacy=True)
    def ajax_apply_lines_groups(self, rows=''):
        self._lines_groups = LinesGroups(data=json.loads(rows))
        q_id = self._store_conc_params()
        params = self._collect_conc_next_url_params(q_id)
        return {
            'id': q_id,
            'next_url': self.create_url('view', params)
        }

    @exposed(return_type='json', http_method='POST', legacy=True)
    def ajax_remove_non_group_lines(self):
        self.args.q.append(self._filter_lines([(x[0], x[1]) for x in self._lines_groups], 'p'))
        q_id = self._store_conc_params()
        params = self._collect_conc_next_url_params(q_id)
        return {
            'id': q_id,
            'next_url': self.create_url('view', params)
        }

    @exposed(return_type='json', http_method='POST', legacy=True)
    def ajax_sort_group_lines(self):
        self._lines_groups.sorted = True
        q_id = self._store_conc_params()
        params = self._collect_conc_next_url_params(q_id)
        return {
            'id': q_id,
            'next_url': self.create_url('view', params)
        }

    @exposed(return_type='json', http_method='POST', legacy=True)
    def ajax_remove_selected_lines(self, pnfilter='p', rows=''):
        data = json.loads(rows)
        self.args.q.append(self._filter_lines(data, pnfilter))
        q_id = self._store_conc_params()
        params = self._collect_conc_next_url_params(q_id)
        return {
            'id': q_id,
            'next_url': self.create_url('view', params)
        }

    @exposed(return_type='json', http_method='POST', legacy=False)
    def ajax_send_group_selection_link_to_mail(self, request):
        import mailing
        ans = mailing.send_concordance_url(plugins.get('auth'), self._plugin_api,
                                           request.form.get('email'),
                                           request.form.get('url'))
        return {'ok': ans}

    @exposed(return_type='json', http_method='POST', legacy=True)
    def ajax_reedit_line_selection(self):
        ans = self._lines_groups.as_list()
        self._lines_groups = LinesGroups(data=[])
        q_id = self._store_conc_params()
        params = self._collect_conc_next_url_params(q_id)
        return dict(id=q_id, selection=ans, next_url=self.create_url('view', params))

    @exposed(return_type='json', legacy=True)
    def ajax_get_line_groups_stats(self):
        ans = defaultdict(lambda: 0)
        for item in self._lines_groups:
            ans[item[2]] += 1
        return ans

    @exposed(return_type='json', legacy=True)
    def ajax_rename_line_group(self, from_num=0, to_num=0):
        new_groups = filter(lambda v: v[2] != from_num or to_num != 0, self._lines_groups)
        if to_num > 0:
            new_groups = map(lambda v: v if v[2] != from_num else (v[0], v[1], to_num), new_groups)
        self._lines_groups = LinesGroups(data=new_groups)
        q_id = self._store_conc_params()
        params = self._collect_conc_next_url_params(q_id)
        return dict(id=q_id, next_url=self.create_url('view', params))

    @exposed(return_type='json', legacy=True)
    def ajax_get_within_max_hits(self):
        query = self.args.q[0]
        m = re.match(r'([\w]+,)(.+)', query)
        if m:
            query_pref = m.groups()[0]
            query_suff = m.groups()[1]
            self.args.q[0] = u'%s[] %s' % (query_pref, butils.CQLDetectWithin().get_within_part(query_suff))
            conc = self.call_function(conclib.get_conc, (self.corp, self._session_get('user', 'user')))
            conc.sync()
            return {'total': conc.fullsize() if conc else None}
        else:
            return {'total': None}


