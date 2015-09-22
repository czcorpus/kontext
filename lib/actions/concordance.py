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
import math
import os
import sys
import re

import werkzeug
from werkzeug.datastructures import MultiDict

from kontext import Kontext, ConcError, MainMenu
from controller import UserActionException, exposed
import settings
import conclib
import corplib
import plugins
import butils
from kwiclib import Kwic
import l10n
from l10n import import_string
from translation import ugettext as _
from argmapping import WidectxArgsMapping, ConcArgsMapping, QueryInputs, Parameter


class Actions(Kontext):
    """
    KonText actions are specified here
    """

    FREQ_FIGURES = {'docf': 'Document counts', 'frq': 'Word counts', 'arf': 'ARF'}

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

    def _import_aligned_form_param_names(self, aligned_corp):
        ans = {}
        for param_name in ('filfpos', 'filtpos', 'queryselector'):  # TODO where to store this?
            full_name = '%s_%s' % (param_name, aligned_corp)
            if hasattr(self, full_name):
                ans[param_name] = getattr(self, full_name)
        return ans

    def _store_semi_persistent_attrs(self, attr_list):
        """
        Stores the state of all semi-persistent parameters (i.e. the ones
        with persistence flag Parameter.PERSISTENT) and also aligned
        corpora form elements (they must be treated in a different way because
        they cannot be hardcoded as Parameter instances due to their dynamic nature).

        arguments:
            explicit_list -- a list of attributes to store (the ones
                             without Parameter.SEMI_PERSISTENT flag will be ignored)
        """
        semi_persist_attrs = self._get_items_by_persistence(Parameter.SEMI_PERSISTENT)
        tmp = MultiDict(self._session.get('semi_persistent_attrs', {}))
        for attr_name in attr_list:
            if attr_name in semi_persist_attrs:
                v = getattr(self.args, attr_name)
                if type(v) in (list, tuple):
                    tmp.setlist(attr_name, v)
                else:
                    tmp[attr_name] = v
        # we have to ensure Werkzeug sets 'should_save' attribute
        self._session['semi_persistent_attrs'] = tmp.items(multi=True)

        # aligned corpora forms inputs require different approach due to their dynamic nature
        if self.args.sel_aligned:
            sess_key = 'aligned_forms:%s' % self.args.corpname
            tmp = self._session.get(sess_key, {})
            for aligned_lang in self.args.sel_aligned:
                tmp[aligned_lang] = self._import_aligned_form_param_names(aligned_lang)
            self._session[sess_key] = tmp

    def _restore_aligned_forms(self):
        sess_key = 'aligned_forms:%s' % self.args.corpname
        if sess_key in self._session and not self.args.sel_aligned:
            self.get_args_mapping(ConcArgsMapping).sel_aligned = self._session[sess_key].keys()

    def _get_speech_segment(self):
        """
        Returns:
            tuple (structname, attr_name)
        """
        segment_str = plugins.get('corparch').get_corpus_info(self.args.corpname).get('speech_segment')
        if segment_str:
            return tuple(segment_str.split('.'))
        return None

    @exposed(vars=('orig_query', ), legacy=True)
    def view(self):
        """
        KWIC view
        """
        self.contains_within = butils.CQLDetectWithin().contains_within(' '.join(self.args.q))
        corpus_info = plugins.get('corparch').get_corpus_info(self.args.corpname)

        self.args.righttoleft = False
        if self._corp().get_conf('RIGHTTOLEFT'):
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

        # 'if GDEX disabled' in Bonito code; KonText has now GDEX functionality
        i = 0
        while i < len(self.args.q):
            if self.args.q[i].startswith('s*') or self.args.q[i][0] == 'e':
                del self.args.q[i]
            i += 1

        conc = self.call_function(conclib.get_conc, (self._corp(),), samplesize=corpus_info.sample_size)
        conc.switch_aligned(os.path.basename(self.args.corpname))
        kwic = Kwic(self._corp(), self.args.corpname, conc)
        labelmap = {}

        out = self.call_function(kwic.kwicpage, (self._get_speech_segment(), ),
                                 labelmap=labelmap,
                                 alignlist=[self.cm.get_Corpus(c)
                                            for c in self.args.align.split(',') if c],
                                 structs=self._get_struct_opts())

        out['Sort_idx'] = self.call_function(kwic.get_sort_idx, (),
                                             enc=self.self_encoding())
        out['result_shuffled'] = not conclib.conc_is_sorted(self.args.q)

        out.update(self.get_conc_sizes(conc))
        if self.args.viewmode == 'sen':
            conclib.PyConc.add_block_items(out['Lines'], block_size=1)
        if self._corp().get_conf('ALIGNED'):
            out['Aligned'] = [{'n': w,
                               'label': corplib.open_corpus(w).get_conf(
                                   'NAME') or w}
                              for w in self._corp().get_conf('ALIGNED').split(',')]
        if self.args.align and not self.args.maincorp:
            self.args.maincorp = os.path.basename(self.args.corpname)
        if len(out['Lines']) == 0:
            msg = _('No result. Please make sure the query and selected query type are correct.')
            self.add_system_message('info', msg)

        params = 'pagesize=%s&leftctx=%s&rightctx=%s&saveformat=%s&heading=%s' \
                 '&numbering=%s&align_kwic=%s&from_line=%s&to_line=%s' \
                 % (self.args.pagesize, self.args.leftctx, self.args.rightctx, '%s',
                    self.args.heading, self.args.numbering, self.args.align_kwic, 1, conc.size())
        self._add_save_menu_item('CSV', 'saveconc', params % 'csv')
        self._add_save_menu_item('XLSX', 'saveconc', params % 'xlsx')
        self._add_save_menu_item('XML', 'saveconc', params % 'xml')
        self._add_save_menu_item('TXT', 'saveconc', params % 'text')
        self._add_save_menu_item('%s...' % _('Custom'), 'saveconc_form',
                                 'leftctx=%s&rightctx=%s' % (self.args.leftctx, self.args.rightctx))
        # unlike 'globals' 'widectx_globals' stores full structs+structattrs information
        # to be able to display extended context with all set structural attributes
        out['widectx_globals'] = self._get_attrs(self.get_args_mapping_keys(WidectxArgsMapping),
                                                 dict(structs=self._get_struct_opts()))
        self._store_conc_results(out)
        return out

    @exposed(vars=('TextTypeSel',), argmappings=(ConcArgsMapping, QueryInputs))
    def first_form(self, request, conc_args, query_input_args):
        self.disabled_menu_items = (MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
        out = {}

        if self.get_http_method() == 'GET':
            self._store_checked_text_types(request.args, out)
        else:
            self._store_checked_text_types(request.form, out)
        self._reset_session_conc()
        self._restore_aligned_forms()

        if self._corp().get_conf('ALIGNED'):
            out['Aligned'] = []
            for al in self._corp().get_conf('ALIGNED').split(','):
                alcorp = corplib.open_corpus(al)
                out['Aligned'].append({'label': alcorp.get_conf('NAME') or al,
                                       'n': al})
                attrlist = alcorp.get_conf('ATTRLIST').split(',')
                poslist = self.cm.corpconf_pairs(alcorp, 'WPOSLIST')
                out['Wposlist_' + al] = [{'n': x[0], 'v': x[1]} for x in poslist]
                if 'lempos' in attrlist:
                    poslist = self.cm.corpconf_pairs(alcorp, 'LPOSLIST')
                out['Lposlist_' + al] = [{'n': x[0], 'v': x[1]} for x in poslist]
                out['has_lemmaattr_' + al] = 'lempos' in attrlist \
                    or 'lemma' in attrlist
        self._attach_tag_builder(out)
        out['user_menu'] = True
        out['aligned_corpora'] = conc_args.getlist('sel_aligned')
        self._export_subcorpora_list(out)
        self._attach_query_metadata(out)
        return out

    @exposed(return_type='json', legacy=True)
    def get_cached_conc_sizes(self):
        self._headers['Content-Type'] = 'text/plain'
        cs = self.call_function(conclib.get_cached_conc_sizes, (self._corp(),))
        return {
            'finished': cs["finished"],
            'concsize': cs["concsize"],
            'relconcsize': cs["relconcsize"],
            'fullsize': cs["fullsize"],
            'thousandsSeparator': u'%s' % l10n.number_formatting('thousandSeparator'),
            'decimalSeparator': u'%s' % l10n.number_formatting('decimalSeparator')
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
            orig_conc = self.call_function(conclib.get_conc, (self._corp(),),
                                           q=self.args.q[:i])
            concsize = orig_conc.size()
            fullsize = orig_conc.fullsize()
        return dict(sampled_size=sampled_size, concsize=concsize,
                    relconcsize=1000000.0 * fullsize / self._corp().search_size(),
                    fullsize=fullsize, finished=conc.finished())

    @exposed(return_type='json', legacy=True)
    def concdesc_json(self, query_id=''):
        self.disabled_menu_items = (MainMenu.SAVE,)
        out = {'Desc': []}

        query_desc = ''
        query_desc_raw = ''
        is_public = True
        if query_id and plugins.has_plugin('query_storage'):
            query_storage = plugins.get('query_storage')
            ans = query_storage.get_user_query(self._session_get('user', 'id'), query_id)
            if ans:
                query_desc_raw = ans['description']
                query_desc = query_storage.decode_description(query_desc_raw)
                is_public = ans['public']
            else:
                self.add_system_message('error', _('Cannot access recorded query.'))
                query_id = None  # we have to invalidate the query_id (to render HTML properly)

        conc_desc = conclib.get_conc_desc(corpus=self._corp(), q=self.args.q,
                                          subchash=getattr(self._corp(), "subchash", None))

        for o, a, u1, u2, s in conc_desc:
            u2.append(('corpname', self.args.corpname))
            if self.args.usesubcorp:
                u2.append(('usesubcorp', self.args.usesubcorp))
            out['Desc'].append({
                'op': o,
                'arg': a,
                'churl': self.urlencode(u1),
                'tourl': self.urlencode(u2),
                'size': s})

        out.update({
            'supports_query_save': plugins.has_plugin('query_storage'),
            'query_desc': query_desc,
            'query_desc_raw': query_desc_raw,
            'query_id': query_id,
            'export_url': '%sto?q=%s' % (self.get_root_url(), query_id),
            'is_public': is_public
        })
        return out

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

        crit = Kontext.onelevelcrit('s', ml1attr, ml1ctx, ml1pos, ml1fcode,
                                    ml1icase, ml1bward)
        if sortlevel > 1:
            crit += Kontext.onelevelcrit(' ', ml2attr, ml2ctx, ml2pos, ml2fcode,
                                         ml2icase, ml2bward)
            if sortlevel > 2:
                crit += Kontext.onelevelcrit(' ', ml3attr, ml3ctx, ml3pos, ml3fcode,
                                             ml3icase, ml3bward)
        self.args.q.append(crit)
        return self.view()

    def _is_err_corpus(self):
        availstruct = self._corp().get_conf('STRUCTLIST').split(',')
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
        thecorp = cname and self.cm.get_Corpus(cname) or self._corp()
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

    def _fetch_pcq_args(self):
        """
        Loads form values of "contain"/"does not contain" select elements located in
        aligned languages' fieldsets.
        """
        ans = {}
        for k, v in self._request.args.items():
            if k.startswith('pcq_pos_neg_'):
                ans[k] = v
        return ans

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

        if 'lemma' in self._corp().get_conf('ATTRLIST').split(','):
            lemmaattr = 'lemma'
        else:
            lemmaattr = 'word'
        wposlist = dict(self.cm.corpconf_pairs(self._corp(), 'WPOSLIST'))
        if self.args.queryselector == 'phraserow':
            self.args.default_attr = 'word'  # XXX to be removed with new first form
        if self.args.default_attr:
            qbase = 'a%s,' % self.args.default_attr
        else:
            qbase = 'q'
        texttypes = self._texttype_query_OLD()
        if texttypes:
            ttquery = import_string(' '.join(['within <%s %s />' % nq for nq in texttypes]),
                                    from_encoding=self._corp().get_conf('ENCODING'))
        else:
            ttquery = u''
        par_query = ''
        nopq = []
        pcq_args = self._fetch_pcq_args()
        for al_corpname in self.args.sel_aligned:
            if pcq_args.get('pcq_pos_neg_' + al_corpname) == 'pos':
                wnot = ''
            else:
                wnot = '!'
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
        for al_corpname in self.args.sel_aligned:
            if al_corpname in nopq and not getattr(self.args,
                                                   'include_empty_' + al_corpname, ''):
                self.args.q.append('x-%s' % al_corpname)
                self.args.q.append('p0 0 1 []')
                self.args.q.append('x-%s' % self.args.corpname)

    @exposed(template='view.tmpl', vars=('TextTypeSel', 'LastSubcorp'), page_model='view',
             legacy=True)
    def first(self):

        ans = {}
        self._store_semi_persistent_attrs(('queryselector', 'sel_aligned'))
        try:
            self._set_first_query(self.args.fc_lemword_window_type,
                                  self.args.fc_lemword_wsize,
                                  self.args.fc_lemword_type,
                                  self.args.fc_lemword,
                                  self.args.fc_pos_window_type,
                                  self.args.fc_pos_wsize,
                                  self.args.fc_pos_type,
                                  self.args.fc_pos)
            if self.args.sel_aligned:
                self.args.align = ','.join(self.args.sel_aligned)
            if self.args.shuffle == 1 and 'f' not in self.args.q:
                self.args.q.append('f')
            ans['replicable_query'] = False if self.get_http_method() == 'POST' else True
            ans.update(self.view())
        except ConcError as e:
            raise UserActionException(e.message)
        return ans

    @exposed(access_level=1, vars=('TextTypeSel', 'LastSubcorp', 'concsize'), legacy=True)
    def filter_form(self, within=0):
        self.disabled_menu_items = (MainMenu.SAVE,)

        self.args.lemma = ''
        self.args.lpos = ''
        out = {'within': within}
        if within and not self.contains_errors():
            self.add_system_message('warning', _('Please specify positive filter to switch'))
        self._attach_tag_builder(out)
        self._attach_query_metadata(out)
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
        texttypes = self._texttype_query_OLD()
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
        if within:
            wquery = ' within %s:(%s)' % (self.args.maincorp or self.args.corpname, query)
            self.args.q[0] += wquery
            self.args.q.append('x-' + (self.args.maincorp or self.args.corpname))
        else:
            self.args.q.append('%s%s %s %i %s' % (pnfilter, filfpos, filtpos,
                                             rank, query))
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
            attr_list = set(self._corp().get_conf('ATTRLIST').split(','))
            return crit_attrs <= attr_list

        fcrit_is_all_nonstruct = True
        for fcrit_item in fcrit:
            fcrit_is_all_nonstruct = (fcrit_is_all_nonstruct and is_non_structural_attr(fcrit_item))

        if fcrit_is_all_nonstruct:
            rel_mode = 1
        else:
            rel_mode = 0
        corp_info = plugins.get('corparch').get_corpus_info(self.args.corpname)

        conc = self.call_function(conclib.get_conc, (self._corp(),))
        result = {
            'fcrit': [('fcrit', cr) for cr in fcrit],
            'FCrit': [{'fcrit': cr} for cr in fcrit],
            'Blocks': [conc.xfreq_dist(cr, flimit, freq_sort, ml,
                                       self.args.ftt_include_empty, rel_mode,
                                       collator_locale=corp_info.collator_locale) for cr in fcrit],
            'paging': 0,
            'concsize': conc.size(),
            'fmaxitems': self.args.fmaxitems,
            'quick_from_line': 1,
            'quick_to_line': None
        }

        if not result['Blocks'][0]:
            logging.getLogger(__name__).warn('freqs - empty list: %s' % (result,))
            return {'message': ('error', _('Empty list')), 'Blocks': [], 'paging': 0,
                    'quick_from_line': None, 'quick_to_line': None, 'FCrit': [], 'fcrit': []}

        if len(result['Blocks']) == 1:  # paging
            items_per_page = self.args.fmaxitems
            fstart = (self.args.fpage - 1) * self.args.fmaxitems + line_offset
            self.args.fmaxitems = self.args.fmaxitems * self.args.fpage + 1 + line_offset
            result['paging'] = 1
            if len(result['Blocks'][0]['Items']) < self.args.fmaxitems:
                result['lastpage'] = 1
            else:
                result['lastpage'] = 0
            result['Blocks'][0]['Total'] = len(result['Blocks'][0]['Items'])
            result['Blocks'][0]['TotalPages'] = int(math.ceil(result['Blocks'][0]['Total'] /
                                                              float(items_per_page)))
            result['Blocks'][0]['Items'] = result['Blocks'][0]['Items'][fstart:self.args.fmaxitems - 1]

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
                        if attr in self._corp().get_conf('ATTRLIST').split(','):
                            wwords = item['Word'][level]['n'].split('  ')  # two spaces
                            fquery = '%s %s 0 ' % (begin, end)
                            fquery += ''.join(['[%s="%s%s"]'
                                               % (attr, icase, l10n.escape(w)) for w in wwords])
                        else:  # structure number
                            fquery = '0 0 1 [] within <%s #%s/>' % \
                                     (attr, item['Word'][0]['n'].split('#')[1])
                    else:  # text types
                        structname, attrname = attr.split('.')
                        if self._corp().get_conf(structname + '.NESTED'):
                            block['unprecise'] = True
                        fquery = '0 0 1 [] within <%s %s="%s" />' \
                                 % (structname, attrname,
                                    l10n.escape(item['Word'][0]['n']))
                    if not item['freq']:
                        continue
                    item['pfilter'].append(('q', 'p%s' % fquery))
                    if len(attrs) == 1 and item['freq'] <= conc.size():
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
        freq = conc.size() - errs - corrs
        if freq > 0 and err_block > -1 and corr_block > -1:
            pfilter = [('q',  'p0 0 1 ([] within ! <err/>) within ! <corr/>')]
            cc = self.call_function(conclib.get_conc, (self._corp(),),
                                    q=self.args.q + [pfilter[0][1]])
            freq = cc.size()
            err_nfilter, corr_nfilter = '', ''
            if freq != conc.size():
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

        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-frequencies.txt"' % \
                                                   saved_filename
            output = result
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-freq-distrib.%s' % (
                self._canonical_corpname(self.args.corpname), suffix)
            writer = plugins.get('export').load_plugin(saveformat, subtype='freq')
            writer.set_col_types(int, unicode, int)

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
                    writer.writeheading([''] + [item['n'] for item in block['Head'][:-2]]
                                        + ['freq', 'freq [%]'])
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
        fcrit = ' '.join([Kontext.onelevelcrit('',
                                               kwargs.get('ml%dattr' % i, 'word'),
                                               kwargs.get('ml%dctx' % i, 0),
                                               kwargs.get('ml%dpos' % i, 1),
                                               kwargs.get('ml%dfcode' % i, 'rc'),
                                               kwargs.get('ml%dicase' % i, ''), 'e')
                          for i in range(1, freqlevel + 1)])
        result = self.freqs([fcrit], flimit, '', 1)
        result['ml'] = 1
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
            corp = self._corp()
        colllist = corp.get_conf('ATTRLIST').split(',')
        out = {'Coll_attrlist': [{'n': n,
                                  'label': corp.get_conf(n + '.LABEL') or n}
                                 for n in colllist],
               'Pos_ctxs': conclib.pos_ctxs(1, 1)}
        return out

    @exposed(access_level=1, vars=('concsize',), legacy=True)
    def collx(self, csortfn='d', cbgrfns=('t', 'm', 'd'), line_offset=0, num_lines=None):
        """
        list collocations
        """
        self.args.cbgrfns = ''.join(cbgrfns)
        self._save_options(self.LOCAL_COLL_OPTIONS, self.args.corpname)

        collstart = (self.args.collpage - 1) * self.args.citemsperpage + line_offset

        if csortfn is '' and cbgrfns:
            self.args.csortfn = cbgrfns[0]
        conc = self.call_function(conclib.get_conc, (self._corp(),))

        num_fetch_lines = num_lines if num_lines is not None else self.args.citemsperpage
        result = conc.collocs(cattr=self.args.cattr, csortfn=self.args.csortfn,
                              cbgrfns=self.args.cbgrfns, cfromw=self.args.cfromw,
                              ctow=self.args.ctow, cminfreq=self.args.cminfreq,
                              cminbgr=self.args.cminbgr, from_idx=collstart,
                              max_lines=num_fetch_lines)
        if collstart + self.args.citemsperpage < result['Total']:
            result['lastpage'] = 0
        else:
            result['lastpage'] = 1

        for item in result['Items']:
            item['pfilter'] = [('q', item['pfilter'])]
            item['nfilter'] = [('q', item['nfilter'])]
            item['str'] = import_string(item['str'],
                                        from_encoding=self._corp().get_conf('ENCODING'))

        result['cmaxitems'] = 10000
        result['to_line'] = 10000  # TODO
        return result

    @exposed(access_level=1, legacy=True)
    def savecoll_form(self, from_line=1, to_line='', csortfn='', cbgrfns=('t', 'm'),
                      saveformat='text', heading=0):
        """
        """
        self.disabled_menu_items = (MainMenu.SAVE, )

        self.args.citemsperpage = sys.maxint
        result = self.collx(csortfn, cbgrfns)
        if to_line == '':
            to_line = len(result['Items'])
        return {
            'from_line': from_line,
            'to_line': to_line,
            'saveformat': saveformat
        }

    @exposed(access_level=1, vars=('concsize',), legacy=True)
    def savecoll(self, from_line=1, to_line='', csortfn='', cbgrfns=('t', 'm'), saveformat='text',
                 heading=0, colheaders=0):
        """
        save collocations
        """
        from_line = int(from_line)
        if to_line == '':
            to_line = len(self.collx(csortfn, cbgrfns)['Items'])
        else:
            to_line = int(to_line)
        num_lines = to_line - from_line + 1
        err = self._validate_range((from_line, to_line), (1, None))
        if err is not None:
            raise err

        self.args.collpage = 1
        self.args.citemsperpage = sys.maxint
        result = self.collx(csortfn, cbgrfns, line_offset=(from_line - 1), num_lines=num_lines)
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
                writer.writerow(i, (item['str'], str(item['freq']))
                                + tuple([str(stat['s']) for stat in item['Stats']]))
                i += 1
            out_data = writer.raw_content()
        return out_data

    @exposed(access_level=1, template='widectx.tmpl', legacy=True)
    def structctx(self, pos=0, struct='doc'):
        """
        display a hit in a context of a structure"
        """
        s = self._corp().get_struct(struct)
        struct_id = s.num_at_pos(pos)
        beg, end = s.beg(struct_id), s.end(struct_id)
        self.detail_left_ctx = pos - beg
        self.detail_right_ctx = end - pos - 1
        result = self.widectx(pos)
        result['no_display_links'] = True
        return result

    @exposed(access_level=0, legacy=True)
    def widectx(self, pos=0):
        """
        display a hit in a wider context
        """
        data = self.call_function(conclib.get_detail_context, (self._corp(), pos))
        data['allow_left_expand'] = int(getattr(self.args, 'detail_left_ctx', 0)) < \
                int(data['maxdetail'])
        data['allow_right_expand'] = int(getattr(self.args, 'detail_right_ctx', 0)) < \
                int(data['maxdetail'])
        data['widectx_globals'] = self._get_attrs(self.get_args_mapping_keys(WidectxArgsMapping),
                                                  dict(structs=self._get_struct_opts()))
        return data

    @exposed(access_level=0, return_type='json', legacy=True)
    def fullref(self, pos=0):
        """
        display a full reference
        """
        return self.call_function(conclib.get_full_ref, (self._corp(), pos))

    @exposed(template='wordlist.tmpl', legacy=True)
    def build_arf_db(self, corpname='', attrname=''):
        if not corpname:
            corpname = self.args.corpname
        if os.path.isfile(corplib.corp_freqs_cache_path(self._corp(), attrname) + '.arf'):
            return 'Finished'
        out = corplib.build_arf_db(self._corp(), attrname)
        if out:
            return {'processing': out[1].strip('%')}
        else:
            return {'processing': 0}

    @exposed(access_level=1, vars=('LastSubcorp',), legacy=True)
    def wordlist_form(self, ref_corpname=''):
        """
        Word List Form
        """
        self.disabled_menu_items = (MainMenu.VIEW, MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE)
        self._reset_session_conc()
        out = {}
        if not ref_corpname:
            ref_corpname = self.args.corpname
        if hasattr(self, 'compatible_corpora'):
            out['CompatibleCorpora'] = plugins.get('corparch').get_list(self.permitted_corpora())
        refcm = corplib.CorpusManager(self.subcpath)
        out['RefSubcorp'] = refcm.subcorp_names(ref_corpname)
        out['ref_corpname'] = ref_corpname
        out['freq_figures'] = self.FREQ_FIGURES
        self._export_subcorpora_list(out)
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
            wlwords = [w.strip() for w in wlfile.split('\n')]
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
        self.disabled_menu_items = (MainMenu.VIEW('kwic-sentence', 'viewattrs'),
                                    MainMenu.FILTER, MainMenu.FREQUENCY,
                                    MainMenu.COLLOCATIONS, MainMenu.CONCORDANCE)

        if not wlpat:
            self.args.wlpat = '.*'
        if '.' in self.args.wlattr:
            orig_wlnums = self.args.wlnums
            if wltype != 'simple':
                raise ConcError(_('Text types are limited to Simple output'))
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
                                                 (self._corp(), self.args.wlwords),
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
                result['wlattr_label'] = (self._corp().get_conf(self.args.wlattr + '.LABEL') or
                                          self.args.wlattr)
            except Exception as e:
                result['wlattr_label'] = self.args.wlattr
                logging.getLogger(__name__).warning('wlattr_label set failed: %s' % e)

            result['freq_figure'] = _(self.FREQ_FIGURES.get(self.args.wlnums, '?'))

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
            return result

        except corplib.MissingSubCorpFreqFile as e:
            out = corplib.build_arf_db(e.args[0], self.args.wlattr)
            if out:
                processing = out[1].strip('%')
            else:
                processing = '0'
            result.update({'processing': processing == '100' and '99' or processing})
            return result

    def _make_wl_query(self):
        qparts = []
        if self.args.wlpat:
            qparts.append('%s="%s"' % (self.args.wlattr, self.args.wlpat))
        if not self.args.include_nonwords:
            qparts.append('%s!="%s"' % (self.args.wlattr,
                                        self._corp().get_conf('NONWORDRE')))
        if self.args.wlwords:
            qq = ['%s=="%s"' % (self.args.wlattr, w.strip()) for w in self.args.wlwords]
            qparts.append('(' + '|'.join(qq) + ')')
        for w in self.args.blacklist:
            qparts.append('%s!=="%s"' % (self.args.wlattr, w.strip()))
        self.args.q = ['q[' + '&'.join(qparts) + ']']

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
        if not self.args.wlstruct_attr1:
            raise ConcError(_('No output attribute specified'))
        if not self.args.wlstruct_attr3:
            level = 2
        if not self.args.wlstruct_attr2:
            level = 1
        if not self.args.wlpat and not self.args.wlwords:
            raise ConcError(
                _('You must specify either a pattern or a file to get the multilevel wordlist'))
        self._make_wl_query()
        self.args.flimit = self.args.wlminfreq
        return self.freqml(flimit=self.args.wlminfreq, freqlevel=level,
                           ml1attr=self.args.wlstruct_attr1, ml2attr=self.args.wlstruct_attr2,
                           ml3attr=self.args.wlstruct_attr3)

    @exposed(access_level=1, legacy=True)
    def savewl_form(self, from_line=1, to_line=''):
        self.disabled_menu_items = (MainMenu.SAVE, )
        if to_line == '':
            to_line = 1000

        ans = {
            'from_line': from_line,
            'to_line': to_line,
        }
        if to_line == 0:
            self.add_system_message('error', _('Empty result cannot be saved.'))
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
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-word-list.%s' % (
                self._canonical_corpname(self.args.corpname), suffix)
            writer = plugins.get('export').load_plugin(saveformat, subtype='wordlist')
            writer.set_col_types(int, unicode, float)

            self._headers['Content-Type'] = writer.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                mkfilename(saveformat),)

            # write the header first, if required
            if colheaders or heading:
                writer.writeheading(('', self.args.wlattr, 'freq'))
            i = 1
            for item in ans['Items']:
                writer.writerow(i, (item['str'], str(item['freq'])))
                i += 1
            out_data = writer.raw_content()
        return out_data

    @exposed(legacy=True)
    def wordlist_process(self, attrname=''):
        self._headers['Content-Type'] = 'text/plain'
        return corplib.build_arf_db_status(self._corp(), attrname)[1]

    @exposed(legacy=True)
    def attr_vals(self, avattr='', avpat=''):
        self._headers['Content-Type'] = 'application/json'
        return corplib.attr_vals(self.args.corpname, avattr, avpat)

    @exposed(access_level=1, legacy=True)
    def saveconc_form(self, from_line=1, to_line=''):
        self.disabled_menu_items = (MainMenu.SAVE, )
        corpus_info = plugins.get('corparch').get_corpus_info(self.args.corpname)
        conc = self.call_function(conclib.get_conc, (self._corp(), corpus_info.sample_size))
        if not to_line:
            to_line = conc.size()
            # TODO Save menu should be active here
        return {'from_line': from_line, 'to_line': to_line}

    @exposed(access_level=1, vars=('concsize',), legacy=True)
    def saveconc(self, saveformat='text', from_line=0, to_line='', align_kwic=0, numbering=0,
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

        def process_lang(root, left_key, kwic_key, right_key):
            if type(root) is dict:
                root = (root,)

            ans = []
            for item in root:
                ans_item = {}
                if 'ref' in item:
                    ans_item['ref'] = item['ref']
                ans_item['left_context'] = merge_conc_line_parts(item[left_key])
                ans_item['kwic'] = merge_conc_line_parts(item[kwic_key])
                ans_item['right_context'] = merge_conc_line_parts(item[right_key])
                ans.append(ans_item)
            return ans

        try:
            corpus_info = plugins.get('corparch').get_corpus_info(self.args.corpname)
            conc = self.call_function(conclib.get_conc, (self._corp(), corpus_info.sample_size))
            kwic = Kwic(self._corp(), self.args.corpname, conc)
            conc.switch_aligned(os.path.basename(self.args.corpname))
            from_line = int(from_line)
            to_line = int(to_line)

            output = {'from_line': from_line, 'to_line': to_line}

            err = self._validate_range((from_line, to_line), (1, conc.size()))
            if err is not None:
                raise err
            page_size = to_line - (from_line - 1)
            fromp = 1
            line_offset = (from_line - 1)
            labelmap = {}

            data = self.call_function(kwic.kwicpage, (self._get_speech_segment(),),
                                      fromp=fromp, pagesize=page_size, line_offset=line_offset,
                                      labelmap=labelmap, align=(),
                                      alignlist=[self.cm.get_Corpus(c)
                                                 for c in self.args.align.split(',') if c],
                                      leftctx=leftctx, rightctx=rightctx,
                                      structs=self._get_struct_opts())

            mkfilename = lambda suffix: '%s-concordance.%s' % (
                self._canonical_corpname(self.args.corpname), suffix)
            if saveformat == 'text':
                self._headers['Content-Type'] = 'text/plain'
                self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                    mkfilename('txt'),)
                output.update(data)
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

                    aligned_corpora = [self._corp()] + \
                                      [self.cm.get_Corpus(c)
                                       for c in self.args.align.split(',') if c]
                    writer.set_corpnames([c.get_conf('NAME') or c.get_conffile()
                                          for c in aligned_corpora])

                    for i in range(len(data['Lines'])):
                        line = data['Lines'][i]
                        if numbering:
                            row_num = str(i + from_line)
                        else:
                            row_num = None
                        lang_rows = process_lang(line, left_key, kwic_key, right_key)
                        if 'Align' in line:
                            lang_rows += process_lang(line['Align'], left_key, kwic_key, right_key)
                        writer.writerow(row_num, *lang_rows)
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
        path = '%s/%s/%s' % (settings.get('corpora', 'speech_files_path'), self.args.corpname, chunk)

        if os.path.exists(path) and not os.path.isdir(path):
            with open(path, 'r') as f:
                file_size = os.path.getsize(path)
                self._headers['Content-Type'] = 'audio/mpeg'
                self._headers['Content-Length'] = '%s' % file_size
                self._headers['Accept-Ranges'] = 'none'
                if self.environ.get('HTTP_RANGE', None):
                    self._headers['Content-Range'] = 'bytes 0-%s/%s' % (
                        os.path.getsize(path) - 1, os.path.getsize(path))
                return f.read()
        else:
            self._set_not_found()
            return None

    @exposed(return_type='json', legacy=True)
    def filter_attributes(self, attrs=None, aligned=None):
        import json

        if plugins.has_plugin('live_attributes'):
            if attrs is None:
                attrs = {}
            else:
                attrs = json.loads(attrs)

            if aligned is None:
                aligned = []
            else:
                aligned = json.loads(aligned)

            ans = plugins.get('live_attributes').get_attr_values(self._corp(), attrs, aligned)
            return ans
        else:
            return {}

    @exposed(return_type='json', legacy=True)
    def bibliography(self, id=''):
        bib_data = plugins.get('live_attributes').get_bibliography(self._corp(), item_id=id)
        return {'bib_data': bib_data}

    @exposed(return_type='json', legacy=True)
    def ajax_remove_selected_lines(self, pnfilter='p', rows=''):
        import json

        data = json.loads(rows)
        expand = lambda x, n: range(x, x + n)
        sel_lines = []
        for item in data:
            sel_lines.append(''.join(['[#%d]' % x2 for x2 in expand(item[0], item[1])]))
        self.args.q.append('%s%s %s %i %s' % (pnfilter, 0, 0, 0, '|'.join(sel_lines)))
        q_id = self._store_conc_params()
        params = {
            'corpname': self.args.corpname,
            'q': '~%s' % q_id,
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
        return {
            'id': q_id,
            'next_url': self.create_url('view', params)
        }
