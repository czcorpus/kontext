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
import json
import time
from functools import partial
import logging
import inspect
import urllib
import os.path
import copy
import re

import werkzeug.urls
from werkzeug.datastructures import MultiDict

import corplib
import conclib
from controller import Controller, UserActionException, convert_types, exposed
import plugins
import settings
import l10n
from l10n import format_number, corpus_get_conf, export_string
from translation import ugettext as _
import scheduled
from structures import Nicedict
from templating import StateGlobals
import fallback_corpus
from argmapping import ConcArgsMapping, Parameter, AttrMappingProxy, AttrMappingInfoProxy, GlobalArgs
from main_menu import MainMenu, MainMenuItem
from plugins.abstract.auth import AbstractInternalAuth


def join_params(*args):
    """
    This is a convenience function used by HTML templates.
    It allows joining URL parameters in various formats
    (strings, lists of (key,value) pairs, dicts).

    returns:
    a string of the form param1=value1&param2=value2&....
    """
    tmp = []
    quote = lambda s: werkzeug.urls.url_quote(s, unsafe='+')
    for a in args:
        if a is None:
            continue
        if isinstance(a, StateGlobals):
            a = [(k, quote(v)) for k, v in a.items()]
        if type(a) in (tuple, list, dict):
            if type(a) is dict:
                a = a.items()
            tmp.extend(['%s=%s' % (k, quote(v) if v is not None else '')
                        for k, v in a])
        elif type(a) in (str, unicode):
            tmp.append(a)
        else:
            raise TypeError(
                'Invalid element type: %s. Must be one of {str, unicode, list, tuple, dict}.' % (
                    type(a)))
    return '&'.join(tmp)


def update_params(params, key, value):
    return [(k, v) for k, v in params if k != key] + [(key, value)]


class ConcError(Exception):
    def __init__(self, msg):
        super(ConcError, self).__init__(msg)


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
            tmp = self._args.getlist(k)
        return tmp if len(tmp) > 1 else tmp[0]


class Kontext(Controller):
    """
    A controller.Controller extension implementing
    KonText-specific requirements.
    """
    # main menu items disabled for public users (this is applied automatically during
    # _post_dispatch())
    ANON_FORBIDDEN_MENU_ITEMS = (MainMenu.NEW_QUERY('history', 'wordlist'),
                                 MainMenu.CORPORA('my-subcorpora', 'new-subcorpus'),
                                 MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER,
                                 MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.VIEW)

    CONCORDANCE_ACTIONS = (MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER, MainMenu.FREQUENCY,
                           MainMenu.COLLOCATIONS, MainMenu.VIEW('kwic-sentence'),
                           MainMenu.CORPORA('new-subcorpus'))

    # A list of parameters needed to make concordance result parameters (e.g. size, currently
    # viewed page,..) persistent. It is used to keep showing these values to a user even if he is
    # outside the concordance view page.
    CONC_RESULT_ATTRS = ('sampled_size', 'fullsize', 'concsize', 'numofpages', 'fromp',
                         'result_relative_freq', 'result_relative_freq_rel_to', 'result_arf',
                         'result_shuffled', 'Sort_idx', 'nextlink', 'lastlink', 'prevlink',
                         'firstlink')

    GENERAL_OPTIONS = ('pagesize', 'kwicleftctx', 'kwicrightctx', 'multiple_copy', 'ctxunit',
                       'refs_up', 'shuffle', 'citemsperpage', 'fmaxitems', 'wlpagesize')

    LOCAL_COLL_OPTIONS = ('cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr', 'collpage', 'cbgrfns',
                          'csortfn')

    # Default corpus must be accessible to any user, otherwise KonText messes up trying
    # to infer some default corpus name and redirect user there. Hopefully, future releases
    # will avoid this.
    DEFAULT_CORPUS = 'susanne'

    # a user settings key entry used to access user's scheduled actions
    SCHEDULED_ACTIONS_KEY = '_scheduled'

    _conc_dir = u''
    _files_path = u'../files'

    def __init__(self, request, ui_lang):
        super(Kontext, self).__init__(request=request, ui_lang=ui_lang)
        self._curr_corpus = None  # Note: always use _corp() method to access current corpus even from inside the class
        self._empty_attr_value_placeholder = settings.get('corpora', 'empty_attr_value_placeholder')
        self.return_url = None
        self.cm = None  # a CorpusManager instance (created in _pre_dispatch() phase)
        self.disabled_menu_items = []
        self.save_menu = []
        self.contains_within = False
        self.subcpath = []

        # conc_persistence plugin related attributes
        self._q_code = None  # a key to 'code->query' database
        self._prev_q_data = None  # data of the previous operation are stored here

    def has_args_mapping(self, clazz):
        return clazz in self._args_mappings

    def get_args_mapping(self, clazz):
        """
        If currently processed action function/method registers 'clazz' argument
        mapper then this function returns an instance of that mapper along with initialized
        values (as obtained from request). In case the current action has not the clazz
        registered, None is returned.

        This method (and objects it returns) serves as a replacement for legacy
        action method's approach where all the arguments were mapped to self.

        returns:
        an implementation of argsmapping.GeneralAttrMapping or freshly initialized
        object with empty values if clazz is not registered
        """
        if clazz in self._args_mappings:
            return self._args_mappings[clazz]
        else:
            return AttrMappingInfoProxy(clazz())

    def get_args_mapping_keys(self, clazz):
        """
        Returns a list of parameter names defined by 'clazz' argument mapping.
        Please note that it is independent on whether the current action registers
        'clazz' or not (i.e. a list of keys is returned for any existing argument mapping
        during any action dispatching).
        """
        ans = self.get_args_mapping(clazz)
        if ans is not None:
            return ans.get_names()
        else:
            return AttrMappingInfoProxy(clazz()).get_names()

    def _export_mapped_args(self):
        """
        This method exports currently registered argument mappings (see get_args_mapping())
        into a dictionary. Please note that internal dictionary is always MultiDict. A list vs.
        scalar decision is done based on Parameter definition (type [] produces lists here,
        other types (str, int) produces scalars).

        The automatic mapping is exported in _pre_dispatch (i.e. before an action method is invoked).
        """
        ans = {}
        for v in self._args_mappings.values():
            ans.update(v.to_dict(none_replac=''))
        return ans

    def _store_mapped_args(self):
        tmp = MultiDict(self._session.get('semi_persistent_attrs', {}))
        for am in self._args_mappings.values():
            args = am.get_names(persistence=Parameter.SEMI_PERSISTENT)
            for arg in args:
                v = getattr(am, arg)
                if type(v) in (list, tuple):
                    tmp.setlist(arg, v)
                else:
                    tmp[arg] = v
        self._session['semi_persistent_attrs'] = tmp.items(multi=True)

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
            params.update(dict(self._request.args.items()))

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
            elif val == 'pid':
                log_data['pid'] = os.getpid()

        logging.getLogger('QUERY').info(json.dumps(log_data))

    @staticmethod
    def _init_default_settings(options):
        if 'shuffle' not in options:
            options['shuffle'] = 1

    def _setup_user_paths(self, user_file_id):
        if not self.user_is_anonymous():
            self.subcpath.append('%s/%s' % (settings.get('corpora', 'users_subcpath'), user_file_id))
        self._conc_dir = '%s/%s' % (settings.get('corpora', 'conc_dir'), user_file_id)

    def _user_has_persistent_settings(self):
        excluded_users = [int(x) for x in settings.get('plugins', 'settings_storage').get(
            'excluded_users', ())]
        return self._session_get('user', 'id') not in excluded_users and not self.user_is_anonymous()

    def _load_user_settings(self):
        """
        Loads user settings via settings_storage plugin. The settings are divided
        into two groups:
        1. corpus independent (e.g. listing page sizes)
        2. corpus dependent (e.g. selected attributes to be presented on concordance page)

        returns:
        2-tuple of dicts ([general settings], [corpus dependent settings])
        """
        options = {}
        corp_options = {}
        if self._user_has_persistent_settings():
            data = plugins.get('settings_storage').load(self._session_get('user', 'id'))
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
        convert_types(options, self.clone_args(), selector=1)
        if callable(actions):
            actions(options)
        self._setup_user_paths(self._session_get('user', 'user'))
        self.args.__dict__.update(options)

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
            convert_types(options, self.clone_args(), selector=1)
            self.args.__dict__.update(ans)

    @staticmethod
    def _get_save_excluded_attributes():
        return 'corpname', Kontext.SCHEDULED_ACTIONS_KEY

    def _save_options(self, optlist=None, selector=''):
        """
        Saves user's options to a storage
        """
        if optlist is None:
            optlist = []
        if selector:
            tosave = [(selector + ':' + opt, self.args.__dict__[opt])
                      for opt in optlist if opt in self.args.__dict__]
        else:
            tosave = [(opt, self.args.__dict__[opt]) for opt in optlist
                      if opt in self.args.__dict__]

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
        settings_storage = plugins.get('settings_storage')
        if self._user_has_persistent_settings():
            options = normalize_opts(settings_storage.load(self._session_get('user', 'id')))
            settings_storage.save(self._session_get('user', 'id'), options)
        else:
            options = normalize_opts(self._session_get('settings'))
            self._session['settings'] = options

    def _restore_prev_conc_params(self):
        """
        Restores previously stored concordance query data using an ID found in self.args.q.
        To even begin the search, two conditions must be met:
        1. conc_persistence plugin is installed
        2. self.args.q contains a string recognized as a valid ID of a stored concordance query
           at the position 0 (other positions may contain additional regular query operations
           (shuffle, filter,...)

        In case the conc_persistence is installed and invalid ID is encountered
        UserActionException will be raised.
        """
        url_q = self.args.q[:]
        conc_persistence = plugins.get('conc_persistence')
        if plugins.has_plugin('conc_persistence') and self.args.q and conc_persistence.is_valid_id(url_q[0]):
            self._q_code = url_q[0][1:]
            self._prev_q_data = conc_persistence.open(self._q_code)
            # !!! must create a copy here otherwise _q_data (as prev query)
            # will be rewritten by self.args.q !!!
            if self._prev_q_data is not None:
                self.args.q = self._prev_q_data['q'][:] + url_q[1:]
            else:
                # !!! we have to reset the invalid query, otherwise _store_conc_params
                # generates a new key pointing to it
                self.args.q = []
                raise UserActionException(_('Invalid or expired query'))

    def _store_conc_params(self):
        """
        Stores concordance operation if the conc_persistence plugin is installed
        (otherwise nothing is done).

        returns:
        string ID of the stored operation or None if nothing was done (from whatever reason)
        """
        if plugins.has_plugin('conc_persistence') and self.args.q:
            query = {
                'q': self.args.q,
                'corpname': self.args.corpname,
                'usesubcorp': self.args.usesubcorp,
                'align': self.args.align
            }
            q_id = plugins.get('conc_persistence').store(self._session_get('user', 'id'),
                                                         curr_data=query,
                                                         prev_data=self._prev_q_data)
        else:
            q_id = None
        return q_id

    def _redirect_to_conc(self):
        """
        Redirects to the current concordance
        """
        args = self._get_attrs(self.get_args_mapping_keys(ConcArgsMapping))
        if self._q_code:
            args.append(('q', '~%s' % self._q_code))
        else:
            args += [('q', q) for q in self.args.q]
        href = werkzeug.urls.Href(self.get_root_url() + 'view')
        self._redirect(href(MultiDict(args)))

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
            tpl_data['q'] = self.urlencode([('q', q) for q in self.args.q])
            tpl_data['Q'] = [{'q': q} for q in self.args.q]

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
        Maps URL and form arguments to self.args.__dict__. This is intended for
        legacy action methods.
        """
        def choose_selector(args, selector):
            selector += ':'
            s = len(selector)
            args.update(dict([(n[s:], v) for n, v in args.items() if n.startswith(selector)]))

        param_types = dict(inspect.getmembers(GlobalArgs,
                                              predicate=lambda x: isinstance(x, Parameter)))

        if 'json' in form:
            json_data = json.loads(form.getvalue('json'))
            named_args.update(json_data)
        for k in form.keys():
            # must remove empty values, this should be achieved by
            # keep_blank_values=0, but it does not work for POST requests
            if len(form.getvalue(k)) > 0:
                key = str(k)
                val = form.getvalue(k)
                if key in param_types:
                    if not param_types[key].is_array() and type(val) is list:
                        # If a parameter (see static Parameter instances) is defined as a scalar
                        # but the web framework returns a list (e.g. an HTML form contains a key
                        # with multiple occurrences) then a possible conflict emerges. Although
                        # this should not happen, original Bonito2 code contains such
                        # inconsistencies. In such cases we use only last value as we expect that
                        # the last value overwrites previous ones with the same key.
                        val = val[-1]
                    elif param_types[key].is_array() and not type(val) is list:
                        # A Parameter object is expected to be a list but
                        # web framework returns a scalar value
                        val = [val]
                named_args[key] = val
        na = named_args.copy()

        convert_types(na, self.clone_args())
        if selectorname:
            choose_selector(self.args.__dict__, getattr(self.args, selectorname))
        self.args.__dict__.update(na)

    def _check_corpus_access(self, path, form, action_metadata):
        allowed_corpora = plugins.get('auth').permitted_corpora(self._session_get('user', 'id'))
        if not action_metadata.get('skip_corpus_init', False):
            self.args.corpname, fallback_url = self._determine_curr_corpus(form, allowed_corpora)
            if not action_metadata.get('legacy', False):
                mapping = self.get_args_mapping(ConcArgsMapping)
                if mapping is not None and hasattr(mapping, 'corpname') and not mapping.corpname:
                    path = [Controller.NO_OPERATION]
                    self._redirect(self._updated_current_url({'corpname': self.args.corpname}))
            if fallback_url:
                path = [Controller.NO_OPERATION]
                if action_metadata.get('return_type', None) != 'json':
                    self._redirect(fallback_url)
                else:
                    path = ['json_error']  # just passing a fallback method for JSON response
        elif len(allowed_corpora) > 0:
            self.args.corpname = ''
        else:
            self.args.corpname = ''
        return path

    def _init_semi_persistent_args(self):
        sp_data = MultiDict(self._session_get('semi_persistent_attrs'))
        if 'corpname' in self._request.args and 'sel_aligned' in sp_data:
            curr_corpora = (sp_data.getlist('sel_aligned') + [sp_data.get('corpname', None)])
            if self._request.args['corpname'] not in curr_corpora:
                sp_data.pop('sel_aligned')
            self._session['semi_persistent_attrs'] = sp_data.items(multi=True)

    # TODO: decompose this method (phase 2)
    def _pre_dispatch(self, path, selectorname, named_args, action_metadata=None):
        """
        Runs before main action is processed. The action includes
        mapping of URL/form parameters to self.args.
        """
        super(Kontext, self)._pre_dispatch(path, selectorname, named_args, action_metadata)

        def validate_corpus():
            c = self._corp()
            if isinstance(c, fallback_corpus.ErrorCorpus):
                return c.get_error()
            return None
        self.add_validator(validate_corpus)

        self._init_semi_persistent_args()

        if not action_metadata:
            action_metadata = {}
        is_legacy_method = action_metadata.get('legacy', False)

        form = LegacyForm(self._request.form, self._request.args)
        if not is_legacy_method:
            for arg_mapping in action_metadata.get('argmappings', []):
                self._args_mappings[arg_mapping] = AttrMappingProxy(arg_mapping(),
                    self._request.args, MultiDict(self._session.get('semi_persistent_attrs')))
                    # TODO what about forms?

        options, corp_options = self._load_user_settings()
        self._scheduled_actions(options)
        # only general setting can be applied now because
        # we do not know final corpus name yet
        self._apply_general_user_settings(options, self._init_default_settings)

        # corpus access check and modify path in case user cannot access currently requested corp.
        path = self._check_corpus_access(path, form, action_metadata)

        # now we can apply also corpus-dependent settings
        # because the corpus name is already known
        self._apply_corpus_user_settings(corp_options, self.args.corpname)

        # TODO Fix the class so "if is_legacy_method:" here is possible to apply here
        if is_legacy_method:
            self._map_args_to_attrs(form, selectorname, named_args)

        self.cm = corplib.CorpusManager(self.subcpath)

        # return url (for 3rd party pages etc.)
        args = {}
        if self.args.corpname:
            args['corpname'] = self.args.corpname
        if self.get_http_method() == 'GET':
            self.return_url = self._updated_current_url(args)
        else:
            self.return_url = '%sfirst_form?%s' % (self.get_root_url(),
                                                   '&'.join(['%s=%s' % (k, v)
                                                             for k, v in args.items()]))
        self._restore_prev_conc_params()
        if len(path) > 0:
            access_level = action_metadata.get('access_level', 0)  # by default, each action is public
            if access_level and self.user_is_anonymous():
                from plugins.abstract import auth
                raise auth.AuthException(_('Access forbidden'))
        # plugins setup
        for p in plugins.get_plugins().values():
            if callable(getattr(p, 'setup', None)):
                p.setup(self)
        return path, selectorname, named_args

    def _post_dispatch(self, methodname, action_metadata, tmpl, result):
        """
        Runs after main action is processed but before any rendering (incl. HTTP headers)
        """
        if self.user_is_anonymous():
            disabled_set = set(self.disabled_menu_items)
            self.disabled_menu_items = tuple(disabled_set.union(set(Kontext.ANON_FORBIDDEN_MENU_ITEMS)))
        super(Kontext, self)._post_dispatch(methodname, action_metadata, tmpl, result)
        self._log_request(self._get_items_by_persistence(Parameter.PERSISTENT), '%s' % methodname,
                          proc_time=self._proc_time)

    def _attach_tag_builder(self, tpl_out):
        """
        arguments:
        tpl_out -- dict data to be used when building an output page from a template
        """
        tag_support = lambda c: (plugins.has_plugin('taghelper')
                                 and plugins.get('taghelper').tag_variants_file_exists(c))
        tpl_out['tag_builder_support'] = {
            '': tag_support(self.args.corpname)
        }
        tpl_out['user_menu'] = True
        if 'Aligned' in tpl_out:
            for item in tpl_out['Aligned']:
                tpl_out['tag_builder_support']['_%s' % item['n']] = tag_support(item['n'])

    def _attach_query_metadata(self, tpl_out):
        """
        Adds information needed by extended version of text type (and other attributes) selection in a query
        """
        tpl_out['metadata_desc'] = plugins.get('corparch').get_corpus_info(
            self.args.corpname, language=self.ui_lang)['metadata']['desc']

    def _add_save_menu_item(self, label, action, params, save_format=None):
        params = copy.copy(params)
        if save_format:
            params['saveformat'] = save_format
        self.save_menu.append({'label': label, 'action': action, 'params': params})

    def _reset_session_conc(self):
        """
        Resets information about current concordance user works with
        """
        if 'conc' in self._session:
            del(self._session['conc'])

    def _export_subcorpora_list(self, corpname, out):
        """
        Updates passed dictionary by information about available sub-corpora.
        Listed values depend on current user and corpus.
        If there is a list already present in 'out' then it is extended
        by the new values.

        arguments:
        corpname -- corpus id
        out -- a dictionary used by templating system
        """
        basecorpname = corpname.split(':')[0]
        subcorp_list = l10n.sort(self.cm.subcorp_names(basecorpname), loc=self.ui_lang, key=lambda x: x['n'])
        if len(subcorp_list) > 0:
            subcorp_list = [{'n': '--%s--' % _('whole corpus'), 'v': ''}] + subcorp_list
        if 'SubcorpList' not in out or out['SubcorpList'] is None:
            out['SubcorpList'] = []
        out['SubcorpList'].extend(subcorp_list)

    def _save_query(self, query, query_type):
        if plugins.has_plugin('query_storage'):
            params = {}
            if query_type == 'lemma':
                params['lpos'] = self.args.lpos
            elif query_type == 'word':
                params['wpos'] = self.args.wpos
                params['qmcase'] = self.args.qmcase
            elif query_type == 'cql':
                params['default_attr'] = self.args.default_attr
            plugins.get('query_storage').write(
                user_id=self._session_get('user', 'id'), corpname=self.args.corpname,
                subcorpname=self.args.usesubcorp, query=query, query_type=query_type,
                params=params)

    def _determine_curr_corpus(self, form, corp_list):
        """
        This method tries to determine which corpus is currently in use.
        If no answer is found or in case there is a conflict between selected
        corpus and user access rights then some fallback alternative is found -
        in such case the returned 'fallback' value is set to a URL leading to the
        fallback corpus.

        Parameters:
        form -- currently processed HTML form (if any)
        corp_list -- a dict (canonical_id => full_id) representing all the corpora user can access

        Return:
        2-tuple containing a corpus name and a fallback URL where application
        may be redirected (if not None)
        """
        cn = ''
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
        if not cn and self.has_args_mapping(ConcArgsMapping):
            cn = self.get_args_mapping(ConcArgsMapping).corpname
        if not cn:
            cn = settings.get_default_corpus(corp_list)

        # in this phase we should have some non-empty corpus selected
        # but we do not know whether user has access to it

        # automatic restricted/unrestricted corpus name selection
        # according to user rights
        canonical_name = self._canonical_corpname(cn)
        if canonical_name in corp_list:  # user has "some" access to the corpus
            if corp_list[canonical_name] != cn:  # user has access to a variant of the corpus
                cn = canonical_name
                fallback = self._updated_current_url({'corpname': corp_list[canonical_name]})
            else:
                cn = corp_list[canonical_name]
                fallback = None
        else:
            cn = ''
            fallback = '%scorpora/corplist' % self.get_root_url()  # TODO hardcoded '/corpora/'
        return cn, fallback

    def self_encoding(self):
        enc = corpus_get_conf(self._corp(), 'ENCODING')
        return enc if enc else 'iso-8859-1'

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
        if self.args.corpname:
            try:
                if not self._curr_corpus or (self.args.usesubcorp and not hasattr(self._curr_corpus,
                                                                                  'subcname')):
                    self._curr_corpus = self.cm.get_Corpus(self.args.corpname,
                                                           self.args.usesubcorp)
                    # TODO opravit poradne!
                self._curr_corpus._conc_dir = self._conc_dir
                return self._curr_corpus
            except Exception as e:
                return fallback_corpus.ErrorCorpus(e)
        else:
            return fallback_corpus.EmptyCorpus()

    def permitted_corpora(self):
        """
        Returns corpora identifiers accessible by the current user.

        returns:
        a dict (canonical_id, id)
        """
        return plugins.get('auth').permitted_corpora(self._session_get('user', 'id'))

    def _load_fav_items(self):
        return plugins.get('user_items').get_user_items(self._session_get('user', 'id'))

    def _add_corpus_related_globals(self, result, maincorp):
        """
        arguments:
        result -- template data dict
        maincorp -- currently focused corpus; please note that in case of aligned
                    corpora this can be a different one than self._corp()
                    (or self.args.corpname) represents.
        """
        result['corpname'] = self.args.corpname
        result['align'] = self.args.align
        result['struct_ctx'] = corpus_get_conf(maincorp, 'STRUCTCTX')
        result['corp_doc'] = corpus_get_conf(maincorp, 'DOCUMENTATION')
        result['human_corpname'] = self._human_readable_corpname()

        result['corp_description'] = maincorp.get_info()
        result['corp_size'] = format_number(self._corp().size())
        corp_conf_info = plugins.get('corparch').get_corpus_info(self.args.corpname)
        if corp_conf_info is not None:
            result['corp_web'] = corp_conf_info.get('web', None)
        else:
            result['corp_web'] = ''
        if self.args.usesubcorp:
            result['subcorp_size'] = format_number(self._corp().search_size())
        else:
            result['subcorp_size'] = None
        attrlist = corpus_get_conf(maincorp, 'ATTRLIST').split(',')
        sref = corpus_get_conf(maincorp, 'SHORTREF')
        result['fcrit_shortref'] = '+'.join([a.strip('=') + ' 0'
                                             for a in sref.split(',')])

        poslist = self.cm.corpconf_pairs(maincorp, 'WPOSLIST')
        result['Wposlist'] = [{'n': x[0], 'v': x[1]} for x in poslist]
        poslist = self.cm.corpconf_pairs(maincorp, 'LPOSLIST')
        if 'lempos' not in attrlist:
            poslist = self.cm.corpconf_pairs(maincorp, 'WPOSLIST')
        result['Lposlist'] = [{'n': x[0], 'v': x[1]} for x in poslist]
        result['lpos_dict'] = dict([(y, x) for x, y in poslist])

        result['has_lemmaattr'] = 'lempos' in attrlist \
            or 'lemma' in attrlist
        result['default_attr'] = corpus_get_conf(maincorp, 'DEFAULTATTR')
        for listname in ['AttrList', 'StructAttrList']:
            if listname in result:
                continue
            result[listname] = \
                [{'label': corpus_get_conf(maincorp, n + '.LABEL') or n, 'n': n}
                 for n in corpus_get_conf(maincorp, listname.upper()).split(',')
                 if n]
        result['tagsetdoc'] = corpus_get_conf(maincorp, 'TAGSETDOC')
        result['ttcrit'] = self.urlencode([('fcrit', '%s 0' % a) for a in
                                           corpus_get_conf(maincorp, 'SUBCORPATTRS')
                                           .replace('|', ',').split(',') if a])
        result['corp_uses_tag'] = 'tag' in corpus_get_conf(maincorp, 'ATTRLIST').split(',')
        result['commonurl'] = self.urlencode([('corpname', self.args.corpname),
                                              ('lemma', self.args.lemma),
                                              ('lpos', self.args.lpos),
                                              ('usesubcorp', self.args.usesubcorp),
                                              ])
        result['citation_info'] = corp_conf_info.get('citation_info', '')

    def _setup_optional_plugins_js(self, result):
        """
        Updates result dict with JavaScript module paths required to
        run client-side parts of some optional plugins. Template document.tmpl
        (i.e. layout template) configures RequireJS module accordingly.
        """
        import plugins
        ans = {}
        for opt_plugin in plugins.get_plugins(include_missing=True).keys():
            ans[opt_plugin] = None
            if plugins.has_plugin(opt_plugin):
                plugin_obj = plugins.get(opt_plugin)
                # if the plug-in is "always on" or "sometimes off but currently on"
                # then it must configure JavaScript
                if (not isinstance(plugin_obj, plugins.abstract.CorpusDependentPlugin)
                        or plugin_obj.is_enabled_for(self.args.corpname)):
                    js_file = settings.get('plugins', opt_plugin, {}).get('js_module')
                    if js_file:
                        ans[opt_plugin] = js_file
        result['plugin_js'] = ans

    def _get_attrs(self, attr_names, force_values=None):
        """
        Returns required attributes (= passed attr_names) and their respective values found
        in 'self.args'. Only attributes initiated via class attributes and the Parameter class
        are considered valid.

        Note: this should not be used with new-style actions.
        """
        if force_values is None:
            force_values = {}

        def is_valid(name, value):
            return isinstance(getattr(GlobalArgs, name, None), Parameter) and value != ''

        def get_val(k):
            return force_values[k] if k in force_values else getattr(self.args, k, None)

        ans = []
        for attr in attr_names:
            v_tmp = get_val(attr)
            if not is_valid(attr, v_tmp):
                continue
            if not hasattr(v_tmp, '__iter__'):
                v_tmp = [v_tmp]
            for v in v_tmp:
                ans.append((attr, v))
        return ans

    def _get_error_reporting_url(self):
        ans = None
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
                ans = '%s?%s' % (settings.get('global', 'error_report_url'), '&'.join(err_rep_params))
        return ans

    def _apply_theme(self, data):
        theme_name = settings.get('theme', 'name')
        theme_css = settings.get('theme', 'css', None)
        if theme_css is None:
            theme_css = []
        elif not hasattr(theme_css, '__iter__'):
            theme_css = [theme_css]

        logo_img = settings.get('theme', 'logo')
        if settings.contains('theme', 'logo_mouseover'):
            logo_alt_img = settings.get('theme', 'logo_mouseover')
        else:
            logo_alt_img = logo_img

        if settings.contains('theme', 'logo_href'):
            logo_href = unicode(settings.get('theme', 'logo_href'))
        else:
            logo_href = self.get_root_url()

        if theme_name == 'default':
            logo_title = _('Click to enter a new query')
        else:
            logo_title = unicode(logo_href)

        fonts = settings.get('theme', 'fonts', None)
        if fonts is None:
            fonts = []
        elif not hasattr(fonts, '__iter__'):
            fonts = [fonts]

        data['theme'] = {
            'name': settings.get('theme', 'name'),
            'css': [os.path.normpath('../files/themes/%s/%s' % (theme_name, p))
                    for p in theme_css],
            'logo_path': os.path.normpath('../files/themes/%s/%s' % (theme_name, logo_img)),
            'logo_mouseover_path': os.path.normpath('../files/themes/%s/%s' % (theme_name,
                                                                               logo_alt_img)),
            'logo_href': logo_href,
            'logo_title': logo_title,
            'logo_inline_css': settings.get('theme', 'logo_inline_css', ''),
            'fonts': fonts
        }

    def _add_globals(self, result, methodname, action_metadata):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        Controller._add_globals(self, result, methodname, action_metadata)

        result['files_path'] = self._files_path
        result['css_prefix'] = self._css_prefix
        result['debug'] = settings.is_debug_mode()
        result['_version'] = (corplib.manatee_version(), settings.get('global', '__version__'))
        # TODO testing app state by looking at the message type may not be the best way
        result['display_closed_conc'] = len(self.args.q) > 0 and result.get('message', [None])[0] != 'error'

        # conc_persistence plugin related
        new_query_key = self._store_conc_params()
        self._update_output_with_conc_params(new_query_key, result)

        result['corpname_url'] = 'corpname=' + self.args.corpname if self.args.corpname else ''
        global_var_val = self._get_attrs(self.get_args_mapping_keys(ConcArgsMapping))
        result['globals'] = self.urlencode(global_var_val)
        result['Globals'] = StateGlobals(global_var_val)
        result['human_corpname'] = None

        result['empty_attr_value_placeholder'] = self._empty_attr_value_placeholder
        result['disabled_menu_items'] = self.disabled_menu_items
        result['save_menu'] = self.save_menu
        result['contains_within'] = self.contains_within

        if self.args.maincorp:
            thecorp = corplib.open_corpus(self.args.maincorp)
        else:
            thecorp = self._corp()
        if not action_metadata.get('skip_corpus_init', False):
            self._add_corpus_related_globals(result, thecorp)

        result['supports_password_change'] = self._uses_internal_user_pages()
        result['undo_q'] = self.urlencode([('q', q) for q in self.args.q[:-1]])
        result['session_cookie_name'] = settings.get('plugins', 'auth').get('auth_cookie_name', '')

        result['root_url'] = self.get_root_url()
        result['static_url'] = '%sfiles/' % self.get_root_url()
        result['user_info'] = self._session.get('user', {'fullname': None})
        result['_anonymous'] = self.user_is_anonymous()

        if plugins.has_plugin('auth'):
            result['login_url'] = plugins.get('auth').get_login_url(self.return_url)
            result['logout_url'] = plugins.get('auth').get_logout_url(self.get_root_url())
        else:
            result['login_url'] = 'login'
            result['logout_url'] = 'login'

        if plugins.has_plugin('application_bar'):
            application_bar = plugins.get('application_bar')
            result['app_bar'] = application_bar.get_contents(plugin_api=self._plugin_api,
                                                             return_url=self.return_url)
            result['app_bar_css'] = application_bar.css_url
        else:
            result['app_bar'] = None
            result['app_bar_css'] = None

        self._apply_theme(result)
        self._init_custom_menu_items(result)

        # updates result dict with javascript modules paths required by some of the optional plugins
        self._setup_optional_plugins_js(result)

        result['CorplistFn'] = self._load_fav_items
        user_items = plugins.get('user_items')

        # automatically result using registered mapped args
        if not action_metadata.get('legacy', False):
            result.update(self._export_mapped_args())
            self._store_mapped_args()
        result['bib_conf'] = plugins.get('corparch').get_corpus_info(self.args.corpname).metadata

        # avalilable languages
        if plugins.has_plugin('getlang'):
            result['avail_languages'] = ()
        else:
            result['avail_languages'] = settings.get_full('global', 'translations')

        result['history_max_query_size'] = settings.get_int('global', 'history_max_query_size')
        result['uiLang'] = self.ui_lang.replace('_', '-') if self.ui_lang else 'en-US'

        # util functions
        result['format_number'] = partial(format_number)
        result['join_params'] = join_params
        result['to_str'] = lambda s: unicode(s) if s is not None else u''
        result['camelize'] = l10n.camelize
        result['update_params'] = update_params
        result['jsonize_user_item'] = user_items.to_json
        result['create_action'] = lambda a, p=None: self.create_url(a, p if p is not None else {})

        result['error_report_url'] = self._get_error_reporting_url()

        result['qunit_test'] = self.args.qunit
        if self.args.qunit and settings.is_debug_mode():
            result['client_model_dir'] = 'tests'
            result['page_model'] = self.args.qunit
        else:
            result['client_model_dir'] = 'tpl'
            result['page_model'] = action_metadata.get('page_model', l10n.camelize(methodname))

        if settings.contains('global', 'ui_state_ttl'):
            result['ui_state_ttl'] = settings.get('global', 'ui_state_ttl')
        else:
            result['ui_state_ttl'] = 3600 * 12

        # we will store specific information (e.g. concordance parameters)
        # to keep user informed about data he is working with on any page
        cached_values = Nicedict(empty_val='')
        self._restore_conc_results(cached_values)
        result['cached'] = cached_values

        # we export plug-ins data KonText core does not care about (it is used
        # by a respective plug-in client-side code)
        result['plugin_data'] = {}
        for plg_name, plg in plugins.get_plugins().items():
            if hasattr(plg, 'export'):
                result['plugin_data'][plg_name] = plg.export(self._plugin_api,
                                                             self._session_get('user', 'id'),
                                                             self.ui_lang)
        return result

    def _restore_conc_results(self, storage):
        """
        Restores current concordance's parameters from session and stores
        them into a passed dict.

        arguments:
        storage: a dict or a dict-like object
        """
        conc_key = '#'.join(self.args.q)
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
        conc_data = self._session.get('conc', {})

        curr_time = int(time.time())
        conc_info_ttl = settings.get_int('global', 'conc_persistence_time')
        record_timestamp = lambda rec_key: conc_data[rec_key]['__timestamp__']
        record_is_old = lambda rec_key: curr_time - record_timestamp(k) > conc_info_ttl
        # let's clean-up too old records to keep session data reasonably big
        for k in conc_data.keys():
            if '__timestamp__' in conc_data or record_is_old(k):
                conc_data.pop(k)
        data = dict([(k, src.get(k)) for k in Kontext.CONC_RESULT_ATTRS])
        data['__timestamp__'] = int(curr_time)
        conc_data['#'.join(self.args.q)] = data

        self._session['conc'] = conc_data  # Werkzeug sets should_save thanks to this

    def _add_undefined(self, result, methodname, vars):
        result['methodname'] = methodname
        if len(vars) == 0:
            return

        if 'TextTypeSel' in vars:
            result['TextTypeSel'] = self._texttypes_with_norms(ret_nums=False)
        if 'LastSubcorp' in vars:
            if self.cm:
                result['LastSubcorp'] = self.cm.subcorp_names(self.args.corpname)
            else:
                # this should apply only in case of an error
                result['LastSubcorp'] = ''
            result['lastSubcorpSize'] = min(len(result['LastSubcorp']) + 1, 20)

        if 'orig_query' in vars:
            conc_desc = conclib.get_conc_desc(corpus=self._corp(),
                                              q=self.args.q,
                                              subchash=getattr(self._corp(), "subchash", None))
            if len(conc_desc) > 1:
                result['tourl'] = self.urlencode(conc_desc[0][3])

    @staticmethod
    def _canonical_corpname(c):
        """
        Returns a corpus identifier without any additional prefixes used
        to support multiple configurations per single corpus.
        (e.g. 'public/bnc' will transform into just 'bnc')
        """
        return plugins.get('auth').canonical_corpname(c)

    def _human_readable_corpname(self):
        """
        Returns an user-readable name of the current corpus (i.e. it cannot be used
        to identify the corpus in KonText's code as it is only intended to be printed
        somewhere on a page).
        """
        if self._corp().get_conf('NAME'):
            return corpus_get_conf(self._corp(), 'NAME')
        elif self.args.corpname:
            return self._canonical_corpname(self.args.corpname)
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
        speech_struct = plugins.get('corparch').get_corpus_info(self.args.corpname).get(
            'speech_segment')
        return speech_struct in corpus_get_conf(self._corp(), 'STRUCTATTRLIST').split(',')

    @staticmethod
    def _validate_range(actual_range, max_range):
        """
        arguments:
        actual_range -- 2-tuple
        max_range -- 2-tuple (if second value is None, that validation of the value is omitted

        returns:
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
        return ','.join(x for x in (self.args.structs, ','.join(self.args.structattrs)) if x)

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
            subcorpattrs = corp.get_conf('SUBCORPATTRS')
            if not subcorpattrs:
                subcorpattrs = corp.get_conf('FULLREF')

        if not subcorpattrs or subcorpattrs == '#':
            raise UserActionException(
                _('Missing display configuration of structural attributes (SUBCORPATTRS or FULLREF).'))

        maxlistsize = settings.get_int('global', 'max_attr_list_size')
        # if live_attributes are installed then always shrink bibliographical
        # entries even if their count is < maxlistsize
        if plugins.has_plugin('live_attributes'):
            ans['bib_attr'] = plugins.get('corparch').get_corpus_info(
                self.args.corpname)['metadata']['label_attr']
            list_none = (ans['bib_attr'], )
            tmp = re.split(r'\s*[,|]\s*', subcorpattrs)

            if ans['bib_attr'] and ans['bib_attr'] not in tmp:  # if bib type is not in subcorpattrs
                tmp.append(ans['bib_attr'])                     # we add it there
                subcorpattrs = '|'.join(tmp)  # we ignore NoSkE '|' vs. ',' stuff deliberately here
        else:
            ans['bib_attr'] = None
            list_none = ()
        tt = corplib.texttype_values(corp, subcorpattrs, maxlistsize, list_none)
        self._add_tt_custom_metadata(tt)

        if ret_nums:
            basestructname = subcorpattrs.split('.')[0]
            struct = corp.get_struct(basestructname)
            normvals = {}
            if self.args.subcnorm not in ('freq', 'tokens'):
                try:
                    nas = struct.get_attr(self.args.subcnorm).pos2str
                except conclib.manatee.AttrNotFound, e:
                    self.add_system_message('error', str(e))
                    self.args.subcnorm = 'freq'
            if self.args.subcnorm == 'freq':
                normvals = dict([(struct.beg(i), 1)
                                 for i in range(struct.size())])
            elif self.args.subcnorm == 'tokens':
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
            obj = self.args
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
                        if v1 == self._empty_attr_value_placeholder:
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

    def _add_tt_custom_metadata(self, tt):
        metadata = plugins.get('corparch').get_corpus_info(
                               self.args.corpname, language=self.ui_lang)['metadata']
        for line in tt:
            for item in line.get('Line', ()):
                item['is_interval'] = int(item['label'] in metadata.get('interval_attrs', []))

    @staticmethod
    def _store_checked_text_types(src_obj, out):
        """
        arguments:
        src_obj -- an object storing keys and values (or list of values);
                   e.g. controller or request.form (i.e. a MultiDict)
        out -- an output dictionary the method will be writing to
        """
        out['checked_sca'] = {}
        if isinstance(src_obj, Controller):
            src_obj = src_obj.args.__dict__
            get_list = lambda o, k: o[k] if type(o[k]) is list else [o[k]]
        else:
            get_list = lambda o, k: o.getlist(k)

        for p in src_obj.keys():
            if p.startswith('sca_'):
                out['checked_sca'][p[4:]] = get_list(src_obj, p)

    def _init_custom_menu_items(self, out):
        out['custom_menu_items'] = {}
        menu_items = inspect.getmembers(MainMenu, predicate=lambda p: isinstance(p, MainMenuItem))
        for item in [x[1] for x in menu_items]:
            out['custom_menu_items'][item.name] = plugins.get('menu_items').get_items(
                item.name, self.ui_lang)

    def _uses_internal_user_pages(self):
        return isinstance(plugins.get('auth'), AbstractInternalAuth)
