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

from types import ListType
import cgi
import json
import time
from functools import partial
import logging
import inspect
import urllib

import corplib
import conclib
from CGIPublisher import CGIPublisher, UserActionException, convert_types, Parameter
import plugins
import settings
import taghelper
import strings
from strings import format_number, corpus_get_conf
from translation import ugettext as _


class ConcError(Exception):
    def __init__(self, msg):
        super(ConcError, self).__init__(msg)


class StateGlobals(object):
    """
    A simple wrapper for $Globals template variable. Unfortunately,
    current code (which comes from Bonito 2) operates with $globals
    (see the difference: g vs. G) which is escaped, hard to update
    string.

    This object should replace $globals in the future because it
    allows easier updates: $Globals.update('corpname', 'bar').to_s()
    """
    def __init__(self, data):
        self._data = {}
        if type(data) is dict:
            data = data.items()
        for k, v in data:
            if type(v) is unicode:
                v = v.encode('utf-8')
            self._data[k] = v

    def __iter__(self):
        return iter(self._data)

    def items(self):
        return self._data.items()

    def to_s(self):
        return urllib.urlencode(self._data)

    def update(self, *args):
        if type(args[0]) is dict:
            self._data.update(args[0])
        elif len(args) == 2:
            self._data[args[0]] = args[1]
        return self


class ConcCGI(CGIPublisher):
    _conc_state_vars = ('corpname', 'viewmode', 'attrs', 'attr_allpos', 'ctxattrs',
                        'structs', 'refs', 'lemma', 'lpos', 'pagesize',
                        'usesubcorp', 'align', 'iquery', 'maincorp')

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
    attrs = Parameter(u'word', persistent=True)
    ctxattrs = Parameter(u'word', persistent=True)
    attr_allpos = Parameter(u'kw')
    allpos = Parameter(u'kw')
    structs = Parameter(u'p,g,err,corr', persistent=True)
    q = Parameter([])
    pagesize = Parameter(40, persistent=True)
    _avail_tbl_templates = Parameter(u'')
    multiple_copy = Parameter(0, persistent=True)
    wlsendmail = Parameter(u'')
    cup_hl = Parameter(u'q', persistent=True)
    structattrs = Parameter([], persistent=True)

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


    kwicleftctx = Parameter('-10', persistent=True)
    kwicrightctx = Parameter('10', persistent=True)
    senleftctx_tpl = Parameter('-1:%s')
    senrightctx_tpl = Parameter('1:%s')
    viewmode = Parameter('kwic')
    align = Parameter('')
    sel_aligned = Parameter([])
    maincorp = Parameter('')
    refs_up = Parameter(0, persistent=True)
    refs = Parameter(None)  # None means "not initialized" while '' means "user wants to show no refs"

    can_annotate = Parameter(0)
    enable_sadd = Parameter(0)
    annotconc = Parameter(u'')

    empty_attr_value_placeholder = Parameter('')
    tag_builder_support = Parameter([])

    shuffle = Parameter(0, persistent=True)
    SubcorpList = Parameter([])

    qunit = Parameter('')  # this parameter is used to activate and set-up a QUnit unit tests

    _conc_dir = u''
    _home_url = u'./first_form'
    _files_path = u'../files'

    def __init__(self, environ, ui_lang):
        super(ConcCGI, self).__init__(environ=environ, ui_lang=ui_lang)
        self._curr_corpus = None
        self.last_corpname = None
        self.empty_attr_value_placeholder = settings.get('corpora', 'empty_attr_value_placeholder')
        self.root_path = self.environ.get('SCRIPT_NAME', '/')
        self.cache_dir = settings.get('corpora', 'cache_dir')
        self.return_url = None
        self.ua = None
        self.cm = None  # a CorpusManager instance (created in _pre_dispatch() phase)
        self.disabled_menu_items = []
        self.save_menu = []

        # conc_persistence plugin related attributes
        self._q_code = None  # a key to 'code->query' database
        self._prev_q_data = None  # data of the previous operation are stored here

    def _log_request(self, user_settings, action_name, proc_time=None):
        """
        Logs user's request by storing URL parameters, user settings and user name

        arguments:
        user_settings -- a dict containing user settings
        action_name -- name of current action
        proc_time -- float specifying how long the action took;
        default is None - in such case no information is stored
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
        if proc_time is not None:
            ans['proc_time'] = proc_time
        logging.getLogger('QUERY').info(json.dumps(ans))

    def _get_persistent_attrs(self):
        """
        Returns list of object's attributes which (along with their values) will be preserved
        """
        attrs = inspect.getmembers(self.__class__, predicate=lambda m: isinstance(m, Parameter) and m.is_persistent())
        return tuple([x[0] for x in attrs])

    def _requires_corpus_access(self, action):
        # TODO this is a flawed solution - method metadata (access_level should be used instead)
        return action not in ('login', 'loginx', 'logoutx', 'ajax_get_toolbar')

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

    def _setup_user_paths(self, user_file_id):
        if not self._anonymous:
            self.subcpath.append('%s/%s' % (settings.get('corpora', 'users_subcpath'), user_file_id))
        self._conc_dir = '%s/%s' % (settings.get('corpora', 'conc_dir'), user_file_id)
        self._wseval_dir = '%s/%s' % (settings.get('corpora', 'wseval_dir'), user_file_id)

    def _load_user_settings(self):
        """
        Loads user settings via settings_storage plugin. The settings are divided
        into two groups:
        1. corpus independent (e.g. last_corpname, pagesize)
        2. corpus dependent (e.g. selected attributes to be presented on concordance page)

        returns:
        2-tuple of dicts ([general settings], [corpus dependent settings])
        """
        options = {}
        corp_options = {}

        for k, v in plugins.settings_storage.load(self._session_get('user', 'id')).items():
            if ':' not in k:
                options[k] = v
            else:
                corp_options[k] = v
        return options, corp_options

    def _apply_general_user_settings(self, options, actions=None):
        """
        Applies general user settings (see self._load_user_settings()) to
        the controller's attributes. This produces a default configuration
        which can (and often is) be overwritten by URL parameters.

        arguments:
        options -- a dictionary containing user settings
        actions -- a custom action to be applied to options (default is None)
        """
        convert_types(options, self.clone_self(), selector=1)
        if callable(actions):
            actions(options)
        self._setup_user_paths(self._user if self._user else 'anonymous')
        self.__dict__.update(options)

    def _apply_corpus_user_settings(self, options, corpname):
        """
        Applies corpus-dependent settings in the similar way
        to self._apply_general_user_settings. But in this case,
        a corpus name must be provided to be able to filter out
        settings of other corpora.
        """
        if len(corpname) == 0:
            raise ValueError('corpname must be non-empty')
        ans = {}
        for k, v in options.items():
            if k.find(corpname) == 0:
                ans[k.split(':', 1)[-1]] = v

        convert_types(options, self.clone_self(), selector=1)
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

    def _restore_prev_conc_params(self):
        """
        Restores previously stored concordance query data using an ID found in self.q.
        To even begin the search, two conditions must be met:
        1. conc_persistence plugin is installed
        2. self.q contains a string recognized as a valid ID of a stored concordance query
           at the position 0 (other positions may contain additional regular query operations
           (shuffle, filter,...)

        In case the conc_persistence is installed and invalid ID is encountered
        UserActionException will be raised.
        """
        url_q = self.q[:]
        if plugins.has_plugin('conc_persistence') and self.q and plugins.conc_persistence.is_valid_id(url_q[0]):
            self._q_code = url_q[0][1:]
            self._prev_q_data = plugins.conc_persistence.open(self._q_code)
            # !!! must create a copy here otherwise _q_data (as prev query)
            # will be rewritten by self.q !!!
            if self._prev_q_data is not None:
                self.q = self._prev_q_data['q'][:] + url_q[1:]
            else:
                raise UserActionException(_('Invalid stored query identifier used'))

    def _store_conc_params(self):
        """
        Stores concordance operation if the conc_persistence plugin is installed
        (otherwise nothing is done).

        returns:
        string ID of the stored operation or None if nothing was done (from whatever reason)
        """
        if plugins.has_plugin('conc_persistence') and self.q:
            query = {
                'q': self.q,
                'corpname': self.corpname,
                'usesubcorp': self.usesubcorp,
                'align': self.align
            }
            q_id = plugins.conc_persistence.store(self._session_get('user', 'id'),
                                                  curr_data=query, prev_data=self._prev_q_data)
        else:
            q_id = None
        return q_id

    def _update_output_with_conc_params(self, op_id, tpl_data):
        """
        Updates template data dictionary tpl_data with stored operation values.

        arguments:
        op_id -- unique operation ID
        tpl_data -- a dictionary used along with HTML template to render the output
        """
        if plugins.has_plugin('conc_persistence'):
            if op_id:
                tpl_data['q'] = 'q=~%s' % op_id
                tpl_data['Q'] = [{'q': '~%s' % op_id}]
            else:
                tpl_data['q'] = ''
                tpl_data['Q'] = []
        else:
            tpl_data['q'] = self.urlencode([('q', q) for q in self.q])
            tpl_data['Q'] = [{'q': q} for q in self.q]

    def _pre_dispatch(self, path, selectorname, named_args, action_metadata=None):
        """
        Runs before main action is processed
        """
        def choose_selector(args, selector):
            selector += ':'
            s = len(selector)
            args.update(dict([(n[s:], v) for n, v in args.items() if n.startswith(selector)]))

        super(ConcCGI, self)._pre_dispatch(path, selectorname, named_args)
        param_types = dict(inspect.getmembers(self.__class__, predicate=lambda x: isinstance(x, Parameter)))

        if not action_metadata:
            action_metadata = {}
        form = cgi.FieldStorage(keep_blank_values=self._keep_blank_values,
                                environ=self.environ, fp=self.environ['wsgi.input'])

        options, corp_options = self._load_user_settings()
        # only general setting can be applied now because
        # we do not know final corpus name yet
        self._apply_general_user_settings(options, self._init_default_settings)

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

        # now we can apply also corpus-dependent settings
        # because the corpus name is already known
        self._apply_corpus_user_settings(corp_options, self.corpname)

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
                if key in param_types:
                    if not param_types[key].is_array() and type(val) is list:
                        # If a parameter (see static Parameter instances) is defined as a scalar
                        # but the web framework returns a list (e.g. an HTML form contains a key with
                        # multiple occurrences) then a possible conflict emerges. Although this should not happen,
                        # original Bonito2 code contains such inconsistencies. In such cases we use only last value
                        # as we expect that the last value overwrites previous ones with the same key.
                        val = val[-1]
                    elif param_types[key].is_array() and not type(val) is list:
                        # A Parameter object is expected to be a list but
                        # web framework returns a scalar value
                        val = [val]
                val = self.recode_input(val)
                if key.startswith('sca_') and val == settings.get('corpora', 'empty_attr_value_placeholder'):
                    val = ''
                named_args[key] = val
        na = named_args.copy()

        convert_types(na, self.clone_self())
        if selectorname:
            choose_selector(self.__dict__, getattr(self, selectorname))
        self.cm = corplib.CorpusManager(plugins.auth.get_corplist(self._user), self.subcpath)
        if getattr(self, 'refs') is None:
            self.refs = corpus_get_conf(self._corp(), 'SHORTREF')
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

        self._restore_prev_conc_params()

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
        if type(result) is dict and '__time__' in result:
            proc_time = result['__time__']
        else:
            proc_time = None
        self._log_request(self._get_persistent_items(), '%s' % methodname, proc_time=proc_time)

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
        return 'corpname',

    def _save_query(self, query, query_type):
        if plugins.has_plugin('query_storage'):
            plugins.query_storage.write(user_id=self._session_get('user', 'id'), corpname=self.corpname,
                                        subcorpname=self.usesubcorp, query=query, query_type=query_type)

    def _determine_curr_corpus(self, form, corp_list):
        """
        This method tries to determine which corpus is currently in use.
        If no answer is found or in case there is a conflict between selected
        corpus and user access rights then some fallback alternative is found -
        in such case the returned 'fallback' value is set to a URL leading to the
        fallback corpus.

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
                fallback = '%sfirst_form?corpname=%s' % (self.get_root_url(), cn)

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
            fallback = '%sfirst_form?corpname=%s' % (self.get_root_url(), cn)
        return cn, fallback

    def self_encoding(self):
        enc = corpus_get_conf(self._corp(), 'ENCODING')
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
        result['struct_ctx'] = corpus_get_conf(corpus, 'STRUCTCTX')
        result['corp_doc'] = corpus_get_conf(corpus, 'DOCUMENTATION')
        result['corp_full_name'] = (corpus_get_conf(corpus, 'NAME')
                                    or self.corpname)

        result['corp_description'] = corpus.get_info()
        result['corp_size'] = format_number(corpus.size())
        corp_conf_info = plugins.corptree.get_corpus_info(self.corpname)
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
        attrlist = corpus_get_conf(corpus, 'ATTRLIST').split(',')
        sref = corpus_get_conf(corpus, 'SHORTREF')
        result['fcrit_shortref'] = '+'.join([a.strip('=') + '+0'
                                             for a in sref.split(',')])
        result['corpencoding'] = corpus_get_conf(corpus, 'ENCODING')
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
        result['default_attr'] = corpus_get_conf(corpus, 'DEFAULTATTR')
        for listname in ['AttrList', 'StructAttrList']:
            if listname in result:
                continue
            result[listname] = \
                [{'label': corpus_get_conf(corpus, n + '.LABEL') or n, 'n': n}
                 for n in corpus_get_conf(corpus, listname.upper()).split(',')
                 if n]
        result['tagsetdoc'] = corpus_get_conf(corpus, 'TAGSETDOC')
        result['ttcrit'] = self.urlencode([('fcrit', '%s 0' % a) for a in
                                           corpus_get_conf(corpus, 'SUBCORPATTRS')
                                           .replace('|', ',').split(',') if a])
        result['corp_uses_tag'] = 'tag' in corpus_get_conf(corpus, 'ATTRLIST').split(',')
        if self.annotconc and not 'GroupNumbers' in result.keys():
            labelmap = conclib.get_conc_labelmap(self._storeconc_path()
                                                 + '.info')
            result['GroupNumbers'] = conclib.format_labelmap(labelmap)
        result['commonurl'] = self.urlencode([('corpname', self.corpname),
                                              ('lemma', self.lemma),
                                              ('lpos', self.lpos),
                                              ('usesubcorp', self.usesubcorp),
                                              ])
        result['citation_info'] = corp_conf_info.get('citation_info', '')

    def _setup_optional_plugins_js(self, result):
        """
        Updates result dict with JavaScript module paths required to
        run client-side parts of some optional plugins. Template document.tmpl
        (i.e. layout template) configures RequireJS module accordingly.
        """
        import plugins

        for opt_plugin in ('live_attributes', 'query_storage'):
            js_file_key = '%s_js' % opt_plugin
            result[js_file_key] = None
            if plugins.has_plugin(opt_plugin):
                plugin_obj = getattr(plugins, opt_plugin)
                if not isinstance(plugin_obj, plugins.CorpusDependentPlugin) or plugin_obj.is_enabled_for(self.corpname):
                    js_file = settings.get('plugins', opt_plugin, {}).get('js_module')
                    if js_file:
                        result[js_file_key] = js_file

    def _add_globals(self, result, methodname, action_metadata):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        CGIPublisher._add_globals(self, result, methodname, action_metadata)

        result['css_fonts'] = settings.get('global', 'fonts') if settings.get('global', 'fonts') else []
        result['human_corpname'] = self._human_readable_corpname()
        result['debug'] = settings.is_debug_mode()
        result['_version'] = (conclib.manatee.version(), settings.get('global', '__version__'))
        # TODO testing app state by looking at the message type may not be the best way
        result['display_closed_conc'] = len(self.q) > 0 and result.get('message', [None])[0] != 'error'

        # conc_persistence plugin related
        op_id = self._store_conc_params()
        self._update_output_with_conc_params(op_id, result)

        result['corpname_url'] = 'corpname=' + self.corpname

        global_var_val = [(n, val) for n in self._conc_state_vars
                          for val in [getattr(self, n, None)]
                          if getattr(self.__class__, n, None) is not val]

        result['globals'] = self.urlencode(global_var_val)
        result['Globals'] = StateGlobals(global_var_val)

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

        # updates result dict with javascript modules paths required by some of the optional plugins
        self._setup_optional_plugins_js(result)

        result['bib_conf'] = plugins.corptree.get_corpus_info(self.corpname).get('metadata', {})

        # avalilable languages
        if plugins.has_plugin('getlang'):
            result['avail_languages'] = ()
        else:
            result['avail_languages'] = settings.get_full('global', 'translations')

        # util functions
        result['format_number'] = partial(format_number)

        result['error_report_url'] = settings.get('global', 'error_report_url', None)

        result['qunit_test'] = self.qunit
        if self.qunit and settings.is_debug_mode():
            result['client_model_dir'] = 'tests'
            result['page_model'] = self.qunit
        else:
            result['client_model_dir'] = 'tpl'
            result['page_model'] = action_metadata.get('page_model', strings.camelize(methodname))

        # is there a concordance information in session?
        self._restore_conc_results(result)

        return result

    def _restore_conc_results(self, storage):
        """
        Restores current concordance's parameters from session and stores
        them into a passed dict.

        arguments:
        storage: a dict or a dict-like object
        """
        conc_key = '#'.join(self.q)
        if 'conc' in self._session and conc_key in self._session['conc']:
            tmp = self._session['conc']

            storage['conc_persist'] = True
            for k in ConcCGI.CONC_PERSISTENT_ATTRS:
                storage[k] = tmp[conc_key].get(k)
        else:
            storage['conc_persist'] = False

    def _store_conc_results(self, src):
        """
        Stores passed data as current concordance parameters

        arguments:
        src -- a dict or a dict-like object
        """
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

    def _add_undefined(self, result, methodname, vars):
        result['methodname'] = methodname
        if len(vars) == 0:
            return

        if 'Desc' in vars:
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

        if 'TextTypeSel' in vars:
            result['TextTypeSel'] = self._texttypes_with_norms(ret_nums=False)
        if 'LastSubcorp' in vars:
            if self.cm:
                result['LastSubcorp'] = self.cm.subcorp_names(self.corpname)
            else:
                # this should apply only in case of an error
                result['LastSubcorp'] = ''
            result['lastSubcorpSize'] = min(len(result['LastSubcorp']) + 1, 20)

        if 'orig_query' in vars:
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
        Restores query form's queryselector_* values using session data.
        The 'queryselector' of the primary corpus can be overridden by
        URL parameter 'queryselector'.
        """
        ans = {}
        if self.queryselector:
            ans['queryselector'] = self.queryselector
        elif 'forms' in self._session:
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

    def _human_readable_corpname(self):
        """
        Returns an user-readable name of the current corpus (i.e. it cannot be used
        to identify the corpus in KonText's code as it is only intended to be printed
        somewhere on a page).
        """
        if self._corp().get_conf('NAME'):
            return corpus_get_conf(self._corp(), 'NAME')
        elif self.corpname:
            return self._canonical_corpname(self.corpname)
        else:
            return ''

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
        return speech_struct in corpus_get_conf(self._corp(), 'STRUCTATTRLIST').split(',')

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

    @staticmethod
    def onelevelcrit(prefix, attr, ctx, pos, fcode, icase, bward='', empty=''):
        fromcode = {'lc': '<0', 'rc': '>0', 'kl': '<0', 'kr': '>0'}
        attrpart = '%s%s/%s%s%s ' % (prefix, attr, icase, bward, empty)
        if not ctx:
            ctx = '%i%s' % (pos, fromcode.get(fcode, '0'))
        if '~' in ctx and '.' in attr:
            ctx = ctx.split('~')[0]
        return attrpart + ctx