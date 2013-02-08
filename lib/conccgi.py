# Copyright (c) 2003-2009  Pavel Rychly
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import os
import re
import locale
from sys import stderr
import time
import glob
from types import ListType
import logging
import math

from CGIPublisher import CGIPublisher, JsonEncodedData, UserActionException
import corplib
import conclib
import version
import settings
import taghelper

escape_regexp = re.compile(r'[][.*+{}?()|\\"$^]')
def escape (s):
    return escape_regexp.sub(r'\\\g<0>', s)
    

try:
    locale.setlocale(locale.LC_NUMERIC, 'en_GB')
    def formatnum (f):
        return locale.format ('%.f', f, True)
except locale.Error:
    def formatnum (f):
        return '%.f' % f

def onelevelcrit (prefix, attr, ctx, pos, fcode, icase, bward=''):
    fromcode = {'lc': '<0', 'rc': '>0', 'kl': '<0', 'kr': '>0'}
    attrpart = '%s%s/%s%s ' % (prefix, attr, icase, bward)
    if not ctx:
        ctx = '%i%s' % (pos, fromcode.get (fcode, '0'))
    if '~' in ctx and '.' in attr:
        ctx = ctx.split('~')[0]
    return attrpart + ctx


class ConcError (Exception):
    def __init__ (self, msg):
        self.message = msg
        

class ConcCGI (CGIPublisher):

    _global_vars = ['corpname', 'viewmode', 'attrs', 'attr_allpos', 'ctxattrs',
                    'structs', 'refs', 'lemma', 'lpos', 'pagesize',
                    'usesubcorp', 'align', 'copy_icon', 'gdex_enabled',
                    'gdexcnt', 'gdexconf']
    _open_version = 0
    # (due to Cheetah) added attributes
    error = ''
    fc_lemword_window_type = 'both'
    fc_lemword_type = 'all'
    fc_lemword_wsize=5,
    fc_lemword='',
    fc_pos_window_type = 'both'
    fc_pos_type = 'all'
    fc_pos_wsize=5,
    fc_pos=[],
    ml = 0
    concarf = ''
    Aligned = []
    prevlink = ''
    nextlink = ''
    concsize = ''
    Lines = []
    fromp = '1'
    numofpages = ''
    Page = []
    pnfilter = 'p'
    filfl = 'f'
    filfpos = '-5'
    filtpos = '5'
    sicase = ''
    sbward = ''
    ml1icase = ''
    ml2icase = ''
    ml3icase = ''
    ml1bward = ''
    ml2bward = ''
    ml3bward = ''
    freq_sort = ''
    heading = 0
    saveformat = 'text'
    wlattr = ''
    wlpat = ''
    wlpage = 1
    wlcache = ''
    blcache = ''
    simple_n = 1
    usearf = 0
    collpage = 1
    fpage = 1
    fmaxitems = 50
    ftt_include_empty = ''
    subcsize = 0
    processing = 0 
    ref_usesubcorp = ''
    wlsort = ''
    keywords = ''
    Keywords = []
    ref_corpname = ''
    Items = []
    showmwlink = ''
    format = ''
    selected = ''
    saved_attrs = 0
                     # save options
    pages = 0
    leftctx = ''
    rightctx = ''
    numbering = 0
    align_kwic = 0
    stored = ''
    # end

    add_vars = {}
    corpname = 'susanne'
    corplist = ['susanne', 'bnc']
    usesubcorp = ''
    subcorp_size = None
    subcname = ''
    subcpath = []
    _conc_dir = ''
    _home_url = '../run.cgi/first_form'
    files_path = '../files'
    css_prefix = ''
    iquery = ''
    queryselector = 'iqueryrow'
    lemma = ''
    lpos = ''
    phrase = ''
    char = ''
    word = ''
    wpos = ''
    cql = ''
    tag = ''
    default_attr = None
    save = 1
    spos = 3
    skey = 'rc'
    qmcase = 0
    rlines = '250'
    attrs = 'word'
    ctxattrs = 'word'
    attr_allpos = 'kw'
    allpos = 'kw'
    structs = 'p,g'
    q = []
    pagesize = 20
    gdexconf = ''
    gdexpath = [] # [('confname', '/path/to/gdex.conf'), ...]
    gdexcnt = 100
    gdex_enabled = 0
    alt_gdexconf = None
    copy_icon = 0
    _avail_tbl_templates = ''
    multiple_copy = 0
    wlsendmail = ''

    sortlevel=1
    flimit = 0
    freqlevel=1
    ml1pos = 1
    ml2pos = 1
    ml3pos = 1
    ml1ctx = '0~0>0'
    ml2ctx = '0~0>0'
    ml3ctx = '0~0>0'
    tbl_template = 'none'

    can_annotate = 0
    enable_sadd = 0
    annotconc = ''
    annotconc_init_labels = ('x', 'u')
    annotconc_num_label_suffixes = ('.e',)
    #annotconc_info_umask = 022
    annotconc_info_umask = 0111  #XXX renumbering from CPA editor

    alpha_features = 0


    add_vars['wsketch_form'] = ['LastSubcorp']
    add_vars['wsketch'] = ['LastSubcorp']
    add_vars['mwsketch_form'] = ['LastSubcorp']
    add_vars['mwsketch'] = ['LastSubcorp']
    add_vars['wsdiff'] = ['LastSubcorp']
    add_vars['save_ws_options'] = ['LastSubcorp']
    add_vars['findx_upload'] = ['LastSubcorp']
    
    def __init__ (self, environ):
        CGIPublisher.__init__(self, environ=environ)
        self.cm = corplib.CorpusManager (self.corplist, self.subcpath, 
                                         self.gdexpath)
        self._curr_corpus = None

    def preprocess_values(self, form):
        if self._corpus_architect: return
        cn = ''
        if form.has_key ('json'):
            import json
            cn = str(json.loads(form.getvalue('json')).get('corpname', ''))
        if form.has_key('corpname') and not cn:
            cn = form.getvalue('corpname')
        if cn:
            if isinstance(cn, ListType):
                cn = cn[-1]
            if not settings.user_has_access_to(cn):
                raise UserActionException(_('Access to the corpus "%s" or its requested variant denied') % cn)
            self.corpname = cn

    def self_encoding(self):
        enc = self._corp().get_conf('ENCODING')
        if enc:
            return enc
        else:
            return 'iso-8859-1'

    def _corp (self):
        if (not self._curr_corpus or
            (self.usesubcorp and not hasattr(self._curr_corpus, 'subcname'))):
            #print >>stderr, '>>>>_corp:%s (%s)' % (self.corpname,
            #                                        self.usesubcorp)
            self._curr_corpus = self.cm.get_Corpus (self.corpname,
                                                    self.usesubcorp)
            # XXX opravit poradne!
            self._curr_corpus._conc_dir = self._conc_dir
        return self._curr_corpus

    def _set_defaults (self):
        try:
            corp = self._corp()
            if not self.__dict__.has_key('refs'):
                self.refs = corp.get_conf('SHORTREF')
            self._headers ['Content-Type'] = 'text/html; charset=utf-8'
#                                  (corp.get_conf('ENCODING') or 'iso-8859-1')
        except:
            self.refs = '#'

    def _correct_parameters (self):
        if self.annotconc == '--NONE--':
            self._cookieattrs.append ('annotconc')
            self.annotconc = ''

    
    def _add_globals (self, result):
        CGIPublisher._add_globals (self, result)

        thecorp = self._corp()
        result['q'] = self.urlencode ([('q', q) for q in self.q])
        result['Q'] = [{'q': q} for q in self.q]
        result['corpname_url'] = 'corpname=' + self.corpname
        if self._corpus_architect: # no corpname for corpus architect
            self._global_vars = self._global_vars[1:]
            result['corpname_url'] = ''
        global_var_val = [(n,val) for n in self._global_vars
                          for val in [getattr (self,n)]
                          if getattr (self.__class__, n, None) is not val]
        result['globals'] = self.urlencode (global_var_val)
        result['Globals'] = [{'name':n,'value':v} for n,v in global_var_val]
        result['has_wsketch'] = (getattr (self, 'wsketch', '')
                                 and thecorp.get_conf('WSDEF')
                                 and thecorp.get_conf('WSBASE') != 'none')
        result['struct_ctx'] = thecorp.get_conf('STRUCTCTX')
        result['can_wseval'] = getattr(self, '_can_wseval', '')
        # these were in add_undefined
        result['Corplist'] = self.cm.corplist_with_names(settings.get('corpora_hierarchy'),
                            settings.get_bool('corpora', 'use_db_whitelist'))
        result['corplist_size'] = min (len(result['Corplist']), 20)
        result['corp_full_name'] = (thecorp.get_conf ('NAME')
                                   or self.corpname)

        result['corp_description'] = thecorp.get_info()
        result['corp_size'] = _('%s positions') % locale.format('%d', thecorp.size(), True).decode('utf-8')
        corp_conf_info = settings.get_corpus_info(thecorp.get_conf('NAME'))
        if corp_conf_info is not None:
            result['corp_web'] = corp_conf_info['web']
        else:
            result['corp_web'] = ''
        if self.usesubcorp:
            result['subcorp_size'] = _('%s positions') % locale.format('%d', thecorp.search_size(), True).decode('utf-8') # TODO check whether this is proper method
        attrlist = thecorp.get_conf('ATTRLIST').split(',')
        sref = thecorp.get_conf('SHORTREF')
        result['fcrit_shortref'] = '+'.join([a.strip('=') + '+0'
                                                for a in sref.split(',')])
        result['corpencoding'] = thecorp.get_conf('ENCODING')
        result['_version'] = (conclib.manatee.version(), version.version)
        poslist = self.cm.corpconf_pairs (thecorp, 'WPOSLIST')
        result['Wposlist'] = [{'n':x[0], 'v':x[1]} for x in poslist]
        poslist = self.cm.corpconf_pairs (thecorp, 'LPOSLIST')
        if 'lempos' not in attrlist:
            poslist = self.cm.corpconf_pairs (thecorp, 'WPOSLIST')
        result['Lposlist'] = [{'n':x[0], 'v':x[1]} for x in poslist]
        result['lpos_dict'] = dict([(y, x) for x, y in poslist])
        poslist = self.cm.corpconf_pairs (thecorp, 'WSPOSLIST')
        if not poslist:
            poslist = self.cm.corpconf_pairs (thecorp, 'LPOSLIST')
        result['WSposlist'] = [{'n':x[0], 'v':x[1]} for x in poslist]
        result['has_lemmaattr'] = 'lempos' in attrlist \
                                  or 'lemma' in attrlist
        result['default_attr'] = thecorp.get_conf('DEFAULTATTR')
        for listname in ['AttrList', 'StructAttrList']:
            result [listname] = \
                   [{'label': thecorp.get_conf (n+'.LABEL') or n, 'n': n}
                    for n in thecorp.get_conf (listname.upper()).split(',')
                    if n]
        result['tagsetdoc'] = thecorp.get_conf('TAGSETDOC')
        result['ttcrit'] = self.urlencode ([('fcrit', '%s 0' % a) for a in
                                     thecorp.get_conf ('SUBCORPATTRS')
                                     .replace('|',',').split(',') if a])
        result['corp_uses_tag'] = 'tag' in thecorp.get_conf('ATTRLIST').split(',')
        if self.annotconc and not result.has_key('GroupNumbers'):
            labelmap = conclib.get_conc_labelmap (self._storeconc_path() 
                                                  + '.info')
            result['GroupNumbers'] = conclib.format_labelmap (labelmap)
        result['commonurl'] = self.urlencode([ ('corpname', self.corpname),
                                               ('lemma', self.lemma),
                                               ('lpos', self.lpos),
                                               ('usesubcorp', self.usesubcorp),
                                             ])
        result['num_tag_pos'] = settings.get_corpus_info(self.corpname)['num_tag_pos']
        result['tag_builder_support'] = taghelper.tag_variants_file_exists(self.corpname)
        return result


    def add_undefined (self, result, methodname):
        CGIPublisher.add_undefined (self, result, methodname)
        result['methodname'] = methodname
        if self.add_vars.has_key (methodname):
            names = self.add_vars[methodname]
        else:
            return

        if 'Desc' in names:
            result['Desc'] = [{'op': o, 'arg': a, 'churl': u1, 'tourl': u2,
                               'size': s}
                              for o,a,u1,u2,s in
                              conclib.get_conc_desc (self.q,
                                                     corpname=self.corpname,
                                                     cache_dir=self.cache_dir,
                                                     subchash=getattr(self._corp(), "subchash", None))]
        thecorp = self._corp()

        if 'TextTypeSel' in names:
            result['TextTypeSel'] = self.texttypes_with_norms(ret_nums=False)
        if 'LastSubcorp' in names:
            result['LastSubcorp'] = self.cm.last_subcorp_names (self.corpname)
            result['lastSubcorpSize'] = min(len(result['LastSubcorp']) +1, 20)

        if 'concsize' in names:
           conc = self.call_function (conclib.get_conc,
                (self._corp(),))
           if conc :
               result['concsize'] = conc.size()

        if 'concsize' in names or 'orig_query' in names:
           conc_desc = conclib.get_conc_desc (self.q,
                       corpname=self.corpname,
                       cache_dir=self.cache_dir,
                       subchash=getattr(self._corp(), "subchash", None))
           if len(conc_desc) > 1:
               result['tourl'] = conc_desc[0][3]

    kwicleftctx = '-5'
    kwicrightctx = '5'
    senleftctx_tpl = '-1:%s'
    senrightctx_tpl = '1:%s'
    viewmode = 'kwic'
    changeviewmode = 0
    align = ''

    def simple_search (self):
        "simple search result -- all in one"
            # concordance lines
        corp = self._corp()
        conclines = 11 # setable?
        self.viewmode = 'sen'
        self.structs = 'g'
        self.pagesize = conclines
        self.gdex_enabled = 1
        self.gdexcnt = conclines
        self.exceptmethod = "first_form"
        result = self.first()
            # frequencies
        fattrs = []
        subcorpattrs = corp.get_conf ('SUBCORPATTRS') \
                               or corp.get_conf ('FULLREF')
        if subcorpattrs != '#':
            fattrs.extend(subcorpattrs.replace('|',',').split(','))
        wsattr = corp.get_conf ('WSATTR')
        if wsattr:
            fattrs.append(wsattr)
        fcrits = ['%s 0' % a for a in fattrs]
        self.q.append('r10000') # speeds-up computing frequency
        result['freqs'] = self.freqs(fcrit=fcrits, ml=1)
            #sketches
        self.numoflines = 10
        result ['Sketches'] = []
        if fattrs and fattrs[-1] in ('lemma', 'lempos'):
            try:
                self.gr = ' ' # all relations
                lemma = result['freqs']['Blocks'][-1]['Items'][0]\
                              ['Word'][0]['n'] # most frequent lemma (lempos)
                if wsattr == 'lempos':
                    self.lemma = lemma[:-2]
                    self.lpos = lemma[-2:]
                result['Sketches'] = self.wseval()['Items'] # "flat" sketches
            except:
                result ['Sketches'] = []
        return result
    
    def view (self, tpl_params={}):
        "kwic view"
        if self.changeviewmode:
            self.viewmode = {'sen':'kwic',
                             'kwic': 'sen'}.get (self.viewmode, 'kwic')
            self._cookieattrs.append ('viewmode')
        self.righttoleft = False
        if self.viewmode == 'kwic':
            self.leftctx = self.kwicleftctx
            self.rightctx = self.kwicrightctx
            if self._corp().get_conf ('RIGHTTOLEFT'):
                self.righttoleft = True
        else:
            sentence_struct = settings.get_corpus_info(self.corpname)['sentence_struct']
            self.leftctx = self.senleftctx_tpl % sentence_struct
            self.rightctx = self.senrightctx_tpl % sentence_struct
            # GDEX changing and turning on and off
        if self.gdex_enabled and self.gdexcnt:
            gdex_set = 0
            for i in range(1,len(self.q)):
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
            
        conc = self.call_function (conclib.get_conc, (self._corp(),))
        labelmap = {}
        if self.annotconc:
            if self._selectstored (self.annotconc):
                anot = self._get_annotconc()
                conc.set_linegroup_from_conc (anot)
                labelmap = anot.labelmap
            elif self.can_annotate:
                self.storeconc (self.annotconc)
                labelmap = conclib.get_conc_labelmap (self._storeconc_path()
                                                      + '.info')
            else:
                self._cookieattrs.append ('annotconc')
                self.annotconc = ''
        #print >>stderr, 'view.labels:%s' % labelmap
        contains_speech = settings.has_configured_speech(self._curr_corpus)
        out = self.call_function(conclib.kwicpage, (self._curr_corpus, conc, contains_speech), labelmap=labelmap,
                                 alignlist=[self.cm.get_Corpus(c)
                                        for c in self.align.split(',') if c],
                                 copy_icon=self.copy_icon,
                                 tbl_template=self.tbl_template)
        del conc
        if self.viewmode == 'sen':
            conclib.add_block_items (out['Lines'], block_size=1)
        if self._corp().get_conf ('ALIGNED'):
            out['Aligned'] = [{'n': w} for w in
                              self._corp().get_conf ('ALIGNED').split(',')]
            #if self.align:
            #    self._cookieattrs.append ('align')
        out.update(tpl_params)
        return out
    add_vars['view'] = ['orig_query']
    
    def concdesc (self):
        return {'Desc': [{'op': o, 'arg': a, 'churl': u1, 'tourl': u2,
                          'size': s}
                         for o,a,u1,u2,s in
                         conclib.get_conc_desc (self.q,
                                                corpname=self.corpname,
                                                cache_dir=self.cache_dir,
                                                subchash=getattr(self._corp(), "subchash", None))]
                }

    add_vars['viewattrs'] = ['concsize'] 
    def viewattrs (self):
        "attrs, refs, structs form"
        corp = self._corp()
        availattr = corp.get_conf('ATTRLIST').split(',')
        attrslist = self.attrs.split(',')
        out = {'Availattrs': [{'n':n,  'checked': 
                               (((n in attrslist) and 'checked') or '')} 
                              for n in availattr]}
        
        availstruct = corp.get_conf('STRUCTLIST').split(',')
        structlist = self.structs.split(',')
        out['Availstructs'] = [{'n': n,
                                'sel': (((n in structlist)
                                             and 'selected') or ''),
                                'label': corp.get_conf (n+'.LABEL') } 
                                for n in availstruct if n and n != '#']
        
        availref = corp.get_conf('STRUCTATTRLIST').split(',')
        reflist = self.refs.split(',')
        out['Availrefs'] = [{'n': '#',  'label': 'Token number', 'sel': 
                             ((('#' in reflist) and 'selected') or '')}] + \
                             [{'n': '=' + n,  'sel': 
                               ((('=' + n in reflist) and 'selected') or ''),
                               'label': (corp.get_conf (n+'.LABEL') or n)} 
                              for n in availref if n and n != '#']
        ctx_elems = self.kwicrightctx.split(':')
        out['newctxsize'] = ctx_elems[0]
        if len(ctx_elems) > 1:
            out['ctxunit'] = ctx_elems[1]
        else:
            out['ctxunit'] = ''

        out['Availgdexconfs'] = self.cm.gdexdict.keys()
        return out

    def set_new_viewattrs (self, setattrs=[], allpos='', setstructs=[],
                    setrefs=[], newctxsize='', gdexcnt=0, gdexconf='', ctxunit=''):
        if ctxunit == '@pos':
            ctxunit = ''
        self.attrs = ','.join(setattrs)
        self.structs = ','.join(setstructs)
        self.refs = ','.join(setrefs)
        self.attr_allpos = allpos
        if allpos == 'all':
            self.ctxattrs = self.attrs
        else:
            self.ctxattrs = 'word'
        self.gdexcnt = gdexcnt
        self.gdexconf = gdexconf
        self._cookieattrs.extend (['attrs', 'ctxattrs', 'structs',
                                   'pagesize', 'copy_icon', 'multiple_copy',
                                   'gdex_enabled', 'gdexcnt', 'gdexconf'])
        if "%s%s" % (newctxsize, ctxunit) != self.kwicrightctx:
            if not newctxsize.isdigit():
                self.exceptmethod = 'viewattrs'
                raise Exception(_('Value [%s] cannot be used as a context width. Please use numbers 0,1,2,...') % newctxsize)
            self.kwicleftctx = '-%s%s' % (newctxsize, ctxunit)
            self.kwicrightctx = '%s%s' % (newctxsize, ctxunit)
            self._cookieattrs.extend (['kwicleftctx', 'kwicrightctx', 'ctxunit'])

    def viewattrsx (self, setattrs=[], allpos='', setstructs=[], setrefs=[],
                    newctxsize='', gdexcnt=0, gdexconf='', ctxunit=''):
        self.set_new_viewattrs(setattrs, allpos, setstructs,
                    setrefs, newctxsize, gdexcnt, gdexconf, ctxunit)
        return self.view()
    
    viewattrsx.template = 'view.tmpl'

    def save_viewattrs (self, setattrs=[], allpos='', setstructs=[],
                    setrefs=[], newctxsize='', gdexcnt=0, gdexconf='', ctxunit=''):
        self.set_new_viewattrs(setattrs, allpos, setstructs,
                    setrefs, newctxsize, gdexcnt, gdexconf, ctxunit)
        self._save_options(['attrs', 'ctxattrs', 'structs', 'pagesize',
                            'copy_icon', 'gdex_enabled', 'gdexcnt', 'gdexconf',
                            'refs',
                            'kwicleftctx', 'kwicrightctx', 'multiple_copy',
                            'tbl_template', 'ctxunit'],
                            self.corpname)
        out = self.viewattrs()
        out['saved_attrs'] = 1
        return out

    save_viewattrs.template = 'viewattrs.tmpl'

    def sort (self):
        "sort concordance form"
        attrlist = self._corp().get_conf('ATTRLIST').split(',')
        out = {'Sort_attrlist': [{'n':n} for n in attrlist],
               'Pos_ctxs': conclib.pos_ctxs(1,1)}
        return out

    def sortx (self, sattr='word', skey='rc', spos=3, sicase='', sbward=''):
        "simple sort concordance"
        if skey == 'lc':
            ctx = '-1<0~-%i<0' % spos
        elif skey == 'kw':
            ctx = '0<0~0>0'
        elif skey == 'rc':
            ctx = '1>0~%i>0' % spos
        if '.' in sattr:
            ctx = ctx.split('~')[0]
            
        self.q.append ('s%s/%s%s %s' % (sattr, sicase, sbward, ctx))
        return self.view()
    
    sortx.template = 'view.tmpl'

    def mlsortx (self,
          ml1attr='word', ml1pos=1, ml1icase='', ml1bward='', ml1fcode='rc',
          ml2attr='word', ml2pos=1, ml2icase='', ml2bward='', ml2fcode='rc',
          ml3attr='word', ml3pos=1, ml3icase='', ml3bward='', ml3fcode='rc',
          sortlevel=1, ml1ctx='', ml2ctx='', ml3ctx=''):
        "multiple level sort concordance"

        crit = onelevelcrit ('s', ml1attr, ml1ctx, ml1pos, ml1fcode,
                             ml1icase, ml1bward)
        if sortlevel > 1:
            crit += onelevelcrit (' ', ml2attr, ml2ctx, ml2pos, ml2fcode,
                                  ml2icase, ml2bward)
            if sortlevel > 2:
                crit += onelevelcrit (' ', ml3attr, ml3ctx, ml3pos, ml3fcode,
                                      ml3icase, ml3bward)
                                      
        self.q.append (crit)
        return self.view()

    mlsortx.template = 'view.tmpl'

    def _compile_query (self, qtype=None):
        queries = {
            'cql': '%(cql)s',
            'lemma': '[lempos="%(lemma)s%(lpos)s"]',
            'wordform': '[%(wordattr)s="%(word)s" & tag="%(wpos)s.*"]',
            'wordformonly': '[%(wordattr)s="%(word)s"]',
            }
        for a in ('iquery', 'word', 'lemma', 'phrase', 'cql', 'tag'):
            if self.queryselector == a + 'row':
                if getattr(self, a, ''):
                    setattr (self, a, getattr (self, a).strip())
                else:
                    raise ConcError (_('No query entered.'))
        if qtype:
            return queries[qtype] % self.clone_self()
        thecorp = self._corp()
        attrlist = thecorp.get_conf('ATTRLIST').split(',')
        wposlist = dict (self.cm.corpconf_pairs (thecorp, 'WPOSLIST'))
        lposlist = dict (self.cm.corpconf_pairs (thecorp, 'LPOSLIST'))
        if self.queryselector == 'iqueryrow':
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
            if '--' not in self.iquery:
                return ''.join([qitem % {'q':escape(q)}
                                for q in self.iquery.split()])
            else:
                def split_tridash (word, qitem):
                    if '--' not in word:
                          return qitem % {'q':word}
                    w1,w2 = word.split('--',1)
                    return "( %s | %s %s | %s )" % (qitem % {'q':w1+w2}, 
                                                    qitem % {'q':w1}, 
                                                    qitem % {'q':w2}, 
                                                    qitem % {'q':w1+'-'+w2})
                return ''.join([split_tridash(escape(q), qitem)
                                for q in self.iquery.split()])

        if self.queryselector == 'lemmarow':
            if self.lpos is '':
                return '[lemma="%s"]' % self.lemma
            if 'lempos' in attrlist:
                try:
                    if self.lpos in lposlist.values():
                        lpos = self.lpos
                    else:
                        lpos = lposlist [self.lpos]
                except KeyError:
                    raise ConcError (_('Undefined lemma PoS')
                                                         + ' "%s"' % self.lpos)
                return '[lempos="%s%s"]' % (self.lemma, lpos)
            else:
                try:
                    if self.lpos in wposlist.values():
                        wpos = self.lpos
                    else:
                        wpos = wposlist [self.lpos]
                except KeyError:
                    raise ConcError (_('Undefined word form PoS')
                                                          + ' "%s"' %self.lpos)
                return '[lemma="%s" & tag="%s"]' % (self.lemma, wpos)
        if self.queryselector == 'phraserow':
            return '"' + '" "'.join (self.phrase.split()) + '"'
        if self.queryselector == 'wordrow':
            if self.qmcase:
                wordattr = 'word="%s"' % self.word
            else:
                if 'lc' in attrlist:
                    wordattr = 'lc="%s"' % self.word
                else:
                    wordattr = 'word="(?i)%s"' % self.word
            if self.wpos is '':
                return '[%s]' % wordattr
            try:
                if self.wpos in wposlist.values():
                    wpos = self.wpos
                else:
                    wpos = wposlist [self.wpos]
            except KeyError:
                raise ConcError (_('Undefined word form PoS')
                                                         + ' "%s"' % self.wpos)
            return '[%s & tag="%s"]' % (wordattr, wpos)
        if self.queryselector == 'charrow':
            return '[word=".*%s.*"]' % self.char
        if self.queryselector == 'tagrow':
            return '[tag="%s"]' % self.tag
        return self.cql
        

    def query (self, qtype='cql'):
        "perform query"
        if self.default_attr:
            qbase = 'a%s,' % self.default_attr 
        else:
            qbase = 'q'
        self.q = [qbase + self._compile_query()]
        return self.view()

    query.template = 'view.tmpl'


    def set_first_query (self, fc_lemword_window_type='',
                               fc_lemword_wsize=0,
                               fc_lemword_type='',
                               fc_lemword='',
                               fc_pos_window_type='',
                               fc_pos_wsize=0,
                               fc_pos_type='',
                               fc_pos=[]):
        'first query screen'
        def append_filter (attrname, items, ctx, fctxtype):
            if not items:
                return
            if fctxtype == 'any':
                self.q.append ('p%s [%s]' %
                               (ctx, '|'.join (['%s="%s"' % (attrname, i)
                                                for i in items])))
            elif fctxtype == 'none':
                self.q.append ('n%s [%s]' %
                          (ctx, '|'.join (['%s="%s"' % (attrname, i)
                                           for i in items])))
            elif fctxtype == 'all':
                for i in items:
                    self.q.append ('p%s [%s="%s"]' % (ctx, attrname, i))
                
        if 'lemma' in self._corp().get_conf('ATTRLIST').split(','):
            lemmaattr = 'lemma'
        else:
            lemmaattr = 'word'
        wposlist = dict (self.cm.corpconf_pairs (self._corp(), 'WPOSLIST'))
        if self.default_attr:
            qbase = 'a%s,' % self.default_attr 
        else:
            qbase = 'q'
        texttypes = self._texttype_query()
        if texttypes:
            ttquery = ' '.join (['within <%s %s />' % nq for nq in texttypes])
        else:
            ttquery = ''
        self.q = [qbase + self._compile_query() + ttquery]

        if fc_lemword_window_type == 'left':
            append_filter (lemmaattr,
                           fc_lemword.split(),
                           '-%i -1 -1' % fc_lemword_wsize,
                           fc_lemword_type)
        elif fc_lemword_window_type == 'right':
            append_filter (lemmaattr,
                           fc_lemword.split(),
                           '1 %i 1' % fc_lemword_wsize,
                           fc_lemword_type)
        elif fc_lemword_window_type == 'both':
            append_filter (lemmaattr,
                           fc_lemword.split(),
                           '-%i %i 1' % (fc_lemword_wsize, fc_lemword_wsize),
                           fc_lemword_type)
        if fc_pos_window_type == 'left':
            append_filter ('tag',
                           [wposlist.get(t,'') for t in fc_pos],
                           '-%i -1 -1' % fc_pos_wsize,
                           fc_pos_type)
        elif fc_pos_window_type == 'right':
            append_filter ('tag',
                           [wposlist.get(t,'') for t in fc_pos],
                           '1 %i 1' % fc_pos_wsize,
                           fc_pos_type)
        elif fc_pos_window_type == 'both':
            append_filter ('tag',
                           [wposlist.get(t,'') for t in fc_pos],
                           '-%i %i 1' % (fc_pos_wsize, fc_pos_wsize),
                           fc_pos_type)


    def first (self, fc_lemword_window_type='',
                     fc_lemword_wsize=0,
                     fc_lemword_type='',
                     fc_lemword='',
                     fc_pos_window_type='',
                     fc_pos_wsize=0,
                     fc_pos_type='',
                     fc_pos=[]):
        self.set_first_query(fc_lemword_window_type,
                             fc_lemword_wsize,
                             fc_lemword_type,
                             fc_lemword,
                             fc_pos_window_type,
                             fc_pos_wsize,
                             fc_pos_type,
                             fc_pos)

        return self.view()
    
    first.template = 'view.tmpl'
    add_vars['first'] = ['TextTypeSel', 'LastSubcorp']

    def filter_form (self):
        self.lemma = ''
        self.lpos = ''
        return {}
    add_vars['filter_form'] = ['TextTypeSel', 'LastSubcorp', 'concsize']

    def filter (self, pnfilter='', filfl='f', filfpos='-5', filtpos='5'):
        "Positive/Negative filter"
        if pnfilter not in ('p','n'):
            raise ConcError (_('Select Positive or Negative filter type'))
        rank = {'f':1, 'l':-1}.get (filfl, 1)
        texttypes = self._texttype_query()
        try:
            query = self._compile_query()
        except ConcError:
            if texttypes: query = '[]'; filfpos='0'; filtpos='0'
            else: raise ConcError (_('No query entered.'))
        query +=  ' '.join (['within <%s %s />' % nq for nq in texttypes])
        if not self.default_attr:
            self.q.append ('%s%s %s %i %s' % (pnfilter, filfpos, filtpos, rank, query))
        else:
            self.q.append ('%s%s %s %i %s,%s' % (pnfilter, filfpos, filtpos, rank, self.default_attr, query))
        try:
            return self.view()
        except Exception, e:
            del self.q[-1]; raise
    filter.template = 'view.tmpl'
    add_vars['filter'] = ['orig_query']

    add_vars['reduce'] = ['concsize'] 
    def reduce (self, rlines='250'):
        "random sample"
        self.q.append ('r' + rlines)
        return self.view({ 'rlines_info' : _('random <strong>%s</strong> displayed') % rlines })
       
    reduce.template = 'view.tmpl'

    add_vars['freq'] = ['concsize'] 
    def freq (self):
        "frequency list form"
        return {'Pos_ctxs': conclib.pos_ctxs(1,1)}

    fcrit = []
    add_vars['freqs'] = ['concsize'] 
    def freqs (self, fcrit=[], flimit=0, freq_sort='', ml=0):
        "display a frequecy list"
        def parse_fcrit(fcrit):
            attrs, marks, ranges = [], [], []
            for i, item in enumerate(fcrit.split()):
                if i % 2 == 0: attrs.append(item)
                if i % 2 == 1: ranges.append(item)
            return attrs, ranges

        def is_non_structural_attr(criteria):
            crit_attrs = set(re.findall(r'(\w+)/\s+-?[0-9]+[<>][0-9]+\s*', criteria))
            if len(crit_attrs) == 0:
                crit_attrs = set(re.findall(r'(\w+\.\w+)\s+[0-9]+', criteria))
            attr_list = set(self._curr_corpus.get_conf('ATTRLIST').split(','))
            return crit_attrs <= attr_list

        def escape_query_value(s):
            ans = s
            t = {
                '"' : r'\"',
                '<' : r'\<',
                '>' : r'\>',
                '.' : r'\.',
                ',' : r'\,',
                '?' : r'\?',
                '*' : r'\*',
                '[' : r'\[',
                ']' : r'\]',
                '{' : r'\{',
                '}' : r'\}',
                '+' : r'\+',
                ')' : r'\)',
                '(' : r'\(',
            }
            for k, v in t.items():
                ans = ans.replace(k, v)
            return ans

        fcrit_is_all_nonstruct = True
        for fcrit_item in fcrit:
            fcrit_is_all_nonstruct = (fcrit_is_all_nonstruct and is_non_structural_attr(fcrit_item))

        if fcrit_is_all_nonstruct:
            rel_mode = 1
        else:
            rel_mode = 0

        corp = self._corp()
        conc = self.call_function (conclib.get_conc, (self._corp(),))
        result = {
            'fcrit': self.urlencode ([('fcrit', self.rec_recode(cr))
                                      for cr in fcrit]),
            'FCrit': [{'fcrit': cr} for cr in fcrit],
            'Blocks': [conc.xfreq_dist (cr, flimit, freq_sort, 300, ml,
                self.ftt_include_empty, rel_mode) for cr in fcrit],
            'paging': 0,
            'concsize' : conc.size(),
            'fmaxitems' : self.fmaxitems
        }
        if not result['Blocks'][0]: raise ConcError(_('Empty list'))
        if len(result['Blocks']) == 1: # paging
            items_per_page = self.fmaxitems
            fstart = (self.fpage - 1) * self.fmaxitems
            self.fmaxitems = self.fmaxitems * self.fpage + 1
            result['paging'] = 1
            if len(result['Blocks'][0]['Items']) < self.fmaxitems:
                result['lastpage'] = 1
            else:
                result['lastpage'] = 0
            result['Blocks'][0]['Total'] = len(result['Blocks'][0]['Items'])
            result['Blocks'][0]['TotalPages'] = int(math.ceil(result['Blocks'][0]['Total'] / float(items_per_page)))
            result['Blocks'][0]['Items'] = result['Blocks'][0]['Items'][fstart:self.fmaxitems-1]

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
                if attr.endswith('/i'): icase = '(?i)'; attr = attr[:-2]
                else: icase = ''; attr = attr.strip('/')
                for ii, item in enumerate(block['Items']):
                    if not item['freq']: continue
                    if not '.' in attr:
                        if attr in corp.get_conf('ATTRLIST').split(','):
                            wwords = item['Word'][level]['n'].split('  ') # two spaces
                            m = re.search('(-?\d+)([<>].*)$', begin)
                            if m:
                                end = str(int(m.group(1)) + len(wwords) - 1) \
                                      + m.group(2)
                            else:
                                end = str(len(wwords) - 1) + '<0'
                                begin += '<0'
                            fquery = '%s %s 1 ' % (begin, end)
                            fquery += ''.join(['[%s="%s%s"]'
                                % (attr, icase, escape(escape_query_value(w))) for w in wwords ])
                        else: # structure number
                            fquery = '0 0<0 1 [] within <%s #%s/>' % \
                                      (attr, item['Word'][0]['n'].split('#')[1])
                    else: # text types
                        fquery = '0 0 1 [] within <%s %s="%s" />' %\
                                 (attr.split('.')[0], attr.split('.')[1],
                                  item['Word'][0]['n'])
                    fquery = self.urlencode(fquery)
                    item['pfilter'] += ';q=p%s' % fquery
                    item['nfilter'] += ';q=n%s' % fquery
        return result

    add_vars['savefreq_form'] = ['concsize'] 
    def savefreq_form (self, fcrit=[]):
        return {'FCrit': [{'fcrit': cr} for cr in fcrit]}

    def savefreq (self, fcrit=[], flimit=0, freq_sort='', ml=0, heading=0,
                  saveformat='text', maxsavelines=1000):
        "save a frequecy list"
        if self.pages:
            if maxsavelines < self.fmaxitems: self.fmaxitems = maxsavelines
        else:
            self.fpage = 1
            self.fmaxitems = maxsavelines
        result = self.freqs (fcrit, flimit, freq_sort, ml)
        if saveformat == 'xml':
            self._headers['Content-Type'] = 'application/XML'
            self._headers['Content-Disposition'] = 'inline; filename="freq.xml"'
            for b in result['Blocks']:
                b['blockname'] = b['Head'][0]['n']
        else:
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'inline; filename="freq.txt"'
        return result
    add_vars['savefreq'] = ['Desc']
    
    def freqml (self, flimit=0, freqlevel=1,
                ml1attr='word', ml1pos=1, ml1icase='', ml1fcode='rc',
                ml2attr='word', ml2pos=1, ml2icase='', ml2fcode='rc',
                ml3attr='word', ml3pos=1, ml3icase='', ml3fcode='rc',
                ml1ctx='0', ml2ctx='0', ml3ctx='0'):
        "multilevel frequecy list"
        fcrit = onelevelcrit ('', ml1attr, ml1ctx, ml1pos, ml1fcode, ml1icase)
        if freqlevel > 1:
            fcrit += onelevelcrit (' ', ml2attr, ml2ctx, ml2pos, ml2fcode,
                                   ml2icase)
            if freqlevel > 2:
                fcrit += onelevelcrit (' ', ml3attr, ml3ctx, ml3pos,
                                       ml3fcode, ml3icase)
        result = self.freqs ([fcrit], flimit, '', 1)
        result['ml'] = 1
        #result['concsize'] = self.
        return result
    freqml.template = 'freqs.tmpl'

    def freqtt (self, flimit=0, fttattr=[]):
        if not fttattr:
            self.exceptmethod = 'freq'
            raise ConcError(_('No text type selected'))
        return self.freqs (['%s 0' % a for a in fttattr], flimit)
    freqtt.template = 'freqs.tmpl'

    cattr = 'word'
    csortfn = 'd'
    cbgrfns = 'mtd'
    cfromw = -5
    ctow = 5
    cminfreq = 5
    cminbgr = 3
    citemsperpage = 50
    
    add_vars['coll'] = ['concsize'] 
    def coll (self):
        "collocations form"
        corp = self._corp()
        colllist = corp.get_conf('ATTRLIST').split(',')
        out = {'Coll_attrlist': [{'n': n,
                                  'label': corp.get_conf (n+'.LABEL') or n}
                                 for n in colllist],
               'Pos_ctxs': conclib.pos_ctxs(1,1)}
        return out

    add_vars['collx'] = ['concsize']

    def collx (self, csortfn='d', cbgrfns=['t','m', 'd']):
        "list collocations"
        collstart = (self.collpage - 1) * self.citemsperpage
        self.cbgrfns = ''.join (cbgrfns)
        if csortfn is '' and cbgrfns:
            self.csortfn = cbgrfns[0]
        conc = self.call_function (conclib.get_conc, (self._corp(),))

        result = conc.collocs(cattr=self.cattr, csortfn=self.csortfn, cbgrfns=self.cbgrfns,
                cfromw=self.cfromw, ctow=self.ctow, cminfreq=self.cminfreq, cminbgr=self.cminbgr,
                from_idx=collstart, max_lines=self.citemsperpage)
        if collstart + self.citemsperpage < result['Total']:
            result['lastpage'] = 0
        else:
            result['lastpage'] = 1
        return result


    def save_coll_options(self, cbgrfns=['t','m']):
        out = self.coll()
        self.cbgrfns = ''.join(cbgrfns)
        self._save_options(['cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr',
                            'collpage', 'citemsperpage', 'cbgrfns', 'csortfn'], self.corpname)
        out['saved_attrs'] = 1
        return out

    save_coll_options.template = 'coll.tmpl'


    def savecoll (self, csortfn='', cbgrfns=['t','m'], saveformat='text',
                  heading=0, maxsavelines=1000):
        "save collocations"
        if not self.pages:
            self.collpage = 1
            self.citemsperpage = maxsavelines
        result = self.collx(csortfn, cbgrfns)
        if saveformat == 'xml':
            self._headers['Content-Type'] = 'application/XML'
            self._headers['Content-Disposition'] = 'inline; filename="coll.xml"'
            result['Scores'] = result['Head'][2:]
        else:
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'inline; filename="coll.txt"'
        return result
    add_vars['savecoll'] = ['Desc', 'concsize']


    def structctx (self, pos=0, struct='doc'):
        "display a hit in a context of a structure"
        s = self._corp().get_struct(struct)
        struct_id = s.num_at_pos(pos)
        beg, end = s.beg(struct_id), s.end(struct_id)
        self.detail_left_ctx = pos - beg
        self.detail_right_ctx = end - pos - 1
        result = self.widectx(pos)
        result ['no_display_links'] = True
        return result

    structctx.template = 'widectx.tmpl'

        
    def widectx (self, pos=0):
        "display a hit in a wider context"
        return self.call_function (conclib.get_detail_context, (self._corp(),
                                                                pos))

    def fullref (self, pos=0):
        "display a full reference"
        return self.call_function (conclib.get_full_ref, (self._corp(), pos))

    def draw_graph (self, fcrit='', flimit=0):
        "draw frequency distribution graph"
        self._headers['Content-Type']= 'image/png'
        self.fcrit = fcrit
        conc = self.call_function (conclib.get_conc, (self._corp(),))
#        print 'Content-Type: text/html; charset=iso-8859-2\n'
        return self.call_function (conc.graph_dist, (fcrit, flimit))

    def clear_cache (self, corpname=''):
        if not corpname: corpname = self.corpname
        os.system ('rm -rf %s/%s' % (self.cache_dir, corpname))
        return 'Done: rm -rf %s/%s' % (self.cache_dir, corpname)

    def build_arf_db (self, corpname='', attrname=''):
        if not corpname: corpname = self.corpname
        if os.path.isfile (corplib.subcorp_base_file(self._corp(), attrname)
                           + '.arf'):
            return 'Finished'
        out = corplib.build_arf_db (self._corp(), attrname)
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
                    xxx = int(lines[1].strip());
                    out = (lines[1], lines[-1])
                except:
                    out = (lines[0], lines[-1])
            else:
                out = ('', lines[-1])
            logfile.close()
        else: out = ('', '')
        return out

    def kill_histogram_processing(self):
        import glob
        pid = self.check_histogram_processing()[0].strip()
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
    add_vars['kill_histogram_processing'] = ['LastSubcorp']

    def findx_form (self):
        out = {'Histlist': []}
        try: import genhist
        except: return out
        histpath = self._corp().get_conf('WSHIST')
        histpath_custom = os.path.join(self.subcpath[-1], self.corpname,
                                                             'histograms.def')
        histlist = []
        if os.path.isfile(histpath):
            histlist.extend(genhist.parse_config_file (open(histpath)))
        if os.path.isfile(histpath_custom):
            histlist.extend(genhist.parse_config_file (open(histpath_custom)))
        histlist_ids = []
        for hist in histlist:
            id = hist.get_id()
            if id not in histlist_ids:
                histlist_ids.append(id)
                out['Histlist'].append({'name': hist.get_attr('HR'), 'id': id})
        return out 

    wlminfreq = 5
    wlmaxitems = 100
    wlicase = 0
    wlwords = []
    blacklist = []
    def wordlist_form (self, ref_corpname=''):
        "Word List Form"
        nogenhist = 0
        corp = self._corp()
        attrlist = corp.get_conf('ATTRLIST').split(',')
        out = {'Attrlist': [{'n': n, 'label': corp.get_conf (n+'.LABEL') or n}
                            for n in attrlist]}
            # set reference corpus and reference subcorp list (for keywords)
        if not ref_corpname: ref_corpname = self.corpname
        refcm = corplib.CorpusManager ([ref_corpname], self.subcpath)
        out['RefSubcorp'] = refcm.last_subcorp_names (ref_corpname)
        out['ref_corpname'] = ref_corpname
        return out
    add_vars['wordlist_form'] = ['LastSubcorp']

    def findx_upload_form(self):
        out = {}
        out['processing'] = self.check_histogram_processing()[1]
        return out


    def get_wl_words(self, attrnames=('wlfile', 'wlcache')):
            # gets arbitrary list of words for wordlist
        wlfile = getattr(self, attrnames[0], '')
        wlcache = getattr(self, attrnames[1], '')
        filename = wlcache; wlwords = []
        if wlfile: # save a cache file
            try:
                from hashlib import md5
            except ImportError:
                from md5 import new as md5
            filename = os.path.join(self.cache_dir, self.corpname,
                                    md5(wlfile).hexdigest() + '.wordlist')
            cache_file = open(filename, 'w')
            cache_file.write(wlfile)
            cache_file.close()
            wlwords = [w.strip() for w in wlfile.split('\n')]
        if wlcache: # read from a cache file
            filename = os.path.join(self.cache_dir, self.corpname, wlcache)
            cache_file = open(filename)
            wlwords = [w.strip() for w in cache_file]
            cache_file.close()
        return wlwords, os.path.basename(filename)


    include_nonwords = 0
    wltype = 'simple'
    wlnums = 'frq'

    def wordlist (self, wlpat='', wltype='simple', corpname='', usesubcorp='',
                  ref_corpname='', ref_usesubcorp='', wlpage=1):
        if not wlpat: self.wlpat = '.*'
        if '.' in self.wlattr:
            if wltype != 'simple':
                raise ConcError(_('Text types are limited to Simple output'))
            if self.wlnums == 'arf':
                raise ConcError(_('ARF cannot be used with text types'))
            elif self.wlnums == 'frq':
                self.wlnums = 'doc sizes'
            elif self.wlnums == 'docf':
                self.wlnums = 'frq'
        wlstart = (wlpage - 1) * self.wlmaxitems
        self.wlmaxitems =  self.wlmaxitems * wlpage + 1 # +1 = end detection
        try:
            self.wlwords, self.wlcache = self.get_wl_words()
            self.blacklist, self.blcache = self.get_wl_words(('wlblacklist',
                                                                    'blcache'))
            if wltype == 'keywords':
                out = self.call_function (corplib.subc_keywords_onstr,
                           ( self.cm.get_Corpus (corpname, usesubcorp),
                             self.cm.get_Corpus (ref_corpname, ref_usesubcorp),
                             self.wlattr ))[wlstart:]
                if len(out) < self.wlmaxitems/wlpage: lastpage = 1
                else: lastpage = 0; out = out[:-1]
                self.wlmaxitems -= 1
                return {'Keywords':[{'str': w, 'score': round(s,1),
                                     'freq': round(f, 1),
                                     'freq_ref': round(fr, 1),
                                     'rel': round(rel, 1),
                                     'rel_ref': round(relref, 1) }
                                 for s, rel, relref, i, iref, f, fr, w in out],
                        'lastpage': lastpage}

            if self.wlwords and self.wlpat == '.*': self.wlsort = ''
            result =  {'Items': self.call_function (corplib.wordlist,
                                       (self._corp(), self.wlwords))[wlstart:]}
            if self.wlwords: result['wlcache'] = self.wlcache
            if self.blacklist: result['blcache'] = self.blcache
            if len(result['Items']) < self.wlmaxitems/wlpage:
                result['lastpage'] = 1
            else:
                result['lastpage'] = 0; result['Items'] = result['Items'][:-1]
            self.wlmaxitems -= 1
            return result
        except corplib.MissingSubCorpFreqFile, subcmiss:
            out = corplib.build_arf_db (subcmiss.args[0], self.wlattr)
            if out: processing = out[1].strip('%')
            else: processing = '0'
            return { 'processing': processing }

    wlstruct_attr1 = ''
    wlstruct_attr2 = ''
    wlstruct_attr3 = ''

    def struct_wordlist (self):
        self.exceptmethod = 'wordlist_form'
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
        if not self.wlstruct_attr3: level = 2
        if not self.wlstruct_attr2: level = 1
        if not self.wlpat and not self.wlwords:
            raise ConcError(_('You must specify either a pattern or a file to get the multilevel wordlist'))
        qparts = []
        if self.wlpat: qparts.append('%s="%s"' % (self.wlattr, self.wlpat))
        if not self.include_nonwords:
            qparts.append('%s!="%s"' % (self.wlattr,
                                        self._corp().get_conf('NONWORDRE')))
        if self.wlwords:
            qq = ['%s=="%s"' % (self.wlattr, w.strip()) for w in self.wlwords]
            qparts.append('(' + '|'.join(qq) + ')')
        for w in self.blacklist:
            qparts.append('%s!=="%s"' % (self.wlattr, w.strip()))
        self.q = ['q[' + '&'.join(qparts) + ']']
        self.flimit = self.wlminfreq
        return  self.freqml (flimit=self.wlminfreq, freqlevel=level,
                ml1attr=self.wlstruct_attr1, ml2attr=self.wlstruct_attr2,
                ml3attr=self.wlstruct_attr3)
    struct_wordlist.template = 'freqs.tmpl'

    def savewl (self, maxsavelines=1000, wlpat='', keywords='', corpname='',
                usesubcorp='', ref_corpname='', ref_usesubcorp='',
                saveformat='text', heading=0):
        'save word list'
        if saveformat == 'xml':
            self._headers['Content-Type'] = 'application/XML'
            self._headers['Content-Disposition'] = 'inline; filename="wl.xml"'
        else:
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'inline; filename="wl.txt"'
        if not self.pages:
            self.wlpage = 1
            self.wlmaxitems = maxsavelines
        return self.wordlist(wlpat, keywords, corpname, usesubcorp,
                             ref_corpname, ref_usesubcorp, wlpage=self.wlpage)
     
    def wordlist_process (self, attrname=''):
        self._headers['Content-Type']= 'text/plain'
        return corplib.build_arf_db_status (self._corp(), attrname)[1]

    subcnorm = 'tokens'

    def texttypes_with_norms(self, subcorpattrs='', list_all=False,
                                              format_num=True, ret_nums=True):
        corp = self._corp()
        if not subcorpattrs:
            subcorpattrs = corp.get_conf ('SUBCORPATTRS') \
                               or corp.get_conf ('FULLREF')
        if not subcorpattrs or subcorpattrs == '#':
            return { 'error': _('No meta-information to create a subcorpus.'),
                     'Normslist': [], 'Blocks': [],
                   }
        maxlistsize = settings.get_int('global', 'max_attr_list_size')
        tt = corplib.texttype_values(corp, subcorpattrs, maxlistsize, list_all)
        if not ret_nums: return {'Blocks': tt, 'Normslist': []}
        basestructname = subcorpattrs.split('.')[0]
        struct = corp.get_struct (basestructname)
        normvals = {}
        if self.subcnorm not in ('freq', 'tokens'):
            try:
                nas = struct.get_attr (self.subcnorm).pos2str
            except conclib.manatee.AttrNotFound, e:
                self.error = str(e)
                self.subcnorm = 'freq'
        if self.subcnorm == 'freq':
            normvals = dict ([(struct.beg(i),1)
                              for i in range (struct.size())])
        elif self.subcnorm == 'tokens':
            normvals = dict ([(struct.beg(i), struct.end(i)-struct.beg(i))
                              for i in range (struct.size())])
        else:
            def safe_int (s):
                try: return int(s)
                except: return 0
            normvals = dict ([(struct.beg(i), safe_int (nas(i)))
                              for i in range (struct.size())])

        def compute_norm (attrname, attr, val):
            valid = attr.str2id(str(val))
            r = corp.filter_query (struct.attr_val (attrname, valid))
            cnt = 0
            while not r.end():
                cnt += normvals[r.peek_beg()]
                r.next()
            return cnt

        for item in tt:
            for col in item['Line']:
                if col.has_key('textboxlength'): continue
                if not col['name'].startswith(basestructname):
                    col['textboxlength'] = 30; continue
                attr = corp.get_attr(col['name'])
                aname = col['name'].split('.')[-1]
                for val in col['Values']:
                    if format_num:
                        val['xcnt'] = formatnum(compute_norm(
                                                    aname, attr, val['v']))
                    else:
                        val['xcnt'] = compute_norm(aname, attr, val['v'])
        return {'Blocks': tt, 'Normslist': self.get_normslist(basestructname)}

    def get_normslist(self, structname):
        corp = self._corp()
        normsliststr = corp.get_conf ('DOCNORMS')
        normslist = [{'n':'freq', 'label': _('Document counts') },
                     {'n':'tokens', 'label':_('Tokens') }]
        if normsliststr:
            normslist += [{'n': n, 'label': corp.get_conf (structname + '.'
                                                          + n + '.LABEL') or n}
                          for n in normsliststr.split(',')]
        else:
            try:
                corp.get_attr(structname + ".wordcount")
                normslist.append({'n':'wordcount', 'label':'Word counts'})
            except:# conclib.manatee.AttrNotFound:
                pass
        return normslist

    def subcorp_form (self, subcorpattrs='', subcname='', within_condition='', within_struct='', method='gui'):
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
        tt_sel = self.texttypes_with_norms()
        structs_and_attrs = {}
        for s, a in [ t.split('.') for t in self._curr_corpus.get_conf('STRUCTATTRLIST').split(',')]:
            if not s in structs_and_attrs:
                structs_and_attrs[s] = []
            structs_and_attrs[s].append(a)

        if tt_sel.has_key('error'):
            return {
                'error': tt_sel['error'],
                'TextTypeSel': tt_sel,
                'structs_and_attrs' : structs_and_attrs,
                'method' : method,
                'within_condition' : '',
                'within_struct' : '',
                'subcname' : ''
            }
        return {
            'TextTypeSel': tt_sel,
            'structs_and_attrs' : structs_and_attrs,
            'method' : method,
            'within_condition' : within_condition,
            'within_struct' : within_struct,
            'subcname' : subcname
        }

    def _texttype_query (self):
        scas = [(a[4:], getattr (self, a))
                for a in dir(self) if a.startswith ('sca_')]
        structs = {}
        for sa, v in scas:
            if type(v) is type('') and '|' in v:
                v = v.split('|')
            s, a = sa.split('.')
            if type(v) is type([]):
                query = '(%s)' % ' | '.join (['%s="%s"' % (a,escape(v1))
                                              for v1 in v])
            else:
                query = '%s="%s"' % (a,escape(v))
            if structs.has_key (s):
                structs[s].append (query)
            else:
                structs[s] = [query]
        return [(sname, ' & '.join(subquery)) for
                sname, subquery in structs.items()]
        
    def subcorp (self, subcname='', delete='', create=False, within_condition='', within_struct='', method=''):
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
        if delete:
            base = os.path.join (self.subcpath[-1], self.corpname, subcname)
            for e in ('.subc', '.used'):
                if os.path.isfile (base + e):
                    os.unlink (base + e)
        if within_condition and within_struct:
            tt_query = [(within_struct, within_condition)]
        else:
            tt_query = self._texttype_query()

        if create and not subcname:
            raise ConcError (_('No subcorpus name specified!'))
        if (not subcname or (not tt_query and delete)
            or (subcname and not delete and not create)):
            subcList = self.cm.subcorp_names (self.corpname)
            if subcList:
                subcname = subcList[0]['n']
            return {'subcname': subcname,
                    'SubcorpList': self.cm.subcorp_names (self.corpname)}
        basecorpname = self.corpname.split(':')[0]
        path = os.path.join (self.subcpath[-1], basecorpname)
        if not os.path.isdir (path):
            os.makedirs (path)
        path = os.path.join (path, subcname) + '.subc'
        # XXX ignoring more structures
        if not tt_query:
            raise ConcError (_('Nothing specified!'))

        structname, subquery = tt_query[0]
        if type(path) == unicode:
            path = path.encode("utf-8")
        if conclib.manatee.create_subcorpus (path, self._corp(), structname,
                                             subquery):
            finalname = '%s:%s' % (basecorpname, subcname)
            sc = self.cm.get_Corpus (finalname)
            return {
                'subcorp': finalname,
                'corpsize': formatnum (sc.size()),
                'subcsize': formatnum (sc.search_size()),
                'SubcorpList': self.cm.subcorp_names (self.corpname),
                'method' : method,
                'within_condition' : within_condition,
                'within_struct' : within_struct,
                'subcname' : subcname
            }
        else:
            raise ConcError (_('Empty subcorpus!'))

    def subcorp_info (self, subcname=''):
        sc = self.cm.get_Corpus (self.corpname, subcname)
        return {'subcorp': subcname,
                'corpsize': formatnum (sc.size()),
                'subcsize': formatnum (sc.search_size())}
#    subcorp_info.template = """<b><TMPL_VAR subcname></b><br>
#        <TMPL_VAR subcsize> <i>of</i> <TMPL_VAR corpsize> <i>tokens</i>"""

    def attr_vals (self, avattr='', avpat=''):
        self._headers['Content-Type'] = ' text/html'
        return corplib.attr_vals(self.corpname, avattr, avpat)

    def delsubc_form (self):
        subc = conclib.manatee.StrVector()
        conclib.manatee.find_subcorpora (self.subcpath[-1], subc)
        return {'Subcorplist': [{'n': c} for c in subc],
                'subcorplist_size': min (len(subc), 20)}

    def delsubc (self, subc=[]):
        base = self.subcpath[-1]
        for subcorp in subc:
            cn, sn = subcorp.split (':',1)
            try:
                os.unlink (os.path.join (base, cn, sn) + '.subc')
            except:
                pass
        return 'Done'
    delsubc.template = 'subcorp_form'

    maxsavelines=1000
    def saveconc (self, maxsavelines=1000, saveformat='text', pages=0, fromp=1,
                  heading=0, align_kwic=0, numbering=0, leftctx='40', rightctx='40'):

        if leftctx.find(':') == -1:  # '#' would not pass the addressline
            lctx = leftctx + '#'
        else:
            lctx = leftctx
        if rightctx.find(':') == -1:
            rctx = rightctx + '#'
        else:
            rctx = rightctx

        conc = self.call_function (conclib.get_conc, (self._corp(),))
        if saveformat == 'xml':
            self._headers['Content-Type'] = 'application/XML'
            self._headers['Content-Disposition'] = 'inline; filename="conc.xml"'
        else:
            self._headers['Content-Type'] = 'application/text'
            self._headers['Content-Disposition'] = 'inline; filename="conc.txt"'
        ps = self.pagesize
        if pages:
            if maxsavelines < self.pagesize:
                ps = maxsavelines
        else:
            fromp = 1
            ps = maxsavelines
        labelmap = {}
        if self.annotconc:
            try:
                anot = self._get_annotconc()
                conc.set_linegroup_from_conc (anot)
                labelmap = anot.labelmap
            except conclib.manatee.FileAccessError:
                pass
        contains_speech = settings.has_configured_speech(self._curr_corpus)
        return self.call_function (conclib.kwicpage, (self._curr_corpus, conc, contains_speech), fromp=fromp,
                                   pagesize=ps, labelmap=labelmap, align=[],
                                   leftctx=lctx, rightctx=rctx)
    add_vars['saveconc'] = ['Desc', 'concsize']

    def _storeconc_path (self, annotconc=None):
        #stderr.write ('storedconc_path: dir: %s, corp: %s, annot: %s\n' %
        #              (self._conc_dir, self.corpname.split, self.annotconc))
        return os.path.join (self._conc_dir, self.corpname.split(':')[0],
                             annotconc or self.annotconc)
    
    def storeconc (self, storeconcname=''):
        conc = self.call_function (conclib.get_conc, (self._corp(),))
        self.annotconc = storeconcname
        cpath = self._storeconc_path()
        cdir = os.path.dirname (cpath)
        if not os.path.isdir (cdir):
            os.makedirs (cdir)
        conc.save (cpath + '.conc')
        um=os.umask (self.annotconc_info_umask)
        labels ='\n'.join(['<li><n>%i</n><lab>%s</lab></li>' % (n+1,x)
                           for (n,x) in enumerate(self.annotconc_init_labels)])
        labels = '<concinfo>\n<labels>\n%s\n</labels>\n</concinfo>\n' % labels
        open (cpath + '.info', 'w').write (labels)
        os.umask (um)
        #print >>stderr, 'save conc: "%s"' % cpath
        self._cookieattrs.append ('annotconc')
        return {'stored': storeconcname}
    storeconc.template = 'saveconc_form.tmpl'
    add_vars['storeconc'] = ['Desc']

    def storeconc_fromlemma (self, lemma='', lpos='-v'):
        import re
        num = re.search ('-\d+$', lemma)
        if num:
            annotname = lemma
            lemma = lemma [:num.start()]
        else:
            annotname = lemma
        if 'lempos' in self._corp().get_conf('ATTRLIST').split(','):
            self.q = ['q[lempos="%s%s"]' % (lemma, lpos)]
            annotname += lpos
        else:
            self.q = ['q[lemma="%s"]' % lemma]
        if not self._selectstored (annotname):
            self.storeconc (annotname)
        self.annotconc = annotname
        try:
            return self.view()
        except ConcError:
            self.exceptmethod = 'first_form'
            raise
            
    storeconc_fromlemma.template = 'view.tmpl'


    def _selectstored (self, annotconc):
        if os.path.exists (self._storeconc_path(annotconc) + '.conc'):
            self._cookieattrs.append ('annotconc')
            return True
        return False
 
    def selectstored (self, annotconc='', storedconcnumber=200):
        out = {}
        if self._selectstored (annotconc):
            out['selected'] = annotconc
            if annotconc.startswith('cpa'):
                out['lemma'] = annotconc[6:]
            else:
                out['lemma'] = annotconc
        self.annotconc, annotconc_saved = '', self.annotconc
        stored = [(os.stat(c).st_mtime, c)
                  for c in glob.glob (self._storeconc_path() + '*.conc')]
        stored.sort(reverse=True)
        #stderr.write('selectstored (%s)[%s]:%s\n' %(self._user, self._conc_dir, stored))
        del stored[storedconcnumber:]
        self.annotconc = annotconc_saved
        out['LastStoredConcs'] = [{'n': os.path.basename(c)[:-5]} for t,c in stored]
        return out

    def _get_annotconc (self):
        return conclib.get_stored_conc (self._corp(), self.annotconc, 
                                        self._conc_dir)

    def _save_lngroup_log (self, log):
        logf = open (self._storeconc_path() + '.log', 'a')
        conclib.flck_ex_lock(logf)
        actionid = hex(hash(tuple(log)))[2:]
        logf.write('Time: %s\n' % time.strftime('%Y-%m-%d %H:%M:%S'))
        logf.write('User: %s\n' % self._user)
        logf.write('Start: #%s#\n' % actionid)
        for toknum, orggrp in log:
            logf.write('%d\t%d\n' % (toknum, orggrp))
        logf.write('End: #%s#\n' % actionid)
        conclib.flck_unlock(logf)
        #print >>stderr, 'locking log file finished', 
        logf.close()
        return actionid

    def undolngroupaction (self, action=''):
        conc = self._get_annotconc()
        logf = open (self._storeconc_path() + '.log')
        process_tokens = False
        log = []
        for line in logf:
            if line.startswith ('Start: #%s#' % action):
                process_tokens = True
            elif line.startswith ('End: #%s#' % action):
                break
            elif process_tokens:
                toknum, lngrp = map (int, line.split())
                log.append((toknum, conc.set_linegroup_at_pos (toknum, lngrp)))
        actionid = self._save_lngroup_log (log)
        conc.save (self._storeconc_path() + '.conc', 1)
        return {'actionid': actionid, 'count': len(log)}
    undolngroupaction.return_type = 'json'

    def setlngroup (self, toknum='', group=0):
        if not self.annotconc:
            return 'No concordance selected'
        conc = self._get_annotconc()
        log = []
        for tn in toknum.strip().split():
            tni = int(tn)
            log.append((tni,conc.set_linegroup_at_pos (tni, group)))
        actionid = self._save_lngroup_log (log)
        conc.save (self._storeconc_path() + '.conc', 1)
        lab = conc.labelmap.get (group, group)
        return {'actionid': actionid, 'label': lab, 'count': len(log)}
    setlngroup.return_type = 'json'

    def setlngroupglobally (self, group=0):
        if not self.annotconc:
            return 'No concordance selected'
        anot = self._get_annotconc()
        conc = self.call_function (conclib.get_conc, (self._corp(),))
        conc.set_linegroup_from_conc (anot)
        # create undo log
        kl = conclib.manatee.KWICLines (conc, '', '', '', '', '', '')
        log = []
        for i in range (conc.size()):
            kl.nextcontext(i)
            log.append((kl.get_pos(), kl.get_linegroup()))
        actionid = self._save_lngroup_log (log)
        conc.set_linegroup_globally (group)
        anot.set_linegroup_from_conc (conc)
        anot.save (self._storeconc_path() + '.conc', 1)
        lab = anot.labelmap.get (group, group)
        return {'actionid': actionid, 'label': lab, 'count': len(log)}
    setlngroupglobally.return_type = 'json'

    def addlngrouplabel (self, annotconc='', newlabel=''):
        ipath = self._storeconc_path() + '.info'
        labelmap = conclib.get_conc_labelmap (ipath)
        if not newlabel:
            firstparts =  [int(x[0][1])
                           for x in [conclib.lngrp_sortcrit(l)
                                     for l in labelmap.values() if l]
                           if x[0][0] == 'n']
            if not firstparts:
                newlabel = '1'
            else:
                newlabel = str (max(firstparts) + 1)

        def _addlngrouplabel_into_map (newlabel, labelmap):
            ids = labelmap.items()
            freeids = map (str, range (1,len(ids) +2))
            #stderr.write('addlngrouplabel: ids: %s, freeids:%s' % (ids, freeids))
            for n,l in ids:
                try:
                    freeids.remove(n)
                except ValueError:
                    pass
                if l == newlabel:
                    break
            else:
                import xml.etree.ElementTree as ET
                try:
                    itree = ET.parse (ipath)
                except IOError, err:
                    itree = ET.ElementTree (ET.fromstring('<concinfo>\n<labels>\n</labels>\n</concinfo>\n'))
                li = ('<li><n>%s</n><lab>%s</lab></li>\n'
                      % (freeids[0], newlabel))
                itree.find('labels').append(ET.fromstring(li))
                itree.write (ipath)
                labelmap[freeids[0]] = newlabel
        _addlngrouplabel_into_map (newlabel, labelmap)
        try:
            int (newlabel)
            for suff in self.annotconc_num_label_suffixes:
                _addlngrouplabel_into_map (newlabel + suff, labelmap)
        except ValueError:
            pass
        
        self._headers['Content-Type'] = 'text/xml'
        return {'GroupNumbers': conclib.format_labelmap (labelmap)}

    def lngroupinfo (self, annotconc=''):
        # XXX opravit poradne! (_conc_dir)
        conc = self.call_function (conclib.get_conc, (self._corp(),))
        anot = self._get_annotconc()
        conc.set_linegroup_from_conc (anot)
        labelmap = anot.labelmap
        labelmap['0'] = 'Not assigned'
        ids = conclib.manatee.IntVector()
        freqs = conclib.manatee.IntVector()
        conc.get_linegroup_stat (ids, freqs)
        lg = [(labelmap.get(str(i),'#%s'%i), i, f) for i,f in zip (ids, freqs)]
        lg = [(conclib.lngrp_sortcrit(n),n,i,f) for n,i,f in lg]
        lg.sort()
        lgs = [{'name': n, 'freq': f, 'id': i} for s,n,i,f in lg]
        if self.enable_sadd and self.lemma:
            import wsclust
            ws = self.call_function (wsclust.WSCluster, ())
            lgids = labelmap.keys()
            for lg in lgs:
                c1 = conclib.manatee.Concordance (conc)
                c1.delete_linegroups (str(lg['id']), True)
                lg['Sketch'] = ws.get_small_word_sketch (self.lemma,
                                                         self.lpos, c1)
        return {'LineGroups': lgs}

    minbootscore=0.5
    minbootdiff=0.8
    
    def bootstrap (self, annotconc='', minbootscore=0.5, minbootdiff=0.8):
        import wsclust
        annot = self._get_annotconc()
        ws = self.call_function (wsclust.WSCluster, ())
        ws.build_pos2coll_map()
        log = ws.bootstrap_conc (annot, minbootscore, minbootdiff)
        print >>stderr, 'bootstrap', len (log)
        actionid = self._save_lngroup_log (log)
        annot.save (self._storeconc_path() + '.conc', 1)
        del annot
        self.q = ['s' + annotconc]
        out = self.lngroupinfo (annotconc)
        out['auto_annotated'] = len(log)
        return out

    bootstrap.template = 'lngroupinfo.tmpl'
                
    def rename_annot (self, annotconc='', newname=''):
        if not newname:
            return self.lngroupinfo(annotconc)

        for p in glob.glob (self._storeconc_path(annotconc) + '.*'):
            d, f = os.path.split(p)
            if f.startswith (annotconc):
                os.rename (p, os.path.join(d, newname + f[len(annotconc):]))
        self.annotconc = newname
        self._cookieattrs.append ('annotconc')
        return self.lngroupinfo(newname)

    rename_annot.template = 'lngroupinfo.tmpl'


    def ajax_get_corp_details(self):
        """
        """
        #self.format = 'json'
        corp_conf_info = settings.get_corpus_info(self._curr_corpus.corpname)
        ans = {
            'corpname' : self._curr_corpus.get_conf ('NAME'),
            'corpus': self._curr_corpus.get_info(),
            'size': self._curr_corpus.size(),
            'attrlist' : [],
            'structlist' : [],
            'corp_web' : corp_conf_info['web'] if corp_conf_info is not None else ''
        }
        try:
            ans['attrlist'] = [(item, self._curr_corpus.get_attr(item).id_range()) for item in self._curr_corpus.get_conf('ATTRLIST').split(',')]
        except RuntimeError, e:
            logging.getLogger(__name__).warn('%s' % e)
            ans['attrlist'] = [(_('Failed to load'), '')]
        ans['structlist'] = [(item, self._curr_corpus.get_struct(item).size()) for item in self._curr_corpus.get_conf('STRUCTLIST').split(',')]

        return ans
    ajax_get_corp_details.template = 'corpus_details.tmpl'

    def test_tags(self, corpname=''):
        """
        """
        import cgi
        form = cgi.FieldStorage()
        for k in form.keys():
            logging.getLogger(__name__).info('form %s -> %s' % (k, form[k]))
        return { 'corpus_name' : self.corpname if self.corpname else corpname,
                 'num_tag_pos' : settings.get_corpus_info(self.corpname)['num_tag_pos'] }
    test_tags.template = 'tqbtest.tmpl'

    def ajax_get_tag_variants(self, pattern=''):
        """
        """
        import taghelper

        try:
            tag_loader = taghelper.TagVariantLoader(self.corpname, settings.get_corpus_info(self.corpname)['num_tag_pos'])
        except IOError as e:
            raise UserActionException(_('Corpus %s is not supported by this widget.') % self.corpname)

        if len(pattern) > 0:
            ans = tag_loader.get_variant(pattern)
        else:
            ans = tag_loader.get_initial_values()

        return JsonEncodedData(ans)
    ajax_get_tag_variants.return_type = 'json'