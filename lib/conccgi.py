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
import time

import corplib
import conclib
import version
from CGIPublisher import CGIPublisher, UserActionException, correct_types
import plugins
import settings
import taghelper
import logging

try:
    _
except NameError:
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


class ConcCGI(CGIPublisher):
    _conc_state_vars = ('corpname', 'viewmode', 'attrs', 'attr_allpos', 'ctxattrs',
                        'structs', 'refs', 'lemma', 'lpos', 'pagesize',
                        'usesubcorp', 'align', 'copy_icon', 'gdex_enabled',
                        'gdexcnt', 'gdexconf', 'iquery', 'maincorp')

    ANON_FORBIDDEN_MENU_ITEMS = ('menu-new-query:history', 'menu-new-query:wordlist', 'menu-view', 'menu-subcorpus',
                                 'menu-sort', 'menu-sample', 'menu-save', 'menu-concordance', 'menu-filter',
                                 'menu-frequency', 'menu-collocations')

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
    corpname = ''  # must be an empty string and not None
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

    can_annotate = 0
    enable_sadd = 0
    annotconc = u''

    empty_attr_value_placeholder = ''
    tag_builder_support = []

    alpha_features = 0

    shuffle = 0

    disabled_menu_items = []
    SubcorpList = []
    save_menu = []

    add_vars['findx_upload'] = [u'LastSubcorp']

    def __init__(self, environ):
        super(ConcCGI, self).__init__(environ=environ)
        self._curr_corpus = None
        self.last_corpname = None
        self.empty_attr_value_placeholder = settings.get('corpora', 'empty_attr_value_placeholder')
        self.root_path = self.environ.get('SCRIPT_NAME', '/')
        self.cache_dir = settings.get('corpora', 'cache_dir')
        self.return_url = None
        self.ua = None

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

        params = dict([item.split('=', 1) for item in [x for x in os.getenv('QUERY_STRING','').split('&') if x]])

        ans = {
            'date': datetime.datetime.today().strftime('%Y-%m-%d %H:%M:%S'),
            'action': action_name,
            'user_id': self._session_get('user', 'id'),
            'user': self._session_get('user', 'user'),
            'params': dict([(k, v) for k, v in params.items() if v]),
            'settings': dict([(k, v) for k, v in user_settings.items() if v])
        }
        logging.getLogger('QUERY').info(json.dumps(ans))

    def _get_persistent_attrs(self):
        """
        Returns list of object's attributes which (along with their values) will be preserved using cookies.
        """
        return ('attrs', 'ctxattrs', 'structs', 'pagesize', 'copy_icon', 'multiple_copy', 'gdex_enabled', 'gdexcnt',
                'gdexconf', 'refs_up', 'shuffle', 'kwicleftctx', 'kwicrightctx', 'ctxunit', 'cup_hl')

    def _requires_corpus_access(self, action):
        return action not in ('login', 'loginx', 'logoutx', 'fcs', 'fcs2html', 'corplist')

    def _init_default_settings(self, options):
        if 'shuffle' not in options:
            options['shuffle'] = 1

    def _get_action_prop(self, action_name, prop_name):
        prop = None
        if hasattr(self, action_name):
            a = getattr(self, action_name)
            if a and hasattr(a, prop_name):
                prop = getattr(a, prop_name)
        return prop

    def _filter_out_unused_settings(self, options):
        """
        Removes settings related to others than
        current corpus.
        This is not very effective but currently it is the
        simplest and still quite effective solution.
        """
        if self.corpname:
            for k in options.keys():
                elms = k.split(':')
                if len(elms) == 2 and elms[0] != self.corpname:
                    del(options[k])

    def _setup_action_params(self, actions=None):
        """
        Sets-up parameters related to processing of current action.
        This typically includes concordance-related values (to be able to keep the state),
        user's options etc.

        Parameters
        ----------
        actions : callable
            a function taking a single parameter (a dictionary) which can can be used
            to alter some of the parameters
        """
        options = {}
        if self._user:
            user_file_id = self._user
        else:
            user_file_id = 'anonymous'
        plugins.settings_storage.load(self._session_get('user', 'id'), options)
        correct_types(options, self.clone_self(), selector=1)
        if callable(actions):
            actions(options)
        self._setup_user_paths(user_file_id)
        self.__dict__.update(options)

    def _get_save_excluded_attributes(self):
        return ()

    def _save_options(self, optlist=[], selector=''):
        """
        Saves user's options to a storage
        """
        if selector:
            tosave = [(selector + ':' + opt, self.__dict__[opt])
                      for opt in optlist if opt in self.__dict__]
        else:
            tosave = [(opt, self.__dict__[opt]) for opt in optlist
                      if opt in self.__dict__]
        options = {}
        # data must be loaded (again) because in-memory settings are
        # in general a subset of the ones stored in db
        plugins.settings_storage.load(self._session_get('user', 'id'), options)
        excluded_attrs = self._get_save_excluded_attributes()
        for k in options.keys():
            if k in excluded_attrs:
                del(options[k])
        options.update(tosave)
        if not self._anonymous:
            plugins.settings_storage.save(self._session_get('user', 'id'), options)
        else:
            pass  # TODO save to the session

    def _pre_dispatch(self, path, selectorname, named_args, action_metadata=None):
        """
        Runs before main action is processed
        """
        super(ConcCGI, self)._pre_dispatch(path, selectorname, named_args)
        if not action_metadata:
            action_metadata = {}
        self.environ = os.environ
        form = cgi.FieldStorage(keep_blank_values=self._keep_blank_values,
                                environ=self.environ, fp=None)

        self._setup_action_params(self._init_default_settings)

        # corpus access check
        allowed_corpora = plugins.auth.get_corplist(self._user)
        if self._requires_corpus_access(path[0]):
            self.corpname, fallback_url = self._determine_curr_corpus(form, allowed_corpora)
            if fallback_url:
                path = [CGIPublisher.NO_OPERATION]
                if action_metadata.get('return_type', None) != 'json':
                    self._redirect(fallback_url)
                else:
                    path = ['json_error']
                    named_args['error'] = _('Corpus access denied')
                    named_args['reset'] = True
        elif len(allowed_corpora) > 0:
            self.corpname = allowed_corpora[0]
        else:
            self.corpname = ''
        # Once we know the current corpus we can remove
        # settings related to other corpora. It is quite
        # a dumb solution but currently there is no other way
        # (other than always loading all the settings)
        self._filter_out_unused_settings(self.__dict__)

        if 'json' in form:
            json_data = json.loads(form.getvalue('json'))
            named_args.update(json_data)
        for k in form.keys():
            self._url_parameters.append(k)
            # must remove empty values, this should be achieved by
            # keep_blank_values=0, but it does not work for POST requests
            if len(form.getvalue(k)) > 0 and not self._keep_blank_values:
                key = str(k)
                val = self.recode_input(form.getvalue(k))
                if key.startswith('sca_') and val == settings.get('corpora', 'empty_attr_value_placeholder'):
                    val = ''
                named_args[key] = val
        na = named_args.copy()

        correct_types(na, self.clone_self())
        if selectorname:
            choose_selector(self.__dict__, getattr(self, selectorname))
        self.cm = corplib.CorpusManager(plugins.auth.get_corplist(self._user), self.subcpath)
        if not 'refs' in self.__dict__:
            self.refs = self._corp().get_conf('SHORTREF')
        self.__dict__.update(na)

        # return url (for 3rd party pages etc.)
        if self.ua in self._session:
            self.return_url = self._session[self.ua]
            del(self._session[self.ua])
            self.ua = None
        elif self.get_http_method() == 'GET':
            self.return_url = self._get_current_url()
        else:
            self.return_url = '%sfirst_form?corpname=%s' % (settings.get_root_url(), self.corpname)

        if len(path) > 0:
            access_level = self._get_action_prop(path[0], 'access_level')
            if access_level and self._user_is_anonymous():
                import auth
                raise auth.AuthException(_('Access forbidden'))

        return path, selectorname, named_args

    def _post_dispatch(self, methodname, tmpl, result):
        """
        Runs after main action is processed but before any rendering (incl. HTTP headers)
        """
        if self._user_is_anonymous():
            disabled_set = set(self.disabled_menu_items)
            for x in ConcCGI.ANON_FORBIDDEN_MENU_ITEMS:
                disabled_set.add(x)
            self.disabled_menu_items = tuple(disabled_set)
        super(ConcCGI, self)._post_dispatch(methodname, tmpl, result)
        self._log_request(self._get_persistent_items(), '%s' % methodname)
 
        if plugins.has_plugin('tracker'):
            plugins.tracker.track(methodname, tmpl, result)


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
        subcorp_list = sorted(self.cm.subcorp_names(basecorpname), key=lambda x: x['n'], cmp=locale.strcoll)
        if len(subcorp_list) > 0:
            subcorp_list = [{'n': '--%s--' % _('whole corpus'), 'v': ''}] + subcorp_list
        out['SubcorpList'] = subcorp_list

    def _get_save_excluded_attributes(self):
        return ('corpname', )

    def _save_query(self):
        if plugins.has_plugin('query_storage'):
            q_encoded = self.urlencode([('q', q) for q in self.q])
            url = '%sconcdesc?corpname=%s;usesubcorp=%s;%s' % (settings.get_root_url(), self.corpname,
                                                               self.usesubcorp, q_encoded)

            description = ''  # "%s::\n\n\t%s\n" % (_('Notes'), ','.join(add_q))
            if not self.usesubcorp:
                corpname = self.corpname
            else:
                corpname = '%s:%s' % (self.corpname, self.usesubcorp)
            plugins.query_storage.write(user_id=self._session_get('user', 'id'), corpname=corpname,
                                        url=url, params=json.dumps(self.q), tmp=1, description=description, query_id=None, public=0)

    def _determine_curr_corpus(self, form, corp_list):
        """
        This method tries to determine which corpus is currently in use.
        If no answer is found or in case there is a conflict between selected
        corpus and user access rights then some fallback alternative is found -
        in such case the 'fallback' flag is set to True.

        Parameters:
        form -- currently processed HTML form (if any)
        corp_list -- list of all the corpora user can access

        Return:
        2-tuple containing a corpus name and a fallback URL where application
        may be redirected (if not None)
        """
        cn = ''
        fallback = None

        if 'json' in form:
            import json
            cn = str(json.loads(form.getvalue('json')).get('corpname', ''))

        # let's fetch required corpus name from html form or from URL params
        if not cn and 'corpname' in form:
            cn = form.getvalue('corpname')
        if isinstance(cn, ListType) and len(cn) > 0:
            cn = cn[-1]

        # if no current corpus is set then we try previous user's corpus
        # and if no such exists then we try default one as configured
        # in settings.xml
        if not cn:
            if self.last_corpname:
                cn = self.last_corpname
            else:
                cn = settings.get_default_corpus(corp_list)
                fallback = '%sfirst_form?corpname=%s' % (settings.get_root_url(), cn)

        # in this phase we should have some non-empty corpus selected
        # but we do not know whether user has access to it

        # automatic restricted/unrestricted corpus name selection
        # according to user rights
        if cn == self._canonical_corpname(cn) and cn not in corp_list \
                and plugins.auth.get_restricted_corp_variant(cn) in corp_list:
            # user wants a canonical variant, has no access to it and restricted variant exists
            cn = plugins.auth.get_restricted_corp_variant(cn)
            fallback = self._update_current_url({'corpname': cn})
        elif cn != self._canonical_corpname(cn) and cn not in corp_list:
            cn = self._canonical_corpname(cn)
            fallback = self._update_current_url({'corpname': cn})

        # last resort solution (this shouldn't happen in properly configured production installation)
        if not cn in corp_list:
            cn = 'susanne'
            fallback = '%sfirst_form?corpname=%s' % (settings.get_root_url(), cn)

        return cn, fallback

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
        if self.corpname:
            if not self._curr_corpus or (self.usesubcorp and not hasattr(self._curr_corpus, 'subcname')):
                self._curr_corpus = self.cm.get_Corpus(self.corpname, self.usesubcorp)
                # TODO opravit poradne!
            self._curr_corpus._conc_dir = self._conc_dir
            return self._curr_corpus
        else:
            from empty_corpus import EmptyCorpus
            return EmptyCorpus()

    def _add_globals(self, result):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        CGIPublisher._add_globals(self, result)

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
        result['Corplist'] = self.cm.corplist_with_names(plugins.corptree.get(),
                                                         settings.get_bool('corpora', 'use_db_whitelist'))
        result['Corpgroups'] = {}
        for corp in result['Corplist']:
            base_path = corp["base_path"]
            if base_path not in result['Corpgroups']:
                result['Corpgroups'][base_path] = {
                    "id": re.sub(r'[^a-zA-Z]', '-', base_path).lower(),
                    "items": []
                }
            result["Corpgroups"][base_path]["items"].append(corp)
        result['corplist_size'] = min(len(result['Corplist']), 20)
        result['corp_full_name'] = (thecorp.get_conf('NAME')
                                    or self.corpname)

        result['corp_description'] = thecorp.get_info()
        result['corp_size'] = locale.format('%d', thecorp.size(), True).decode('utf-8')
        result['user_info'] = self._session['user']
        corp_conf_info = plugins.corptree.get_corpus_info(self.corpname)
        if corp_conf_info is not None:
            result['corp_web'] = corp_conf_info.get('web', None)
            result['corp_pmltq'] = corp_conf_info.get('pmltq', None)
            result['corp_repo'] = corp_conf_info.get('repo', None)
        else:
            result['corp_web'] = ''
            result['corp_pmltq'] = ''
            result['corp_repo'] = ''
        if self.usesubcorp:
            sc = self.cm.get_Corpus('%s:%s' % (self.corpname.split(':')[0], self.usesubcorp))
            result['subcorp_size'] = locale.format('%d', sc.search_size(), True).decode('utf-8')
        else:
            result['subcorp_size'] = None
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
        result['num_tag_pos'] = corp_conf_info.get('num_tag_pos', 0)
        result['supports_password_change'] = settings.supports_password_change()
        result['undo_q'] = self.urlencode([('q', q) for q in self.q[:-1]])
        result['citation_info'] = corp_conf_info.get('citation_info', '')
        result['session_cookie_name'] = settings.get('plugins', 'auth').get('auth_cookie_name', '')
        result['css_fonts'] = settings.get('global', 'fonts') if settings.get('global', 'fonts') else []
        result['root_url_protocol'] = settings.get('global', 'root_url_protocol')
        result['root_url_host'] = settings.get('global', 'root_url_host')
        result['root_url_port'] = settings.get('global', 'root_url_port')
        result['root_url_path'] = settings.get('global', 'root_url_path')
        result['root_url'] = settings.get_root_url()

        if self._corp().get_conf('NAME'):
            result['canonical_corpname'] = self._corp().get_conf('NAME')
        elif self.corpname:
            result['canonical_corpname'] = self._canonical_corpname(self.corpname)
        else:
            result['canonical_corpname'] = ''
        result['debug'] = settings.is_debug_mode()
        result['display_closed_conc'] = len(self.q) > 0 and result.get('message', [None])[0] != 'error'

        if self._session_get('__message'):
            result['message'] = ('info', self._session_get('__message'))
            del(self._session['__message'])

        if plugins.has_plugin('auth'):
            result['login_url'] = plugins.auth.get_login_url()
            result['logout_url'] = plugins.auth.get_logout_url()
            try:
                result['uses_aai'] = plugins.auth.uses_aai()
            except AttributeError:
                result['uses_aai'] = False
        else:
            result['login_url'] = 'login'
            result['logout_url'] = 'login'
            result['uses_aai'] = False

        if plugins.has_plugin('application_bar'):
            result['app_bar'] = plugins.application_bar.get_contents(cookies=self._cookies,
                                                                     curr_lang=os.environ['LANG'],
                                                                     return_url=self.return_url)
            result['app_bar_css'] = plugins.application_bar.css_url
            result['app_bar_css1'] = plugins.application_bar.css_url1 \
                if hasattr(plugins.application_bar, "css_url1") else None
            result['app_bar_css_ie'] = plugins.application_bar.css_url_ie
            result['app_bar_js'] = plugins.application_bar.js_url
        else:
            result['app_bar'] = None
            result['app_bar_css'] = None
            result['app_bar_css_ie'] = None
            result['app_bar_js'] = None

        if plugins.has_plugin('footer_bar'):
            result['foot_bar'] = plugins.footer_bar.get_contents(cookies=self._cookies,
                                                                     curr_lang=os.environ['LANG'],
                                                                     return_url=self.return_url)
            result['foot_bar_css'] = plugins.footer_bar.css_url
            result['foot_bar_css_ie'] = plugins.footer_bar.css_url_ie
            result['foot_bar_js'] = plugins.footer_bar.js_url
        else:
            result['foot_bar'] = None
            result['foot_bar_css'] = None
            result['foot_bar_css_ie'] = None
            result['foot_bar_js'] = None

        # avalilable languages
        if plugins.has_plugin('getlang'):
            result['avail_languages'] = ()
        else:
            result['avail_languages'] = settings.get_full('global', 'translations')

        result['error_report_url'] = settings.get('global', 'error_report_url', None)

        # is there a concordance information in session?
        self._restore_conc_results(result)

        return result

    def _restore_conc_results(self, storage):
        conc_key = '#'.join(self.q)
        if 'conc' in self._session and conc_key in self._session['conc']:
            tmp = self._session['conc']
            storage['conc_persist'] = True
            storage['sampled_size'] = tmp[conc_key].get('sampled_size', None)
            storage['fullsize'] = tmp[conc_key].get('fullsize', None)
            storage['concsize'] = tmp[conc_key].get('concsize', None)
            storage['result_relative_freq'] = tmp[conc_key].get('result_relative_freq', None)
            storage['result_relative_freq_rel_to'] = tmp[conc_key].get('result_relative_freq_rel_to', None)
            storage['result_arf'] = tmp[conc_key].get('result_arf', None)
            storage['result_shuffled'] = tmp[conc_key].get('result_shuffled', None)
        else:
            storage['conc_persist'] = False

    def _store_conc_results(self, data):
        if not 'conc' in self._session:
            self._session['conc'] = {}

        curr_time = int(time.time())
        for k in self._session['conc'].keys():
            if '__timestamp__' in self._session['conc'] \
                or curr_time - self._session['conc'][k]['__timestamp__'] > settings.get_int('global',
                                                                                            'conc_persistence_time'):
                self._session['conc'].pop(k)

        data['__timestamp__'] = int(curr_time)
        self._session['conc']['#'.join(self.q)] = data

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
            result['show_cup_menu'] = self._is_err_corpus()

    def _store_query_selector_types(self):
        """
        Stores the state of all queryselector_* values so they can
        be used to restore respective forms
        """
        if 'forms' not in self._session:
            self._session['forms'] = {}
        for item in vars(self):
            if item.startswith('queryselector'):
                self._session['forms'][item] = getattr(self, item)

    def _restore_query_selector_types(self):
        """
        """
        ans = {}
        if 'forms' in self._session:
            ans.update(self._session['forms'])
        return ans

    def _canonical_corpname(self, c):
        """
        Internally we sometimes use path-like corpora names to distinguish between
        two access levels (this is achieved by two different registry files).
        E.g. you have 'syn2010' corpus and 'spec/syn2010' corpus which means that somewhere
        there is a registry file called 'syn2010' and also a directory 'spec' with
        another registry file 'syn2010'. But this should be transparent to users so that
        they see 'syn2010' in both cases. This method solves the problem by converting
        path-like names to basename ones.
        """
        return c.rsplit('/', 1)[-1]

    def _has_configured_speech(self):
        """
        Tests whether the provided corpus contains
        structural attributes compatible with current application's configuration
        (e.g. corpus contains structural attribute seg.id and the configuration INI
        file contains line speech_segment_struct_attr = seg.id).

        Parameters
        ----------
        corpus : manatee.Corpus
          corpus object we want to test
        """
        speech_struct = plugins.corptree.get_corpus_info(self.corpname).get('speech_segment')
        return speech_struct in self._corp().get_conf('STRUCTATTRLIST').split(',')

    def _get_speech_segment(self):
        """
        Returns:
            tuple (structname, attr_name)
        """
        segment_str = plugins.corptree.get_corpus_info(self.corpname).get('speech_segment')
        if segment_str:
            return tuple(segment_str.split('.'))
        return None


    kwicleftctx = '-10'
    kwicrightctx = '10'
    senleftctx_tpl = '-1:%s'
    senrightctx_tpl = '1:%s'
    viewmode = 'kwic'
    align = ''
    sel_aligned = []
    maincorp = ''
    refs_up = 0
