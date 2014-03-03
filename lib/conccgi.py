# Copyright (c) 2003-2009  Pavel Rychly
# Copyright (c) 2013 Institute of the Czech National Corpus
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
from types import ListType
import cgi
import json
import time
from functools import partial
import logging
import inspect

import corplib
import conclib
import version
from CGIPublisher import CGIPublisher, UserActionException, correct_types, Parameter
import plugins
import settings
import taghelper
import strings
from strings import format_number
from translation import ugettext as _


escape_regexp = re.compile(r'[][.*+{}?()|\\"$^]')


def escape(s):
    return escape_regexp.sub(r'\\g<0>', s)


def onelevelcrit(prefix, attr, ctx, pos, fcode, icase, bward='', empty=''):
    fromcode = {'lc': '<0', 'rc': '>0', 'kl': '<0', 'kr': '>0'}
    attrpart = '%s%s/%s%s%s ' % (prefix, attr, icase, bward, empty)
    if not ctx:
        ctx = '%i%s' % (pos, fromcode.get(fcode, '0'))
    if '~' in ctx and '.' in attr:
        ctx = ctx.split('~')[0]
    return attrpart + ctx


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

    CONC_PERSISTENT_ATTRS = ('sampled_size', 'fullsize', 'concsize', 'numofpages', 'fromp', 'result_relative_freq',
                             'result_relative_freq_rel_to', 'result_arf', 'result_shuffled', 'Sort_idx',
                             'nextlink', 'lastlink', 'prevlink', 'firstlink')

    error = Parameter(u'')
    fc_lemword_window_type = Parameter(u'both')
    fc_lemword_type = Parameter(u'all')
    fc_lemword_wsize = Parameter(5)
    fc_lemword = Parameter(u'')
    fc_pos_window_type = Parameter(u'both')
    fc_pos_type = Parameter(u'all')
    fc_pos_wsize = Parameter(5)
    fc_pos = Parameter([])
    ml = Parameter(0)
    concarf = Parameter(u'')
    Aligned = Parameter([])
    prevlink = Parameter(u'')
    nextlink = Parameter(u'')
    concsize = Parameter(u'')
    samplesize = Parameter(0)  # orig 1e7
    Lines = Parameter([])
    fromp = Parameter(u'1')
    numofpages = Parameter(0)
    pnfilter = Parameter(u'p')
    filfl = Parameter(u'f')
    filfpos = Parameter(u'-5')
    filtpos = Parameter(u'5')
    sicase = Parameter(u'')
    sbward = Parameter(u'')
    ml1icase = Parameter(u'')
    ml2icase = Parameter(u'')
    ml3icase = Parameter(u'')
    ml4icase = Parameter(u'')
    ml1bward = Parameter(u'')
    ml2bward = Parameter(u'')
    ml3bward = Parameter(u'')
    freq_sort = Parameter(u'')
    heading = Parameter(0)
    saveformat = Parameter(u'text')
    wlattr = Parameter(u'')
    wlpat = Parameter(u'')
    wlpage = Parameter(1)
    wlcache = Parameter(u'')
    blcache = Parameter(u'')
    simple_n = Parameter(1)
    usearf = Parameter(0)
    collpage = Parameter(1)
    fpage = Parameter(1)
    fmaxitems = Parameter(50)
    ftt_include_empty = Parameter(u'')
    subcsize = Parameter(0)
    processing = Parameter(0)
    ref_usesubcorp = Parameter(u'')
    wlsort = Parameter(u'')
    keywords = Parameter(u'')
    Keywords = Parameter([])
    ref_corpname = Parameter(u'')
    Items = Parameter([])
    format = Parameter(u'')
    selected = Parameter(u'')
    pages = Parameter(0)
    leftctx = Parameter(u'')
    rightctx = Parameter(u'')
    numbering = Parameter(0)
    align_kwic = Parameter(0)
    stored = Parameter(u'')
    # end

    corpname = Parameter('')  # must be an empty string and not None
    usesubcorp = Parameter(u'')
    subcname = Parameter(u'')
    subcpath = Parameter([])
    css_prefix = Parameter(u'')
    iquery = Parameter(u'')
    queryselector = Parameter(u'iqueryrow')
    lemma = Parameter(u'')
    lpos = Parameter(u'')
    phrase = Parameter(u'')
    char = Parameter(u'')
    word = Parameter(u'')
    wpos = Parameter(u'')
    cql = Parameter(u'')
    tag = Parameter('')
    default_attr = Parameter(None)
    save = Parameter(1)
    async = Parameter(1)
    spos = Parameter(3)
    skey = Parameter(u'rc')
    qmcase = Parameter(0)
    rlines = Parameter(u'250')
    attrs = Parameter(u'word')
    ctxattrs = Parameter(u'word')
    attr_allpos = Parameter(u'kw')
    allpos = Parameter(u'kw')
    structs = Parameter(u'p,g,err,corr')
    q = Parameter([])
    pagesize = Parameter(40)
    gdexconf = Parameter(u'')
    gdexcnt = Parameter(100)
    gdex_enabled = Parameter(0)
    alt_gdexconf = Parameter(None)
    copy_icon = Parameter(0)
    _avail_tbl_templates = Parameter(u'')
    multiple_copy = Parameter(0)
    wlsendmail = Parameter(u'')
    cup_hl = Parameter(u'q')

    sortlevel = Parameter(1)
    flimit = Parameter(0)
    freqlevel = Parameter(1)
    ml1pos = Parameter(1)
    ml2pos = Parameter(1)
    ml3pos = Parameter(1)
    ml4pos = Parameter(1)
    ml1ctx = Parameter(u'0~0>0')
    ml2ctx = Parameter(u'0~0>0')
    ml3ctx = Parameter(u'0~0>0')
    ml4ctx = Parameter(u'0~0>0')
    tbl_template = Parameter(u'none')
    errcodes_link = Parameter(u'')
    hidenone = Parameter(1)

    can_annotate = Parameter(0)
    enable_sadd = Parameter(0)
    annotconc = Parameter(u'')

    empty_attr_value_placeholder = Parameter('')
    tag_builder_support = Parameter([])

    shuffle = Parameter(0)
    SubcorpList = Parameter([])

    _conc_dir = u''
    _home_url = u'./first_form'
    _files_path = u'../files'

    add_vars = {'findx_upload': [u'LastSubcorp']}

    def __init__(self, environ, ui_lang):
        super(ConcCGI, self).__init__(environ=environ, ui_lang=ui_lang)
        self._curr_corpus = None
        self.last_corpname = None
        self.empty_attr_value_placeholder = settings.get('corpora', 'empty_attr_value_placeholder')
        self.root_path = self.environ.get('SCRIPT_NAME', '/')
        self.cache_dir = settings.get('corpora', 'cache_dir')
        self.return_url = None
        self.ua = None
        self.disabled_menu_items = []
        self.save_menu = []

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

        params = {}
        if self.environ.get('QUERY_STRING'):
            params.update(dict([item.split('=', 1) for item in [x for x in self.environ.get('QUERY_STRING').split('&')
                                                                if x]]))

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
        Returns list of object's attributes which (along with their values) will be preserved
        """
        return ('attrs', 'ctxattrs', 'structs', 'pagesize', 'copy_icon', 'multiple_copy', 'gdex_enabled', 'gdexcnt',
                'gdexconf', 'refs_up', 'shuffle', 'kwicleftctx', 'kwicrightctx', 'ctxunit', 'cup_hl')

    def _is_corpus_free_action(self, action):
        return action in ('login', 'loginx', 'logoutx')

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

    def _apply_user_settings(self, actions=None):
        """
        Updates object's attributes according to user settings. Settings
        are loaded via settings_storage plugin.

        arguments:
        actions -- a callable taking a single parameter (a dictionary) which can can be used
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
        param_types = dict(inspect.getmembers(self.__class__, predicate=lambda x: isinstance(x, Parameter)))

        if not action_metadata:
            action_metadata = {}
        form = cgi.FieldStorage(keep_blank_values=self._keep_blank_values,
                                environ=self.environ, fp=self.environ['wsgi.input'])

        self._apply_user_settings(self._init_default_settings)
        # corpus access check
        allowed_corpora = plugins.auth.get_corplist(self._user)
        if not self._is_corpus_free_action(path[0]):
            self.corpname, fallback = self._determine_curr_corpus(form, allowed_corpora)
            if fallback:
                path = [CGIPublisher.NO_OPERATION]
                if action_metadata.get('return_type', None) != 'json':
                    import hashlib
                    self._session['__message'] = _('Please <span class="sign-in">sign-in</span> to continue.')
                    curr_url = self._get_current_url()
                    curr_url_key = '__%s' % hashlib.md5(curr_url).hexdigest()[:8]
                    self._session[curr_url_key] = curr_url
                    self._redirect('%sfirst_form?corpname=%s&ua=%s' %
                                   (self.get_root_url(), self.corpname, curr_url_key))
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
                val = form.getvalue(k)
                # we have to clean-up the mess with multiple defined values (TODO not a system solution)
                if key in param_types and not param_types[key].is_array() and type(val) is list:
                    val = val[0]
                val = self.recode_input(val)
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
            self.return_url = '%sfirst_form?corpname=%s' % (self.get_root_url(), self.corpname)

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
        subcorp_list = strings.sort(self.cm.subcorp_names(basecorpname), loc=self.ui_lang, key=lambda x: x['n'])
        if len(subcorp_list) > 0:
            subcorp_list = [{'n': '--%s--' % _('whole corpus'), 'v': ''}] + subcorp_list
        out['SubcorpList'] = subcorp_list

    def _get_save_excluded_attributes(self):
        return ('corpname', )

    def _save_query(self):
        if plugins.has_plugin('query_storage'):
            q_encoded = self.urlencode([('q', q) for q in self.q])
            url = '%sconcdesc?corpname=%s;usesubcorp=%s;%s' % (self.get_root_url(), self.corpname,
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
        2-tuple containing a corpus name and the 'fallback' boolean flag
        """
        cn = ''
        fallback = False

        if 'json' in form:
            import json
            cn = str(json.loads(form.getvalue('json')).get('corpname', ''))

        if not cn and 'corpname' in form:
            cn = form.getvalue('corpname')
        if cn:
            if isinstance(cn, ListType):
                cn = cn[-1]

        if not cn:
            if self.last_corpname:
                cn = self.last_corpname
            else:
                cn = settings.get_default_corpus(corp_list)

        if not cn in corp_list and '/' in cn and cn.split('/')[1] in corp_list:
            cn = cn.split('/')[1]
            fallback = True

        if not cn in corp_list:
            cn = corp_list[0] if len(corp_list) > 0 else 'susanne'
            fallback = True

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

    def _add_corpus_related_globals(self, result, corpus):
        result['files_path'] = self._files_path
        result['struct_ctx'] = corpus.get_conf('STRUCTCTX')
        result['corp_doc'] = corpus.get_conf('DOCUMENTATION')
        result['corp_full_name'] = (corpus.get_conf('NAME')
                                    or self.corpname)

        result['corp_description'] = corpus.get_info()
        result['corp_size'] = format_number(corpus.size())
        corp_conf_info = plugins.corptree.get_corpus_info(corpus.get_conf('NAME'))
        if corp_conf_info is not None:
            result['corp_web'] = corp_conf_info.get('web', None)
        else:
            result['corp_web'] = ''

        result['Corplist'] = self.cm.corplist_with_names(plugins.corptree.get(),
                                                         settings.get_bool('corpora', 'use_db_whitelist'))
        result['corplist_size'] = min(len(result['Corplist']), 20)
        if self.usesubcorp:
            sc = self.cm.get_Corpus('%s:%s' % (self.corpname.split(':')[0], self.usesubcorp))
            result['subcorp_size'] = format_number(sc.search_size())
        else:
            result['subcorp_size'] = None
        attrlist = corpus.get_conf('ATTRLIST').split(',')
        sref = corpus.get_conf('SHORTREF')
        result['fcrit_shortref'] = '+'.join([a.strip('=') + '+0'
                                             for a in sref.split(',')])
        result['corpencoding'] = corpus.get_conf('ENCODING')
        poslist = self.cm.corpconf_pairs(corpus, 'WPOSLIST')
        result['Wposlist'] = [{'n': x[0], 'v': x[1]} for x in poslist]
        poslist = self.cm.corpconf_pairs(corpus, 'LPOSLIST')
        if 'lempos' not in attrlist:
            poslist = self.cm.corpconf_pairs(corpus, 'WPOSLIST')
        result['Lposlist'] = [{'n': x[0], 'v': x[1]} for x in poslist]
        result['lpos_dict'] = dict([(y, x) for x, y in poslist])
        poslist = self.cm.corpconf_pairs(corpus, 'WSPOSLIST')
        if not poslist:
            poslist = self.cm.corpconf_pairs(corpus, 'LPOSLIST')
        result['has_lemmaattr'] = 'lempos' in attrlist \
            or 'lemma' in attrlist
        result['default_attr'] = corpus.get_conf('DEFAULTATTR')
        for listname in ['AttrList', 'StructAttrList']:
            if listname in result:
                continue
            result[listname] = \
                [{'label': corpus.get_conf(n + '.LABEL') or n, 'n': n}
                 for n in corpus.get_conf(listname.upper()).split(',')
                 if n]
        result['tagsetdoc'] = corpus.get_conf('TAGSETDOC')
        result['ttcrit'] = self.urlencode([('fcrit', '%s 0' % a) for a in
                                           corpus.get_conf('SUBCORPATTRS')
                                           .replace('|', ',').split(',') if a])
        result['corp_uses_tag'] = 'tag' in corpus.get_conf('ATTRLIST').split(',')
        if self.annotconc and not 'GroupNumbers' in result.keys():
            labelmap = conclib.get_conc_labelmap(self._storeconc_path()
                                                 + '.info')
            result['GroupNumbers'] = conclib.format_labelmap(labelmap)
        result['commonurl'] = self.urlencode([('corpname', self.corpname),
                                              ('lemma', self.lemma),
                                              ('lpos', self.lpos),
                                              ('usesubcorp', self.usesubcorp),
                                              ])
        result['num_tag_pos'] = corp_conf_info.get('num_tag_pos', 0)
        result['citation_info'] = corp_conf_info.get('citation_info', '')

    def _add_globals(self, result):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        CGIPublisher._add_globals(self, result)

        result['css_fonts'] = settings.get('global', 'fonts') if settings.get('global', 'fonts') else []
        result['human_corpname'] = self._canonical_corpname(self.corpname) if self.corpname else ''
        result['debug'] = settings.is_debug_mode()
        result['_version'] = (conclib.manatee.version(), version.version)
        result['display_closed_conc'] = len(self.q) > 0

        result['q'] = self.urlencode([('q', q) for q in self.q])
        result['Q'] = [{'q': q} for q in self.q]
        result['corpname_url'] = 'corpname=' + self.corpname

        global_var_val = [(n, val) for n in self._conc_state_vars
                          for val in [getattr(self, n, None)]
                          if getattr(self.__class__, n, None) is not val]

        result['globals'] = self.urlencode(global_var_val)
        result['Globals'] = [{'name': n, 'value': v} for n, v in global_var_val]

        if self.maincorp:
            thecorp = conclib.manatee.Corpus(self.maincorp)
        else:
            thecorp = self._corp()
        try:
            self._add_corpus_related_globals(result, thecorp)
        except Exception as ex:
            pass

        result['supports_password_change'] = settings.supports_password_change()
        result['undo_q'] = self.urlencode([('q', q) for q in self.q[:-1]])
        result['session_cookie_name'] = settings.get('plugins', 'auth').get('auth_cookie_name', '')

        result['root_url'] = self.get_root_url()
        result['user_info'] = self._session.get('user', {'fullname': None})

        if self._session_get('__message'):
            result['message'] = ('info', self._session_get('__message'))
            del(self._session['__message'])

        if plugins.has_plugin('auth'):
            result['login_url'] = plugins.auth.get_login_url(self.get_root_url())
            result['logout_url'] = plugins.auth.get_logout_url(self.get_root_url())
        else:
            result['login_url'] = 'login'
            result['logout_url'] = 'login'

        if plugins.has_plugin('application_bar'):
            result['app_bar'] = plugins.application_bar.get_contents(cookies=self._cookies,
                                                                     curr_lang=self.ui_lang,
                                                                     return_url=self.return_url)
            result['app_bar_css'] = plugins.application_bar.css_url
            result['app_bar_css_ie'] = plugins.application_bar.css_url_ie
        else:
            result['app_bar'] = None
            result['app_bar_css'] = None
            result['app_bar_css_ie'] = None

        # avalilable languages
        if plugins.has_plugin('getlang'):
            result['avail_languages'] = ()
        else:
            result['avail_languages'] = settings.get_full('global', 'translations')

        # util functions
        result['format_number'] = partial(format_number)

        # is there a concordance information in session?
        self._restore_conc_results(result)

        return result

    def _restore_conc_results(self, storage):
        conc_key = '#'.join(self.q)
        if 'conc' in self._session and conc_key in self._session['conc']:
            tmp = self._session['conc']

            storage['conc_persist'] = True
            for k in ConcCGI.CONC_PERSISTENT_ATTRS:
                storage[k] = tmp[conc_key].get(k)
        else:
            storage['conc_persist'] = False

    def _store_conc_results(self, src):
        if not 'conc' in self._session:
            self._session['conc'] = {}

        curr_time = int(time.time())
        # let's clean-up too old records to keep session data reasonably big
        for k in self._session['conc'].keys():
            if '__timestamp__' in self._session['conc'] \
                or curr_time - self._session['conc'][k]['__timestamp__'] > settings.get_int('global',
                                                                                            'conc_persistence_time'):
                self._session['conc'].pop(k)

        data = dict([(k, src.get(k)) for k in ConcCGI.CONC_PERSISTENT_ATTRS])
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
            result['TextTypeSel'] = self._texttypes_with_norms(ret_nums=False)
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

    def _validate_range(self, actual_range, max_range):
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
                msg = _('Range [%s, %s] is invalid. It must be non-empty and left value must be greater or equal '
                             'than %s' % (actual_range + (max_range[0], )))
            return UserActionException(msg)
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
