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
import locale
import csv
import time

import conccgi
from conccgi import ConcCGI, ConcError
from CGIPublisher import JsonEncodedData, UserActionException
import settings
import conclib
import corplib
import plugins
import butils

try:
    _
except NameError:
    _ = lambda s: s


class Actions(ConcCGI):

    FREQ_FIGURES = {'docf': _('Document counts'), 'frq': _('Word counts'), 'arf': _('ARF')}

    def __init__(self, environ):
        super(Actions, self).__init__(environ=environ)
        self.contains_within = False
        self.disabled_menu_items = ()

    def user_password_form(self):
        if not settings.supports_password_change():
            return {'message': ('error', _('This function is disabled.'))}
        return {}

    user_password_form.access_level = 1
    user_password_form.template = 'user_password_form.tmpl'

    def user_password(self, curr_passwd='', new_passwd='', new_passwd2=''):
        if not settings.supports_password_change():
            return {'message': ('error', _('This function is disabled.'))}
        logged_in = settings.auth.validate_user(self._user, curr_passwd)
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
        self._redirect(settings.get_root_url())

    user_password.access_level = 1
    user_password.template = 'user_password.tmpl'

    def login(self):
        self.disabled_menu_items = ('menu-new-query', 'menu-word-list', 'menu-view', 'menu-sort', 'menu-sample',
                                    'menu-save', 'menu-subcorpus', 'menu-concordance', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc')
        return {}

    def loginx(self, username='', password=''):
        ans = {}
        user = plugins.auth.validate_user(username, password)
        if user.get('id', None) is not None:
            self._session['user'] = user
            parts = self.environ.data['REQUEST_URI'].split("redirectTo=")
            if len(parts) == 2:
                redirect = parts[1]
            else:
                redirect = '%sfirst_form' % (settings.get_root_url(), )

            self._redirect(redirect)
        else:
            self.disabled_menu_items = ('menu-new-query', 'menu-word-list', 'menu-view', 'menu-sort', 'menu-sample',
                                        'menu-save', 'menu-subcorpus', 'menu-concordance', 'menu-filter',
                                        'menu-frequency',
                                        'menu-collocations', 'menu-conc-desc')
            ans['message'] = ('error', _('Incorrect username or password'))
        return ans

    loginx.template = 'login.tmpl'

    def logoutx(self):
        self.disabled_menu_items = ('menu-new-query', 'menu-word-list', 'menu-view', 'menu-sort', 'menu-sample',
                                    'menu-save', 'menu-subcorpus', 'menu-concordance', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc')
        plugins.auth.logout(self._get_session_id())
        self._session = {
            'user': plugins.auth.anonymous_user()  # just to keep rendering ok
        }
        self._user = None
        self._anonymous = 1
        try:
            if plugins.auth.uses_aai():
                self._redirect('%sfirst_form' % (settings.get_root_url(), ))
        except AttributeError:
            pass
        return {
            'message': ('info', _('You have been logged out'))
        }

    logoutx.access_level = 1
    logoutx.template = 'login.tmpl'

    def view(self, view_params={}):
        """
        kwic view

        Parameters
        ----------

        view_params : dict
            parameter_name->value pairs with the highest priority (i.e. it overrides any url/cookie-based values)
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
            # GDEX changing and turning on and off
        if self.gdex_enabled and self.gdexcnt:
            gdex_set = 0
            for i in range(1, len(self.q)):
                # 's*' is old gdex call, should be deleted in mid 2011
                if self.q[i].startswith('s*') or self.q[i][0] == 'e':
                    self.q[i] = 'e%s %s' % (str(self.gdexcnt), self.gdexconf)
                    gdex_set = 1
            if not gdex_set:
                self.q.append('e%s %s' % (str(self.gdexcnt), self.gdexconf))
        else:
            i = 0
            while i < len(self.q):
                if self.q[i].startswith('s*') or self.q[i][0] == 'e':
                    del self.q[i]
                i += 1
        conc = self.call_function(conclib.get_conc, (self._corp(),))
        conc.switch_aligned(os.path.basename(self.corpname))
        labelmap = {}

        out = self.call_function(conclib.kwicpage, ((self._corp(), self.corpname), conc, self._get_speech_segment()),
                                 labelmap=labelmap,
                                 alignlist=[self.cm.get_Corpus(c)
                                            for c in self.align.split(',') if c],
                                 copy_icon=self.copy_icon,
                                 tbl_template=self.tbl_template)

        out['Sort_idx'] = self.call_function(conclib.get_sort_idx, (conc,),
                                             enc=self.self_encoding())
        out['result_shuffled'] = not conclib.conc_is_sorted(self.q)

        out.update(self.get_conc_sizes(conc))
        if self.viewmode == 'sen':
            conclib.add_block_items(out['Lines'], block_size=1)
        if self._corp().get_conf('ALIGNED'):
            out['Aligned'] = [{'n': w,
                               'label': conclib.manatee.Corpus(w).get_conf(
                                   'NAME') or w}
                              for w in self._corp().get_conf('ALIGNED').split(',')]
        if self.align and not self.maincorp:
            self.maincorp = os.path.basename(self.corpname)
        if len(out['Lines']) == 0:
            out['message'] = ('info', _('Empty result'))
            out['next_url'] = '%sfirst_form' % settings.get_root_url()

        params = 'pagesize=%s&leftctx=%s&rightctx=%s&saveformat=%s&heading=%s' \
                 '&numbering=%s&align_kwic=%s&from_line=%s&to_line=%s' \
                 % (self.pagesize, self.leftctx, self.rightctx, '%s', self.heading, self.numbering,
                    self.align_kwic, 1, conc.size())
        self._add_save_menu_item('CSV', 'saveconc', params % 'csv')
        self._add_save_menu_item('XML', 'saveconc', params % 'xml')
        self._add_save_menu_item('TXT', 'saveconc', params % 'text')
        self._add_save_menu_item('%s...' % _('Custom'), 'saveconc_form', 'leftctx=%s&rightctx=%s' % (self.leftctx,
                                                                                                     self.rightctx))

        self._store_conc_results({
            'sampled_size': out.get('sampled_size', None),
            'fullsize': out.get('fullsize', None),
            'concsize': out.get('concsize', None),
            'result_relative_freq': out.get('result_relative_freq', None),
            'result_relative_freq_rel_to': out.get('result_relative_freq_rel_to', None),
            'result_arf': out.get('result_arf', None),
            'result_shuffled': out.get('result_shuffled', False)
        })
        self._save_query()
        return out

    ConcCGI.add_vars['view'] = ['orig_query']

    def first_form(self):
        self.disabled_menu_items = ('menu-view', 'menu-sort', 'menu-sample', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-conc-desc', 'menu-save', 'menu-concordance')
        out = {}
        self._reset_session_conc()
        out.update(self._restore_query_selector_types())
        if self._corp().get_conf('ALIGNED'):
            out['Aligned'] = []
            for al in self._corp().get_conf('ALIGNED').split(','):
                if plugins.has_plugin('corptree'):
                    keyboard_lang = plugins.corptree.get_corpus_info(al)['keyboard_lang']
                else:
                    keyboard_lang
                alcorp = conclib.manatee.Corpus(al)
                out['Aligned'].append({'label': alcorp.get_conf('NAME') or al,
                                       'n': al, 'keyboard_lang': keyboard_lang or ''})
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
        if plugins.has_plugin('corptree'):
            keyboard_lang = plugins.corptree.get_corpus_info(self.corpname)['keyboard_lang']
        else:
            keyboard_lang
        out['keyboard_lang'] = keyboard_lang or ''
        self._enable_subcorpora_list(out)
        self.last_corpname = self.corpname
        self._save_options(['last_corpname'])
        return out

    ConcCGI.add_vars['first_form'] = ['TextTypeSel', 'LastSubcorp']

    def get_cached_conc_sizes(self):
        self._headers['Content-Type'] = 'text/plain; charset=utf-8'
        cs = self.call_function(conclib.get_cached_conc_sizes, (self._corp(),))

        return {
            'finished': int(cs["finished"]),
            'concsize': cs["concsize"],
            'relconcsize': cs["relconcsize"],
            'fullsize': cs["fullsize"],
            'thousandsSeparator': u'%s' % locale.localeconv()['thousands_sep'].decode('utf-8'),
            'radixSeparator': u'%s' % locale.localeconv()['decimal_point'].decode('utf-8')
        }

    get_cached_conc_sizes.return_type = 'json'

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

        conc_desc = conclib.get_conc_desc(self.q, corpname=self.corpname, cache_dir=self.cache_dir,
                                          subchash=getattr(self._corp(), "subchash", None))

        out['Desc'] = []
        for o, a, u1, u2, s in conc_desc:
            u2.append(('corpname', self.corpname))
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
            'export_url': '%sto?q=%s' % (settings.get_root_url(), query_id),
            'is_public': is_public
        })
        return out

    def concdesc_json(self, query_id=''):
        return self.concdesc(query_id)

    concdesc_json.return_type = 'json'

    def viewattrs(self):
        """
        attrs, refs, structs form
        """
        from tbl_settings import tbl_labels

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
        reflist = self.refs.split(',')
        ref_is_allowed = lambda r: r and r not in (
            '#', plugins.corptree.get_corpus_info(self.corpname).get('speech_segment'))
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
        out['Availgdexconfs'] = self.cm.gdexdict.keys()
        out['tbl_labels'] = tbl_labels
        return out

    viewattrs.access_level = 1
    ConcCGI.add_vars['viewattrs'] = ['concsize']

    def _set_new_viewopts(self, newctxsize='', gdexcnt=0, gdexconf='', refs_up='', ctxunit=''):
        self.gdexcnt = gdexcnt
        self.gdexconf = gdexconf

        if ctxunit == '@pos':
            ctxunit = ''
        if "%s%s" % (newctxsize, ctxunit) != self.kwicrightctx:
            if not newctxsize.isdigit():
                self.exceptmethod = 'viewattrs'
                raise Exception(
                    _('Value [%s] cannot be used as a context width. Please use numbers 0,1,2,...') % newctxsize)
            self.kwicleftctx = '-%s%s' % (newctxsize, ctxunit)
            self.kwicrightctx = '%s%s' % (newctxsize, ctxunit)

    def _set_new_viewattrs(self, setattrs=[], allpos='', setstructs=[], setrefs=[]):
        self.attrs = ','.join(setattrs)
        self.structs = ','.join(setstructs)
        self.refs = ','.join(setrefs)
        self.attr_allpos = allpos
        if allpos == 'all':
            self.ctxattrs = self.attrs
        else:
            self.ctxattrs = 'word'

    def viewattrsx(self, setattrs=[], allpos='', setstructs=[], setrefs=[], shuffle=0):
        self._set_new_viewattrs(setattrs=setattrs, allpos=allpos, setstructs=setstructs, setrefs=setrefs)
        self._save_options(['attrs', 'ctxattrs', 'structs', 'refs', 'pagesize'], self.corpname)
        # TODO refs_up ???
        return self.view()

    viewattrsx.access_level = 1
    viewattrsx.template = 'view.tmpl'

    def viewopts(self):
        from tbl_settings import tbl_labels

        self.disabled_menu_items = ('menu-save', )
        out = {
            'newctxsize': self.kwicleftctx[1:],
            'tbl_labels': tbl_labels
        }
        return out

    viewopts.access_level = 1

    def viewoptsx(self, newctxsize='', gdexcnt=0, gdexconf='', ctxunit='', refs_up='', shuffle=0):
        # TODO pagesize?
        self._set_new_viewopts(newctxsize=newctxsize, gdexcnt=gdexcnt, gdexconf=gdexconf, refs_up=refs_up,
                               ctxunit=ctxunit)
        self._save_options(['pagesize', 'copy_icon', 'gdex_enabled', 'gdexcnt', 'gdexconf', 'kwicleftctx',
                            'kwicrightctx', 'multiple_copy', 'tbl_template', 'ctxunit', 'refs_up', 'shuffle'])
        return self.view()

    viewoptsx.access_level = 1
    viewoptsx.template = 'view.tmpl'

    def sort(self):
        """
        sort concordance form
        """
        self.disabled_menu_items = ('menu-save',)
        return {'Pos_ctxs': conclib.pos_ctxs(1, 1)}

    sort.access_level = 1
    ConcCGI.add_vars['sort'] = ['concsize']

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

    sortx.access_level = 1
    sortx.template = 'view.tmpl'

    def mlsortx(self,
                ml1attr='word', ml1pos=1, ml1icase='', ml1bward='', ml1fcode='rc',
                ml2attr='word', ml2pos=1, ml2icase='', ml2bward='', ml2fcode='rc',
                ml3attr='word', ml3pos=1, ml3icase='', ml3bward='', ml3fcode='rc',
                sortlevel=1, ml1ctx='', ml2ctx='', ml3ctx=''):
        "multiple level sort concordance"

        crit = conccgi.onelevelcrit('s', ml1attr, ml1ctx, ml1pos, ml1fcode,
                                    ml1icase, ml1bward)
        if sortlevel > 1:
            crit += conccgi.onelevelcrit(' ', ml2attr, ml2ctx, ml2pos, ml2fcode,
                                         ml2icase, ml2bward)
            if sortlevel > 2:
                crit += conccgi.onelevelcrit(' ', ml3attr, ml3ctx, ml3pos, ml3fcode,
                                             ml3icase, ml3bward)

        self.q.append(crit)
        return self.view()

    mlsortx.access_level = 1
    mlsortx.template = 'view.tmpl'

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
                return ''.join([qitem % {'q': conccgi.escape(q)}
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

                return ''.join([split_tridash(conccgi.escape(q), qitem)
                                for q in iquery.split()])

        if queryselector == 'lemmarow':
            if not lpos:
                return '[lemma="%s"]' % lemma
            if 'lempos' in attrlist:
                try:
                    if not lpos in lposlist.values():
                        lpos = lposlist[lpos]
                except KeyError:
                    raise ConcError(_('Undefined lemma PoS') + ' "%s"' % lpos)
                return '[lempos="%s%s"]' % (lemma, lpos)
            else: # XXX
                try:
                    if lpos in wposlist.values():
                        wpos = lpos
                    else:
                        wpos = wposlist[lpos]
                except KeyError:
                    raise ConcError(_('Undefined word form PoS')
                                    + ' "%s"' % lpos)
                return '[lemma="%s" & tag="%s"]' % (lemma, wpos)
        if queryselector == 'phraserow':
            return '"' + '" "'.join(phrase.split()) + '"'
        if queryselector == 'wordrow':
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
        if queryselector == 'charrow':
            if not char:
                raise ConcError(_('No char entered'))
            return '[word=".*%s.*"]' % char
        elif queryselector == 'tagrow':
            return '[tag="%s"]' % self.tag
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

    query.template = 'view.tmpl'

    def _set_first_query(self, fc_lemword_window_type='',
                         fc_lemword_wsize=0,
                         fc_lemword_type='',
                         fc_lemword='',
                         fc_pos_window_type='',
                         fc_pos_wsize=0,
                         fc_pos_type='',
                         fc_pos=[]):
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
            self.default_attr = 'word' # XXX to be removed with new first form
        if self.default_attr:
            qbase = 'a%s,' % self.default_attr
        else:
            qbase = 'q'
        texttypes = self._texttype_query()
        if texttypes:
            ttquery = ' '.join(['within <%s %s />' % nq for nq in texttypes])
        else:
            ttquery = ''
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

    def first(self, fc_lemword_window_type='',
              fc_lemword_wsize=0,
              fc_lemword_type='',
              fc_lemword='',
              fc_pos_window_type='',
              fc_pos_wsize=0,
              fc_pos_type='',
              fc_pos=[]):

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
        self._store_query_selector_types()
        return self.view()

    first.template = 'view.tmpl'
    ConcCGI.add_vars['first'] = ['TextTypeSel', 'LastSubcorp']

    def filter_form(self, within=0):
        self.disabled_menu_items = ('menu-save',)

        self.lemma = ''
        self.lpos = ''
        out = {'within': within}
        if within and not self.error:
            out['message'] = ('error', _('Please specify positive filter to switch'))
        self._attach_tag_builder(out)
        return out

    filter_form.access_level = 1
    ConcCGI.add_vars['filter_form'] = ['TextTypeSel', 'LastSubcorp', 'concsize']

    def filter(self, pnfilter='', filfl='f', filfpos='-5', filtpos='5',
               inclkwic=False, within=0):
        """
        Positive/Negative filter
        """
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

    filter.access_level = 1
    filter.template = 'view.tmpl'
    ConcCGI.add_vars['filter'] = ['orig_query']

    def reduce_form(self):
        """
        """
        self.disabled_menu_items = ('menu-save',)
        return {}

    def reduce(self, rlines='250'):
        """
        random sample
        """
        self.q.append('r' + rlines)
        return self.view()

    ConcCGI.add_vars['reduce'] = ['concsize']
    reduce.access_level = 1
    reduce.template = 'view.tmpl'

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

    freq.access_level = 1
    ConcCGI.add_vars['freq'] = ['concsize']
    fcrit = []

    def freqs(self, fcrit=[], flimit=0, freq_sort='', ml=0, line_offset=0):
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
                    if not item['freq']: continue
                    if not '.' in attr:
                        if attr in self._corp().get_conf('ATTRLIST').split(','):
                            wwords = item['Word'][level]['n'].split('  ')  # two spaces
                            fquery = '%s %s 0 ' % (begin, end)
                            fquery += ''.join(['[%s="%s%s"]'
                                               % (attr, icase, conccgi.escape(w)) for w in wwords])
                        else:  # structure number
                            fquery = '0 0 1 [] within <%s #%s/>' % \
                                     (attr, item['Word'][0]['n'].split('#')[1])
                    else:  # text types
                        structname, attrname = attr.split('.')
                        if self._corp().get_conf(structname + '.NESTED'):
                            block['unprecise'] = True
                        fquery = '0 0 1 [] within <%s %s="%s" />' \
                                 % (structname, attrname,
                                    conccgi.escape(item['Word'][0]['n']))
                    if not item['freq']: continue
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
            elif curr_fcrit.split()[0] == 'corr.typfe':
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

    freqs.access_level = 1
    ConcCGI.add_vars['savefreq_form'] = ['concsize']

    def savefreq_form(self, fcrit=[], flimit=0, freq_sort='', ml=0, saveformat='text', from_line=1, to_line=''):
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

    savefreq_form.access_level = 1

    def savefreq(self, fcrit=[], flimit=0, freq_sort='', ml=0,
                 saveformat='text', from_line=1, to_line='', colheaders=0):
        """
        save a frequency list
        """
        from_line = int(from_line)
        if not to_line:
            to_line = sys.maxint
        else:
            to_line = int(to_line)

        err = conccgi.validate_range((from_line, to_line), (1, None))
        if err is not None:
            raise err

        self.fpage = 1
        self.fmaxitems = to_line - from_line + 1
        self.wlwords, self.wlcache = self.get_wl_words()
        self.blacklist, self.blcache = self.get_wl_words(('wlblacklist',
                                                          'blcache'))
        if self.wlattr:
            self.make_wl_query()  # multilevel wordlist

        result = self.freqs(fcrit, flimit, freq_sort, ml)  # this piece of sh.. has hidden parameter dependencies
        saved_filename = self._canonical_corpname(self.corpname)
        if saveformat == 'xml':
            self._headers['Content-Type'] = 'text/xml; charset=utf-8'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-frequencies.xml"' % saved_filename
            for b in result['Blocks']:
                b['blockname'] = b['Head'][0]['n']
            tpl_data = result
        elif saveformat == 'text':
            self._headers['Content-Type'] = 'text/plain; charset=utf-8/'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-frequencies.txt"' % saved_filename
            tpl_data = result
        elif saveformat == 'csv':
            from butils import UnicodeCSVWriter, Writeable
            from codecs import BOM_UTF8

            self._headers['Content-Type'] = 'text/csv'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-frequencies.csv"' % saved_filename

            csv_buff = Writeable()
            csv_writer = UnicodeCSVWriter(csv_buff, delimiter=';', quotechar='"', quoting=csv.QUOTE_ALL)

            for block in result['Blocks']:
                # write the header first, if required
                if colheaders:
                    csv_writer.writerow([item['n'] for item in block['Head'][:-2]] + ['freq', 'freq [%]'])
                    # then write the data (first block only)
                for item in block['Items']:
                    csv_writer.writerow([w['n'] for w in item['Word']] + [str(item['freq']), str(item.get('rel', ''))])
                csv_writer.writerow('')

            tpl_data = {
                'csv_rows': [row.decode('utf-8') for row in csv_buff.rows],
                'bom_prefix': BOM_UTF8.decode('utf-8')
            }
        return tpl_data

    savefreq.access_level = 1
    ConcCGI.add_vars['savefreq'] = ['Desc']

    def freqml(self, flimit=0, freqlevel=1, **kwargs):
        """
        multilevel frequency list
        """
        fcrit = ' '.join([conccgi.onelevelcrit('', kwargs.get('ml%dattr' % i, 'word'),
                                               kwargs.get('ml%dctx' % i, 0), kwargs.get('ml%dpos' % i, 1),
                                               kwargs.get('ml%dfcode' % i, 'rc'), kwargs.get('ml%dicase' % i, ''), 'e')
                          for i in range(1, freqlevel + 1)])
        result = self.freqs([fcrit], flimit, '', 1)
        result['ml'] = 1
        self._session['last_freq_level'] = freqlevel
        return result

    freqml.access_level = 1
    freqml.template = 'freqs.tmpl'
    freqml.accept_kwargs = True

    def freqtt(self, flimit=0, fttattr=[]):
        if not fttattr:
            self.exceptmethod = 'freq'
            raise ConcError(_('No text type selected'))
        return self.freqs(['%s 0' % a for a in fttattr], flimit)

    freqtt.access_level = 1
    freqtt.template = 'freqs.tmpl'

    cattr = 'word'
    csortfn = 'd'
    cbgrfns = 'mtd'
    cfromw = -5
    ctow = 5
    cminfreq = 5
    cminbgr = 3
    citemsperpage = 50

    def coll(self):
        """
        collocations form
        """
        self.disabled_menu_items = ('menu-save', )
        if self.maincorp:
            corp = conclib.manatee.Corpus(self.maincorp)
        else:
            corp = self._corp()
        colllist = corp.get_conf('ATTRLIST').split(',')
        out = {'Coll_attrlist': [{'n': n,
                                  'label': corp.get_conf(n + '.LABEL') or n}
                                 for n in colllist],
               'Pos_ctxs': conclib.pos_ctxs(1, 1)}
        return out

    coll.access_level = 1
    ConcCGI.add_vars['coll'] = ['concsize']

    def collx(self, csortfn='d', cbgrfns=['t', 'm', 'd'], line_offset=0, num_lines=None):
        """
        list collocations
        """
        self.cbgrfns = ''.join(cbgrfns)
        self._save_options(['cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr',
                            'collpage', 'citemsperpage', 'cbgrfns', 'csortfn'], self.corpname)

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
            item["pfilter"] = 'q=' + self.urlencode(item["pfilter"])
            item["nfilter"] = 'q=' + self.urlencode(item["nfilter"])
        result['cmaxitems'] = 10000
        result['to_line'] = 10000  # TODO
        return result

    collx.access_level = 1
    ConcCGI.add_vars['collx'] = ['concsize']

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

    savecoll_form.access_level = 1

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
        err = conccgi.validate_range((from_line, to_line), (1, None))
        if err is not None:
            raise err

        self.collpage = 1
        self.citemsperpage = sys.maxint
        result = self.collx(csortfn, cbgrfns, line_offset=(from_line - 1), num_lines=num_lines)
        saved_filename = self._canonical_corpname(self.corpname)
        if saveformat == 'xml':
            self._headers['Content-Type'] = 'text/xml; charset=utf-8'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-collocations.xml"' % saved_filename
            result['Scores'] = result['Head'][2:]
            tpl_data = result
        elif saveformat == 'text':
            self._headers['Content-Type'] = 'text/plain; charset=utf-8/'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-collocations.txt"' % saved_filename
            tpl_data = result
        elif saveformat == 'csv':
            from butils import UnicodeCSVWriter, Writeable
            from codecs import BOM_UTF8

            csv_buff = Writeable()
            csv_writer = UnicodeCSVWriter(csv_buff, delimiter=';', quotechar='"', quoting=csv.QUOTE_ALL)
            self._headers['Content-Type'] = 'text/csv'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-collocations.csv' % saved_filename

            # write the header first, if required
            if colheaders:
                csv_writer.writerow([item['n'] for item in result['Head']])
                # then write the data
            for item in result['Items']:
                csv_writer.writerow(
                    (item['str'], str(item['freq'])) + tuple([str(stat['s']) for stat in item['Stats']]))

            tpl_data = {
                'data': [row.decode('utf-8') for row in csv_buff.rows],
                'bom_prefix': BOM_UTF8.decode('utf-8')
            }
        return tpl_data

    savecoll.access_level = 1
    ConcCGI.add_vars['savecoll'] = ['Desc', 'concsize']

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

    structctx.access_level = 1
    structctx.template = 'widectx.tmpl'

    def widectx(self, pos=0):
        """
        display a hit in a wider context
        """
        data = self.call_function(conclib.get_detail_context, (self._corp(), pos))
        data['allow_left_expand'] = int(getattr(self, 'detail_left_ctx', 0)) < int(data['maxdetail'])
        data['allow_right_expand'] = int(getattr(self, 'detail_right_ctx', 0)) < int(data['maxdetail'])
        return data

    widectx.access_level = 0

    def widectx_raw(self, pos=0):
        data = conclib.get_detail_context(self._corp(), pos)
        return data

    widectx_raw.access_level = 0
    widectx_raw.return_type = 'json'

    def fullref(self, pos=0):
        """
        display a full reference
        """
        return self.call_function(conclib.get_full_ref, (self._corp(), pos))

    fullref.access_level = 0
    fullref.return_type = 'json'

    def draw_graph(self, fcrit='', flimit=0):
        """
        draw frequency distribution graph
        """
        self._headers['Content-Type'] = 'image/png'
        self.fcrit = fcrit
        conc = self.call_function(conclib.get_conc, (self._corp(),))
        #        print 'Content-Type: text/html; charset=iso-8859-2\n'
        return self.call_function(conc.graph_dist, (fcrit, flimit))

    def clear_cache(self, corpname=''):
        if not corpname:
            corpname = self.corpname
        os.system('rm -rf %s/%s' % (self.cache_dir, corpname))
        return 'Done: rm -rf %s/%s' % (self.cache_dir, corpname)

    def build_arf_db(self, corpname='', attrname=''):
        if os.path.isfile(corplib.wordcount_precalc_path(self._corp(), attrname) + '.arf'):
            return 'Finished'
        out = corplib.build_arf_db(self._corp(), attrname)
        if out:
            return {'processing': out[1].strip('%')}
        else:
            return {'processing': 0}

    build_arf_db.template = 'wordlist.tmpl'

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

    def kill_histogram_processing(self):
        import glob

        pid = self.check_histogram_processing().split(':')[0]
        if pid:
            try:
                os.kill(int(pid), 9)
                os.remove(os.path.join(self._tmp_dir, 'findx_upload.%s' % self._user))
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

    kill_histogram_processing.template = 'findx_upload_form.tmpl'
    ConcCGI.add_vars['kill_histogram_processing'] = ['LastSubcorp']

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

    wlminfreq = 5
    wlmaxitems = 100
    wlicase = 0
    wlwords = []
    blacklist = []

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
        self._enable_subcorpora_list(out)
        return out

    wordlist_form.access_level = 1
    ConcCGI.add_vars['wordlist_form'] = ['LastSubcorp']

    def findx_upload_form(self):
        return {
            'processing': self.check_histogram_processing().split(':')[1]
        }

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

    include_nonwords = 0
    wltype = 'simple'
    wlnums = 'frq'

    def wordlist(self, wlpat='', wltype='simple', corpname='', usesubcorp='',
                 ref_corpname='', ref_usesubcorp='', wlpage=1, line_offset=0):
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
        if self._anonymous and wlpage >= 10:  # limit paged lists
            wlpage = 10
            self.wlpage = 10
            lastpage = 1
        elif self._anonymous and self.wlmaxitems > 1000:  # limit saved lists
            wlpage = 1
            self.wlpage = 1
            self.wlmaxitems = 1000
        wlstart = (wlpage - 1) * self.wlmaxitems + line_offset

        self.wlmaxitems = self.wlmaxitems * wlpage + 1  # +1 = end detection
        result = {
            'reload_url': ('wordlist?wlattr=%s&corpname=%s&usesubcorp=%s&wlpat=%s&wlminfreq=%s'
                           + '&include_nonwords=%s&wlsort=f&wlnums=%s') % (self.wlattr, self.corpname, self.usesubcorp,
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
                if self.wlattr == 'ws_collocations':
                    kw_func = getattr(corplib, 'ws_keywords')
                else:
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
                if self.wlattr == 'ws_collocations':
                    result.update({'Items': self.call_function(corplib.ws_wordlist,
                                                               (self._corp(),))[wlstart:]})
                else:
                    if hasattr(self, 'wlfile') and self.wlpat == '.*':
                        self.wlsort = ''
                    result.update({'Items': self.call_function(corplib.wordlist,
                                                               (self._corp(), self.wlwords))[wlstart:]})
                    if self.wlwords:
                        result['wlcache'] = self.wlcache
                    if self.blacklist:
                        result['blcache'] = self.blcache
                result_list = result['Items']
            if len(result_list) < self.wlmaxitems / wlpage:
                result['lastpage'] = 1
            else:
                result['lastpage'] = 0
                result_list = result_list[:-1]
            self.wlmaxitems -= 1
            if '.' in self.wlattr:
                self.wlnums = orig_wlnums
            try:
                result['wlattr_label'] = self._corp().get_conf(
                    self.wlattr + '.LABEL') or self.wlattr
            except Exception:
                result['wlattr_label'] = self.wlattr

            result['freq_figure'] = self.FREQ_FIGURES.get(self.wlnums, '?')

            params = 'saveformat=%%s&wlattr=%s&colheaders=0&ref_usesubcorp=&wltype=simple&wlpat=%s&wlminfreq=%s&from_line=1&to_line=' \
                     % (self.wlattr, wlpat, self.wlminfreq)
            self._add_save_menu_item('CSV', 'savewl', params % 'csv')
            self._add_save_menu_item('XML', 'savewl', params % 'xml')
            self._add_save_menu_item('TXT', 'savewl', params % 'text')
            # custom save is solved in templates because of compatibility issues
            self.last_corpname = self.corpname
            self._save_options(['last_corpname'])
        except corplib.MissingSubCorpFreqFile as e:
            self.wlmaxitems -= 1
            # Beware - many potential errors arise in the forked process created in corplib.build_arf_db.
            # But the original Bonito2 code does not include any shared state with ability to express all the required
            # situations. It writes the string "100%" to the shared log file without hesitation even if the action
            # completely failed. Enjoy!
            out = corplib.build_arf_db(e.corp, self.wlattr)
            if out:
                processing = out[1].strip('%')
            else:
                processing = '0'
            result.update({'processing': processing == '100' and '99' or processing})
        return result

    wordlist.access_level = 1

    wlstruct_attr1 = ''
    wlstruct_attr2 = ''
    wlstruct_attr3 = ''

    def make_wl_query(self):
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

    def struct_wordlist(self):
        self.exceptmethod = 'wordlist_form'
        if self.fcrit:
            self.wlwords, self.wlcache = self.get_wl_words()
            self.blacklist, self.blcache = self.get_wl_words(('wlblacklist',
                                                              'blcache'))
            self.make_wl_query()
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
        self.make_wl_query()
        self.flimit = self.wlminfreq
        return self.freqml(flimit=self.wlminfreq, freqlevel=level,
                           ml1attr=self.wlstruct_attr1, ml2attr=self.wlstruct_attr2,
                           ml3attr=self.wlstruct_attr3)

    struct_wordlist.template = 'freqs.tmpl'

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

    savewl_form.access_level = 1

    def savewl(self, wlpat='', from_line=1, to_line='', wltype='simple', usesubcorp='', ref_corpname='',
               ref_usesubcorp='', saveformat='text', colheaders=0):
        """
        save word list
        """
        from_line = int(from_line)
        to_line = int(to_line) if to_line else sys.maxint
        line_offset = (from_line - 1)
        self.wlmaxitems = sys.maxint  # TODO
        ans = self.wordlist(wlpat, wltype, self.corpname, usesubcorp,
                            ref_corpname, ref_usesubcorp, wlpage=1, line_offset=line_offset)
        err = conccgi.validate_range((from_line, to_line), (1, None))
        if err is not None:
            raise err
        ans['Items'] = ans['Items'][:(to_line - from_line + 1)]

        saved_filename = self._canonical_corpname(self.corpname)
        if saveformat == 'xml':
            self._headers['Content-Type'] = 'text/xml; charset=utf-8'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-word-list.xml"' % saved_filename
            tpl_data = ans
        elif saveformat == 'text':
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-word-list.txt"' % saved_filename
            tpl_data = ans
        elif saveformat == 'csv':
            from butils import UnicodeCSVWriter, Writeable
            from codecs import BOM_UTF8

            csv_buff = Writeable()
            csv_writer = UnicodeCSVWriter(csv_buff, delimiter=';', quotechar='"', quoting=csv.QUOTE_ALL)
            # write the header first, if required
            if colheaders:
                csv_writer.writerow((self.wlattr, 'freq'))
                # then write the data
            for item in ans['Items']:
                csv_writer.writerow((item['str'], str(item['freq'])))
            tpl_data = {
                'data': [row.decode('utf-8') for row in csv_buff.rows],
                'bom_prefix': BOM_UTF8.decode('utf-8')
            }
            self._headers['Content-Type'] = 'text/csv'
            self._headers['Content-Disposition'] = 'attachment; filename="%s-word-list.csv"' % saved_filename

        return tpl_data

    savewl.access_level = 1

    def wordlist_process(self, attrname=''):
        self._headers['Content-Type'] = 'text/plain; charset=utf-8'
        return corplib.build_arf_db_status(self._corp(), attrname)[1]

    subcnorm = 'tokens'

    def texttypes_with_norms(self, subcorpattrs='', list_all=False,
                             format_num=True, ret_nums=True):
        corp = self._corp()
        if not subcorpattrs:
            subcorpattrs = corp.get_conf('SUBCORPATTRS') \
                or corp.get_conf('FULLREF')
        if not subcorpattrs or subcorpattrs == '#':
            return {'message': ('error', _('No meta-information to create a subcorpus.')),
                    'Normslist': [], 'Blocks': [],
            }
        maxlistsize = settings.get_int('global', 'max_attr_list_size')
        tt = corplib.texttype_values(corp, subcorpattrs, maxlistsize, list_all)
        if not ret_nums: return {'Blocks': tt, 'Normslist': []}
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
            def safe_int(s):
                try:
                    return int(s)
                except:
                    return 0

            normvals = dict([(struct.beg(i), safe_int(nas(i)))
                             for i in range(struct.size())])

        def compute_norm(attrname, attr, val):
            valid = attr.str2id(unicode(val))
            r = corp.filter_query(struct.attr_val(attrname, valid))
            cnt = 0
            while not r.end():
                cnt += normvals[r.peek_beg()]
                r.next()
            return cnt

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
                        val['xcnt'] = conccgi.formatnum(compute_norm(
                            aname, attr, val['v']))
                    else:
                        val['xcnt'] = compute_norm(aname, attr, val['v'])
        return {'Blocks': tt, 'Normslist': self.get_normslist(basestructname)}

    def get_normslist(self, structname):
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

    def subcorp_form(self, subcorpattrs='', subcname='', within_condition='', within_struct='', method='gui'):
        """
        Parameters
        ----------
        subcorpattrs : str
            TODO
        within_condition : str
            the same meaning as in subcorp()
        within_struct : str
            the same meaning as in subcorp()
        method : str
            the same meaning as in subcorp()
        """
        self.disabled_menu_items = ('menu-save',)
        self._reset_session_conc()

        tt_sel = self.texttypes_with_norms()
        structs_and_attrs = {}
        for s, a in [t.split('.') for t in self._corp().get_conf('STRUCTATTRLIST').split(',')]:
            if not s in structs_and_attrs:
                structs_and_attrs[s] = []
            structs_and_attrs[s].append(a)

        out = {}
        out['SubcorpList'] = ()
        if os.environ['REQUEST_METHOD'] == 'POST':
            out['checked_sca'] = {}
            for p in self._url_parameters:
                if p.startswith('sca_'):
                    for checked_value in getattr(self, p):
                        out['checked_sca'][checked_value] = True

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
                query = '(%s)' % ' | '.join(['%s="%s"' % (a, conccgi.escape(v1))
                                             for v1 in v])
            else:
                query = '%s="%s"' % (a, conccgi.escape(v))
            if structs.has_key(s):
                structs[s].append(query)
            else:
                structs[s] = [query]
        return [(sname, ' & '.join(subquery)) for
                sname, subquery in structs.items()]

    def subcorp(self, subcname='', delete='', create=False, within_condition='', within_struct='', method=''):
        """
        Parameters
        ----------
        subcname : str
                name of new subcorpus
        delete : str
                sets whether to delete existing subcorpus; any non-empty value means 'delete'
        create : bool
                sets whether to create new subcorpus
        within_condition: str
                custom within condition; if non-empty then clickable form is omitted
        within_struct : str
                a structure the within_condition will be applied to
        method : {'raw', 'gui'}
                flag indicating whether user used raw query or clickable attribute list; this is
                actually used only to display proper user interface (i.e. not to detect which
                values to use when creating the subcorpus)
        """
        if self.get_http_method() != 'POST':
            self.last_corpname = self.corpname
            self._save_options(['last_corpname'])
            self._redirect('%ssubcorp_form?corpname=%s' % (settings.get_root_url(), self.corpname))
            return None
        if delete:
            base = os.path.join(self.subcpath[-1], self.corpname, subcname)
            for e in ('.subc', '.used'):
                if os.path.isfile((base + e).encode('utf-8')):
                    os.unlink((base + e).encode('utf-8'))
        if within_condition and within_struct:
            tt_query = [(within_struct, within_condition)]
        else:
            tt_query = self._texttype_query()
        basecorpname = self.corpname.split(':')[0]
        if create and not subcname:
            raise ConcError(_('No subcorpus name specified!'))
        if (not subcname or (not tt_query and delete)
                or (subcname and not delete and not create)):
            subc_list = self.cm.subcorp_names(basecorpname)
            for item in subc_list:
                item['selected'] = False
            if subc_list:
                subcname = subc_list[0]['n']
                subc_list[0]['selected'] = True
                sc = self.cm.get_Corpus('%s:%s' % (basecorpname, subcname))
                corp_size = conccgi.formatnum(sc.size())
                subcorp_size = conccgi.formatnum(sc.search_size())
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
        if conclib.manatee.create_subcorpus(path, self._corp(), structname,
                                            subquery):
            self._redirect('subcorp_list?corpname=%s' % self.corpname)
            return {}
        else:
            raise ConcError(_('Empty subcorpus!'))

    subcorp.access_level = 1

    def subcorp_list(self, selected_subc=[], sort='n'):
        """
        """
        import tables
        import locale

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
                except Exception as e:
                    logging.getLogger(__name__).error(e)

        data = []
        corplist = plugins.auth.get_corplist(self._user)
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
                        'usesubcorp': item['n']
                    })
            except Exception as e:
                logging.getLogger(__name__).warn('Failed to fetch information about subcorpus of [%s]: %s' % (corp, e))

        sort_key, rev = tables.parse_sort_key(sort)
        cmp_functions = {'n': locale.strcoll, 'size': None, 'created': None}
        data = sorted(data, key=lambda x: x[sort_key], reverse=rev, cmp=cmp_functions[sort_key])
        sort_keys = dict([(x, (x, '')) for x in ('n', 'size', 'created')])
        if not rev:
            sort_keys[sort_key] = ('-%s' % sort_key, '&#8593;')
        else:
            sort_keys[sort_key] = (sort_key, '&#8595;')

        self.cm.get_Corpus(current_corp)  # this is necessary to reset manatee module back to its original state
        return {'subcorp_list': data, 'sort_keys': sort_keys, 'rev': rev}

    subcorp_list.access_level = 1

    def ajax_subcorp_info(self, subcname=''):
        sc = self.cm.get_Corpus(self.corpname, subcname)
        return {'subCorpusName': subcname,
                'corpusSize': conccgi.formatnum(sc.size()),
                'subCorpusSize': conccgi.formatnum(sc.search_size())}

    ajax_subcorp_info.access_level = 1
    ajax_subcorp_info.return_type = 'json'

    def attr_vals(self, avattr='', avpat=''):
        self._headers['Content-Type'] = 'application/json'
        return corplib.attr_vals(self.corpname, avattr, avpat)

    def delsubc_form(self):
        subc = conclib.manatee.StrVector()
        conclib.manatee.find_subcorpora(self.subcpath[-1], subc)
        return {'Subcorplist': [{'n': c} for c in subc],
                'subcorplist_size': min(len(subc), 20)}

    def delsubc(self, subc=[]):
        base = self.subcpath[-1]
        for subcorp in subc:
            cn, sn = subcorp.split(':', 1)
            try:
                os.unlink(os.path.join(base, cn, sn) + '.subc')
            except:
                pass
        return 'Done'

    delsubc.template = 'subcorp_form'
    maxsavelines = 1000

    def saveconc_form(self, from_line=1, to_line=''):
        self.disabled_menu_items = ('menu-save', )
        conc = self.call_function(conclib.get_conc, (self._corp(), self.samplesize))
        if not to_line:
            to_line = conc.size()
            # TODO Save menu should be active here
        return {'from_line': from_line, 'to_line': to_line}

    saveconc_form.access_level = 1

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

            row = []
            for item in root:
                if 'ref' in item:
                    row.append(item['ref'])
                row.append(merge_conc_line_parts(item[left_key]))
                row.append(merge_conc_line_parts(item[kwic_key]))
                row.append(merge_conc_line_parts(item[right_key]))
            return row

        try:
            conc = self.call_function(conclib.get_conc, (self._corp(), self.samplesize))
            conc.switch_aligned(os.path.basename(self.corpname))
            from_line = int(from_line)
            to_line = int(to_line)

            tpl_data = {'from_line': from_line, 'to_line': to_line}

            err = conccgi.validate_range((from_line, to_line), (1, conc.size()))
            if err is not None:
                raise err
            page_size = to_line - (from_line - 1)
            fromp = 1
            line_offset = (from_line - 1)
            labelmap = {}
            data = self.call_function(conclib.kwicpage, ((self._corp(), self.corpname), conc, self._get_speech_segment()), fromp=fromp,
                                      pagesize=page_size, line_offset=line_offset, labelmap=labelmap, align=[],
                                      alignlist=[self.cm.get_Corpus(c)
                                                 for c in self.align.split(',') if c],
                                      leftctx=leftctx, rightctx=rightctx)

            mkfilename = lambda suffix: '%s-concordance.%s' % (self._canonical_corpname(self.corpname), suffix)
            if saveformat == 'xml':
                self._headers['Content-Type'] = 'text/xml; charset=utf-8'
                self._headers['Content-Disposition'] = 'attachment; filename="%s"' % mkfilename('xml')
                tpl_data.update(data)
            elif saveformat == 'text':
                self._headers['Content-Type'] = 'text/plain; charset=utf-8'
                self._headers['Content-Disposition'] = 'attachment; filename="%s"' % mkfilename('txt')
                tpl_data.update(data)
            elif saveformat == 'csv':
                from butils import UnicodeCSVWriter, Writeable
                from codecs import BOM_UTF8

                self._headers['Content-Type'] = 'text/csv'
                self._headers['Content-Disposition'] = 'attachment; filename="%s"' % mkfilename('csv')
                csv_buff = Writeable()
                csv_writer = UnicodeCSVWriter(csv_buff, delimiter=';', quotechar='"', quoting=csv.QUOTE_ALL)

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

                    for i in range(len(data['Lines'])):
                        line = data['Lines'][i]
                        if numbering:
                            row = [str(i + from_line)]
                        else:
                            row = []
                        row += process_lang(line, left_key, kwic_key, right_key)
                        if 'Align' in line:
                            row += process_lang(line['Align'], left_key, kwic_key, right_key)
                        csv_writer.writerow(row)
                tpl_data.update({
                    'data': [row.decode('utf-8') for row in csv_buff.rows],
                    'bom_prefix': BOM_UTF8.decode('utf-8')
                })
            else:
                raise UserActionException(_('Unknown export data type'))
            return tpl_data
        except Exception as e:
            self._headers['Content-Type'] = 'text/html'
            if 'Content-Disposition' in self._headers:
                del (self._headers['Content-Disposition'])
            raise e

    saveconc.access_level = 1
    ConcCGI.add_vars['saveconc'] = ['Desc', 'concsize']

    def _storeconc_path(self, annotconc=None):
        #stderr.write ('storedconc_path: dir: %s, corp: %s, annot: %s\n' %
        #              (self._conc_dir, self.corpname.split, self.annotconc))
        return os.path.join(self._conc_dir, self.corpname.split(':')[0],
                            annotconc or self.annotconc)

    def storeconc(self, storeconcname=''):
        conc = self.call_function(conclib.get_conc, (self._corp(),))
        self.annotconc = storeconcname
        cpath = self._storeconc_path()
        cdir = os.path.dirname(cpath)
        if not os.path.isdir(cdir):
            os.makedirs(cdir)
        conc.save(cpath + '.conc')
        um = os.umask(self.annotconc_info_umask)
        labels = '\n'.join(['<li><n>%i</n><lab>%s</lab></li>' % (n + 1, x)
                            for (n, x) in enumerate(self.annotconc_init_labels)])
        labels = '<concinfo>\n<labels>\n%s\n</labels>\n</concinfo>\n' % labels
        open(cpath + '.info', 'w').write(labels)
        os.umask(um)
        return {'stored': storeconcname, 'conc_size': conc.size()}

    storeconc.access_level = 1
    storeconc.template = 'saveconc_form.tmpl'
    ConcCGI.add_vars['storeconc'] = ['Desc']

    def ajax_get_corp_details(self):
        """
        """
        corp_conf_info = plugins.corptree.get_corpus_info(self._corp().corpname)
        TemplateClass = self._get_template_class('corpus_detail')
        template = unicode(TemplateClass(searchList=[]))

        format_int = lambda x: locale.format('%d', x, True).decode('UTF-8')

        ans = {
            'corpname': self._canonical_corpname(self._corp().get_conf('NAME')),
            'description': self._corp().get_info(),
            'size': format_int(self._corp().size()),
            'attrlist': [],
            'structlist': [],
            'web_url': corp_conf_info['web'] if corp_conf_info is not None else '',
            'template': template
        }
        try:
            ans['attrlist'] = [{'name': item, 'size': format_int(self._corp().get_attr(item).id_range())} for item in
                               self._corp().get_conf('ATTRLIST').split(',')]
        except RuntimeError as e:
            logging.getLogger(__name__).warn('%s' % e)
            ans['attrlist'] = [{'message': ('error', _('Failed to load'))}]
        ans['structlist'] = [{'name': item, 'size': format_int(self._corp().get_struct(item).size())} for item in
                             self._corp().get_conf('STRUCTLIST').split(',')]

        return ans

    ajax_get_corp_details.return_type = 'json'

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

    ajax_get_structs_details.return_type = 'json'

    def ajax_get_tag_variants(self, pattern=''):
        """
        """
        import taghelper

        try:
            tag_loader = taghelper.TagVariantLoader(self.corpname,
                                                    plugins.corptree.get_corpus_info(self.corpname)['num_tag_pos'])
        except IOError as e:
            raise UserActionException(_('Corpus %s is not supported by this widget.') % self.corpname)

        if len(pattern) > 0:
            ans = tag_loader.get_variant(pattern)
        else:
            ans = tag_loader.get_initial_values()

        return JsonEncodedData(ans)

    ajax_get_tag_variants.return_type = 'json'

    def fcs(self, operation='explain', version='', recordPacking='xml',
            extraRequestData='', query='', startRecord='', responsePosition='',
            recordSchema='', maximumRecords='', scanClause='', maximumTerms='', **kwargs):
        "Federated content search API function (www.clarin.eu/fcs)"

        # default values
        self._headers['Content-Type'] = 'text/xml; charset=utf-8'
        corpname = settings.get('corpora', 'fcs_default_corpus') or 'suzanne'
        self.corpname = corpname
        self._curr_corpus = self.cm.get_Corpus(self.corpname)
        numberOfRecords = 0
        current_version = 1.2
        # supported parameters for all operations
        sup_pars = ['operation', 'stylesheet', 'version', 'extraRequestData']
        # implicit result sent to template
        out = {'operation': operation, 'version': current_version,
               'recordPacking': recordPacking, 'result': [],
               'numberOfRecords': numberOfRecords,
               'server_name': settings.get('global', 'root_url_host'),
               'server_port': settings.get('global', 'root_url_port'),
               'database': settings.get('global', 'root_url_path')[1:] + 'fcs'}
        try:
            # check version
            if version and current_version < float(version):
                raise Exception(5, version, 'Unsupported version')

            # check integer parameters
            if maximumRecords != '':
                try:
                    maximumRecords = int(maximumRecords)
                    if maximumRecords <= 0:
                        raise Exception(6, 'maximumRecords', 'Unsupported parameter value')
                except:
                    raise Exception(6, 'maximumRecords', 'Unsupported parameter value')
            else:
                maximumRecords = 250
            out['maximumRecords'] = maximumRecords
            if maximumTerms != '':
                try:
                    maximumTerms = int(maximumTerms)
                except:
                    raise Exception(6, 'maximumTerms', 'Unsupported parameter value')
            else:
                maximumTerms = 100
            out['maximumTerms'] = maximumTerms
            if startRecord != '':
                try:
                    startRecord = int(startRecord)
                    if startRecord <= 0:
                        raise Exception(6, 'startRecord', 'Unsupported parameter value')
                except:
                    raise Exception(6, 'startRecord', 'Unsupported parameter value')
            else:
                startRecord = 0
            out['startRecord'] = startRecord
            if responsePosition != '':
                try:
                    responsePosition = int(responsePosition)
                except:
                    raise Exception(6, 'responsePosition', 'Unsupported parameter value')
            else:
                responsePosition = 0
            out['responsePosition'] = responsePosition

            # set content-type in HTTP header
            if recordPacking == 'string':
                self._headers['Content-Type'] = 'text/plain; charset=utf-8'
            elif recordPacking == 'xml':
                self._headers['Content-Type'] = 'text/xml; charset=utf-8'
            else:
                raise Exception(71, 'recordPacking', 'Unsupported record packing')

            # provide info about service
            if operation == 'explain' or not operation:
                sup_pars.append('recordPacking') # other supported parameters
                sup_pars.append('x-fcs-endpoint-description') # other supported parameters
                unsup_pars = list(set(self._url_parameters) - set(sup_pars))
                if unsup_pars:
                    raise Exception(8, unsup_pars[0], 'Unsupported parameter')
                    #if extraRequestData:
                #    corpname = extraRequestData
                out['result'] = self._corp().get_conf('ATTRLIST').split(',')
                out['numberOfRecords'] = len(out['result'])

            # wordlist for a given attribute
            elif operation == 'scan':
            # check supported parameters
                sup_pars.extend(['scanClause', 'responsePosition',
                                 'maximumTerms', 'x-cmd-resource-info'])
                unsup_pars = list(set(self._url_parameters) - set(sup_pars))
                if unsup_pars:
                    raise Exception(8, unsup_pars[0], 'Unsupported parameter')
                    #if extraRequestData:
                #    corpname = extraRequestData
		out['resourceInfoRequest'] = 'x-cmd-resource-info' in kwargs and kwargs['x-cmd-resource-info'] == 'true'
                out['result'] = conclib.fcs_scan((self._corp(), self.corpname), scanClause,
                                                 maximumTerms, responsePosition)

            # simple concordancer
            elif operation == 'searchRetrieve':
            # check supported parameters
                sup_pars.extend(['query', 'startRecord', 'maximumRecords',
                                 'recordPacking', 'recordSchema', 'resultSetTTL','x-cmd-context'])
                unsup_pars = list(set(self._url_parameters) - set(sup_pars))
                if unsup_pars:
                    raise Exception(8, unsup_pars[0], 'Unsupported parameter')
		if hasattr(self, 'x-cmd-context'):
		    corpname = getattr(self, 'x-cmd-context')
                    corplist = plugins.auth.get_corplist(self._user)
		    if corpname in corplist:
		        self._curr_corpus = None
		    	self.corpname = corpname
                out['result'] = conclib.fcs_search((self._corp(), self.corpname), query,
                                                   maximumRecords, startRecord)
                out['numberOfRecords'] = len(out['result'])

            # unsupported operation
            else:
                out['operation'] = 'explain'  # show within explain template
                raise Exception(4, '', 'Unsupported operation')
            return out

        # catch exception and amend diagnostics in template
        except Exception as e:
            out['message'] = ('error', True)   # TODO 'True' is quite a meaningless message
            try:  # concrete error, catch message from lower levels
                out['code'], out['details'], out['msg'] = e[0], e[1], e[2]
            except:  # general error
                out['code'], out['details'] = 1, repr(e)
                out['msg'] = 'General system error'
            return out

    fcs.template = 'fcs.tmpl'
    fcs.accept_kwargs = True

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

    stats.template = 'stats.tmpl'

    def ajax_save_query(self, description='', url='', query_id='', public='', tmp=1):
        html = plugins.query_storage.decode_description(description)
        query_id = plugins.query_storage.write(user=self._session_get('user', 'id'), corpname=self.corpname, url=url,
                                               tmp=0, description=description, query_id=query_id, public=int(public))
        return {'rawHtml': html, 'queryId': query_id}

    ajax_save_query.access_level = 1
    ajax_save_query.return_type = 'json'

    def ajax_delete_query(self, query_id=''):
        plugins.query_storage.delete_user_query(self._session_get('user', 'id'), query_id)
        return {}

    ajax_delete_query.access_level = 1
    ajax_delete_query.return_type = 'json'

    def ajax_undelete_query(self, query_id=''):
        from datetime import datetime

        plugins.query_storage.undelete_user_query(self._session_get('user', 'id'), query_id)
        query = plugins.query_storage.get_user_query(self._session_get('user', 'id'), query_id)
        desc = plugins.query_storage.decode_description(query['description'])
        autosaved_class = ' autosaved' if query['tmp'] else ''
        notification_autosaved = "| %s" % _('autosaved') if query['tmp'] else ''

        html = """<div class="query-history-item%s" data-query-id="%s">
                <h4>%s | <a class="open" href="%s">%s</a> | <a class="delete" href="#">%s</a>%s</h4>
                %s""" % (autosaved_class, query_id, datetime.fromtimestamp(query['created']), query['url'], _('open'),
                         _('delete'), notification_autosaved, desc)
        return {
            'html': html
        }

    ajax_undelete_query.access_level = 1
    ajax_undelete_query.return_type = 'json'

    def query_history(self, offset=0, limit=100, from_date='', to_date='', types=[]):
        self.disabled_menu_items = ('menu-view', 'menu-sort', 'menu-sample',
                                    'menu-save', 'menu-concordance', 'menu-filter', 'menu-frequency',
                                    'menu-collocations', 'menu-view')
        self._reset_session_conc()
        if plugins.has_plugin('query_storage'):
            rows = plugins.query_storage.get_user_queries(self._session_get('user', 'id'), from_date=from_date,
                                                          to_date=to_date, offset=offset, limit=limit, types=types)
            for row in rows:
                row['corpname'] = self._canonical_corpname(row['corpname'])
                row['created'] = (row['created'].strftime('%X'), row['created'].strftime('%x'))
        else:
            rows = []

        return {
            'data': rows,
            'from_date': from_date,
            'to_date': to_date,
            'types': types
        }

    query_history.access_level = 1

    def to(self, q=''):
        row = plugins.query_storage.get_user_query(self._session_get('user', 'id'), q)
        if row:
            self._redirect('%s&query_id=%s' % (row['url'], row['id']))
        return {}

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

    audio.access_level = 0

    def view_tree(self, id=''):

        path = '%s/%s/%s' % (settings.get('corpora', 'view_treex_files_path'), self.corpname, id)
        if os.path.exists(path) and not os.path.isdir(path):
            with open(path, 'r') as f:
                file_size = os.path.getsize(path)
                self._headers['Content-Type'] = 'application/json'
                self._headers['Content-Length'] = '%s' % file_size
                self._headers['Accept-Ranges'] = 'none'
                if self.environ.get('HTTP_RANGE', None):
                    self._headers['Content-Range'] = 'bytes 0-%s/%s' % (
                        os.path.getsize(path) - 1, os.path.getsize(path))
                return f.read()
        else:
            self._set_not_found()
            return None

    view_tree.access_level = 0

    def corplist(self):
        """
        Displays information page with the list of available corpora
        """
        out = {}
        return out

    corplist.template = 'corplist.tmpl'

    def fcs2html(self):
        """
        Returns XSL template for rendering FCS XML.
        """
        self._headers['Content-Type'] = 'text/xsl; charset=utf-8'
        out = {}
        return out

    fcs2html.template = 'fcs2html.tmpl'
