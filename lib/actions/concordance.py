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

    cattr = Parameter('word')
    csortfn = Parameter('d')
    cbgrfns = Parameter(['m', 't', 'td'])
    cfromw = Parameter(-5)
    ctow = Parameter(5)
    cminfreq = Parameter(5)
    cminbgr = Parameter(3)

    wlminfreq = Parameter(5)
    wlicase = Parameter(0)
    wlwords = Parameter([])
    blacklist = Parameter([])

    include_nonwords = Parameter(0)
    wltype = Parameter('simple')
    wlnums = Parameter('frq')

    wlstruct_attr1 = Parameter('')
    wlstruct_attr2 = Parameter('')
    wlstruct_attr3 = Parameter('')

    maxsavelines = Parameter(1000)
    fcrit = Parameter([])

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
        self.contains_within = False
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
                v = getattr(self, attr_name)
                if type(v) in (list, tuple):
                    tmp.setlist(attr_name, v)
                else:
                    tmp[attr_name] = v
        # we have to ensure Werkzeug sets 'should_save' attribute
        self._session['semi_persistent_attrs'] = tmp.items(multi=True)

        # aligned corpora forms inputs require different approach due to their dynamic nature
        tmp = self._session.get('aligned_forms', {})
        for aligned_lang in self.sel_aligned:
            tmp[aligned_lang] = self._import_aligned_form_param_names(aligned_lang)
        self._session['aligned_forms'] = tmp  # this ensures Werkzeug sets 'should_save' attribute

    def _get_speech_segment(self):
        """
        Returns:
            tuple (structname, attr_name)
        """
        segment_str = plugins.get('corptree').get_corpus_info(self.corpname).get('speech_segment')
        if segment_str:
            return tuple(segment_str.split('.'))
        return None

    @exposed(vars=('orig_query', ), legacy=True)
    def view(self):
        """
        KWIC view
        """
        self.contains_within = butils.CQLDetectWithin().contains_within(' '.join(self.q))

        self.righttoleft = False
        if self._corp().get_conf('RIGHTTOLEFT'):
            self.righttoleft = True
        if self.viewmode == 'kwic':
            self.leftctx = self.kwicleftctx
            self.rightctx = self.kwicrightctx
        elif self.viewmode == 'align' and self.align:
            self.leftctx = 'a,%s' % os.path.basename(self.corpname)
            self.rightctx = 'a,%s' % os.path.basename(self.corpname)
        else:
            sentence_struct = plugins.get('corptree').get_corpus_info(
                self.corpname)['sentence_struct']
            self.leftctx = self.senleftctx_tpl % sentence_struct
            self.rightctx = self.senrightctx_tpl % sentence_struct

        # 'if GDEX disabled' in Bonito code; KonText has now GDEX functionality
        i = 0
        while i < len(self.q):
            if self.q[i].startswith('s*') or self.q[i][0] == 'e':
                del self.q[i]
            i += 1

        conc = self.call_function(conclib.get_conc, (self._corp(),))
        conc.switch_aligned(os.path.basename(self.corpname))
        kwic = Kwic(self._corp(), self.corpname, conc)
        labelmap = {}

        out = self.call_function(kwic.kwicpage, (self._get_speech_segment(), ),
                                 labelmap=labelmap,
                                 alignlist=[self.cm.get_Corpus(c) for c in self.align.split(',')
                                            if c],
                                 tbl_template=self.tbl_template,
                                 structs=self._get_struct_opts())

        out['Sort_idx'] = self.call_function(kwic.get_sort_idx, (),
                                             enc=self.self_encoding())
        out['result_shuffled'] = not conclib.conc_is_sorted(self.q)

        out.update(self.get_conc_sizes(conc))
        if self.viewmode == 'sen':
            conclib.PyConc.add_block_items(out['Lines'], block_size=1)
        if self._corp().get_conf('ALIGNED'):
            out['Aligned'] = [{'n': w,
                               'label': corplib.open_corpus(w).get_conf(
                                   'NAME') or w}
                              for w in self._corp().get_conf('ALIGNED').split(',')]
        if self.align and not self.maincorp:
            self.maincorp = os.path.basename(self.corpname)
        if len(out['Lines']) == 0:
            msg = _('No result. Please make sure the query and selected query type are correct.')
            self.add_system_message('info', msg)

        params = 'pagesize=%s&leftctx=%s&rightctx=%s&saveformat=%s&heading=%s' \
                 '&numbering=%s&align_kwic=%s&from_line=%s&to_line=%s' \
                 % (self.pagesize, self.leftctx, self.rightctx, '%s', self.heading, self.numbering,
                    self.align_kwic, 1, conc.size())
        self._add_save_menu_item('CSV', 'saveconc', params % 'csv')
        self._add_save_menu_item('XLSX', 'saveconc', params % 'xlsx')
        self._add_save_menu_item('XML', 'saveconc', params % 'xml')
        self._add_save_menu_item('TXT', 'saveconc', params % 'text')
        self._add_save_menu_item('%s...' % _('Custom'), 'saveconc_form',
                                 'leftctx=%s&rightctx=%s' % (self.leftctx, self.rightctx))
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
        self.last_corpname = self.corpname
        self._save_options(['last_corpname'])
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
        while i < len(self.q) and not self.q[i].startswith('r'):
            i += 1
        if i < len(self.q):
            sampled_size = concsize

        for j in range(i + 1, len(self.q)):
            if self.q[j][0] in ('p', 'n'):
                return {'concsize': concsize, 'sampled_size': 0,
                        'relconcsize': 0, 'fullsize': fullsize,
                        'finished': conc.finished()}
        if sampled_size:
            orig_conc = self.call_function(conclib.get_conc, (self._corp(),),
                                           q=self.q[:i])
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

        conc_desc = conclib.get_conc_desc(corpus=self._corp(), q=self.q,
                                          subchash=getattr(self._corp(), "subchash", None))

        for o, a, u1, u2, s in conc_desc:
            u2.append(('corpname', self.corpname))
            if self.usesubcorp:
                u2.append(('usesubcorp', self.usesubcorp))
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

        self.q.append('s%s/%s%s %s' % (sattr, sicase, sbward, ctx))
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
        self.q.append(crit)
        return self.view()

    def _is_err_corpus(self):
        availstruct = self._corp().get_conf('STRUCTLIST').split(',')
        if not ('err' in availstruct and 'corr' in availstruct):
            return False
        return True

    def _compile_basic_query(self, qtype=None, suff='', cname=''):
        queryselector = getattr(self, 'queryselector' + suff)
        iquery = getattr(self, 'iquery' + suff, '')
        lemma = getattr(self, 'lemma' + suff, '')
        lpos = getattr(self, 'lpos' + suff, '')
        phrase = getattr(self, 'phrase' + suff, '')
        qmcase = getattr(self, 'qmcase' + suff, '')
        word = getattr(self, 'word' + suff, '')
        wpos = getattr(self, 'wpos' + suff, '')
        char = getattr(self, 'char' + suff, '')
        cql = getattr(self, 'cql' + suff, '')

        queries = {
            'cql': '%(cql)s',
            'lemma': '[lempos="%(lemma)s%(lpos)s"]',
            'wordform': '[%(wordattr)s="%(word)s" & tag="%(wpos)s.*"]',
            'wordformonly': '[%(wordattr)s="%(word)s"]',
        }
        for a in ('iquery', 'word', 'lemma', 'phrase', 'cql'):
            if queryselector == a + 'row':
                if getattr(self, a + suff, ''):
                    setattr(self, a + suff, getattr(self, a + suff).strip())
                elif suff:
                    return ''
                else:
                    raise ConcError(_('No query entered.'))
        if qtype:
            return queries[qtype] % self.clone_self()
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
            if self.qmcase:
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
            self._save_query(self.tag, queryselector)
            return '[tag="%s"]' % self.tag
        else:
            self._save_query(cql, 'cql')
            return cql

    def _compile_query(self, qtype=None, cname=''):
        if not self._is_err_corpus():
            return self._compile_basic_query(qtype, cname=cname)
        err_code = getattr(self, 'cup_err_code', '')
        err = getattr(self, 'cup_err', '')
        corr = getattr(self, 'cup_corr', '')
        switch = getattr(self, 'errcorr_switch', '')
        if not err_code and not err and not corr:
            cql = self._compile_basic_query(qtype)
            if self.queryselector != 'cqlrow':
                cql = cql.replace('][', '] (<corr/>)? [')
                cql = cql.replace('](', '] (<corr/>)? (')
                cql = cql.replace('] [', '] (<corr/>)? [')
            return cql
            # compute error query
        corr_restr = corr or (err_code and switch == 'c')
        err_restr = err or (err_code and switch == 'e')
        if err_code:
            corr_within = '<corr type="%s"/>' % err_code
        else:
            corr_within = '<corr/>'
        if err_code:
            err_within = '<err type="%s"/>' % err_code
        else:
            err_within = '<err/>'
        err_containing = ''
        corr_containing = ''
        if err:
            self.iquery = err
            self.queryselector = 'iqueryrow'
            err_containing = ' containing ' + self._compile_basic_query(qtype)
        if corr:
            self.iquery = corr
            self.queryselector = 'iqueryrow'
            corr_containing = ' containing ' + self._compile_basic_query(qtype)
        err_query = '(%s%s)' % (err_within, err_containing)
        corr_query = '(%s%s)' % (corr_within, corr_containing)
        fullstruct = '(%s%s)' % (err_query, corr_query)
        if self.cup_hl == 'e' or (self.cup_hl == 'q' and err_restr
                                  and not corr_restr):
            return '%s within %s' % (err_query, fullstruct)
        elif self.cup_hl == 'c' or (self.cup_hl == 'q' and corr_restr
                                    and not err_restr):
            return '%s within %s' % (corr_query, fullstruct)
        else:  # highlight both
            return fullstruct

    @exposed(template='view.tmpl', page_model='view', legacy=True)
    def query(self, qtype='cql'):
        """
        perform query
        """
        if self.default_attr:
            qbase = 'a%s,' % self.default_attr
        else:
            qbase = 'q'
        self.q = [qbase + self._compile_query()]
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
                self.q.append('P%s [%s]' %
                              (ctx, '|'.join(['%s="%s"' % (attrname, i)
                                              for i in items])))
            elif fctxtype == 'none':
                self.q.append('N%s [%s]' %
                              (ctx, '|'.join(['%s="%s"' % (attrname, i)
                                              for i in items])))
            elif fctxtype == 'all':
                for i in items:
                    self.q.append('P%s [%s="%s"]' % (ctx, attrname, i))

        if 'lemma' in self._corp().get_conf('ATTRLIST').split(','):
            lemmaattr = 'lemma'
        else:
            lemmaattr = 'word'
        wposlist = dict(self.cm.corpconf_pairs(self._corp(), 'WPOSLIST'))
        if self.queryselector == 'phraserow':
            self.default_attr = 'word'  # XXX to be removed with new first form
        if self.default_attr:
            qbase = 'a%s,' % self.default_attr
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
        for al_corpname in self.sel_aligned:
            if getattr(self, 'pcq_pos_neg_' + al_corpname) == 'pos':
                wnot = ''
            else:
                wnot = '!'
            pq = self._compile_basic_query(suff='_' + al_corpname,
                                           cname=al_corpname)
            if pq:
                par_query += ' within%s %s:%s' % (wnot, al_corpname, pq)
            if not pq or wnot:
                nopq.append(al_corpname)
        self.q = [qbase + self._compile_query() + ttquery + par_query]
        #if self.shuffle:
        #    self.q.append('f')

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
        for al_corpname in self.sel_aligned:
            if al_corpname in nopq and not getattr(self,
                                                   'include_empty_' + al_corpname, ''):
                self.q.append('x-%s' % al_corpname)
                self.q.append('p0 0 1 []')
                self.q.append('x-%s' % self.corpname)

    @exposed(template='view.tmpl', vars=('TextTypeSel', 'LastSubcorp'), page_model='view',
             legacy=True)
    def first(self, fc_lemword_window_type='',
              fc_lemword_wsize=0,
              fc_lemword_type='',
              fc_lemword='',
              fc_pos_window_type='',
              fc_pos_wsize=0,
              fc_pos_type='',
              fc_pos=()):

        ans = {}
        self._store_semi_persistent_attrs(('queryselector', 'sel_aligned'))
        try:
            self._set_first_query(fc_lemword_window_type,
                                  fc_lemword_wsize,
                                  fc_lemword_type,
                                  fc_lemword,
                                  fc_pos_window_type,
                                  fc_pos_wsize,
                                  fc_pos_type,
                                  fc_pos)
            if self.sel_aligned:
                self.align = ','.join(self.sel_aligned)
            if self.shuffle == 1 and 'f' not in self.q:
                self.q.append('f')
            ans['replicable_query'] = False if self.get_http_method() == 'POST' else True
            ans.update(self.view())
        except ConcError as e:
            raise UserActionException(e.message)
        return ans

    @exposed(access_level=1, vars=('TextTypeSel', 'LastSubcorp', 'concsize'), legacy=True)
    def filter_form(self, within=0):
        self.disabled_menu_items = (MainMenu.SAVE,)

        self.lemma = ''
        self.lpos = ''
        out = {'within': within}
        if within and not self.error:
            self.add_system_message('error', _('Please specify positive filter to switch'))
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
            query = self._compile_query(cname=self.maincorp)
        except ConcError:
            if texttypes:
                query = '[]'
                filfpos = '0'
                filtpos = '0'
            else:
                raise ConcError(_('No query entered.'))
        query += ' '.join(['within <%s %s />' % nq for nq in texttypes])
        if within:
            wquery = ' within %s:(%s)' % (self.maincorp or self.corpname, query)
            self.q[0] += wquery
            self.q.append('x-' + (self.maincorp or self.corpname))
        else:
            self.q.append('%s%s %s %i %s' % (pnfilter, filfpos, filtpos,
                                             rank, query))
        try:
            return self.view()
        except:
            if within:
                self.q[0] = self.q[0][:-len(wquery)]
            else:
                del self.q[-1]
            raise

    @exposed()
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
        self.q.append('r' + rlines)
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
        corp_info = plugins.get('corptree').get_corpus_info(self.corpname)

        conc = self.call_function(conclib.get_conc, (self._corp(),))
        result = {
            'fcrit': self.urlencode([('fcrit', cr) for cr in fcrit]),
            'FCrit': [{'fcrit': cr} for cr in fcrit],
            'Blocks': [conc.xfreq_dist(cr, flimit, freq_sort, ml,
                                       self.ftt_include_empty, rel_mode,
                                       collator_locale=corp_info.collator_locale) for cr in fcrit],
            'paging': 0,
            'concsize': conc.size(),
            'fmaxitems': self.fmaxitems,
            'quick_from_line': 1,
            'quick_to_line': None
        }

        if not result['Blocks'][0]:
            logging.getLogger(__name__).warn('freqs - empty list: %s' % (result,))
            return {'message': ('error', _('Empty list')), 'Blocks': [], 'paging': 0,
                    'quick_from_line': None, 'quick_to_line': None, 'FCrit': []}

        if len(result['Blocks']) == 1:  # paging
            items_per_page = self.fmaxitems
            fstart = (self.fpage - 1) * self.fmaxitems + line_offset
            self.fmaxitems = self.fmaxitems * self.fpage + 1 + line_offset
            result['paging'] = 1
            if len(result['Blocks'][0]['Items']) < self.fmaxitems:
                result['lastpage'] = 1
            else:
                result['lastpage'] = 0
            result['Blocks'][0]['Total'] = len(result['Blocks'][0]['Items'])
            result['Blocks'][0]['TotalPages'] = int(math.ceil(result['Blocks'][0]['Total'] /
                                                              float(items_per_page)))
            result['Blocks'][0]['Items'] = result['Blocks'][0]['Items'][fstart:self.fmaxitems - 1]

        for b in result['Blocks']:
            for item in b['Items']:
                item['pfilter'] = ''
                item['nfilter'] = ''
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
                    efquery = werkzeug.urls.url_quote(fquery)
                    item['pfilter'] += ';q=p%s' % efquery
                    if len(attrs) == 1 and item['freq'] <= conc.size():
                        item['nfilter'] += ';q=n%s' % efquery
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
            pfilter = ';q=p0 0 1 ([] within ! <err/>) within ! <corr/>'
            cc = self.call_function(conclib.get_conc, (self._corp(),),
                                    q=self.q + [pfilter[3:]])
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

        self.fpage = 1
        self.fmaxitems = to_line - from_line + 1
        self.wlwords, self.wlcache = self._get_wl_words(upl_file='wlfile', cache_file='wlcache')
        self.blacklist, self.blcache = self._get_wl_words(upl_file='wlblacklist',
                                                          cache_file='blcache')
        if self.wlattr:
            self._make_wl_query()  # multilevel wordlist

        # following piece of sh.t has hidden parameter dependencies
        result = self.freqs(fcrit, flimit, freq_sort, ml)
        saved_filename = self._canonical_corpname(self.corpname)

        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-frequencies.txt"' % \
                                                   saved_filename
            output = result
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-freq-distrib.%s' % (
                self._canonical_corpname(self.corpname), suffix)
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
            self.exceptmethod = 'freq'
            raise ConcError(_('No text type selected'))
        return self.freqs(['%s 0' % a for a in fttattr], flimit)

    @exposed(access_level=1, vars=('concsize',), legacy=True)
    def coll(self):
        """
        collocations form
        """
        self.disabled_menu_items = (MainMenu.SAVE, )
        if self.maincorp:
            corp = corplib.open_corpus(self.maincorp)
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
        self.cbgrfns = ''.join(cbgrfns)
        self._save_options(self.LOCAL_COLL_OPTIONS, self.corpname)

        collstart = (self.collpage - 1) * self.citemsperpage + line_offset

        if csortfn is '' and cbgrfns:
            self.csortfn = cbgrfns[0]
        conc = self.call_function(conclib.get_conc, (self._corp(),))

        num_fetch_lines = num_lines if num_lines is not None else self.citemsperpage
        result = conc.collocs(cattr=self.cattr, csortfn=self.csortfn, cbgrfns=self.cbgrfns,
                              cfromw=self.cfromw, ctow=self.ctow, cminfreq=self.cminfreq,
                              cminbgr=self.cminbgr, from_idx=collstart, max_lines=num_fetch_lines)
        if collstart + self.citemsperpage < result['Total']:
            result['lastpage'] = 0
        else:
            result['lastpage'] = 1

        for item in result['Items']:
            item['pfilter'] = self.urlencode([('q', item['pfilter'])])
            item['nfilter'] = self.urlencode([('q', item['nfilter'])])
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

        self.citemsperpage = sys.maxint
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

        self.collpage = 1
        self.citemsperpage = sys.maxint
        result = self.collx(csortfn, cbgrfns, line_offset=(from_line - 1), num_lines=num_lines)
        saved_filename = self._canonical_corpname(self.corpname)
        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-collocations.txt"' % (
                saved_filename,)
            out_data = result
            out_data['Desc'] = self.concdesc_json()['Desc']
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-collocations.%s' % (
                self._canonical_corpname(self.corpname), suffix)
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
        data['allow_left_expand'] = int(getattr(self, 'detail_left_ctx', 0)) < \
                int(data['maxdetail'])
        data['allow_right_expand'] = int(getattr(self, 'detail_right_ctx', 0)) < \
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
            corpname = self.corpname
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
            ref_corpname = self.corpname
        if hasattr(self, 'compatible_corpora'):
            out['CompatibleCorpora'] = plugins.get('corptree').get_list(self.permitted_corpora())
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
        wlcache = getattr(self, cache_file, '')
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
            self.wlpat = '.*'
        if '.' in self.wlattr:
            orig_wlnums = self.wlnums
            if wltype != 'simple':
                raise ConcError(_('Text types are limited to Simple output'))
            if self.wlnums == 'arf':
                raise ConcError(_('ARF cannot be used with text types'))
            elif self.wlnums == 'frq':
                self.wlnums = 'doc sizes'
            elif self.wlnums == 'docf':
                self.wlnums = 'docf'

        if paginate:
            wlmaxitems = self.wlpagesize * self.wlpage + 1
        else:
            wlmaxitems = sys.maxint
        wlstart = (self.wlpage - 1) * self.wlpagesize
        result = {
            'reload_url': self.create_url('wordlist', {
                'corpname': self.corpname, 'usesubcorp': self.usesubcorp,
                'wlattr': self.wlattr, 'wlpat': self.wlpat, 'wlminfreq': self.wlminfreq,
                'include_nonwords': self.include_nonwords, 'wlsort': self.wlsort,
                'wlnums': self.wlnums
            })
        }
        try:
            self.wlwords, self.wlcache = self._get_wl_words(upl_file='wlfile', cache_file='wlcache')
            self.blacklist, self.blcache = self._get_wl_words(upl_file='wlblacklist',
                                                              cache_file='blcache')
            if wltype == 'keywords':
                args = (self.cm.get_Corpus(self.corpname, usesubcorp),
                        self.cm.get_Corpus(ref_corpname, ref_usesubcorp))
                kw_func = getattr(corplib, 'subc_keywords_onstr')
                args = args + (self.wlattr,)
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
                if hasattr(self, 'wlfile') and self.wlpat == '.*':
                    self.wlsort = ''
                result_list = self.call_function(corplib.wordlist,
                                                 (self._corp(), self.wlwords),
                                                 wlmaxitems=wlmaxitems)[wlstart:]
                if self.wlwords:
                    result['wlcache'] = self.wlcache
                if self.blacklist:
                    result['blcache'] = self.blcache
                result['Items'] = result_list
            if len(result_list) < self.wlpagesize + 1:
                result['lastpage'] = 1
            else:
                result['lastpage'] = 0
                if paginate:
                    result_list = result_list[:-1]
            result['Items'] = result_list

            if '.' in self.wlattr:
                self.wlnums = orig_wlnums
            try:
                result['wlattr_label'] = (self._corp().get_conf(self.wlattr + '.LABEL') or
                                          self.wlattr)
            except Exception as e:
                result['wlattr_label'] = self.wlattr
                logging.getLogger(__name__).warning('wlattr_label set failed: %s' % e)

            result['freq_figure'] = _(self.FREQ_FIGURES.get(self.wlnums, '?'))

            params = {
                'colheaders': 0,
                'ref_usesubcorp': None,
                'wlattr': self.wlattr,
                'wlpat': wlpat,
                'wlsort': self.wlsort,
                'wlminfreq': self.wlminfreq,
                'wlnums': self.wlnums,
                'wlcache': self.wlcache,
                'blcache': self.blcache,
                'wltype': 'simple',
                'from_line': 1,
                'to_line': None,
                'include_nonwords': self.include_nonwords
            }

            self._add_save_menu_item('CSV', 'savewl', params, save_format='csv')
            self._add_save_menu_item('XLSX', 'savewl', params, save_format='xlsx')
            self._add_save_menu_item('XML', 'savewl', params, save_format='xml')
            self._add_save_menu_item('TXT', 'savewl', params, save_format='text')
            # custom save is solved in templates because of compatibility issues
            self.last_corpname = self.corpname
            self._save_options(['last_corpname'])
            return result

        except corplib.MissingSubCorpFreqFile as e:
            out = corplib.build_arf_db(e.args[0], self.wlattr)
            if out:
                processing = out[1].strip('%')
            else:
                processing = '0'
            result.update({'processing': processing == '100' and '99' or processing})
            return result

    def _make_wl_query(self):
        qparts = []
        if self.wlpat:
            qparts.append('%s="%s"' % (self.wlattr, self.wlpat))
        if not self.include_nonwords:
            qparts.append('%s!="%s"' % (self.wlattr,
                                        self._corp().get_conf('NONWORDRE')))
        if self.wlwords:
            qq = ['%s=="%s"' % (self.wlattr, w.strip()) for w in self.wlwords]
            qparts.append('(' + '|'.join(qq) + ')')
        for w in self.blacklist:
            qparts.append('%s!=="%s"' % (self.wlattr, w.strip()))
        self.q = ['q[' + '&'.join(qparts) + ']']

    @exposed(template='freqs.tmpl', legacy=True)
    def struct_wordlist(self):
        self.exceptmethod = 'wordlist_form'
        if self.fcrit:
            self.wlwords, self.wlcache = self._get_wl_words(upl_file='wlfile', cache_file='wlcache')
            self.blacklist, self.blcache = self._get_wl_words(upl_file='wlblacklist',
                                                              cache_file='blcache')
            self._make_wl_query()
            return self.freqs(self.fcrit, self.flimit, self.freq_sort, 1)

        if '.' in self.wlattr:
            raise ConcError('Text types are limited to Simple output')
        if self.wlnums != 'frq':
            raise ConcError('Multilevel lists are limited to Word counts frequencies')
        level = 3
        self.wlwords, self.wlcache = self._get_wl_words(upl_file='wlfile', cache_file='wlcache')
        self.blacklist, self.blcache = self._get_wl_words(upl_file='wlblacklist',
                                                          cache_file='blcache')
        if not self.wlstruct_attr1:
            raise ConcError(_('No output attribute specified'))
        if not self.wlstruct_attr3:
            level = 2
        if not self.wlstruct_attr2:
            level = 1
        if not self.wlpat and not self.wlwords:
            raise ConcError(
                _('You must specify either a pattern or a file to get the multilevel wordlist'))
        self._make_wl_query()
        self.flimit = self.wlminfreq
        return self.freqml(flimit=self.wlminfreq, freqlevel=level,
                           ml1attr=self.wlstruct_attr1, ml2attr=self.wlstruct_attr2,
                           ml3attr=self.wlstruct_attr3)

    @exposed(access_level=1, legacy=True)
    def savewl_form(self, wlpat='', from_line=1, to_line='', wltype='simple',
                    usesubcorp='', ref_corpname='', ref_usesubcorp='',
                    saveformat='text'):
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
        self.wlpage = 1
        ans = self.wordlist(wlpat=self.wlpat, wltype=wltype, usesubcorp=usesubcorp,
                            ref_corpname=ref_corpname, ref_usesubcorp=ref_usesubcorp,
                            paginate=False)
        err = self._validate_range((from_line, to_line), (1, None))
        if err is not None:
            raise err
        ans['Items'] = ans['Items'][:(to_line - from_line + 1)]

        saved_filename = self._canonical_corpname(self.corpname)

        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-word-list.txt"' % (
                saved_filename,)
            out_data = ans
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-word-list.%s' % (
                self._canonical_corpname(self.corpname), suffix)
            writer = plugins.get('export').load_plugin(saveformat, subtype='wordlist')
            writer.set_col_types(int, unicode, float)

            self._headers['Content-Type'] = writer.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="%s"' % (
                mkfilename(saveformat),)

            # write the header first, if required
            if colheaders or heading:
                writer.writeheading(('', self.wlattr, 'freq'))
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
        return corplib.attr_vals(self.corpname, avattr, avpat)

    @exposed(access_level=1, legacy=True)
    def saveconc_form(self, from_line=1, to_line=''):
        self.disabled_menu_items = (MainMenu.SAVE, )
        conc = self.call_function(conclib.get_conc, (self._corp(), self.samplesize))
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
            conc = self.call_function(conclib.get_conc, (self._corp(), self.samplesize))
            kwic = Kwic(self._corp(), self.corpname, conc)
            conc.switch_aligned(os.path.basename(self.corpname))
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
                                                 for c in self.align.split(',') if c],
                                      leftctx=leftctx, rightctx=rightctx,
                                      structs=self._get_struct_opts())

            mkfilename = lambda suffix: '%s-concordance.%s' % (
                self._canonical_corpname(self.corpname), suffix)
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
                                      [self.cm.get_Corpus(c) for c in self.align.split(',') if c]
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
        path = '%s/%s/%s' % (settings.get('corpora', 'speech_files_path'), self.corpname, chunk)

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
        self.q.append('%s%s %s %i %s' % (pnfilter, 0, 0, 0, '|'.join(sel_lines)))
        q_id = self._store_conc_params()
        params = {
            'corpname': self.corpname,
            'q': '~%s' % q_id,
            'viewmode': self.viewmode,
            'attrs': self.attrs,
            'attr_allpos': self.attr_allpos,
            'ctxattrs': self.ctxattrs,
            'structs': self.structs,
            'refs': self.refs,
            'viewmode': self.viewmode
        }
        if self.usesubcorp:
            params['usesubcorp'] = self.usesubcorp
        if self.align:
            params['align'] = self.align
        return {
            'id': q_id,
            'next_url': self.create_url('view', params)
        }
