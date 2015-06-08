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
import urllib

import werkzeug.urls

from kontext import Kontext, ConcError
from controller import JsonEncodedData, UserActionException, exposed, Parameter
import settings
import conclib
import corplib
import plugins
import butils
from kwiclib import Kwic
import l10n
from l10n import import_string, export_string, format_number
from translation import ugettext as _


class Actions(Kontext):
    """
    KonText actions are specified here
    """

    FREQ_FIGURES = {'docf': 'Document counts', 'frq': 'Word counts', 'arf': 'ARF'}

    WIDECTX_ATTRS = ('attrs', 'attr_allpos', 'ctxattrs', 'structs', 'refs')

    cattr = Parameter('word')
    csortfn = Parameter('d')
    cbgrfns = Parameter(['m', 't', 'td'])
    cfromw = Parameter(-5)
    ctow = Parameter(5)
    cminfreq = Parameter(5)
    cminbgr = Parameter(3)
    citemsperpage = Parameter(50)

    wlminfreq = Parameter(5)
    wlmaxitems = Parameter(100)
    wlicase = Parameter(0)
    wlwords = Parameter([])
    blacklist = Parameter([])

    include_nonwords = Parameter(0)
    wltype = Parameter('simple')
    wlnums = Parameter('frq')

    wlstruct_attr1 = Parameter('')
    wlstruct_attr2 = Parameter('')
    wlstruct_attr3 = Parameter('')

    subcnorm = Parameter('tokens')
    maxsavelines = Parameter(1000)
    fcrit = Parameter([])

    """
    This class specifies all the actions KonText offers to a user via HTTP
    """
    def __init__(self, environ, ui_lang):
        """
        arguments:
        environ -- wsgi environment variable
        ui_lang -- a language code in which current action's result will be presented
        """
        super(Actions, self).__init__(environ=environ, ui_lang=ui_lang)
        self.contains_within = False
        self.disabled_menu_items = ()

    def get_mapping_url_prefix(self):
        """
        This is required as it maps the controller to request URLs
        """
        return '/'

    @exposed(access_level=1, template='user_password_form.tmpl')
    def user_password_form(self):
        if not settings.supports_password_change():
            return {'message': ('error', _('This function is disabled.'))}
        return {}

    @exposed(access_level=1, template='user_password.tmpl')
    def user_password(self, curr_passwd='', new_passwd='', new_passwd2=''):
        if not settings.supports_password_change():
            return {'message': ('error', _('This function is disabled.'))}
        logged_in = plugins.auth.validate_user(self.session_get('user', 'user'), curr_passwd)
        if not logged_in:
            raise UserActionException(_('Unknown user'))
        if settings.auth.validate_password(curr_passwd):
            pass
        else:
            raise UserActionException(_('Invalid password'))

        if new_passwd != new_passwd2:
            raise UserActionException(_('New password and its confirmation do not match.'))

        if not settings.auth.validate_new_password(new_passwd):
            raise UserActionException(settings.auth.get_required_password_properties())

        settings.auth.update_user_password(new_passwd)
        self._redirect(self.get_root_url())

    @exposed()
    def login(self):
        self.disabled_menu_items = ('menu-new-query', 'menu-word-list', 'menu-view', 'menu-sort', 'menu-sample',
                                    'menu-save', 'menu-subcorpus', 'menu-concordance', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc')
        return {}

    @exposed(template='login.tmpl')
    def loginx(self, username='', password=''):
        ans = {}
        self._session['user'] = plugins.auth.validate_user(username, password)

        if self._session['user'].get('id', None):
            self._redirect('%sfirst_form' % (self.get_root_url(), ))
        else:
            self.disabled_menu_items = ('menu-new-query', 'menu-word-list', 'menu-view', 'menu-sort', 'menu-sample',
                                        'menu-save', 'menu-subcorpus', 'menu-concordance', 'menu-filter',
                                        'menu-frequency',
                                        'menu-collocations', 'menu-conc-desc')
            ans['message'] = ('error', _('Incorrect username or password'))
        return ans

    @exposed(access_level=1, template='login.tmpl')
    def logoutx(self):
        self.disabled_menu_items = ('menu-new-query', 'menu-word-list', 'menu-view', 'menu-sort', 'menu-sample',
                                    'menu-save', 'menu-subcorpus', 'menu-concordance', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc')
        plugins.auth.logout(self._get_session_id())
        self._init_session()

        return {
            'message': ('info', _('You have been logged out'))
        }

    @exposed(vars=('orig_query', ))
    def view(self, view_params={}):
        """
        kwic view

        arguments:
        view_params -- parameter_name->value pairs with the highest priority (i.e. it overrides any url/cookie-based
                       values)
        """
        for k, v in view_params.items():
            if k in self.__dict__:
                self.__dict__[k] = v

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
            sentence_struct = plugins.corptree.get_corpus_info(self.corpname)['sentence_struct']
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

        # we merge structs (e.g. 'doc', 'p') with structural attributes (e.g. 'doc.id', 'p.version')
        # because manatee accepts both together
        # important note: "self.structs" is a string of comma-separated values while "self.structattrs" is a list
        out = self.call_function(kwic.kwicpage, (self._get_speech_segment(), ),
                                 labelmap=labelmap,
                                 alignlist=[self.cm.get_Corpus(c) for c in self.align.split(',') if c],
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
            out['message'] = ('info', _('No result. Please make sure the query and selected query type are correct.'))
            out['next_url'] = '%sfirst_form' % self.get_root_url()

        params = 'pagesize=%s&leftctx=%s&rightctx=%s&saveformat=%s&heading=%s' \
                 '&numbering=%s&align_kwic=%s&from_line=%s&to_line=%s' \
                 % (self.pagesize, self.leftctx, self.rightctx, '%s', self.heading, self.numbering,
                    self.align_kwic, 1, conc.size())
        self._add_save_menu_item('CSV', 'saveconc', params % 'csv')
        self._add_save_menu_item('XLSX', 'saveconc', params % 'xlsx')
        self._add_save_menu_item('XML', 'saveconc', params % 'xml')
        self._add_save_menu_item('TXT', 'saveconc', params % 'text')
        self._add_save_menu_item('%s...' % _('Custom'), 'saveconc_form', 'leftctx=%s&rightctx=%s' % (self.leftctx,
                                                                                                     self.rightctx))
        out['widectx_globals'] = self.urlencode(self._get_attrs(self.WIDECTX_ATTRS,
                                                                dict(structs=self._get_struct_opts())))
        self._store_conc_results(out)
        return out

    @exposed(vars=('TextTypeSel', 'LastSubcorp'))
    def first_form(self):
        self.disabled_menu_items = ('menu-sort', 'menu-sample', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc', 'menu-save', 'menu-concordance')
        out = {}
        self._reset_session_conc()
        out.update(self._fetch_semi_peristent_attrs())

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
        self._export_subcorpora_list(out)
        out['metadata_desc'] = plugins.corptree.get_corpus_info(self.corpname, language=self.ui_lang)['metadata']['desc']
        self.last_corpname = self.corpname
        self._save_options(['last_corpname'])
        return out

    @exposed(return_type='json')
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
                    relconcsize=1000000.0 * fullsize / self._corp().search_size(), fullsize=fullsize,
                    finished=conc.finished())

    def concdesc(self, query_id=''):
        self.disabled_menu_items = ('menu-save',)
        out = {}

        query_desc = ''
        query_desc_raw = ''
        is_public = True
        if query_id and plugins.has_plugin('query_storage'):
            ans = plugins.query_storage.get_user_query(self._session_get('user', 'id'), query_id)
            if ans:
                query_desc_raw = ans['description']
                query_desc = plugins.query_storage.decode_description(query_desc_raw)
                is_public = ans['public']
            else:
                out['message'] = ('error', _('Cannot access recorded query.'))
                query_id = None  # we have to invalidate the query_id (to render HTML properly)

        conc_desc = conclib.get_conc_desc(corpus=self._corp(), q=self.q,
                                          subchash=getattr(self._corp(), "subchash", None))

        out['Desc'] = []
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

    @exposed(return_type='json')
    def concdesc_json(self, query_id=''):
        return self.concdesc(query_id)

    @exposed(access_level=1, vars=('concsize', ))
    def viewattrs(self):
        """
        attrs, refs, structs form
        """
        from collections import defaultdict

        self.disabled_menu_items = ('menu-save',)
        out = {}
        if self.maincorp:
            corp = corplib.manatee.Corpus(self.maincorp)
            out['AttrList'] = [{'label': corp.get_conf(n + '.LABEL') or n, 'n': n}
                               for n in corp.get_conf('ATTRLIST').split(',')
                               if n]
        else:
            corp = self._corp()
        availstruct = corp.get_conf('STRUCTLIST').split(',')
        structlist = self.structs.split(',')
        out['Availstructs'] = [{'n': n,
                                'sel': (((n in structlist)
                                         and 'selected') or ''),
                                'label': corp.get_conf(n + '.LABEL')}
                               for n in availstruct if n and n != '#']

        availref = corp.get_conf('STRUCTATTRLIST').split(',')
        structattrs = defaultdict(list)
        reflist = self.refs.split(',')

        ref_is_allowed = lambda r: r and r not in (
            '#', plugins.corptree.get_corpus_info(self.corpname).get('speech_segment'))

        for item in availref:
            if ref_is_allowed(item):
                k, v = item.split('.', 1)
                structattrs[k].append(v)
                if not k in reflist:
                    reflist.append(k)

        out['Availrefs'] = [{
                            'n': '#',
                            'label': _('Token number'),
                            'sel': ((('#' in reflist) and 'selected') or '')
                            }] + \
                           [{
                            'n': '=' + n,
                            'sel': ((('=' + n in reflist) and 'selected') or ''),
                            'label': (corp.get_conf(n + '.LABEL') or n)
                            }
                            for n in availref if ref_is_allowed(n)
                            ]
        doc = corp.get_conf('DOCSTRUCTURE')
        if doc in availstruct:
            out['Availrefs'].insert(1, {'n': doc, 'label': _('Document number'),
                                        'sel': (doc in reflist and 'selected' or '')})
        out['newctxsize'] = self.kwicleftctx[1:]
        out['structattrs'] = structattrs
        out['curr_structattrs'] = self.structattrs
        return out

    def _set_new_viewopts(self, newctxsize='', refs_up='', ctxunit=''):
        if ctxunit == '@pos':
            ctxunit = ''
        if "%s%s" % (newctxsize, ctxunit) != self.kwicrightctx:
            if not newctxsize.isdigit():
                self.exceptmethod = 'viewattrs'
                raise Exception(
                    _('Value [%s] cannot be used as a context width. Please use numbers 0,1,2,...') % newctxsize)
            self.kwicleftctx = '-%s%s' % (newctxsize, ctxunit)
            self.kwicrightctx = '%s%s' % (newctxsize, ctxunit)

    def _set_new_viewattrs(self, setattrs=(), allpos='', setstructs=(), setrefs=(), structattrs=()):
        self.attrs = ','.join(setattrs)
        self.structs = ','.join(setstructs)
        self.refs = ','.join(setrefs)
        self.attr_allpos = allpos
        if allpos == 'all':
            self.ctxattrs = self.attrs
        else:
            self.ctxattrs = 'word'
        self.structattrs = structattrs

    @exposed(access_level=1, template='view.tmpl', page_model='view')
    def viewattrsx(self, setattrs=(), allpos='', setstructs=(), setrefs=(), structattrs=(), shuffle=0):
        self._set_new_viewattrs(setattrs=setattrs,
                                allpos=allpos,
                                setstructs=setstructs,
                                setrefs=setrefs,
                                structattrs=structattrs)
        self._save_options(['attrs', 'ctxattrs', 'structs', 'refs', 'structattrs'], self.corpname)
        # TODO refs_up ???
        if self.q:
            return self.view()
        else:
            self._redirect('first_form')

    @exposed(access_level=1)
    def viewopts(self):
        self.disabled_menu_items = ('menu-save', )
        out = {
            'newctxsize': self.kwicleftctx[1:]
        }
        return out

    @exposed(access_level=1, template='view.tmpl', page_model='view')
    def viewoptsx(self, newctxsize='', ctxunit='', refs_up='', shuffle=0):
        # TODO pagesize?
        self._set_new_viewopts(newctxsize=newctxsize, refs_up=refs_up, ctxunit=ctxunit)
        # This KonText version does not allow user settings for
        # collocations and frequencies pages. To save something reasonable
        # we use 'pagesize' here.
        self.citemsperpage = self.pagesize
        self.fmaxitems = self.pagesize
        self._save_options(self.GENERAL_OPTIONS)

        if self.q:
            return self.view()
        else:
            self._redirect('first_form')

    @exposed(access_level=1, vars=('concsize', ))
    def sort(self):
        """
        sort concordance form
        """
        self.disabled_menu_items = ('menu-save',)
        return {'Pos_ctxs': conclib.pos_ctxs(1, 1)}

    @exposed(access_level=1, template='view.tmpl', page_model='view')
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

    @exposed(access_level=1, template='view.tmpl', page_model='view')
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
            return '"' + '" "'.join(phrase.split()) + '"'
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
        err_containing = '';
        corr_containing = ''
        if err:
            self.iquery = err;
            self.queryselector = 'iqueryrow'
            err_containing = ' containing ' + self._compile_basic_query(qtype)
        if corr:
            self.iquery = corr;
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

    @exposed(template='view.tmpl', page_model='view')
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
        texttypes = self._texttype_query()
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

    @exposed(template='view.tmpl', vars=('TextTypeSel', 'LastSubcorp'), page_model='view')
    def first(self, fc_lemword_window_type='',
              fc_lemword_wsize=0,
              fc_lemword_type='',
              fc_lemword='',
              fc_pos_window_type='',
              fc_pos_wsize=0,
              fc_pos_type='',
              fc_pos=()):
        self._store_semi_persistent_attrs(('queryselector',))
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
        return self.view()

    @exposed(access_level=1, vars=('TextTypeSel', 'LastSubcorp', 'concsize'))
    def filter_form(self, within=0):
        self.disabled_menu_items = ('menu-save',)
        self.lemma = ''
        self.lpos = ''
        out = {'within': within}
        out.update(self._fetch_semi_peristent_attrs())
        if within and not self.error:
            out['message'] = ('error', _('Please specify positive filter to switch'))
        self._attach_tag_builder(out)
        return out

    @exposed(access_level=1, template='view.tmpl', vars=('orig_query', ), page_model='view')
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
        texttypes = self._texttype_query()
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
        self.disabled_menu_items = ('menu-save',)
        return {}

    @exposed(access_level=1, template='view.tmpl', vars=('concsize',), page_model='view')
    def reduce(self, rlines='250'):
        """
        random sample
        """
        self.q.append('r' + rlines)
        return self.view()

    @exposed(access_level=1, vars=('concsize',))
    def freq(self):
        """
        frequency list form
        """
        self.disabled_menu_items = ('menu-save',)
        return {
            'Pos_ctxs': conclib.pos_ctxs(1, 1, 6),
            'multilevel_freq_dist_max_levels': settings.get('corpora', 'multilevel_freq_dist_max_levels', 1),
            'last_num_levels': self._session_get('last_freq_level')
        }

    @exposed(access_level=1)
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

        conc = self.call_function(conclib.get_conc, (self._corp(),))
        result = {
            'fcrit': self.urlencode([('fcrit', self.rec_recode(cr))
                                     for cr in fcrit]),
            'FCrit': [{'fcrit': cr} for cr in fcrit],
            'Blocks': [conc.xfreq_dist(cr, flimit, freq_sort, 300, ml,
                                       self.ftt_include_empty, rel_mode) for cr in fcrit],
            'paging': 0,
            'concsize': conc.size(),
            'fmaxitems': self.fmaxitems,
            'quick_from_line': 1,
            'quick_to_line': None
        }

        if not result['Blocks'][0]:
            logging.getLogger(__name__).warn('freqs - empty list: %s' % (result,))
            return {'message': ('error', _('Empty list')), 'Blocks': [], 'paging': 0, 'quick_from_line': None,
                    'quick_to_line': None,
                    'FCrit': []}

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
            result['Blocks'][0]['TotalPages'] = int(math.ceil(result['Blocks'][0]['Total'] / float(items_per_page)))
            result['Blocks'][0]['Items'] = result['Blocks'][0]['Items'][fstart:self.fmaxitems - 1]

        for b in result['Blocks']:
            for item in b['Items']:
                item['pfilter'] = ''
                item['nfilter'] = ''
                ## generating positive and negative filter references
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
                    if not '.' in attr:
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
                    efquery = self.urlencode(fquery)
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
                for item in block['Items']: corrs += item['freq']
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

    @exposed(access_level=1, vars=('concsize',))
    def savefreq_form(self, fcrit=(), flimit=0, freq_sort='', ml=0, saveformat='text', from_line=1, to_line=''):
        """
        Displays a form to set-up the 'save frequencies' operation
        """
        self.disabled_menu_items = ('menu-save', )
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

    @exposed(access_level=1, vars=('Desc',))
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
        self.wlwords, self.wlcache = self.get_wl_words()
        self.blacklist, self.blcache = self.get_wl_words(('wlblacklist',
                                                          'blcache'))
        if self.wlattr:
            self._make_wl_query()  # multilevel wordlist

        result = self.freqs(fcrit, flimit, freq_sort, ml)  # this piece of sh.. has hidden parameter dependencies
        saved_filename = self._canonical_corpname(self.corpname)

        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-frequencies.txt"' % saved_filename
            output = result
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-freq-distrib.%s' % (self._canonical_corpname(self.corpname), suffix)
            writer = plugins.export.load_plugin(saveformat, subtype='freq')
            writer.set_col_types(int, unicode, int)

            self._headers['Content-Type'] = writer.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="%s"' % mkfilename(saveformat)

            for block in result['Blocks']:
                col_names = [item['n'] for item in block['Head'][:-2]] + ['freq', 'freq [%]']
                if saveformat == 'xml':
                    col_names.insert(0, 'str')
                if hasattr(writer, 'add_block'):
                    writer.add_block('')  # TODO block name

                if colheaders or heading:
                    writer.writeheading([''] + [item['n'] for item in block['Head'][:-2]] + ['freq', 'freq [%]'])
                i = 1
                for item in block['Items']:
                    writer.writerow(i, [w['n'] for w in item['Word']] + [str(item['freq']), str(item.get('rel', ''))])
                    i += 1
            output = writer.raw_content()
        return output

    @exposed(access_level=1, template='freqs.tmpl', accept_kwargs=True)
    def freqml(self, flimit=0, freqlevel=1, **kwargs):
        """
        multilevel frequency list
        """
        fcrit = ' '.join([Kontext.onelevelcrit('', kwargs.get('ml%dattr' % i, 'word'),
                                               kwargs.get('ml%dctx' % i, 0), kwargs.get('ml%dpos' % i, 1),
                                               kwargs.get('ml%dfcode' % i, 'rc'), kwargs.get('ml%dicase' % i, ''), 'e')
                          for i in range(1, freqlevel + 1)])
        result = self.freqs([fcrit], flimit, '', 1)
        result['ml'] = 1
        self._session['last_freq_level'] = freqlevel
        return result

    @exposed(access_level=1, template='freqs.tmpl')
    def freqtt(self, flimit=0, fttattr=()):
        if not fttattr:
            self.exceptmethod = 'freq'
            raise ConcError(_('No text type selected'))
        return self.freqs(['%s 0' % a for a in fttattr], flimit)

    @exposed(access_level=1, vars=('concsize',))
    def coll(self):
        """
        collocations form
        """
        self.disabled_menu_items = ('menu-save', )
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

    @exposed(access_level=1, vars=('concsize',))
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
                              cfromw=self.cfromw, ctow=self.ctow, cminfreq=self.cminfreq, cminbgr=self.cminbgr,
                              from_idx=collstart, max_lines=num_fetch_lines)
        if collstart + self.citemsperpage < result['Total']:
            result['lastpage'] = 0
        else:
            result['lastpage'] = 1

        for item in result['Items']:
            item['pfilter'] = 'q=' + self.urlencode(item['pfilter'])
            item['nfilter'] = 'q=' + self.urlencode(item['nfilter'])
            item['str'] = import_string(item['str'], from_encoding=self._corp().get_conf('ENCODING'))

        result['cmaxitems'] = 10000
        result['to_line'] = 10000  # TODO
        return result

    @exposed(access_level=1)
    def savecoll_form(self, from_line=1, to_line='', csortfn='', cbgrfns=['t', 'm'], saveformat='text',
                      heading=0):
        """
        """
        self.disabled_menu_items = ('menu-save', )

        self.citemsperpage = sys.maxint
        result = self.collx(csortfn, cbgrfns)
        if to_line == '':
            to_line = len(result['Items'])
        return {
            'from_line': from_line,
            'to_line': to_line,
            'saveformat': saveformat
        }

    @exposed(access_level=1, vars=('Desc', 'concsize',))
    def savecoll(self, from_line=1, to_line='', csortfn='', cbgrfns=['t', 'm'], saveformat='text',
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
            self._headers['Content-Disposition'] = 'attachment; filename="%s-collocations.txt"' % saved_filename
            out_data = result
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-collocations.%s' % (self._canonical_corpname(self.corpname), suffix)
            writer = plugins.export.load_plugin(saveformat, subtype='coll')
            writer.set_col_types(int, unicode, *(8 * (float,)))

            self._headers['Content-Type'] = writer.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="%s"' % mkfilename(saveformat)

            if colheaders or heading:
                writer.writeheading([''] + [item['n'] for item in result['Head']])
            i = 1
            for item in result['Items']:
                writer.writerow(i, (item['str'], str(item['freq'])) + tuple([str(stat['s']) for stat in item['Stats']]))
                i += 1
            out_data = writer.raw_content()
        return out_data

    @exposed(access_level=1, template='widectx.tmpl')
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

    @exposed(access_level=0)
    def widectx(self, pos=0):
        """
        display a hit in a wider context
        """
        data = self.call_function(conclib.get_detail_context, (self._corp(), pos))
        data['allow_left_expand'] = int(getattr(self, 'detail_left_ctx', 0)) < int(data['maxdetail'])
        data['allow_right_expand'] = int(getattr(self, 'detail_right_ctx', 0)) < int(data['maxdetail'])

        data['widectx_globals'] = self.urlencode(self._get_attrs(self.WIDECTX_ATTRS,
                                                 dict(structs=self._get_struct_opts())))
        return data

    @exposed(access_level=0, return_type='json')
    def widectx_raw(self, pos=0):
        data = conclib.get_detail_context(self._corp(), pos)
        return data

    @exposed(access_level=0, return_type='json')
    def fullref(self, pos=0):
        """
        display a full reference
        """
        return self.call_function(conclib.get_full_ref, (self._corp(), pos))

    @exposed()
    def draw_graph(self, fcrit='', flimit=0):
        """
        draw frequency distribution graph
        """
        self._headers['Content-Type'] = 'image/png'
        self.fcrit = fcrit
        conc = self.call_function(conclib.get_conc, (self._corp(),))
        #        print 'Content-Type: text/html; charset=iso-8859-2\n'
        return self.call_function(conc.graph_dist, (fcrit, flimit))

    @exposed(template='wordlist.tmpl')
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

    @exposed()
    def check_histogram_processing(self):
        logfile_name = os.path.join(self.subcpath[-1], self.corpname,
                                    'hist.build')
        if os.path.isfile(logfile_name):
            logfile = open(logfile_name)
            lines = logfile.readlines()
            if len(lines) > 1:
                try:
                    out = (lines[1], lines[-1])
                except:
                    out = (lines[0], lines[-1])
            else:
                out = ('', lines[-1])
            logfile.close()
        else:
            out = ('', '')
        return ':'.join(map(str.strip, out))

    @exposed(template='findx_upload_form.tmpl', vars=('LastSubcorp',))
    def kill_histogram_processing(self):
        import glob

        pid = self.check_histogram_processing().split(':')[0]
        if pid:
            try:
                os.kill(int(pid), 9)
                os.remove(os.path.join(self._tmp_dir, 'findx_upload.%s' % self._session_get('user', 'user')))
            except OSError:
                pass
        logfile_name = os.path.join(self.subcpath[-1], self.corpname,
                                    'hist.build')
        if os.path.isfile(logfile_name):
            os.rename(logfile_name, logfile_name + '.old')
        tmp_glob = os.path.join(self.subcpath[-1], self.corpname, '*.histtmp')
        for name in glob.glob(tmp_glob):
            os.rename(name, name[:-8])
        return self.wordlist_form()

    @exposed()
    def findx_form(self):
        out = {'Histlist': []}
        try:
            import genhist
        except:
            return out
        histpath = self._corp().get_conf('WSHIST')
        histpath_custom = os.path.join(self.subcpath[-1], self.corpname,
                                       'histograms.def')
        histlist = []
        if os.path.isfile(histpath):
            histlist.extend(genhist.parse_config_file(open(histpath)))
        if os.path.isfile(histpath_custom):
            histlist.extend(genhist.parse_config_file(open(histpath_custom)))
        histlist_ids = []
        for hist in histlist:
            id = hist.get_id()
            if id not in histlist_ids:
                histlist_ids.append(id)
                out['Histlist'].append({'name': hist.get_attr('HR') or id,
                                        'id': id})
        return out

    @exposed(access_level=1, vars=('LastSubcorp',))
    def wordlist_form(self, ref_corpname=''):
        """
        Word List Form
        """
        self.disabled_menu_items = ('menu-view', 'menu-sort', 'menu-sample', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc', 'menu-save', 'menu-concordance')
        self._reset_session_conc()
        out = {}
        if not ref_corpname:
            ref_corpname = self.corpname
        if hasattr(self, 'compatible_corpora'):
            refcm = corplib.CorpusManager(
                [str(c) for c in self.compatible_corpora], self.subcpath)
            out['CompatibleCorpora'] = refcm.corplist_with_names(plugins.corptree.get(),
                                                                 settings.get_bool('corpora', 'use_db_whitelist'))
        else:
            refcm = corplib.CorpusManager([ref_corpname], self.subcpath)
        out['RefSubcorp'] = refcm.subcorp_names(ref_corpname)
        out['ref_corpname'] = ref_corpname
        out['freq_figures'] = self.FREQ_FIGURES
        self._export_subcorpora_list(out)
        return out

    @exposed()
    def findx_upload_form(self):
        return {
            'processing': self.check_histogram_processing().split(':')[1]
        }

    @exposed()
    def get_wl_words(self, attrnames=('wlfile', 'wlcache')):
        """
        gets arbitrary list of words for wordlist
        """
        wlfile = getattr(self, attrnames[0], '').encode('utf8')
        wlcache = getattr(self, attrnames[1], '')
        filename = wlcache
        wlwords = []
        if wlfile:  # save a cache file
            try:
                from hashlib import md5
            except ImportError:
                from md5 import new as md5
            filename = os.path.join(self.cache_dir,
                                    md5(wlfile).hexdigest() + '.wordlist')
            if not os.path.isdir(self.cache_dir):
                os.makedirs(self.cache_dir)
            cache_file = open(filename, 'w')
            cache_file.write(wlfile)
            cache_file.close()
            wlwords = [w.decode('utf8').strip() for w in wlfile.split('\n')]
        if wlcache:  # read from a cache file
            filename = os.path.join(self.cache_dir, wlcache)
            cache_file = open(filename)
            wlwords = [w.strip() for w in cache_file]
            cache_file.close()
        return wlwords, os.path.basename(filename)

    @exposed(access_level=1)
    def wordlist(self, wlpat='', wltype='simple', usesubcorp='',
                 ref_corpname='', ref_usesubcorp='', line_offset=0):
        """
        """
        self.disabled_menu_items = ('menu-view', 'menu-sort', 'menu-sample', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc', 'menu-concordance')

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

        lastpage = 0
        if self._user_is_anonymous() and self.wlpage >= 10:  # limit paged lists
            self.wlpage = 10
            lastpage = 1
        elif self._user_is_anonymous() and self.wlmaxitems > 1000:  # limit saved lists
            self.wlpage = 1
            self.wlmaxitems = 1000
        wlstart = (self.wlpage - 1) * self.wlmaxitems + line_offset
        self.wlmaxitems = self.wlmaxitems * self.wlpage + 1  # +1 = end detection
        result = {
            'reload_url': ('wordlist?wlattr=%s&corpname=%s&usesubcorp=%s&wlpat=%s&wlminfreq=%s'
                           '&include_nonwords=%s&wlsort=f&wlnums=%s') % (self.wlattr, self.corpname, self.usesubcorp,
                                                                         self.wlpat, self.wlminfreq,
                                                                         self.include_nonwords, self.wlnums)
        }
        try:
            self.wlwords, self.wlcache = self.get_wl_words()
            self.blacklist, self.blcache = self.get_wl_words(('wlblacklist',
                                                              'blcache'))
            if wltype == 'keywords':
                args = (self.cm.get_Corpus(self.corpname, usesubcorp),
                        self.cm.get_Corpus(ref_corpname, ref_usesubcorp))
                kw_func = getattr(corplib, 'subc_keywords_onstr')
                args = args + (self.wlattr,)
                out = self.call_function(kw_func, args)[wlstart:]
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
                result_list = self.call_function(corplib.wordlist, (self._corp(), self.wlwords))[wlstart:]
                if self.wlwords:
                    result['wlcache'] = self.wlcache
                if self.blacklist:
                    result['blcache'] = self.blcache
                result['Items'] = result_list
            if len(result_list) < self.wlmaxitems / self.wlpage:
                result['lastpage'] = 1
            else:
                result['lastpage'] = 0
                result_list = result_list[:-1]
            result['Items'] = result_list
            self.wlmaxitems -= 1
            if '.' in self.wlattr:
                self.wlnums = orig_wlnums
            try:
                result['wlattr_label'] = self._corp().get_conf(self.wlattr + '.LABEL') or self.wlattr
            except Exception as e:
                result['wlattr_label'] = self.wlattr
                logging.getLogger(__name__).warning('wlattr_label set failed: %s' % e)

            result['freq_figure'] = _(self.FREQ_FIGURES.get(self.wlnums, '?'))

            params_values = {
                'wlattr': self.wlattr,
                'wlpat': wlpat,
                'wlsort': self.wlsort,
                'wlminfreq': self.wlminfreq,
                'wlnums': self.wlnums
            }
            params = ('saveformat=%%s&wlattr=%(wlattr)s&colheaders=0&ref_usesubcorp=&wltype=simple&wlpat=%(wlpat)s&'
                      'from_line=1&to_line=&wlsort=%(wlsort)s&wlminfreq=%(wlminfreq)s&wlnums=%(wlnums)s') % params_values

            self._add_save_menu_item('CSV', 'savewl', params % 'csv')
            self._add_save_menu_item('XLSX', 'savewl', params % 'xlsx')
            self._add_save_menu_item('XML', 'savewl', params % 'xml')
            self._add_save_menu_item('TXT', 'savewl', params % 'text')
            # custom save is solved in templates because of compatibility issues
            self.last_corpname = self.corpname
            self._save_options(['last_corpname'])
            return result

        except corplib.MissingSubCorpFreqFile as e:
            self.wlmaxitems -= 1
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

    @exposed(template='freqs.tmpl')
    def struct_wordlist(self):
        self.exceptmethod = 'wordlist_form'
        if self.fcrit:
            self.wlwords, self.wlcache = self.get_wl_words()
            self.blacklist, self.blcache = self.get_wl_words(('wlblacklist',
                                                              'blcache'))
            self._make_wl_query()
            return self.freqs(self.fcrit, self.flimit, self.freq_sort, 1)

        if '.' in self.wlattr:
            raise ConcError('Text types are limited to Simple output')
        if self.wlnums != 'frq':
            raise ConcError('Multilevel lists are limited to Word counts frequencies')
        level = 3
        self.wlwords, self.wlcache = self.get_wl_words()
        self.blacklist, self.blcache = self.get_wl_words(('wlblacklist',
                                                          'blcache'))
        if not self.wlstruct_attr1:
            raise ConcError(_('No output attribute specified'))
        if not self.wlstruct_attr3:
            level = 2
        if not self.wlstruct_attr2:
            level = 1
        if not self.wlpat and not self.wlwords:
            raise ConcError(_('You must specify either a pattern or a file to get the multilevel wordlist'))
        self._make_wl_query()
        self.flimit = self.wlminfreq
        return self.freqml(flimit=self.wlminfreq, freqlevel=level,
                           ml1attr=self.wlstruct_attr1, ml2attr=self.wlstruct_attr2,
                           ml3attr=self.wlstruct_attr3)

    @exposed(access_level=1)
    def savewl_form(self, wlpat='', from_line=1, to_line='', wltype='simple',
                    usesubcorp='', ref_corpname='', ref_usesubcorp='',
                    saveformat='text'):
        self.disabled_menu_items = ('menu-save', )
        if to_line == '':
            to_line = 1000

        ans = {
            'from_line': from_line,
            'to_line': to_line,
        }
        if to_line == 0:
            ans['message'] = ('error', _('Empty result cannot be saved.'))
        return ans

    @exposed(access_level=1)
    def savewl(self, wlpat='', from_line=1, to_line='', wltype='simple', usesubcorp='', ref_corpname='',
               ref_usesubcorp='', saveformat='text', colheaders=0, heading=0):
        """
        save word list
        """
        from_line = int(from_line)
        to_line = int(to_line) if to_line else sys.maxint
        line_offset = (from_line - 1)
        self.wlmaxitems = sys.maxint  # TODO
        self.wlpage = 1
        ans = self.wordlist(wlpat=wlpat, wltype=wltype, usesubcorp=usesubcorp,
                            ref_corpname=ref_corpname, ref_usesubcorp=ref_usesubcorp, line_offset=line_offset)
        err = self._validate_range((from_line, to_line), (1, None))
        if err is not None:
            raise err
        ans['Items'] = ans['Items'][:(to_line - from_line + 1)]

        saved_filename = self._canonical_corpname(self.corpname)
        if saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-word-list.txt"' % saved_filename
            out_data = ans
        elif saveformat in ('csv', 'xml', 'xlsx'):
            mkfilename = lambda suffix: '%s-word-list.%s' % (self._canonical_corpname(self.corpname), suffix)
            writer = plugins.export.load_plugin(saveformat, subtype='wordlist')
            writer.set_col_types(int, unicode, float)

            self._headers['Content-Type'] = writer.content_type()
            self._headers['Content-Disposition'] = 'attachment; filename="%s"' % mkfilename(saveformat)

            # write the header first, if required
            if colheaders or heading:
                writer.writeheading(('', self.wlattr, 'freq'))
            i = 1
            for item in ans['Items']:
                writer.writerow(i, (item['str'], str(item['freq'])))
                i += 1
            out_data = writer.raw_content()
        return out_data

    @exposed()
    def wordlist_process(self, attrname=''):
        self._headers['Content-Type'] = 'text/plain'
        return corplib.build_arf_db_status(self._corp(), attrname)[1]

    def _add_text_type_hints(self, tt):
        if settings.contains('external_links', 'corpora_related'):
            hints = dict([(x[1]['key'], x[0]) for x in settings.get_full('external_links', 'corpora_related')])
            for line in tt:
                for item in line.get('Line', ()):
                    if 'label' in item and item['label'] in hints:
                        item['label_hint'] = hints[item['label']]

    def _texttypes_with_norms(self, subcorpattrs='', format_num=True, ret_nums=True):
        corp = self._corp()
        ans = {}

        def compute_norm(attrname, attr, val):
            valid = attr.str2id(export_string(unicode(val), to_encoding=self._corp().get_conf('ENCODING')))
            r = corp.filter_query(struct.attr_val(attrname, valid))
            cnt = 0
            while not r.end():
                cnt += normvals[r.peek_beg()]
                r.next()
            return cnt

        def safe_int(s):
            try:
                return int(s)
            except ValueError:
                return 0

        if not subcorpattrs:
            subcorpattrs = corp.get_conf('SUBCORPATTRS') \
                or corp.get_conf('FULLREF')
        if not subcorpattrs or subcorpattrs == '#':
            return {'message': ('error', _('No meta-information to create a subcorpus.')),
                    'Normslist': [], 'Blocks': []}

        maxlistsize = settings.get_int('global', 'max_attr_list_size')
        # if live_attributes are installed then always shrink bibliographical
        # entries even if their count is < maxlistsize
        if plugins.has_plugin('live_attributes'):
            ans['bib_attr'] = plugins.corptree.get_corpus_info(self.corpname)['metadata']['label_attr']
            list_none = (ans['bib_attr'], )
        else:
            ans['bib_attr'] = None
            list_none = ()
        tt = corplib.texttype_values(corp, subcorpattrs, maxlistsize, list_none)
        self._add_text_type_hints(tt)

        if ret_nums:
            basestructname = subcorpattrs.split('.')[0]
            struct = corp.get_struct(basestructname)
            normvals = {}
            if self.subcnorm not in ('freq', 'tokens'):
                try:
                    nas = struct.get_attr(self.subcnorm).pos2str
                except conclib.manatee.AttrNotFound, e:
                    self.error = str(e)
                    self.subcnorm = 'freq'
            if self.subcnorm == 'freq':
                normvals = dict([(struct.beg(i), 1)
                                 for i in range(struct.size())])
            elif self.subcnorm == 'tokens':
                normvals = dict([(struct.beg(i), struct.end(i) - struct.beg(i))
                                 for i in range(struct.size())])
            else:
                normvals = dict([(struct.beg(i), safe_int(nas(i)))
                                 for i in range(struct.size())])

            for item in tt:
                for col in item['Line']:
                    if 'textboxlength' in col:
                        continue
                    if not col['name'].startswith(basestructname):
                        col['textboxlength'] = 30
                        continue
                    attr = corp.get_attr(col['name'])
                    aname = col['name'].split('.')[-1]
                    for val in col['Values']:
                        if format_num:
                            val['xcnt'] = format_number(compute_norm(aname, attr, val['v']))
                        else:
                            val['xcnt'] = compute_norm(aname, attr, val['v'])
            ans['Blocks'] = tt
            ans['Normslist'] = self._get_normslist(basestructname)
            logging.getLogger(__name__).debug(ans)
        else:
            ans['Blocks'] = tt
            ans['Normslist'] = []
        return ans

    def _get_normslist(self, structname):
        corp = self._corp()
        normsliststr = corp.get_conf('DOCNORMS')
        normslist = [{'n': 'freq', 'label': _('Document counts')},
                     {'n': 'tokens', 'label': _('Tokens')}]
        if normsliststr:
            normslist += [{'n': n, 'label': corp.get_conf(structname + '.'
                                                          + n + '.LABEL') or n}
                          for n in normsliststr.split(',')]
        else:
            try:
                corp.get_attr(structname + ".wordcount")
                normslist.append({'n': 'wordcount', 'label': _('Word counts')})
            except:
                pass
        return normslist

    @exposed()
    def subcorp_form(self, subcorpattrs='', subcname='', within_condition='', within_struct='', method='gui'):
        """
        arguments:
        subcorpattrs -- ???
        within_condition -- the same meaning as in subcorp()
        within_struct -- the same meaning as in subcorp()
        method -- the same meaning as in subcorp()
        """
        self.disabled_menu_items = ('menu-save',)
        self._reset_session_conc()

        tt_sel = self._texttypes_with_norms()
        structs_and_attrs = {}
        for s, a in [t.split('.') for t in self._corp().get_conf('STRUCTATTRLIST').split(',')]:
            if not s in structs_and_attrs:
                structs_and_attrs[s] = []
            structs_and_attrs[s].append(a)

        out = {'SubcorpList': ()}
        if self.environ['REQUEST_METHOD'] == 'POST':
            out['checked_sca'] = {}
            for p in self._url_parameters:
                if p.startswith('sca_'):
                    tmp = getattr(self, p)
                    p = p[4:]
                    out['checked_sca'][p] = set()
                    if hasattr(tmp, '__iter__'):  # multi-value form items may appear here
                        out['checked_sca'][p] = out['checked_sca'][p].union(tmp)
                    else:
                        out['checked_sca'][p].add(tmp)
        if 'error' in tt_sel:
            out.update({
                'message': ('error', tt_sel['error']),
                'TextTypeSel': tt_sel,
                'structs_and_attrs': structs_and_attrs,
                'method': method,
                'within_condition': '',
                'within_struct': '',
                'subcname': ''
            })
        else:
            out.update({
                'TextTypeSel': tt_sel,
                'structs_and_attrs': structs_and_attrs,
                'method': method,
                'within_condition': within_condition,
                'within_struct': within_struct,
                'subcname': subcname
            })
        return out

    def _texttype_query(self):
        scas = [(a[4:], getattr(self, a))
                for a in dir(self) if a.startswith('sca_')]
        structs = {}
        for sa, v in scas:
            if type(v) in (type(''), type(u'')) and '|' in v:
                v = v.split('|')
            s, a = sa.split('.')
            if type(v) is type([]):
                query = '(%s)' % ' | '.join(['%s="%s"' % (a, l10n.escape(v1))
                                             for v1 in v])
            else:
                query = '%s="%s"' % (a, l10n.escape(v))
            query = export_string(query, to_encoding=self._corp().get_conf('ENCODING'))
            if s in structs:
                structs[s].append(query)
            else:
                structs[s] = [query]
        return [(sname, ' & '.join(subquery)) for
                sname, subquery in structs.items()]

    @exposed(access_level=1)
    def subcorp(self, subcname='', delete='', create=False, within_condition='', within_struct='', method=''):
        """
        arguments:
        subcname -- name of new subcorpus
        delete -- sets whether to delete existing subcorpus; any non-empty value means 'delete'
        create -- bool, sets whether to create new subcorpus
        within_condition -- custom within condition; if non-empty then clickable form is omitted
        within_struct -- a structure the within_condition will be applied to
        method -- {'raw', 'gui'} a flag indicating whether user used raw query or clickable attribute list; this is
                  actually used only to display proper user interface (i.e. not to detect which values to use when
                  creating the subcorpus)
        """
        if self.get_http_method() != 'POST':
            self.last_corpname = self.corpname
            self._save_options(['last_corpname'])
            self._redirect('%ssubcorp_form?corpname=%s' % (self.get_root_url(), self.corpname))
            return None
        if delete:
            base = os.path.join(self.subcpath[-1], self.corpname, subcname)
            for e in ('.subc', '.used'):
                if os.path.isfile((base + e).encode('utf-8')):
                    os.unlink((base + e).encode('utf-8'))

        if within_condition and within_struct:
            within_struct = export_string(within_struct, to_encoding=self._corp().get_conf('ENCODING'))
            within_condition = export_string(within_condition, to_encoding=self._corp().get_conf('ENCODING'))
            tt_query = [(within_struct, within_condition)]
        else:
            tt_query = self._texttype_query()
        basecorpname = self.corpname.split(':')[0]
        if create and not subcname:
            raise ConcError(_('No subcorpus name specified!'))
        if (not subcname or (not tt_query and delete)
                or (subcname and not delete and not create)):
            # an error => generate subc_form parameters
            subc_list = self.cm.subcorp_names(basecorpname)
            for item in subc_list:
                item['selected'] = False
            if subc_list:
                subcname = subc_list[0]['n']
                subc_list[0]['selected'] = True
                sc = self.cm.get_Corpus('%s:%s' % (basecorpname, subcname))
                corp_size = format_number(sc.size())
                subcorp_size = format_number(sc.search_size())
            else:
                subc_list = []
                corp_size = 0
                subcorp_size = 0

            return {
                'subcname': subcname,
                'corpsize': corp_size,
                'subcsize': subcorp_size,
                'SubcorpList': subc_list,
                'fetchSubcInfo': 'false'  # this is ok (it is used as a JavaScript value)
            }
        path = os.path.join(self.subcpath[-1], basecorpname)
        if not os.path.isdir(path):
            os.makedirs(path)
        path = os.path.join(path, subcname) + '.subc'
        # XXX ignoring more structures
        if not tt_query:
            raise ConcError(_('Nothing specified!'))
        structname, subquery = tt_query[0]
        if type(path) == unicode:
            path = path.encode("utf-8")
        if corplib.create_subcorpus(path, self._corp(), structname, subquery):
            if plugins.has_plugin('subc_restore'):
                try:
                    plugins.subc_restore.store_query(user_id=self._session_get('user', 'id'), corpname=self.corpname,
                                                     subcname=subcname, structname=tt_query[0][0],
                                                     condition=tt_query[0][1])
                except Exception as e:
                    logging.getLogger(__name__).warning('Failed to store subcorpus query: %s' % e)
            self._redirect('subcorp_list?corpname=%s' % self.corpname)
            return {}
        else:
            raise ConcError(_('Empty subcorpus!'))

    @exposed(access_level=1)
    def subcorp_list(self, selected_subc=(), sort='n'):
        """
        """
        self.disabled_menu_items = ('menu-view', 'menu-sort', 'menu-sample', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc', 'menu-save', 'menu-concordance')

        current_corp = self.corpname

        if self.get_http_method() == 'POST':
            base = self.subcpath[-1]
            for subcorp_id in selected_subc:
                try:
                    corp, subcorp = subcorp_id.split(':', 1)
                    sc_obj = self.cm.get_Corpus(corp, subcorp)
                    os.unlink(os.path.join(base, corp, subcorp).encode('utf-8') + '.subc')
                    if plugins.has_plugin('subc_restore'):
                        try:
                            plugins.subc_restore.delete_query(self._session_get('user', 'id'), corp, subcorp)
                        except Exception as e:
                            logging.getLogger(__name__).error('subc_restore plug-in failed to delete a query: %s' % e)
                except Exception as e:
                    logging.getLogger(__name__).error(e)

        data = []
        corplist = plugins.auth.get_corplist(self._session_get('user', 'id'))
        for corp in corplist:
            try:
                self.cm.get_Corpus(corp)
                basecorpname = corp.split(':')[0]
                for item in self.cm.subcorp_names(basecorpname):
                    sc = self.cm.get_Corpus(corp, item['n'])
                    data.append({
                        'n': '%s:%s' % (corp, item['n']),
                        'v': item['n'],
                        'size': sc.search_size(),
                        'created': sc.created,
                        'corpname': corp,
                        'usesubcorp': werkzeug.urls.url_quote_plus(item['n'])
                    })
            except Exception as e:
                logging.getLogger(__name__).warn('Failed to fetch information about subcorpus of [%s]: %s' % (corp, e))

        sort_key, rev = Kontext._parse_sorting_param(sort)
        if sort_key in ('size', 'created'):
            data = sorted(data, key=lambda x: x[sort_key], reverse=rev)
        else:
            data = l10n.sort(data, loc=self.ui_lang, key=lambda x: x[sort_key], reverse=rev)

        sort_keys = dict([(x, (x, '')) for x in ('n', 'size', 'created')])
        if not rev:
            sort_keys[sort_key] = ('-%s' % sort_key, '&#8593;')
        else:
            sort_keys[sort_key] = (sort_key, '&#8595;')

        self.cm.get_Corpus(current_corp)  # this is necessary to reset manatee module back to its original state
        return {'subcorp_list': data, 'sort_keys': sort_keys, 'rev': rev}

    @exposed(access_level=1, return_type='json')
    def ajax_subcorp_info(self, subcname=''):
        sc = self.cm.get_Corpus(self.corpname, subcname)
        return {'subCorpusName': subcname,
                'corpusSize': format_number(sc.size()),
                'subCorpusSize': format_number(sc.search_size())}

    @exposed()
    def attr_vals(self, avattr='', avpat=''):
        self._headers['Content-Type'] = 'application/json'
        return corplib.attr_vals(self.corpname, avattr, avpat)

    @exposed()
    def delsubc_form(self):
        subc = corplib.create_str_vector()
        corplib.find_subcorpora(self.subcpath[-1], subc)
        return {'Subcorplist': [{'n': c} for c in subc],
                'subcorplist_size': min(len(subc), 20)}

    @exposed(template='subcorp_form')
    def delsubc(self, subc=()):
        base = self.subcpath[-1]
        for subcorp in subc:
            cn, sn = subcorp.split(':', 1)
            try:
                os.unlink(os.path.join(base, cn, sn) + '.subc')
            except:
                pass
        return 'Done'

    @exposed(access_level=1)
    def saveconc_form(self, from_line=1, to_line=''):
        self.disabled_menu_items = ('menu-save', )
        conc = self.call_function(conclib.get_conc, (self._corp(), self.samplesize))
        if not to_line:
            to_line = conc.size()
            # TODO Save menu should be active here
        return {'from_line': from_line, 'to_line': to_line}

    @exposed(access_level=1, vars=('Desc', 'concsize'))
    def saveconc(self, saveformat='text', from_line=0, to_line='', align_kwic=0, numbering=0, leftctx='40',
                 rightctx='40'):

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
                                      fromp=fromp, pagesize=page_size, line_offset=line_offset, labelmap=labelmap,
                                      align=(), alignlist=[self.cm.get_Corpus(c) for c in self.align.split(',') if c],
                                      leftctx=leftctx, rightctx=rightctx, structs=self._get_struct_opts())

            mkfilename = lambda suffix: '%s-concordance.%s' % (self._canonical_corpname(self.corpname), suffix)
            if saveformat == 'text':
                self._headers['Content-Type'] = 'text/plain'
                self._headers['Content-Disposition'] = 'attachment; filename="%s"' % mkfilename('txt')
                output.update(data)
            elif saveformat in ('csv', 'xlsx', 'xml'):
                writer = plugins.export.load_plugin(saveformat, subtype='concordance')

                self._headers['Content-Type'] = writer.content_type()
                self._headers['Content-Disposition'] = 'attachment; filename="%s"' % mkfilename(saveformat)

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

                    aligned_corpora = [self._corp()] + [self.cm.get_Corpus(c) for c in self.align.split(',') if c]
                    writer.set_corpnames([c.get_conf('NAME') or c.get_conffile() for c in aligned_corpora])

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

    @exposed(return_type='json')
    def ajax_get_corp_details(self):
        """
        """
        corp_conf_info = plugins.corptree.get_corpus_info(self._corp().corpname)
        template_class = self._get_template_class('corpus_detail')
        template = unicode(template_class(searchList=[]))

        ans = {
            'corpname': self._canonical_corpname(self._corp().get_conf('NAME')),
            'description': self._corp().get_info(),
            'size': l10n.format_number(int(self._corp().size())),
            'attrlist': [],
            'structlist': [],
            'web_url': corp_conf_info['web'] if corp_conf_info is not None else '',
            'template': template
        }
        try:
            ans['attrlist'] = [{'name': item, 'size': l10n.format_number(int(self._corp().get_attr(item).id_range()))}
                               for item in self._corp().get_conf('ATTRLIST').split(',')]
        except RuntimeError as e:
            logging.getLogger(__name__).warn('%s' % e)
            ans['attrlist'] = [{'message': ('error', _('Failed to load'))}]
        ans['structlist'] = [{'name': item, 'size': l10n.format_number(int(self._corp().get_struct(item).size()))}
                             for item in self._corp().get_conf('STRUCTLIST').split(',')]
        return ans

    @exposed(return_type='json')
    def ajax_get_structs_details(self):
        """
        """
        ans = {}
        for item in self._corp().get_conf('STRUCTATTRLIST').split(','):
            k, v = item.split('.')
            if k not in ans:
                ans[k] = []
            ans[k].append(v)
        return ans

    @exposed(return_type='json')
    def ajax_get_tag_variants(self, pattern=''):
        """
        """
        import taghelper

        try:
            tag_loader = taghelper.TagVariantLoader(self.corpname,
                                                    plugins.corptree.get_corpus_info(self.corpname)['tagset'],
                                                    self.ui_lang)
        except IOError:
            raise UserActionException(_('Corpus %s is not supported by this widget.') % self.corpname)

        if len(pattern) > 0:
            ans = tag_loader.get_variant(pattern)
        else:
            ans = tag_loader.get_initial_values()
        return JsonEncodedData(ans)

    @exposed(template='stats.tmpl')
    def stats(self, from_date='', to_date='', min_occur=''):

        if plugins.auth.is_administrator():
            import system_stats

            data = system_stats.load(settings.get('global', 'log_path'), from_date=from_date, to_date=to_date,
                                     min_occur=min_occur)
            maxmin = {}
            for label, section in data.items():
                maxmin[label] = system_stats.get_max_min(section)

            out = {
                'stats': data,
                'minmax': maxmin,
                'from_date': from_date,
                'to_date': to_date,
                'min_occur': min_occur
            }
        else:
            out = {'message': ('error', _('You don\'t have enough privileges to see this page.'))}
        return out

    def _load_query_history(self, offset, limit, from_date, to_date, query_type, current_corpus):
        from datetime import datetime

        types = {
            'iquery': _('Basic'),
            'lemma': _('Lemma'),
            'phrase': _('Phrase'),
            'word': _('Word Form'),
            'char': _('Character'),
            'cql': 'CQL'
        }

        if plugins.has_plugin('query_storage'):
            if current_corpus:
                corpname = self.corpname
            else:
                corpname = None
            rows = plugins.query_storage.get_user_queries(self._session_get('user', 'id'), offset=offset, limit=limit,
                                                          query_type=query_type, corpname=corpname,
                                                          from_date=from_date, to_date=to_date)
            for row in rows:
                created_dt = datetime.fromtimestamp(row['created'])
                row['humanCorpname'] = self._canonical_corpname(row['corpname'])
                row['created'] = (created_dt.strftime(l10n.date_formatting()),
                                  created_dt.strftime(l10n.time_formatting()))
                row['query_type_translated'] = types.get(row['query_type'], '?')
        else:
            rows = ()
        return rows

    @exposed(access_level=1)
    def query_history(self, offset=0, limit=100, from_date='', to_date='', query_type='', current_corpus=''):
        self.disabled_menu_items = ('menu-view', 'menu-sort', 'menu-sample',
                                    'menu-save', 'menu-concordance', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-view')
        self._reset_session_conc()  # TODO in case user returns using back button, this may produce UX problems
        num_records = int(settings.get('plugins', 'query_storage').get('ucnk:page_num_records', 0))

        if not offset:
            offset = 0
        if not limit:
            limit = 0
        rows = self._load_query_history(from_date=from_date, query_type=query_type, current_corpus=current_corpus,
                                        to_date=to_date, offset=offset, limit=num_records)
        return {
            'data': rows,
            'from_date': from_date,
            'to_date': to_date,
            'offset': offset,
            'limit': limit,
            'page_num_records': num_records,
            'page_append_records': settings.get('plugins', 'query_storage').get('ucnk:page_append_records', 0)
        }

    @exposed(access_level=1, return_type='json')
    def ajax_query_history(self, current_corpus='', offset=0, limit=20, query_type=''):
        if not offset:
            offset = 0
        if not limit:
            limit = 0
        rows = self._load_query_history(offset=offset, limit=limit, query_type=query_type,
                                        current_corpus=current_corpus, from_date=None, to_date=None)
        return {
            'data': rows,
            'from_date': None,
            'to_date': None,
            'offset': offset,
            'limit': limit
        }

    @exposed(access_level=0)
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

    @exposed(return_type='json')
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

            ans = plugins.live_attributes.get_attr_values(self._corp(), attrs, aligned)
            return ans
        else:
            return {}

    @exposed(return_type='json')
    def bibliography(self, id=''):
        bib_data = plugins.live_attributes.get_bibliography(self._corp(), item_id=id)
        return {'bib_data': bib_data}

    @exposed(return_type='html', template='empty.tmpl')
    def ajax_get_toolbar(self):
        html = plugins.application_bar.get_contents(cookies=self._cookies,
                                                    curr_lang=self.ui_lang,
                                                    return_url=self.return_url,
                                                    use_fallback=False,
                                                    timeout=20)
        return {'html': html}

    @exposed(return_type='json')
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
            'id' : q_id,
            'next_url' : 'view?%s' % '&'.join(['%s=%s' % (k, urllib.quote(v.encode('utf-8'))) for k, v in params.items()])
        }