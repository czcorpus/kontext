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

import re
import locale
from types import ListType
import os
import cgi
import json

from usercgi import UserCGI
import corplib
import conclib
import version
from CGIPublisher import UserActionException, correct_types
import plugins
import settings
import taghelper
import logging

if not '_' in globals():
    _ = lambda s: s


escape_regexp = re.compile(r'[][.*+{}?()|\\"$^]')


def escape(s):
    return escape_regexp.sub(r'\\\g<0>', s)


try:
    locale.setlocale(locale.LC_NUMERIC, 'en_GB')

    def formatnum(f):

        return locale.format('%.f', f, True)
except locale.Error:
    def formatnum(f):
        return '%.f' % f


def onelevelcrit(prefix, attr, ctx, pos, fcode, icase, bward='', empty=''):
    fromcode = {'lc': '<0', 'rc': '>0', 'kl': '<0', 'kr': '>0'}
    attrpart = '%s%s/%s%s%s ' % (prefix, attr, icase, bward, empty)
    if not ctx:
        ctx = '%i%s' % (pos, fromcode.get(fcode, '0'))
    if '~' in ctx and '.' in attr:
        ctx = ctx.split('~')[0]
    return attrpart + ctx


def validate_range(actual_range, max_range):
    """
    Parameters
    ----------
    actual_range : 2-tuple
    max_range : 2-tuple (if second value is None, that validation of the value is omitted

    Returns
    -------
    None if everything is OK else UserActionException instance
    """
    if actual_range[0] < max_range[0] or (max_range[1] is not None and actual_range[1] > max_range[1]) \
            or actual_range[0] > actual_range[1]:
        if max_range[0] > max_range[1]:
            msg = _('Invalid range - cannot select rows from an empty list.')
        elif max_range[1] is not None:
            msg = _('Range [%s, %s] is invalid. It must be non-empty and within [%s, %s].') \
                    % (actual_range + max_range)
        else:
            msg = _('Range [%s, %s] is invalid. It must be non-empty and left value must be greater or equal than %s') \
                    % (actual_range + (max_range[0], ))
        return UserActionException(msg)
    return None


def choose_selector(args, selector):
    selector += ':'
    s = len(selector)
    for n, v in [(n[s:], v) for n, v in args.items() if n.startswith(selector)]:
        args[n] = v


class ConcError(Exception):
    def __init__(self, msg):
        super(ConcError, self).__init__(msg)


class ConcCGI(UserCGI):
    _conc_state_vars = ('corpname', 'viewmode', 'attrs', 'attr_allpos', 'ctxattrs',
                        'structs', 'refs', 'lemma', 'lpos', 'pagesize',
                        'usesubcorp', 'align', 'copy_icon', 'gdex_enabled',
                        'gdexcnt', 'gdexconf', 'iquery', 'maincorp')
    error = u''
    fc_lemword_window_type = u'both'
    fc_lemword_type = u'all'
    fc_lemword_wsize = 5,
    fc_lemword = u'',
    fc_pos_window_type = u'both'
    fc_pos_type = u'all'
    fc_pos_wsize = 5,
    fc_pos = [],
    ml = 0
    concarf = u''
    Aligned = []
    prevlink = u''
    nextlink = u''
    concsize = u''
    samplesize = 0  # orig 1e7
    Lines = []
    fromp = u'1'
    numofpages = u''
    pnfilter = u'p'
    filfl = u'f'
    filfpos = u'-5'
    filtpos = u'5'
    sicase = u''
    sbward = u''
    ml1icase = u''
    ml2icase = u''
    ml3icase = u''
    ml4icase = u''
    ml1bward = u''
    ml2bward = u''
    ml3bward = u''
    freq_sort = u''
    heading = 0
    saveformat = u'text'
    wlattr = u''
    wlpat = u''
    wlpage = 1
    wlcache = u''
    blcache = u''
    simple_n = 1
    usearf = 0
    collpage = 1
    fpage = 1
    fmaxitems = 50
    ftt_include_empty = u''
    subcsize = 0
    processing = 0
    ref_usesubcorp = u''
    wlsort = u''
    keywords = u''
    Keywords = []
    ref_corpname = u''
    Items = []
    format = u''
    selected = u''
    pages = 0
    leftctx = u''
    rightctx = u''
    numbering = 0
    align_kwic = 0
    stored = u''
    # end

    add_vars = {}
    corpname = None
    usesubcorp = u''
    subcname = u''
    subcpath = []
    _conc_dir = u''
    _home_url = u'../run.cgi/first_form'
    files_path = u'../files'
    css_prefix = u''
    iquery = u''
    queryselector = u'iqueryrow'
    lemma = u''
    lpos = u''
    phrase = u''
    char = u''
    word = u''
    wpos = u''
    cql = u''
    tag = ''
    default_attr = None
    save = 1
    async = 1
    spos = 3
    skey = u'rc'
    qmcase = 0
    rlines = u'250'
    attrs = u'word'
    ctxattrs = u'word'
    attr_allpos = u'kw'
    allpos = u'kw'
    structs = u'p,g,err,corr'
    q = []
    pagesize = 40
    gdexconf = u''
    gdexpath = []  # [('confname', '/path/to/gdex.conf'), ...]
    gdexcnt = 100
    gdex_enabled = 0
    alt_gdexconf = None
    copy_icon = 0
    _avail_tbl_templates = u''
    multiple_copy = 0
    wlsendmail = u''
    cup_hl = u'q'

    sortlevel = 1
    flimit = 0
    freqlevel = 1
    ml1pos = 1
    ml2pos = 1
    ml3pos = 1
    ml4pos = 1
    ml1ctx = u'0~0>0'
    ml2ctx = u'0~0>0'
    ml3ctx = u'0~0>0'
    ml4ctx = u'0~0>0'
    tbl_template = u'none'
    errcodes_link = u''
    hidenone = 1
    helpsite = u'https://trac.sketchengine.co.uk/wiki/SkE/Help/PageSpecificHelp/'

    can_annotate = 0
    enable_sadd = 0
    annotconc = u''

    empty_attr_value_placeholder = ''
    tag_builder_support = []

    alpha_features = 0

    shuffle = 0

    active_menu_item = None
    disabled_menu_items = []
    SubcorpList = []
    save_menu = []
    last_corpus = None

    add_vars['findx_upload'] = [u'LastSubcorp']

    def __init__(self, environ):
        super(UserCGI, self).__init__(environ=environ)
        self._curr_corpus = None
        self.empty_attr_value_placeholder = settings.get('corpora', 'empty_attr_value_placeholder')
        self.root_path = self.environ.get('SCRIPT_NAME', '/')
        self.common_app_bar_url = settings.get('global', 'common_app_bar_url')

    def _log_request(self, user_settings, action_name):
        """
        Logs user's request by storing URL parameters, user settings and user name

        Parameters
        ----------
        user_settings: dict
            settings stored in user's cookie
        action_name: str
            name of the action
        """
        import json
        import datetime

        ans = {
            'date': datetime.datetime.today().strftime('%Y-%m-%d %H:%M:%S'),
            'action': action_name,
            'user': os.getenv('REMOTE_USER'),
            'params': dict([item.split('=', 1) for item in [x for x in os.getenv('QUERY_STRING').split('&') if x]]),
            'settings': user_settings
        }
        logging.getLogger('QUERY').info(json.dumps(ans))

    def _get_persistent_attrs(self):
        """
        Returns list of object's attributes which (along with their values) will be preserved using cookies.
        """
        return ('attrs', 'ctxattrs', 'structs', 'pagesize', 'copy_icon', 'multiple_copy', 'gdex_enabled', 'gdexcnt',
                'gdexconf', 'refs_up', 'shuffle', 'kwicleftctx', 'kwicrightctx', 'ctxunit', 'cup_hl', 'last_corpus')

    def _pre_dispatch(self, selectorname, named_args):
        """
        Runs before main action is processed
        """
        self.environ = os.environ
        named_args.update(self._get_user_settings())

        form = cgi.FieldStorage(keep_blank_values=self._keep_blank_values,
                                environ=self.environ, fp=None)
        self._fetch_corpname(form, named_args)
        self._setup_user(self.corpname)

        if 'json' in form:
            json_data = json.loads(form.getvalue('json'))
            named_args.update(json_data)
        for k in form.keys():
            self._url_parameters.append(k)
            # must remove empty values, this should be achieved by
            # keep_blank_values=0, but it does not work for POST requests
            if len(form.getvalue(k)) > 0 and not self._keep_blank_values:
                named_args[str(k)] = self.recode_input(form.getvalue(k))
        na = named_args.copy()
        correct_types(na, self.clone_self())
        if selectorname:
            choose_selector(self.__dict__, getattr(self, selectorname))
        self.cm = corplib.CorpusManager(plugins.auth.get_corplist(self._user), self.subcpath,
                                        self.gdexpath)
        self._set_defaults()
        self.__dict__.update(na)

    def _post_dispatch(self, methodname, tmpl, result):
        """
        Runs after main action is processed but before any rendering (incl. HTTP headers)
        """
        self.last_corpus = self.corpname
        self._log_request(self._get_persistent_items(), '%s' % methodname)

    def _attach_tag_builder(self, tpl_out):
        """
        Parameters
        ----------
        tpl_out : dict
            data to be used when building an output page from a template
        """
        tpl_out['tag_builder_support'] = {
            '': taghelper.tag_variants_file_exists(self.corpname)
        }
        tpl_out['user_menu'] = True
        if 'Aligned' in tpl_out:
            for item in tpl_out['Aligned']:
                tpl_out['tag_builder_support']['_%s' % item['n']] = taghelper.tag_variants_file_exists(item['n'])

    def _add_save_menu_item(self, label, action, params):
        self.save_menu.append({'label': label, 'action': action, 'params': params})

    def _reset_session_conc(self):
        """
        Resets information about current concordance user works with
        """
        if 'conc' in self._session:
            del(self._session['conc'])

    def _enable_subcorpora_list(self, out):
        """
        Parameters
        ----------
        out : dict
        """
        basecorpname = self.corpname.split(':')[0]
        out['SubcorpList'] = [{'n': '--%s--' % _('whole corpus'), 'v': ''}] \
            + sorted(self.cm.subcorp_names(basecorpname), key=lambda x: x['n'], cmp=locale.strcoll)

    def _save_query(self):
        if plugins.has_plugin('query_storage'):
            q_encoded = self.urlencode([('q', q) for q in self.q])
            url = '%sconcdesc?corpname=%s;usesubcorp=%s;%s' % (settings.get_root_url(), self.corpname,
                                                               self.usesubcorp, q_encoded)
            description = "%s::\n\n\t%s\n" % (_('Parameters'), ';'.join(self.q))
            plugins.query_storage.write(user=self._user, corpname=self.corpname,
                                        url=url, tmp=1, description=description, query_id=None, public=0)

    def _fetch_corpname(self, form, named_args):
        cn = ''
        if 'json' in form:
            import json

            cn = str(json.loads(form.getvalue('json')).get('corpname', ''))
        if 'corpname' in form and not cn:
            cn = form.getvalue('corpname')
        if cn:
            if isinstance(cn, ListType):
                cn = cn[-1]
            if not cn in plugins.auth.get_corplist(self._user):
                raise UserActionException(_('Access to the corpus "%s" or its requested variant denied') % cn)
            self.corpname = cn

        if not self.corpname:
            if named_args.get('last_corpus', None):
                self.corpname = named_args['last_corpus']
            else:
                self.corpname = 'susanne'

    def self_encoding(self):
        enc = self._corp().get_conf('ENCODING')
        if enc:
            return enc
        else:
            return 'iso-8859-1'

    def _corp(self):
        """
        Returns current corpus (as a manatee object).
        This should be preferred over accessing _curr_corpus attribute
        because they may produce different results!
        """
        if (not self._curr_corpus or
                (self.usesubcorp and not hasattr(self._curr_corpus, 'subcname'))):
            self._curr_corpus = self.cm.get_Corpus(self.corpname,
                                                   self.usesubcorp)
            # TODO opravit poradne!
            self._curr_corpus._conc_dir = self._conc_dir
        return self._curr_corpus

    def _set_defaults(self):
        if not 'refs' in self.__dict__:
            self.refs = self._corp().get_conf('SHORTREF')

    def _add_globals(self, result):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        """
        UserCGI._add_globals(self, result)

        if self.maincorp:
            thecorp = conclib.manatee.Corpus(self.maincorp)
        else:
            thecorp = self._corp()
        result['q'] = self.urlencode([('q', q) for q in self.q])
        result['Q'] = [{'q': q} for q in self.q]
        result['corpname_url'] = 'corpname=' + self.corpname

        global_var_val = [(n, val) for n in self._conc_state_vars
                          for val in [getattr(self, n)]
                          if getattr(self.__class__, n, None) is not val]

        result['globals'] = self.urlencode(global_var_val)
        result['Globals'] = [{'name': n, 'value': v} for n, v in global_var_val]
        result['struct_ctx'] = thecorp.get_conf('STRUCTCTX')
        result['corp_doc'] = thecorp.get_conf('DOCUMENTATION')
        result['Corplist'] = self.cm.corplist_with_names(settings.get('corpora_hierarchy'),
                                                         settings.get_bool('corpora', 'use_db_whitelist'))
        result['corplist_size'] = min(len(result['Corplist']), 20)
        result['corp_full_name'] = (thecorp.get_conf('NAME')
                                    or self.corpname)

        result['corp_description'] = thecorp.get_info()
        result['corp_size'] = _('%s positions') % locale.format('%d', thecorp.size(), True).decode('utf-8')
        result['user_info'] = self._session['user']
        corp_conf_info = settings.get_corpus_info(thecorp.get_conf('NAME'))
        if corp_conf_info is not None:
            result['corp_web'] = corp_conf_info['web']
        else:
            result['corp_web'] = ''
        if self.usesubcorp:
            sc = self.cm.get_Corpus('%s:%s' % (self.corpname.split(':')[0], self.usesubcorp))
            result['subcorp_size'] = ('%s positions') % locale.format('%d', sc.search_size(), True).decode('utf-8')
        attrlist = thecorp.get_conf('ATTRLIST').split(',')
        sref = thecorp.get_conf('SHORTREF')
        result['fcrit_shortref'] = '+'.join([a.strip('=') + '+0'
                                             for a in sref.split(',')])
        result['corpencoding'] = thecorp.get_conf('ENCODING')
        result['_version'] = (conclib.manatee.version(), version.version)
        poslist = self.cm.corpconf_pairs(thecorp, 'WPOSLIST')
        result['Wposlist'] = [{'n': x[0], 'v': x[1]} for x in poslist]
        poslist = self.cm.corpconf_pairs(thecorp, 'LPOSLIST')
        if 'lempos' not in attrlist:
            poslist = self.cm.corpconf_pairs(thecorp, 'WPOSLIST')
        result['Lposlist'] = [{'n': x[0], 'v': x[1]} for x in poslist]
        result['lpos_dict'] = dict([(y, x) for x, y in poslist])
        poslist = self.cm.corpconf_pairs(thecorp, 'WSPOSLIST')
        if not poslist:
            poslist = self.cm.corpconf_pairs(thecorp, 'LPOSLIST')
        result['has_lemmaattr'] = 'lempos' in attrlist \
            or 'lemma' in attrlist
        result['default_attr'] = thecorp.get_conf('DEFAULTATTR')
        for listname in ['AttrList', 'StructAttrList']:
            if listname in result: continue
            result[listname] = \
                [{'label': thecorp.get_conf(n + '.LABEL') or n, 'n': n}
                 for n in thecorp.get_conf(listname.upper()).split(',')
                 if n]
        result['tagsetdoc'] = thecorp.get_conf('TAGSETDOC')
        result['ttcrit'] = self.urlencode([('fcrit', '%s 0' % a) for a in
                                           thecorp.get_conf('SUBCORPATTRS')
                                           .replace('|', ',').split(',') if a])
        result['corp_uses_tag'] = 'tag' in thecorp.get_conf('ATTRLIST').split(',')
        if self.annotconc and not result.has_key('GroupNumbers'):
            labelmap = conclib.get_conc_labelmap(self._storeconc_path()
                                                 + '.info')
            result['GroupNumbers'] = conclib.format_labelmap(labelmap)
        result['commonurl'] = self.urlencode([('corpname', self.corpname),
                                              ('lemma', self.lemma),
                                              ('lpos', self.lpos),
                                              ('usesubcorp', self.usesubcorp),
                                             ])
        result['num_tag_pos'] = settings.get_corpus_info(self.corpname)['num_tag_pos']
        result['supports_password_change'] = settings.supports_password_change()

        # is there a concordance information in session?
        if 'conc' in self._session:
            result['show_conc_bar'] = True
            result['sampled_size'] = self._session['conc'].get('sampled_size', None)
            result['fullsize'] = self._session['conc'].get('fullsize', None)
            result['concsize'] = self._session['conc'].get('concsize', None)
            result['result_relative_freq'] = self._session['conc'].get('result_relative_freq', None)
            result['result_relative_freq_rel_to'] = self._session['conc'].get('result_relative_freq_rel_to', None)
            result['result_arf'] = self._session['conc'].get('result_arf', None)
            result['shuffle_notification'] = self._session['conc'].get('shuffle_notification', None)
        else:
            result['show_conc_bar'] = False
        return result

    def _add_undefined(self, result, methodname):
        result['methodname'] = methodname
        if methodname in self.add_vars:
            names = self.add_vars[methodname]
        else:
            return

        if 'Desc' in names:
            if methodname in ('savecoll', 'savewl', 'savefreq', 'saveconc'):
                translate = False
            else:
                translate = True
            result['Desc'] = [{'op': o, 'arg': a, 'churl': self.urlencode(u1),
                               'tourl': self.urlencode(u2), 'size': s}
                              for o, a, u1, u2, s in
                              conclib.get_conc_desc(self.q,
                                                    corpname=self.corpname,
                                                    cache_dir=self.cache_dir,
                                                    subchash=getattr(self._corp(), "subchash", None),
                                                    translate=translate)]

        if 'TextTypeSel' in names:
            result['TextTypeSel'] = self.texttypes_with_norms(ret_nums=False)
        if 'LastSubcorp' in names:
            result['LastSubcorp'] = self.cm.subcorp_names(self.corpname)
            result['lastSubcorpSize'] = min(len(result['LastSubcorp']) + 1, 20)

        if 'orig_query' in names:
            conc_desc = conclib.get_conc_desc(self.q,
                                              corpname=self.corpname,
                                              cache_dir=self.cache_dir,
                                              subchash=getattr(self._corp(), "subchash", None))
            if len(conc_desc) > 1:
                result['tourl'] = self.urlencode(conc_desc[0][3])
        if methodname.startswith('first'):
            result['show_cup_menu'] = self.is_err_corpus()

    kwicleftctx = '-10'
    kwicrightctx = '10'
    senleftctx_tpl = '-1:%s'
    senrightctx_tpl = '1:%s'
    viewmode = 'kwic'
    align = ''
    sel_aligned = []
    maincorp = ''
    refs_up = 0
