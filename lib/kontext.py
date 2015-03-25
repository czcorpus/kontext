# Copyright (c) 2003-2013  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
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
from controller import Controller, UserActionException, convert_types, Parameter
import plugins
import settings
import l10n
from l10n import format_number, corpus_get_conf, export_string
from translation import ugettext as _
import scheduled
from structures import Nicedict, FixedDict
from templating import StateGlobals
import fallback_corpus
from werkzeug.wrappers import Request


def simplify_num(v):
    if v >= 1e9:
        return '%dG' % (round(v / 1e9, 0))
    if v >= 1e6:
        return '%dM' % (round(v / 1e6, 0))
    if v >= 1e3:
        return '%dK' % (round(v / 1e3, 0))
    return '%d' % (round(v / 1e2, 0) * 100,)


class ConcError(Exception):
    def __init__(self, msg):
        super(ConcError, self).__init__(msg)


class ConcArgsMapping(FixedDict):
    """
    This class covers all the attributes representing a concordance. I.e. the application should
    be able to restore any concordance just by using these parameters.

    Please note that this list does not include the 'q' parameter which collects currently built query
    (it has been inherited from Bonito2).
    """
    corpname = None
    usesubcorp = None
    maincorp = None
    viewmode = None
    pagesize = None
    align = None
    attrs = None
    attr_allpos = None
    ctxattrs = None
    structs = None
    refs = None

    def get_attrs(self):
        return self.__dict__.keys()


class LegacyForm(object):
    """
    A wrapper class which ensures that Werkzeug's request.form (= MultiDict)
    will be compatible with legacy code in the Kontext class.
    """
    def __init__(self, form, args):
        self._form = form
        self._args = args

    def __iter__(self):
        return self.keys().__iter__()

    def __contains__(self, item):
        return self._form.__contains__(item) or self._args.__contains__(item)

    def keys(self):
        return list(set(self._form.keys() + self._args.keys()))

    def getvalue(self, k):
        tmp = self._form.getlist(k)
        if len(tmp) == 0 and k in self._args:
            return self._args[k]
        elif len(tmp) == 1:
            return tmp[0]
        return tmp


class MainMenuItem(object):
    def __init__(self, name):
        self.name = name
        self.items = []

    def __call__(self, *items):
        self.items.extend(items)
        return self

    def __repr__(self):
        if len(self.items) > 0:
            return ', '.join(['%s:%s' % (self.name, item) for item in self.items])
        else:
            return self.name

    def matches(self, s):
        """
        Tests whether a provided template menu identifier
        (based on convention main_menu_item:submenu_item)
        matches this one.

        arguments:
        s -- (sub)menu item string identifier
        """
        s2 = s.split(':')
        if len(s2) == 2:
            return self.name == s2[0] and s2[1] in self.items
        else:
            return self.name == s2[0] and len(self.items) == 0


class MainMenu(object):
    """
    Specifies main menu items on KonText page. Items themselves are used
    to disable parts of the menu (whole sections or individual submenu items).

    Examples:
    1) to disable whole FILTER section just add MainMenu.FILTER to the list of
       disabled menu items (see kontext.Kontext).
    2) to disable the 'word list' and 'history' functionalities in 'new query' section
       just add MainMenu.NEW_QUERY('wordlist', 'history')
    """
    NEW_QUERY = MainMenuItem('menu-new-query')
    VIEW = MainMenuItem('menu-view')
    SAVE = MainMenuItem('menu-save')
    CORPORA = MainMenuItem('menu-corpora')
    CONCORDANCE = MainMenuItem('menu-concordance')
    FILTER = MainMenuItem('menu-filter')
    FREQUENCY = MainMenuItem('menu-frequency')
    COLLOCATIONS = MainMenuItem('menu-collocations')
    HELP = MainMenuItem('menu-help')


class Kontext(Controller):
    """
    A controller.Controller extension implementing
    KonText-specific requirements.
    """
    # main menu items disabled for public users (this is applied automatically during _post_dispatch())
    ANON_FORBIDDEN_MENU_ITEMS = (MainMenu.NEW_QUERY('history', 'wordlist'),
                                 MainMenu.CORPORA('my-subcorpora', 'new-subcorpus'),
                                 MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER,
                                 MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.VIEW)

    CONCORDANCE_ACTIONS = (MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER, MainMenu.FREQUENCY,
                           MainMenu.COLLOCATIONS, MainMenu.VIEW('kwic-sentence'))

    # A list of parameters needed to make concordance result parameters (e.g. size, currently viewed page,..)
    # persistent. It is used to keep showing these values to a user even if he is outside the concordance view page.
    CONC_RESULT_ATTRS = ('sampled_size', 'fullsize', 'concsize', 'numofpages', 'fromp', 'result_relative_freq',
                         'result_relative_freq_rel_to', 'result_arf', 'result_shuffled', 'Sort_idx',
                         'nextlink', 'lastlink', 'prevlink', 'firstlink')


    GENERAL_OPTIONS = ('pagesize', 'kwicleftctx', 'kwicrightctx', 'multiple_copy', 'tbl_template', 'ctxunit',
                       'refs_up', 'shuffle', 'citemsperpage', 'fmaxitems')

    LOCAL_COLL_OPTIONS = ('cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr', 'collpage', 'cbgrfns',
                          'csortfn')


    # Default corpus must be accessible to any user, otherwise KonText messes up trying
    # to infer some default corpus name and redirect user there. Hopefully, future releases
    # will avoid this.
    DEFAULT_CORPUS = 'susanne'

    # a user settings key entry used to access user's scheduled actions
    SCHEDULED_ACTIONS_KEY = '_scheduled'

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
    queryselector = Parameter(u'')  # empty by-default; a session value is used in case nothing is set via URL
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
    subcnorm = Parameter('tokens')

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
    maincorp = Parameter('')   # used only in case of parallel corpora - specifies corpus with "focus"
    refs_up = Parameter(0, persistent=True)
    refs = Parameter(None)  # None means "not initialized" while '' means "user wants to show no refs"

    enable_sadd = Parameter(0)
    tag_builder_support = Parameter([])

    shuffle = Parameter(0, persistent=True)
    SubcorpList = Parameter([])

    favorite_corpora = Parameter([], persistent=True)
    keyword = Parameter([])

    qunit = Parameter('')  # this parameter is used to activate and set-up a QUnit unit tests

    _conc_dir = u''
    _home_url = u'./first_form'
    _files_path = u'../files'

    def __init__(self, request, ui_lang):
        super(Kontext, self).__init__(request=request, ui_lang=ui_lang)
        self._curr_corpus = None  # Note: always use _corp() method to access current corpus even from inside the class
        self.last_corpname = None
        self.empty_attr_value_placeholder = settings.get('corpora', 'empty_attr_value_placeholder')
        self.cache_dir = settings.get('corpora', 'cache_dir')
        self.return_url = None
        self.cm = None  # a CorpusManager instance (created in _pre_dispatch() phase)
        self.disabled_menu_items = []
        self.save_menu = []
        self._conc_args = ConcArgsMapping()

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
        
        logged_values = settings.get('global', 'logged_values', ())
        log_data = {} 

        params = {}
        if self.environ.get('QUERY_STRING'):
            params.update(dict([item.split('=', 1) for item in [x for x in self.environ.get('QUERY_STRING').split('&')
                                                                if x]])) 

        for val in logged_values:
            if val == 'date':
                log_data['date'] = datetime.datetime.today().strftime('%Y-%m-%d %H:%M:%S')
            elif val == 'action':
                log_data['action'] = action_name
            elif val == 'user_id':
                log_data['user_id'] = self._session_get('user', 'id')
            elif val == 'user':
                log_data['user'] = self._session_get('user', 'user')
            elif val == 'params':
                log_data['params'] = dict([(k, v) for k, v in params.items() if v])
            elif val == 'settings':
                log_data['settings'] = dict([(k, v) for k, v in user_settings.items() if v])
            elif val == 'proc_time' and proc_time is not None:
                log_data['proc_time'] = proc_time
            elif val.find('environ:') == 0:
                if 'request' not in log_data:
                    log_data['request'] = {}
                k = val.split(':')[-1]
                log_data['request'][k] = self.environ.get(k)

        logging.getLogger('QUERY').info(json.dumps(log_data))

    def _requires_corpus_access(self, action):
        # TODO this is a flawed solution - method metadata (access_level should be used instead)
        return action not in ('login', 'loginx', 'logoutx', 'ajax_get_toolbar')

    def _init_default_settings(self, options):
        if 'shuffle' not in options:
            options['shuffle'] = 1

    def _setup_user_paths(self, user_file_id):
        if not self._user_is_anonymous():
            self.subcpath.append('%s/%s' % (settings.get('corpora', 'users_subcpath'), user_file_id))
        self._conc_dir = '%s/%s' % (settings.get('corpora', 'conc_dir'), user_file_id)

    def _user_has_persistent_settings(self):
        excluded_users = [int(x) for x in settings.get('plugins', 'settings_storage').get('excluded_users', ())]
        return self._session_get('user', 'id') not in excluded_users and not self._user_is_anonymous()

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
        if self._user_has_persistent_settings():
            data = plugins.settings_storage.load(self._session_get('user', 'id'))
        else:
            data = self._session_get('settings')
            if not data:
                data = {}
        for k, v in data.items():
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
        self._setup_user_paths(self._session_get('user', 'user'))
        self.__dict__.update(options)

    def _apply_corpus_user_settings(self, options, corpname):
        """
        Applies corpus-dependent settings in the similar way
        to self._apply_general_user_settings. But in this case,
        a corpus name must be provided to be able to filter out
        settings of other corpora. Otherwise, no action is performed.
        """
        if len(corpname) > 0:
            ans = {}
            for k, v in options.items():
                tokens = k.rsplit(':', 1)  # e.g. public/syn2010:structattrs => ['public/syn2010', 'structattrs']
                if len(tokens) == 2:
                    if tokens[0] == corpname and tokens[1] not in self.GENERAL_OPTIONS:
                        ans[tokens[1]] = v
            convert_types(options, self.clone_self(), selector=1)
            self.__dict__.update(ans)

    def _get_save_excluded_attributes(self):
        return ()

    def _save_options(self, optlist=None, selector=''):
        """
        Saves user's options to a storage
        """
        if optlist is None:
            optlist = []
        if selector:
            tosave = [(selector + ':' + opt, self.__dict__[opt])
                      for opt in optlist if opt in self.__dict__]
        else:
            tosave = [(opt, self.__dict__[opt]) for opt in optlist
                      if opt in self.__dict__]

        def normalize_opts(opts):
            if opts is None:
                opts = {}
            excluded_attrs = self._get_save_excluded_attributes()
            for k in opts.keys():
                if k in excluded_attrs:
                    del(opts[k])
            opts.update(tosave)
            return opts

        # data must be loaded (again) because in-memory settings are
        # in general a subset of the ones stored in db (and we want
        # to store (again) even values not used in this particular request)
        if self._user_has_persistent_settings():
            options = normalize_opts(plugins.settings_storage.load(self._session_get('user', 'id')))
            plugins.settings_storage.save(self._session_get('user', 'id'), options)
        else:
            options = normalize_opts(self._session_get('settings'))
            self._session['settings'] = options

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
                raise UserActionException(_('Invalid or expired query'))

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

    def _scheduled_actions(self, user_settings):
        actions = []
        if Kontext.SCHEDULED_ACTIONS_KEY in user_settings:
            value = user_settings[Kontext.SCHEDULED_ACTIONS_KEY]
            if type(value) is dict:
                actions.append(value)
            elif type(value):
                actions += value
            for action in actions:
                func_name = action['action']
                if hasattr(scheduled, func_name):
                    fn = getattr(scheduled, func_name)
                    if inspect.isclass(fn):
                        fn = fn()
                    if callable(fn):
                        try:
                            ans = apply(fn, (), action)
                            if 'message' in ans:
                                self.add_system_message('message', ans['message'])
                            continue
                        except Exception as e:
                            logging.getLogger('SCHEDULING').error('task_id: %s, error: %s(%s)' % (
                                action.get('id', '??'), e.__class__.__name__, e))
                # avoided by 'continue' in case everything is OK
                logging.getLogger('SCHEDULING').error('task_id: %s, Failed to invoke scheduled action: %s' % (
                    action.get('id', '??'), action,))
            self._save_options()  # this causes scheduled task to be removed from settings

    def _map_args_to_attrs(self, form, selectorname, named_args):
        """
        Maps URL and form arguments to self.__dict__. This is intended for
        legacy action methods.
        """
        def choose_selector(args, selector):
            selector += ':'
            s = len(selector)
            args.update(dict([(n[s:], v) for n, v in args.items() if n.startswith(selector)]))

        param_types = dict(inspect.getmembers(self.__class__, predicate=lambda x: isinstance(x, Parameter)))

        if 'json' in form:
            json_data = json.loads(form.getvalue('json'))
            named_args.update(json_data)
        for k in form.keys():
            # must remove empty values, thi   s should be achieved by
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
                named_args[key] = val
        na = named_args.copy()

        convert_types(na, self.clone_self())
        if selectorname:
            choose_selector(self.__dict__, getattr(self, selectorname))
        self.__dict__.update(na)

    def _check_corpus_access(self, path, form, action_metadata):
        allowed_corpora = plugins.auth.get_corplist(self._session_get('user', 'id'))
        if self._requires_corpus_access(path[0]):
            self.corpname, fallback_url = self._determine_curr_corpus(form, allowed_corpora)
            if fallback_url:
                path = [Controller.NO_OPERATION]
                if action_metadata.get('return_type', None) != 'json':
                    self._redirect(fallback_url)
                else:
                    path = ['json_error']  # just passing a fallback method for JSON response
        elif len(allowed_corpora) > 0:
            self.corpname = ''
        else:
            self.corpname = ''
        return path

    # TODO: decompose this method (phase 2)
    def _pre_dispatch(self, path, selectorname, named_args, action_metadata=None):
        """
        Runs before main action is processed
        """
        def validate_corpus():
            c = self._corp()
            if isinstance(c, fallback_corpus.ErrorCorpus):
                return c.get_error()
            return None
        self.add_validator(validate_corpus)

        super(Kontext, self)._pre_dispatch(path, selectorname, named_args)

        if not action_metadata:
            action_metadata = {}
        is_legacy_method = action_metadata.get('legacy', False)

        if is_legacy_method:
            form = cgi.FieldStorage(keep_blank_values=self._keep_blank_values,
                                    environ=self.environ, fp=self.environ['wsgi.input'])
        else:
            form = LegacyForm(self._request.form, self._request.args)

        options, corp_options = self._load_user_settings()
        self._scheduled_actions(options)
        # only general setting can be applied now because
        # we do not know final corpus name yet
        self._apply_general_user_settings(options, self._init_default_settings)

        # corpus access check and modify path in case user cannot access currently requested corp.
        path = self._check_corpus_access(path, form, action_metadata)

        # now we can apply also corpus-dependent settings
        # because the corpus name is already known
        self._apply_corpus_user_settings(corp_options, self.corpname)

        # TODO Fix the class so "if is_legacy_method:" here is possible to apply here
        if is_legacy_method:
            self._map_args_to_attrs(form, selectorname, named_args)
        logging.getLogger(__name__)
        self.cm = corplib.CorpusManager(plugins.auth.get_corplist(self._session_get('user', 'id')), self.subcpath)
        if getattr(self, 'refs') is None:
            self.refs = corpus_get_conf(self._corp(), 'SHORTREF')

        # return url (for 3rd party pages etc.)
        if self.get_http_method() == 'GET':
            self.return_url = self._updated_current_url({'remote': 1})
        else:
            self.return_url = '%sfirst_form?corpname=%sremote=1' % (self.get_root_url(), self.corpname)

        self._restore_prev_conc_params()

        if len(path) > 0:
            access_level = action_metadata.get('access_level', 0)  # by default, each action is public
            if access_level and self._user_is_anonymous():
                from plugins.abstract import auth
                raise auth.AuthException(_('Access forbidden'))
        # plugins setup
        for p in plugins.list_plugins():
            if callable(getattr(p, 'setup', None)):
                p.setup(self)

        return path, selectorname, named_args

    def _post_dispatch(self, methodname, tmpl, result):
        """
        Runs after main action is processed but before any rendering (incl. HTTP headers)
        """
        if self._user_is_anonymous():
            disabled_set = set(self.disabled_menu_items)
            self.disabled_menu_items = tuple(disabled_set.union(set(Kontext.ANON_FORBIDDEN_MENU_ITEMS)))
        super(Kontext, self)._post_dispatch(methodname, tmpl, result)
        self._log_request(self._get_persistent_items(), '%s' % methodname, proc_time=self._proc_time)

    def _attach_tag_builder(self, tpl_out):
        """
        Parameters
        ----------
        tpl_out : dict
            data to be used when building an output page from a template
        """
        tpl_out['tag_builder_support'] = {
            '': plugins.taghelper.tag_variants_file_exists(self.corpname)
        }
        tpl_out['user_menu'] = True
        if 'Aligned' in tpl_out:
            for item in tpl_out['Aligned']:
                tpl_out['tag_builder_support']['_%s' % item['n']] = plugins.taghelper.tag_variants_file_exists(item['n'])

    def _attach_query_metadata(self, tpl_out):
        """
        Adds information needed by extended version of text type (and other attributes) selection in a query
        """
        tpl_out['metadata_desc'] = plugins.corptree.get_corpus_info(self.corpname, language=self.ui_lang)['metadata']['desc']

    def _add_save_menu_item(self, label, action, params):
        self.save_menu.append({'label': label, 'action': action, 'params': params})

    def _reset_session_conc(self):
        """
        Resets information about current concordance user works with
        """
        if 'conc' in self._session:
            del(self._session['conc'])

    def _export_subcorpora_list(self, out):
        """
        Updates passed dictionary by information about available sub-corpora.
        Listed values depend on current user and corpus.

        arguments:
        out -- a dictionary used by templating system
        """
        basecorpname = self.corpname.split(':')[0]
        subcorp_list = l10n.sort(self.cm.subcorp_names(basecorpname), loc=self.ui_lang, key=lambda x: x['n'])
        if len(subcorp_list) > 0:
            subcorp_list = [{'n': '--%s--' % _('whole corpus'), 'v': ''}] + subcorp_list
        out['SubcorpList'] = subcorp_list

    def _get_save_excluded_attributes(self):
        return 'corpname', Kontext.SCHEDULED_ACTIONS_KEY

    def _save_query(self, query, query_type):
        if plugins.has_plugin('query_storage'):
            params = {}
            if query_type == 'lemma':
                params['lpos'] = self.lpos
            elif query_type == 'word':
                params['wpos'] = self.wpos
                params['qmcase'] = self.qmcase
            elif query_type == 'cql':
                params['default_attr'] = self.default_attr
            plugins.query_storage.write(user_id=self._session_get('user', 'id'), corpname=self.corpname,
                                        subcorpname=self.usesubcorp, query=query, query_type=query_type, params=params)

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
            fallback = self._updated_current_url({'corpname': cn})
        elif cn != self._canonical_corpname(cn) and cn not in corp_list:
            cn = self._canonical_corpname(cn)
            fallback = self._updated_current_url({'corpname': cn})

        # last resort solution (this shouldn't happen in properly configured production installation)
        if not cn in corp_list:
            cn = Kontext.DEFAULT_CORPUS
            fallback = '%sfirst_form?corpname=%s' % (self.get_root_url(), cn)
        return cn, fallback

    def self_encoding(self):
        enc = corpus_get_conf(self._corp(), 'ENCODING')
        if enc:
            return enc
        else:
            return 'iso-8859-1'

    def _app_cookie_names(self):
        """
        Any valid cookie is loaded and available but only these are saved by KonText
        """
        return tuple([settings.get('plugins', 'auth')['auth_cookie_name']])

    def _corp(self):
        """
        Returns current corpus (as a manatee object). The method ensures
        that a corpus-like object is always returned even in case of an error.
        To interrupt normal request processing a controller validator (see add_validator)
        is defined.

        This should be always preferred over accessing _curr_corpus attribute.

        returns:
        a manatee.Corpus instance in case everything is OK (corpus is known, object is initialized
        without errors) or ErrorCorpus in case an exception occurred or Empty corpus in case
        the action does not need one (but KonText's internals do).
        """
        if self.corpname:
            try:
                if not self._curr_corpus or (self.usesubcorp and not hasattr(self._curr_corpus, 'subcname')):
                    self._curr_corpus = self.cm.get_Corpus(self.corpname, self.usesubcorp)
                    # TODO opravit poradne!
                self._curr_corpus._conc_dir = self._conc_dir
                return self._curr_corpus
            except Exception as e:
                return fallback_corpus.ErrorCorpus(e)
        else:
            return fallback_corpus.EmptyCorpus()

    def _load_fav_corplist(self):
        user_corpora = self.cm.corplist_with_names(plugins.corptree.get(), settings.get_bool('corpora', 'use_db_whitelist'))
        favorite_corpora = [fc for fc in user_corpora if fc['canonical_id'] in self.favorite_corpora]
        if len(favorite_corpora) == 0:
            favorite_corpora.append({
                'id': self.corpname,
                'canonical_id': self._canonical_corpname(self.corpname),
                'name': self._human_readable_corpname(),
                'size': self._corp().search_size(),
                'desc': 'current corpus (you have no favorite corpora)',
                'path': ''
            })
        for item in favorite_corpora:
            item['size'] = simplify_num(item['size'])
        return favorite_corpora

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

        result['CorplistFn'] = self._load_fav_corplist
        mkitem = lambda x: (x[0], x[0].replace(' ', '_'), x[1])
        corp_labels = [mkitem(item) for item in plugins.corptree.get_all_corpus_keywords()]

        result['corpora_labels'] = json.dumps(corp_labels)
        if self.usesubcorp:
            result['subcorp_size'] = format_number(self._corp().search_size())
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

        for opt_plugin in ('live_attributes', 'query_storage', 'application_bar'):
            js_file_key = '%s_js' % opt_plugin
            result[js_file_key] = None
            if plugins.has_plugin(opt_plugin):
                plugin_obj = getattr(plugins, opt_plugin)
                # if the plug-in is "always on" or "sometimes off but currently on" then it must configure JavaScript
                if not isinstance(plugin_obj, plugins.abstract.CorpusDependentPlugin) or plugin_obj.is_enabled_for(self.corpname):
                    js_file = settings.get('plugins', opt_plugin, {}).get('js_module')
                    if js_file:
                        result[js_file_key] = js_file

    def _get_attrs(self, attr_names, force_values=None):
        if force_values is None:
            force_values = {}
        is_valid = lambda name, value: getattr(self.__class__, name, None) is not value and value != ''
        get_val = lambda k: force_values[k] if k in force_values else getattr(self, k, None)
        return [(n, val) for n in attr_names for val in [get_val(n)] if is_valid(n, val)]

    def _add_globals(self, result, methodname, action_metadata):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        Controller._add_globals(self, result, methodname, action_metadata)

        result['css_fonts'] = settings.get('global', 'fonts') if settings.get('global', 'fonts') else []
        result['human_corpname'] = self._human_readable_corpname()
        result['debug'] = settings.is_debug_mode()
        result['_version'] = (corplib.manatee_version(), settings.get('global', '__version__'))
        # TODO testing app state by looking at the message type may not be the best way
        result['display_closed_conc'] = len(self.q) > 0 and result.get('message', [None])[0] != 'error'

        # conc_persistence plugin related
        op_id = self._store_conc_params()
        self._update_output_with_conc_params(op_id, result)

        result['corpname_url'] = 'corpname=' + self.corpname
        global_var_val = self._get_attrs(self._conc_args.get_attrs())
        result['globals'] = self.urlencode(global_var_val)
        result['Globals'] = StateGlobals(global_var_val)

        if self.maincorp:
            thecorp = corplib.open_corpus(self.maincorp)
        else:
            thecorp = self._corp()
        try:
            self._add_corpus_related_globals(result, thecorp)
        except Exception as ex:
            logging.getLogger(__name__).warning('supressed error in kontext._add_corpus_related_globals(): %s' % ex)

        result['supports_password_change'] = plugins.auth.uses_internal_user_pages()
        result['undo_q'] = self.urlencode([('q', q) for q in self.q[:-1]])
        result['session_cookie_name'] = settings.get('plugins', 'auth').get('auth_cookie_name', '')

        result['root_url'] = self.get_root_url()
        result['static_url'] = '%sfiles/' % self.get_root_url()
        result['user_info'] = self._session.get('user', {'fullname': None})
        result['_anonymous'] = self._user_is_anonymous()

        if plugins.has_plugin('auth'):
            result['login_url'] = plugins.auth.get_login_url(self._updated_current_url({'remote': 1}))
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

        result['error_report_url'] = None
        if settings.get('global', 'error_report_url', None):
            err_rep_params = []
            params_def = settings.get_full('global', 'error_report_params')
            if params_def[0]:  # 0: conf value, 1: conf metadata; always guaranteed
                for param_val, param_meta in params_def:
                    if param_val[0] == '@':
                        attr = getattr(self, param_val[1:])
                        real_val = apply(attr) if callable(attr) else attr
                    else:
                        real_val = param_val
                    err_rep_params.append('%s=%s' % (param_meta['name'], urllib.quote_plus(real_val)))
                result['error_report_url'] = '%s?%s' % (settings.get('global', 'error_report_url'), '&'.join(err_rep_params))

        result['qunit_test'] = self.qunit
        if self.qunit and settings.is_debug_mode():
            result['client_model_dir'] = 'tests'
            result['page_model'] = self.qunit
        else:
            result['client_model_dir'] = 'tpl'
            result['page_model'] = action_metadata.get('page_model', l10n.camelize(methodname))

        if settings.contains('global', 'ui_state_ttl'):
            result['ui_state_ttl'] = settings.get('global', 'ui_state_ttl')
        else:
            result['ui_state_ttl'] = 3600 * 12

        # now we store specific information (e.g. concordance parameters)
        # to keep user informed about data he is working with on any page
        cached_values = Nicedict(empty_val='')
        self._restore_conc_results(cached_values)
        result['cached'] = cached_values
        result['join_params'] = lambda *args: '&'.join([s.strip() for s in args if s.strip()])
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
            for k in Kontext.CONC_RESULT_ATTRS:
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

        data = dict([(k, src.get(k)) for k in Kontext.CONC_RESULT_ATTRS])
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

        It is also OK if nothing is set for a particular query selector (primary
        corpus, aligned corpora) either from URL or from session. In such case
        the respective 'SELECT' HTML element will display its first 'OPTION'
        which is 'iqueryrow' (= basic query type).
        """
        ans = {}
        if self.queryselector:
            ans['queryselector'] = self.queryselector
        elif 'forms' in self._session:
            ans.update(self._session['forms'])
        return ans

    def _canonical_corpname(self, c):
        """
        """
        return corplib.canonical_corpname(c)

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

    def _get_struct_opts(self):
        """
        Returns structures and structural attributes the current concordance should display.
        Note: current solution is little bit confusing - there are two overlapping parameters
        here: structs & structattrs where the former is the one used in URL and the latter
        stores user's persistent settings (but can be also passed via URL with some limitations).
        """
        return '%s,%s' % (self.structs, ','.join(self.structattrs))

    @staticmethod
    def onelevelcrit(prefix, attr, ctx, pos, fcode, icase, bward='', empty=''):
        fromcode = {'lc': '<0', 'rc': '>0', 'kl': '<0', 'kr': '>0'}
        attrpart = '%s%s/%s%s%s ' % (prefix, attr, icase, bward, empty)
        if not ctx:
            ctx = '%i%s' % (pos, fromcode.get(fcode, '0'))
        if '~' in ctx and '.' in attr:
            ctx = ctx.split('~')[0]
        return attrpart + ctx

    @staticmethod
    def _parse_sorting_param(k):
        if k[0] == '-':
            revers = True
            k = k[1:]
        else:
            revers = False
        return k, revers

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
            raise UserActionException(_('No meta-information to create a subcorpus.'))

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

    def _texttype_query_OLD(self, obj=None, access=None, attr_producer=None):
        """
        Extracts all the text-type related form parameters user can access when creating
        a subcorpus or selecing ad-hoc metadata in the query form.

        Because currently there are two ways how action methods access URL/form parameters
        this method is able to extract the values either from 'self' (= old style) or from
        the 'request' (new style) object. In the latter case you have to provide item access
        function and attribute producer (= function which returns an iterable providing names
        of at least all the relevant attributes). For the latter case, method _texttype_query()
        is preferred over this one.

        arguments:
        obj -- object holding argument names and values
        access -- a function specifying how to extract the value if you know the name and object
        attr_producer -- a function returning an iterable containing parameter names

        returns:
        a list of tuples (struct, condition)
        """
        if obj is None:
            obj = self
        if access is None:
            access = lambda o, att: getattr(o, att)
        if attr_producer is None:
            attr_producer = lambda o: dir(o)

        scas = [(a[4:], access(obj, a))
                for a in attr_producer(obj) if a.startswith('sca_')]
        structs = {}
        for sa, v in scas:
            if type(v) in (str, unicode) and '|' in v:
                v = v.split('|')
            s, a = sa.split('.')
            if type(v) is list:
                expr_items = []
                for v1 in v:
                    if v1 != '':
                        if v1 == self.empty_attr_value_placeholder:
                            v1 = ''
                        expr_items.append('%s="%s"' % (a, l10n.escape(v1)))
                if len(expr_items) > 0:
                    query = '(%s)' % ' | '.join(expr_items)
                else:
                    query = None
            else:
                query = '%s="%s"' % (a, l10n.escape(v))

            if query is not None:  # TODO: is the following encoding change always OK?
                query = export_string(query, to_encoding=self._corp().get_conf('ENCODING'))
                if s in structs:
                    structs[s].append(query)
                else:
                    structs[s] = [query]
        return [(sname, ' & '.join(subquery)) for
                sname, subquery in structs.items()]

    def _texttype_query(self, request):
        """
        Extracts all the text-type related parameters user can access when creating
        a subcorpus or selecing ad-hoc metadata in the query form.

        This method is compatible with new-style action functions only.
        """
        return self._texttype_query_OLD(obj=request, access=lambda o, x: apply(o.form.getlist, (x,)),
                                        attr_producer=lambda o: o.form.keys())

    @staticmethod
    def _add_text_type_hints(tt):
        if settings.contains('external_links', 'corpora_related'):
            hints = dict([(x[1]['key'], x[0]) for x in settings.get_full('external_links', 'corpora_related')])
            for line in tt:
                for item in line.get('Line', ()):
                    if 'label' in item and item['label'] in hints:
                        item['label_hint'] = hints[item['label']]

    def _store_checked_text_types(self, src_obj, out):
        """
        arguments:
        src_obj -- an object storing keys and values (or list of values);
                   e.g. controller or request.form (i.e. a MultiDict)
        out -- an output dictionary the method will be writing to
        """
        out['checked_sca'] = {}
        if isinstance(src_obj, Controller):
            src_obj = src_obj.__dict__
            get_list = lambda o, k: o[k] if type(o[k]) is list else [o[k]]
        else:
            get_list = lambda o, k: o.getlist(k)

        for p in src_obj.keys():
            if p.startswith('sca_'):
                out['checked_sca'][p[4:]] = get_list(src_obj, p)