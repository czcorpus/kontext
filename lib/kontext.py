# Copyright (c) 2003-2013  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
# Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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
from functools import partial
import logging
import inspect
import urllib
import os.path
import copy
import time
from types import DictType

import werkzeug.urls
from werkzeug.datastructures import MultiDict

import corplib
import conclib
from controller import Controller, UserActionException, convert_types, exposed
import plugins
import settings
import l10n
from l10n import format_number, corpus_get_conf
from translation import ugettext as _, get_avail_languages
import scheduled
import templating
import fallback_corpus
from argmapping import ConcArgsMapping, Parameter, GlobalArgs
from main_menu import MainMenu, MenuGenerator, ConcMenuItem
from plugins.abstract.auth import AbstractInternalAuth
from texttypes import TextTypeCollector, get_tt


class LinesGroups(object):
    """
    Handles concordance lines groups manually defined by a user.
    It is expected that the controller has always an instance of
    this class available (i.e. no None value).
    """
    def __init__(self, data):
        if type(data) is not list:
            raise ValueError('LinesGroups data argument must be a list')
        self.data = data
        self.sorted = False

    def __len__(self):
        return len(self.data) if self.data else 0

    def __iter__(self):
        return iter(self.data) if self.data else iter([])

    def serialize(self):
        return {'data': self.data, 'sorted': self.sorted}

    def as_list(self):
        return self.data if self.data else []

    def is_defined(self):
        return len(self.data) > 0

    @staticmethod
    def deserialize(data):
        if type(data) is list:
            data = dict(data=data)
        ans = LinesGroups(data.get('data', []))
        ans.sorted = data.get('sorted', False)
        return ans


class RequestArgsProxy(object):
    """
    A wrapper class allowing an access to both
    Werkzeug's request.form and request.args (MultiDict objects).
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

    def getlist(self, k):
        """
        Returns a list of values matching passed argument
        name. List is returned even if there is a single
        value avalilable.

        URL arguments have higher priority over POST ones.
        """
        tmp = self._form.getlist(k)
        if len(tmp) == 0 and k in self._args:
            tmp = self._args.getlist(k)
        return tmp

    def getvalue(self, k):
        """
        Returns either a single value or a list of values
        depending on HTTP request arguments.

        URL arguments have higher priority over POST ones.
        """
        tmp = self.getlist(k)
        return tmp if len(tmp) > 1 else tmp[0]


class AsyncTaskStatus(object):
    """
    Keeps information about background tasks which are visible to a user
    (i.e. user is informed that some calculation/task takes a long time
    and that it is going to run in background and that the user will
    be notified once it is done).

    Please note that concordance calculation uses a different mechanism
    as it requires continuous update of its status.

    Status string is taken from Celery and should always equal
    one of the following: PENDING, STARTED, RETRY, FAILURE, SUCCESS

    Attributes:
        ident (str): task identifier (unique per specific task instance)
        label (str): user-readable task label
        status (str): one of
    """

    CATEGORY_SUBCORPUS = 'subcorpus'

    def __init__(self, ident, label, status, category, args, created=None, error=None):
        self.ident = ident
        self.label = label
        self.status = status
        self.category = category
        self.created = created if created else time.time()
        self.args = args
        self.error = error

    def is_finished(self):
        return self.status in ('FAILURE', 'SUCCESS')

    @staticmethod
    def from_dict(data):
        """
        Creates an instance from the 'dict' type. This is used
        to unserialize instances from session.
        """
        return AsyncTaskStatus(status=data['status'], ident=data['ident'], label=data['label'],
                               category=data['category'], created=data.get('created'), args=data.get('args', {}),
                               error=data.get('error'))

    def to_dict(self):
        """
        Transforms an instance to the 'dict' type. This is used
        to serialize instances to session.
        """
        return self.__dict__


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

    GENERAL_OPTIONS = ('pagesize', 'kwicleftctx', 'kwicrightctx', 'multiple_copy', 'ctxunit',
                       'shuffle', 'citemsperpage', 'fmaxitems', 'wlpagesize', 'line_numbers')

    LOCAL_COLL_OPTIONS = ('cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr', 'collpage', 'cbgrfns',
                          'csortfn')

    BASE_ATTR = 'word'

    # Default corpus must be accessible to any user, otherwise KonText messes up trying
    # to infer some default corpus name and redirect user there. Hopefully, future releases
    # will avoid this.
    DEFAULT_CORPUS = 'susanne'

    # a user settings key entry used to access user's scheduled actions
    SCHEDULED_ACTIONS_KEY = '_scheduled'

    PARAM_TYPES = dict(inspect.getmembers(GlobalArgs, predicate=lambda x: isinstance(x, Parameter)))

    _conc_dir = u''
    _files_path = settings.get('global', 'static_files_prefix', u'../files')

    def __init__(self, request, ui_lang):
        super(Kontext, self).__init__(request=request, ui_lang=ui_lang)
        self._curr_corpus = None  # Note: always use _corp() method to access current corpus even from inside the class
        self.return_url = None
        self.cm = None  # a CorpusManager instance (created in _pre_dispatch() phase)
        self.disabled_menu_items = []
        self.save_menu = []
        self.subcpath = []
        self._lines_groups = LinesGroups(data=[])
        self._plugin_api = PluginApi(self, self._cookies, self._request.session)

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
        import datetime

        logged_values = settings.get('logging', 'values', ())
        log_data = {}

        params = {}
        if self.environ.get('QUERY_STRING'):
            params.update(dict(self._request.args.items()))

        for val in logged_values:
            if val == 'date':
                log_data['date'] = datetime.datetime.today().strftime('%s.%%f' % settings.DEFAULT_DATETIME_FORMAT)
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
        conf = settings.get('plugins', 'settings_storage')
        excluded_users = conf.get('excluded_users', None)
        if excluded_users is None:
            excluded_users = []
        else:
            excluded_users = [int(x) for x in excluded_users]
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
                self._lines_groups = LinesGroups.deserialize(
                    self._prev_q_data.get('lines_groups', []))
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
                'align': self.args.align,
                'lines_groups': self._lines_groups.serialize()
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
        args = self._get_attrs(ConcArgsMapping)
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
                tpl_data['Q'] = ['~%s' % op_id]
            else:
                tpl_data['q'] = ''
                tpl_data['Q'] = []
        else:
            tpl_data['q'] = self.urlencode([('q', q) for q in self.args.q])
            tpl_data['Q'] = self.args.q[:]
        tpl_data['num_lines_in_groups'] = len(self._lines_groups)
        tpl_data['lines_groups_numbers'] = tuple(set([v[2] for v in self._lines_groups]))

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

    def _map_args_to_attrs(self, req_args, named_args):
        """
        arguments:
        req_args -- a RequestArgsProxy instance
        named_args -- already processed named arguments

        Maps URL and form arguments to self.args.__dict__.
        Multi-value arguments are not supported. In case you want to
        access a value list (e.g. stuff like foo=a&foo=b&foo=c)
        please use request.args.getlist/request.form.getlist methods.
        """

        if 'json' in req_args:
            json_data = json.loads(req_args.getvalue('json'))
            named_args.update(json_data)
        for k in req_args.keys():
            # must remove empty values, this should be achieved by
            # keep_blank_values=0, but it does not work for POST requests
            if len(req_args.getvalue(k)) > 0:
                key = str(k)
                val = req_args.getvalue(k)
                if key in self.PARAM_TYPES:
                    if not self.PARAM_TYPES[key].is_array() and type(val) is list:
                        # If a parameter (see static Parameter instances) is defined as a scalar
                        # but the web framework returns a list (e.g. an HTML form contains a key
                        # with multiple occurrences) then a possible conflict emerges. Although
                        # this should not happen, original Bonito2 code contains such
                        # inconsistencies. In such cases we use only last value as we expect that
                        # the last value overwrites previous ones with the same key.
                        val = val[-1]
                    elif self.PARAM_TYPES[key].is_array() and not type(val) is list:
                        # A Parameter object is expected to be a list but
                        # web framework returns a scalar value
                        val = [val]
                named_args[key] = val
        na = named_args.copy()

        convert_types(na, self.clone_args())
        self.args.__dict__.update(na)

    def _check_corpus_access(self, path, form, action_metadata):
        allowed_corpora = plugins.get('auth').permitted_corpora(self._session_get('user', 'id'))
        if not action_metadata.get('skip_corpus_init', False):
            self.args.corpname, fallback_url = self._determine_curr_corpus(form, allowed_corpora)
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

    def _init_semi_persistent_args(self, form_proxy):
        """
        Update self.args using semi persistent attributes. Only values
        not present in provided form_proxy are updated.

        arguments:
        form_proxy -- a RequestArgsProxy instance

        """
        sp_data = MultiDict(self._session_get('semi_persistent_attrs'))
        if 'corpname' in self._request.args and 'sel_aligned' in sp_data:
            curr_corpora = (sp_data.getlist('sel_aligned') + [sp_data.get('corpname', None)])
            if self._request.args['corpname'] not in curr_corpora:
                sp_data.pop('sel_aligned')
        self._session['semi_persistent_attrs'] = sp_data.items(multi=True)
        for k, v in self._session['semi_persistent_attrs']:
            if k not in form_proxy:
                self.PARAM_TYPES[k].update_attr(self.args, k, v)

    # TODO: decompose this method (phase 2)
    def _pre_dispatch(self, path, named_args, action_metadata=None):
        """
        Runs before main action is processed. The action includes
        mapping of URL/form parameters to self.args.
        """
        super(Kontext, self)._pre_dispatch(path, named_args, action_metadata)

        def validate_corpus():
            if isinstance(self.corp, fallback_corpus.ErrorCorpus):
                return self.corp.get_error()
            return None
        self.add_validator(validate_corpus)

        form = RequestArgsProxy(self._request.form, self._request.args)

        self._init_semi_persistent_args(form)

        if not action_metadata:
            action_metadata = {}

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
        self._map_args_to_attrs(form, named_args)

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
        return path, named_args

    def _post_dispatch(self, methodname, action_metadata, tmpl, result):
        """
        Runs after main action is processed but before any rendering (incl. HTTP headers)
        """
        if self.user_is_anonymous():
            disabled_set = set(self.disabled_menu_items)
            self.disabled_menu_items = tuple(disabled_set.union(set(Kontext.ANON_FORBIDDEN_MENU_ITEMS)))
        super(Kontext, self)._post_dispatch(methodname, action_metadata, tmpl, result)
        # create and store concordance query key
        if type(result) is DictType:
            new_query_key = self._store_conc_params()
            self._update_output_with_conc_params(new_query_key, result)
        # log user request
        self._log_request(self._get_items_by_persistence(Parameter.PERSISTENT), '%s' % methodname,
                          proc_time=self._proc_time)

    def _attach_query_metadata(self, tpl_out):
        """
        Adds information needed by extended version of text type (and other attributes) selection in a query
        """
        corpus_info = plugins.get('corparch').get_corpus_info(self.args.corpname, language=self.ui_lang)
        tpl_out['metadata_desc'] = corpus_info['metadata']['desc']
        tpl_out['input_languages'][self.args.corpname] = corpus_info['collator_locale']

    def _attach_query_types(self, tpl_out):
        def import_qs(qs):
            return qs[:-3] if qs is not None else None
        tpl_out['query_types'] = {self.args.corpname: import_qs(self.args.queryselector)}
        if self.corp.get_conf('ALIGNED'):
            for al in self.corp.get_conf('ALIGNED').split(','):
                tpl_out['query_types'][al] = import_qs(getattr(self.args, 'queryselector_{0}'.format(al), None))

    def _add_save_menu_item(self, label, action, params, save_format=None):
        params = copy.copy(params)
        if save_format:
            if type(params) is dict:
                params['saveformat'] = save_format
                params = params.items()
            elif type(params) is list:
                params.append(('saveformat', save_format))
            else:
                raise ValueError('Unsupported argument type: %s' % type(params))
        item_id = '%s-%s' % (action.replace('/', '_'), save_format)
        self.save_menu.append(ConcMenuItem(MainMenu.SAVE(item_id), label, action).add_args(*params))

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

        # 1st option: fetch required corpus name from html form or from URL params
        if not cn and 'corpname' in form:
            cn = form.getvalue('corpname')
        if isinstance(cn, ListType) and len(cn) > 0:
            cn = cn[-1]

        # 2nd option: try currently initialized corpname (e.g. from restored semi-persistent args)
        if not cn:
            cn = self.args.corpname

        # 3rd option (fallback): if no current corpus is set then we try previous user's corpus
        # and if no such exists then we try default one as configured
        # in settings.xml
        if not cn:
            cn = settings.get_default_corpus(corp_list)

        # in this phase we should have some non-empty corpus selected
        # but we do not know whether user has access to it

        # 1) reload permissions in case of no access and if available
        auth = plugins.get('auth')
        if cn not in corp_list and isinstance(auth, plugins.abstract.auth.AbstractRemoteAuth):
            auth.refresh_user_permissions(self._plugin_api)
            corp_list = auth.permitted_corpora(self._session_get('user', 'id'))
        # 2) try alternative corpus configuration (e.g. with restricted access)
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

    def _attach_aligned_corpora_info(self, exp_data):
        """
        Adds template data required to generate components for adding/overviewing
        aligned corpora.

        arguments:
        exp_data -- a dict where exported data is stored
        """
        if self.corp.get_conf('ALIGNED'):
            exp_data['Aligned'] = []
            for al in self.corp.get_conf('ALIGNED').split(','):
                alcorp = corplib.open_corpus(al)
                exp_data['Aligned'].append(dict(label=alcorp.get_conf('NAME') or al, n=al))
                attrlist = alcorp.get_conf('ATTRLIST').split(',')
                poslist = self.cm.corpconf_pairs(alcorp, 'WPOSLIST')
                exp_data['Wposlist_' + al] = [{'n': x[0], 'v': x[1]} for x in poslist]
                if 'lempos' in attrlist:
                    poslist = self.cm.corpconf_pairs(alcorp, 'LPOSLIST')
                exp_data['Lposlist_' + al] = [{'n': x[0], 'v': x[1]} for x in poslist]
                exp_data['has_lemmaattr_' + al] = 'lempos' in attrlist \
                    or 'lemma' in attrlist
                exp_data['input_languages'][al] = plugins.get('corparch').get_corpus_info(al).collator_locale

    def self_encoding(self):
        enc = corpus_get_conf(self.corp, 'ENCODING')
        return enc if enc else 'iso-8859-1'

    @property
    def corp(self):
        """
        Contains the current corpus. The property always contains a corpus-like object
        (even in case of an error). Possible values:

        1. a manatee.Corpus instance in case everything is OK (corpus is known, object is initialized
        without errors)
        2. an ErrorCorpus instance in case an exception occurred
        3. an Empty corpus instance in case the action does not need one (but KonText's internals do).

        This should be always preferred over accessing _curr_corpus attribute.

        """
        if self.args.corpname:
            try:
                if not self._curr_corpus or (self.args.usesubcorp and not hasattr(self._curr_corpus,
                                                                                  'subcname')):
                    self._curr_corpus = self.cm.get_Corpus(self.args.corpname,
                                                           self.args.usesubcorp)
                self._curr_corpus._conc_dir = self._conc_dir
                return self._curr_corpus
            except Exception as ex:
                return fallback_corpus.ErrorCorpus(ex)
        else:
            return fallback_corpus.EmptyCorpus()

    def permitted_corpora(self):
        """
        Returns corpora identifiers accessible by the current user.

        returns:
        a dict (canonical_id, id)
        """
        return plugins.get('auth').permitted_corpora(self._session_get('user', 'id'))

    def _load_fav_items(self):  # TODO implementation-specific
        return plugins.get('user_items').get_user_items(self._session_get('user', 'id'))

    def _add_corpus_related_globals(self, result, maincorp):
        """
        arguments:
        result -- template data dict
        maincorp -- currently focused corpus; please note that in case of aligned
                    corpora this can be a different one than self.corp
                    (or self.args.corpname) represents.
        """
        result['corpname'] = self.args.corpname
        result['align'] = self.args.align
        result['human_corpname'] = self._human_readable_corpname()

        result['corp_description'] = maincorp.get_info()
        result['corp_size'] = self.corp.size()
        if self.args.usesubcorp:
            result['subcorp_size'] = self.corp.search_size()
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

        if corpus_get_conf(maincorp, 'FREQTTATTRS'):
            ttcrit_attrs = corpus_get_conf(maincorp, 'FREQTTATTRS')
        else:
            ttcrit_attrs = corpus_get_conf(maincorp, 'SUBCORPATTRS')
        result['ttcrit'] = [('fcrit', '%s 0' % a) for a in ttcrit_attrs.replace('|', ',').split(',') if a]
        result['corp_uses_tag'] = 'tag' in corpus_get_conf(maincorp, 'ATTRLIST').split(',')
        result['commonurl'] = self.urlencode([('corpname', self.args.corpname),
                                              ('lemma', self.args.lemma),
                                              ('lpos', self.args.lpos),
                                              ('usesubcorp', self.args.usesubcorp),
                                              ])
        result['interval_chars'] = (
            settings.get('corpora', 'left_interval_char', None),
            settings.get('corpora', 'interval_char', None),
            settings.get('corpora', 'right_interval_char', None),
        )

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
                if (not isinstance(plugin_obj, plugins.abstract.CorpusDependentPlugin) or
                        plugin_obj.is_enabled_for(self.args.corpname)):
                    js_file = settings.get('plugins', opt_plugin, {}).get('js_module')
                    if js_file:
                        ans[opt_plugin] = js_file
        result['plugin_js'] = ans
        result['active_plugins'] = plugins.get_plugins(include_missing=False).keys()

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
                        real_val = attr() if callable(attr) else attr
                    else:
                        real_val = param_val
                    err_rep_params.append('%s=%s' % (param_meta['name'], urllib.quote_plus(real_val)))
                ans = '%s?%s' % (settings.get('global', 'error_report_url'), '&'.join(err_rep_params))
        return ans

    def _apply_theme(self, data):
        theme_name = settings.get('theme', 'name')
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

        def is_remote_resource(path):
            return path.find('//') == 0 or path.find('http') == 0

        data['theme'] = {
            'name': settings.get('theme', 'name'),
            'logo_path': os.path.normpath(os.path.join(self._files_path, 'themes', theme_name, logo_img)),
            'logo_mouseover_path': os.path.normpath(os.path.join(self._files_path, 'themes', theme_name, logo_alt_img)),
            'logo_href': logo_href,
            'logo_title': logo_title,
            'logo_inline_css': settings.get('theme', 'logo_inline_css', ''),
            'online_fonts': settings.get_list('theme', 'fonts'),
            'online_css': filter(lambda x: is_remote_resource(x), settings.get_list('theme', 'css'))
        }
        if settings.is_debug_mode() and os.path.isfile(os.path.join(os.path.dirname(__file__),
                                                                    '../public/files/css/custom.min.css')):
            # custom.min.css contains both theme and plug-in custom stylesheets
            data['theme']['css'] = os.path.normpath(os.path.join(self._files_path, 'css/custom.min.css'))
        else:
            # in production mode, all the styles are packed into a single file
            data['theme']['css'] = None

    def _add_globals(self, result, methodname, action_metadata):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        Controller._add_globals(self, result, methodname, action_metadata)
        result['base_attr'] = Kontext.BASE_ATTR
        result['files_path'] = self._files_path
        result['debug'] = settings.is_debug_mode()
        result['_version'] = (corplib.manatee_version(), settings.get('global', '__version__'))

        global_var_val = self._get_attrs(ConcArgsMapping)
        result['globals'] = self.urlencode(global_var_val)
        result['Globals'] = templating.StateGlobals(global_var_val)
        result['Globals'].set('q', [q for q in result.get('Q')])
        result['human_corpname'] = None

        if self.args.maincorp:
            thecorp = corplib.open_corpus(self.args.maincorp)
        else:
            thecorp = self.corp
        if not action_metadata.get('skip_corpus_init', False):
            self._add_corpus_related_globals(result, thecorp)
            result['uses_corp_instance'] = True
        else:
            result['uses_corp_instance'] = False

        result['supports_password_change'] = self._uses_internal_user_pages()
        result['undo_q'] = self.urlencode([('q', q) for q in self.args.q[:-1]])
        result['session_cookie_name'] = settings.get('plugins', 'auth').get('auth_cookie_name', '')

        result['root_url'] = self.get_root_url()
        result['static_url'] = '%sfiles/' % self.get_root_url()
        result['user_info'] = self._session.get('user', {'fullname': None})
        result['_anonymous'] = self.user_is_anonymous()

        if plugins.has_plugin('auth') and isinstance(plugins.get('auth'), AbstractInternalAuth):
            result['login_url'] = plugins.get('auth').get_login_url(self.return_url)
            result['logout_url'] = plugins.get('auth').get_logout_url(self.get_root_url())
        else:
            result['login_url'] = None
            result['logout_url'] = None

        if plugins.has_plugin('application_bar'):
            application_bar = plugins.get('application_bar')
            result['app_bar'] = application_bar.get_contents(plugin_api=self._plugin_api,
                                                             return_url=self.return_url)
            result['app_bar_css'] = application_bar.get_styles(plugin_api=self._plugin_api)
            result['app_bar_js'] = application_bar.get_scripts(plugin_api=self._plugin_api)
        else:
            result['app_bar'] = None
            result['app_bar_css'] = []
            result['app_bar_js'] = None

        if plugins.has_plugin('footer_bar'):
            result['footer_bar'] = plugins.get('footer_bar').get_contents(self._plugin_api, self.return_url)
            result['footer_bar_css'] = plugins.get('footer_bar').get_css_url()
        else:
            result['footer_bar'] = None
            result['footer_bar_css'] = None

        self._apply_theme(result)

        # updates result dict with javascript modules paths required by some of the optional plugins
        self._setup_optional_plugins_js(result)

        result['CorplistFn'] = self._load_fav_items
        user_items = plugins.get('user_items')
        result['bib_conf'] = plugins.get('corparch').get_corpus_info(self.args.corpname).metadata

        # available languages; used just by UI language switch
        if plugins.has_plugin('getlang'):
            result['avail_languages'] = ()  # getlang plug-in provides customized switch
        else:
            result['avail_languages'] = settings.get_full('global', 'translations')

        hmqs = settings.get('plugins', 'query_storage').get('history_max_query_size', None)
        result['history_max_query_size'] = int(hmqs) if hmqs else None
        result['uiLang'] = self.ui_lang.replace('_', '-') if self.ui_lang else 'en-US'

        if settings.contains('global', 'intl_polyfill_url'):
            result['intl_polyfill_url'] = settings.get('global', 'intl_polyfill_url').format(
                    ','.join('Intl.~locale.%s' % x for x in get_avail_languages()))
        else:
            result['intl_polyfill_url'] = None

        # util functions
        result['format_number'] = partial(format_number)
        result['join_params'] = templating.join_params
        result['to_str'] = lambda s: unicode(s) if s is not None else u''
        result['to_json'] = lambda obj: json.dumps(obj)
        result['camelize'] = l10n.camelize
        result['update_params'] = templating.update_params
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

        result['has_subcmixer'] = plugins.has_plugin('subcmixer')

        result['can_send_mail'] = bool(settings.get('mailing'))

        result['use_conc_toolbar'] = settings.get_bool('global', 'use_conc_toolbar')

        # we export plug-ins data KonText core does not care about (it is used
        # by a respective plug-in client-side code)
        result['plugin_data'] = {}
        for plg_name, plg in plugins.get_plugins().items():
            if hasattr(plg, 'export'):
                result['plugin_data'][plg_name] = plg.export(self._plugin_api)

        # main menu
        menu_items = MenuGenerator(result, self.args).generate(disabled_items=self.disabled_menu_items,
                                                               save_items=self.save_menu,
                                                               corpus_dependent=result['uses_corp_instance'],
                                                               ui_lang=self.ui_lang)
        result['menu_data'] = menu_items
        # We will also generate a simplified static menu which is rewritten
        # as soon as JS stuff is initiated. It can be used e.g. by search engines.
        result['static_menu'] = [dict(label=x[1]['label'], disabled=x[1].get('disabled', False),
                                      action=x[1].get('fallback_action'))
                                 for x in menu_items['submenuItems']]

        # asynchronous tasks
        result['async_tasks'] = [t.to_dict() for t in self.get_async_tasks()]
        return result

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
        if self.corp.get_conf('NAME'):
            return corpus_get_conf(self.corp, 'NAME')
        elif self.args.corpname:
            return self._canonical_corpname(self.args.corpname)
        else:
            return ''

    def get_speech_segment(self):
        """
        Returns a speech segment (= structural attribute, e.g. 'sp.audio')
        if the current corpus has one configured.

        Returns:
            str: segment name if speech_segment is configured in 'corpora.xml' and it actually exists; else None
        """
        speech_struct = plugins.get('corparch').get_corpus_info(self.args.corpname).get('speech_segment')
        if speech_struct in corpus_get_conf(self.corp, 'STRUCTATTRLIST').split(','):
            return tuple(speech_struct.split('.'))
        else:
            return None

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
                        'than %s' % (actual_range[0], actual_range[1], max_range))
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
    def _parse_sorting_param(k):
        if k[0] == '-':
            revers = True
            k = k[1:]
        else:
            revers = False
        return k, revers

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

    @staticmethod
    def _uses_internal_user_pages():
        return isinstance(plugins.get('auth'), AbstractInternalAuth)

    def get_async_tasks(self, category=None):
        """
        Returns a list of tasks user is explicitly informed about.

        Args:
            category (str): task category filter
        Returns:
            (list of AsyncTaskStatus)
        """
        if 'async_tasks' in self._session:
            ans = [AsyncTaskStatus.from_dict(d) for d in self._session['async_tasks']]
        else:
            ans = []
        if category is not None:
            return filter(lambda item: item.category == category, ans)
        else:
            return ans

    def _set_async_tasks(self, task_list):
        self._session['async_tasks'] = [at.to_dict() for at in task_list]

    def _store_async_task(self, async_task_status):
        at_list = self.get_async_tasks()
        at_list.append(async_task_status)
        self._set_async_tasks(at_list)

    @exposed(return_type='json', legacy=True)
    def concdesc_json(self):
        out = {'Desc': []}
        conc_desc = conclib.get_conc_desc(corpus=self.corp, q=self.args.q,
                                          subchash=getattr(self.corp, 'subchash', None))

        def nicearg(arg):
            args = arg.split('"')
            niceargs = []
            niceargsset = set()
            for i in range(len(args)):
                if i % 2:
                    tmparg = args[i].strip('\\').replace('(?i)', '')
                    if tmparg not in niceargsset:
                        niceargs.append(tmparg)
                        niceargsset.add(tmparg)
                else:
                    if args[i].startswith('within'):
                        niceargs.append('within')
            return ', '.join(niceargs)

        for o, a, u1, u2, s in conc_desc:
            u2.append(('corpname', self.args.corpname))
            if self.args.usesubcorp:
                u2.append(('usesubcorp', self.args.usesubcorp))
            out['Desc'].append({
                'op': o,
                'arg': a,
                'nicearg': nicearg(a),
                'churl': self.urlencode(u1),
                'tourl': self.urlencode(u2),
                'size': s})
        return out

    @exposed(return_type='json', skip_corpus_init=True)
    def check_tasks_status(self, request):
        backend, conf = settings.get_full('global', 'calc_backend')
        if backend == 'celery':
            import task
            app = task.get_celery_app(conf['conf'])
            at_list = self.get_async_tasks()
            for at in at_list:
                r = app.AsyncResult(at.ident)
                at.status = r.status
                if at.status == 'FAILURE':
                    at.error = unicode(r.result)
            self._set_async_tasks(at_list)
            return {'data': [d.to_dict() for d in at_list]}
        else:
            return {'data': []}  # other backends are not supported

    @exposed(return_type='json', skip_corpus_init=True)
    def remove_task_info(self, request):
        task_ids = request.form.getlist('tasks')
        self._set_async_tasks(filter(lambda x: x.ident not in task_ids, self.get_async_tasks()))
        return self.check_tasks_status(request)


class PluginApi(object):

    def __init__(self, controller, cookies, session):
        self._controller = controller
        self._cookies = cookies
        self._session = session
        self._shared_data = {}

    def set_shared(self, key, value):
        self._shared_data[key] = value

    def get_shared(self, key, default=None):
        return self._shared_data.get(key, default)

    def get_environ(self, key, default=None):
        """
        Return an environment variable
        """
        return self._controller.environ.get(key, default)

    @property
    def cookies(self):
        return self._cookies

    @property
    def session(self):
        return self._session

    def refresh_session_id(self):
        return self._controller.refresh_session_id()

    @property
    def user_lang(self):
        return self._controller.ui_lang

    @property
    def user_id(self):
        return self._session.get('user', {'id': None}).get('id')

    @property
    def user_is_anonymous(self):
        return self._controller.user_is_anonymous()

    @property
    def current_corpus(self):
        return self._controller.corp

    def get_canonical_corpname(self, c):
        return plugins.get('auth').canonical_corpname(c)

    @property
    def current_url(self):
        return getattr(self._controller, '_get_current_url')()

    @property
    def root_url(self):
        return self._controller.get_root_url()

    def redirect(self, url, code=303):
        return getattr(self._controller, '_redirect')(url, code=code)

    @property
    def text_types(self):
        ans = {}
        maxlistsize = settings.get_int('global', 'max_attr_list_size')
        subcorpattrs = self.current_corpus.get_conf('SUBCORPATTRS')
        if not subcorpattrs:
            subcorpattrs = self.current_corpus.get_conf('FULLREF')
        tt = get_tt(self.current_corpus, self.user_lang).export(subcorpattrs, maxlistsize)
        for item in tt:
            for tt2 in item['Line']:
                ans[tt2['name']] = {'type': 'default', 'values': [x['v'] for x in tt2.get('Values', [])]}
        return ans
