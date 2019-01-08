# Copyright (c) 2003-2013  Pavel Rychly, Vojtech Kovar, Milos Jakubicek, Milos Husak, Vit Baisa
# Copyright (c) 2013 Charles University, Faculty of Arts,
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

import json
from functools import partial
import logging
import inspect
import os.path
import time
from types import DictType

import werkzeug.urls
from werkzeug.datastructures import MultiDict

import corplib
import conclib
from controller import Controller, convert_types, exposed
from controller.errors import (UserActionException, ForbiddenException, AlignedCorpusForbiddenException,
                               NotFoundException)
import plugins
import plugins.abstract
from plugins.abstract.corpora import BrokenCorpusInfo
from plugins.abstract.auth import AbstractInternalAuth
import settings
import l10n
from l10n import corpus_get_conf
from translation import ugettext as translate
import scheduled
import fallback_corpus
from argmapping import ConcArgsMapping, Parameter, GlobalArgs
from main_menu import MainMenu, MenuGenerator, EventTriggeringItem
from controller.plg import PluginApi
from templating import DummyGlobals
from collections import defaultdict


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
    It is also possible to force arguments manually in which
    case anything with the same key from 'form' or 'args' is
    suppressed. This is used when unpacking arguments from
    a query hash code.

    The class is used in 'pre dispatch' phase and it is not
    expected to be used within individual action methods
    where 'request' object is available and also 'self.args'
    mapping.
    """

    def __init__(self, form, args):
        self._form = form
        self._args = args
        self._forced = defaultdict(lambda: [])

    def __iter__(self):
        return self.keys().__iter__()

    def __contains__(self, item):
        return self._forced.__contains__(item) or self._form.__contains__(item) or self._args.__contains__(item)

    def keys(self):
        return list(set(self._forced.keys() + self._form.keys() + self._args.keys()))

    def getlist(self, k):
        """
        Returns a list of values matching passed argument
        name. List is returned even if there is a single
        value avalilable.

        URL arguments have higher priority over POST ones.
        """
        tmp = self._forced[k]
        if len(tmp) > 0:
            return tmp
        tmp = self._form.getlist(k)
        if len(tmp) > 0:
            return tmp
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

    def add_forced_arg(self, k, *v):
        self._forced[k] = self._forced[k] + list(v)


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


def val_to_js(obj):
    return json.dumps(obj).replace('</script>', '<" + "/script>').replace('<script>', '<" + "script>')


class Kontext(Controller):
    """
    A controller.Controller extension implementing
    KonText-specific requirements.
    """

    # main menu items disabled for public users (this is applied automatically during
    # post_dispatch())
    ANON_FORBIDDEN_MENU_ITEMS = (MainMenu.NEW_QUERY('history', 'wordlist'),
                                 MainMenu.CORPORA('my-subcorpora', 'create-subcorpus'),
                                 MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER,
                                 MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)

    CONCORDANCE_ACTIONS = (MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER, MainMenu.FREQUENCY,
                           MainMenu.COLLOCATIONS, MainMenu.VIEW('kwic-sentence'),
                           MainMenu.CORPORA('create-subcorpus'))

    GENERAL_OPTIONS = ('pagesize', 'kwicleftctx', 'kwicrightctx', 'multiple_copy', 'ctxunit',
                       'shuffle', 'citemsperpage', 'fmaxitems', 'wlpagesize', 'line_numbers',
                       'cql_editor')

    LOCAL_COLL_OPTIONS = ('cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr', 'cbgrfns', 'csortfn')

    BASE_ATTR = 'word'  # TODO this value is actually hardcoded throughout the code

    # a user settings key entry used to access user's scheduled actions
    SCHEDULED_ACTIONS_KEY = '_scheduled'

    PARAM_TYPES = dict(inspect.getmembers(GlobalArgs, predicate=lambda x: isinstance(x, Parameter)))

    def __init__(self, request, ui_lang):
        super(Kontext, self).__init__(request=request, ui_lang=ui_lang)
        # Note: always use _corp() method to access current corpus even from inside the class
        self._curr_corpus = None
        self._corpus_variant = ''  # a prefix for a registry file

        self.return_url = None

        # a CorpusManager instance (created in pre_dispatch() phase)
        # generates (sub)corpus objects with additional properties
        self.cm = None

        self.disabled_menu_items = []

        # menu items - they should not be handled directly
        self._save_menu = []

        self.subcpath = []

        self._conc_dir = u''

        self._files_path = settings.get('global', 'static_files_prefix', u'../files')

        # data of the current manual concordance line selection/categorization
        self._lines_groups = LinesGroups(data=[])

        self._plugin_api = PluginApi(self, self._cookies, self._request.session)
        self.get_corpus_info = partial(
            plugins.runtime.CORPARCH.instance.get_corpus_info, self._plugin_api.user_lang)

        # conc_persistence plugin related attributes
        self._q_code = None  # a key to 'code->query' database
        self._prev_q_data = None  # data of the previous operation are stored here
        self._auto_generated_conc_ops = []

    def get_mapping_url_prefix(self):
        return super(Kontext, self).get_mapping_url_prefix()

    def _create_action_log(self, user_settings, action_name, proc_time=None):
        """
        Logs user's request by storing URL parameters, user settings and user name

        arguments:
        user_settings -- a dict containing user settings
        action_name -- name of current action
        proc_time -- float specifying how long the action took;
        default is None - in such case no information is stored

        returns:
        log record dict
        """
        import datetime

        logged_values = settings.get('logging', 'values', ())
        log_data = {}

        params = {}
        if self.environ.get('QUERY_STRING'):
            params.update(dict(self._request.args.items()))

        for val in logged_values:
            if val == 'date':
                log_data['date'] = datetime.datetime.today().strftime(
                    '%s.%%f' % settings.DEFAULT_DATETIME_FORMAT)
            elif val == 'action':
                log_data['action'] = action_name
            elif val == 'user_id':
                log_data['user_id'] = self.session_get('user', 'id')
            elif val == 'user':
                log_data['user'] = self.session_get('user', 'user')
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
        return log_data

    @staticmethod
    def _init_default_settings(options):
        if 'shuffle' not in options:
            options['shuffle'] = int(settings.get_bool('global', 'shuffle_conc_by_default', False))

    def _setup_user_paths(self):
        user_id = self.session_get('user', 'id')
        self.subcpath = [os.path.join(settings.get('corpora', 'users_subcpath'), 'published')]
        if not self.user_is_anonymous():
            self.subcpath.insert(0, os.path.join(settings.get(
                'corpora', 'users_subcpath'), str(user_id)))
        self._conc_dir = '%s/%s' % (settings.get('corpora', 'conc_dir'), user_id)

    def _user_has_persistent_settings(self):
        with plugins.runtime.SETTINGS_STORAGE as sstorage:
            return self.session_get('user', 'id') not in sstorage.get_excluded_users() and not self.user_is_anonymous()

    def get_current_aligned_corpora(self):
        return [self.args.corpname] + self.args.align

    def get_available_aligned_corpora(self):
        return [self.args.corpname] + [c for c in self.corp.get_conf('ALIGNED').split(',') if len(c) > 0]

    def _get_valid_settings(self):
        """
        Return all the settings valid for actual
        KonText version (i.e. deprecated values
        are filtered out).
        """
        if self._user_has_persistent_settings():
            data = plugins.runtime.SETTINGS_STORAGE.instance.load(self.session_get('user', 'id'))
        else:
            data = self.session_get('settings')
            if not data:
                data = {}
        return [x for x in data.items() if x[0] != 'queryselector']

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
        for k, v in self._get_valid_settings():
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
        self._setup_user_paths()
        self.args.__dict__.update(options)

    def _apply_corpus_user_settings(self, options, corpname):
        """
        Applies corpus-dependent settings in the similar way
        to self._apply_general_user_settings. But in this case,
        a corpus name must be provided to be able to filter out
        settings of other corpora. Otherwise, no action is performed.
        """
        ans = {}
        for k, v in options.items():
            # e.g. public/syn2010:structattrs => ['public/syn2010', 'structattrs']
            tokens = k.rsplit(':', 1)
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

        Arguments:
        optlist -- a list of options/arguments to be saved
        selector -- a 'namespace' prefix (typically, a corpus name) used
                    to attach an option to a specific corpus
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
        with plugins.runtime.SETTINGS_STORAGE as settings_storage:
            if self._user_has_persistent_settings():
                options = normalize_opts(settings_storage.load(self.session_get('user', 'id')))
                settings_storage.save(self.session_get('user', 'id'), options)
            else:
                options = normalize_opts(self.session_get('settings'))
                self._session['settings'] = options

    def _restore_prev_conc_params(self, form):
        """
        Restores previously stored concordance query data using an ID found in request arg 'q'.
        To even begin the search, two conditions must be met:
        1. conc_persistence plugin is installed
        2. request arg 'q' contains a string recognized as a valid ID of a stored concordance query
           at the position 0 (other positions may contain additional regular query operations
           (shuffle, filter,...)

        Restored values will be stored in 'form' instance as forced ones preventing 'form'
        from returning its original values (no matter what is there).

        In case the conc_persistence is installed and invalid ID is encountered
        UserActionException will be raised.

        arguments:
            form -- RequestArgsProxy
        """
        url_q = form.getlist('q')[:]
        with plugins.runtime.CONC_PERSISTENCE as conc_persistence:
            if len(url_q) > 0 and conc_persistence.is_valid_id(url_q[0]):
                self._q_code = url_q[0][1:]
                self._prev_q_data = conc_persistence.open(self._q_code)
                # !!! must create a copy here otherwise _q_data (as prev query)
                # will be rewritten by self.args.q !!!
                if self._prev_q_data is not None:
                    form.add_forced_arg('q', self._prev_q_data['q'][:] + url_q[1:])
                    corpora = self._prev_q_data.get('corpora', [])
                    if len(corpora) > 0:
                        form.add_forced_arg('corpname', corpora[0])
                    if len(corpora) > 1:
                        form.add_forced_arg('align', *corpora[1:])
                        form.add_forced_arg('viewmode', 'align')
                    if self._prev_q_data.get('usesubcorp', None):
                        form.add_forced_arg('usesubcorp', self._prev_q_data['usesubcorp'])
                    self._lines_groups = LinesGroups.deserialize(
                        self._prev_q_data.get('lines_groups', []))
                else:
                    raise UserActionException(translate('Invalid or expired query'))

    def user_subc_names(self, corpname):
        if self.user_is_anonymous():
            return []
        return self.cm.subcorp_names(corpname)

    def get_saveable_conc_data(self):
        """
        Return values to be stored as a representation
        of user's query (here we mean all the data needed
        to reach the current result page including data
        needed to restore involved query forms).
        """
        if len(self._auto_generated_conc_ops) > 0:
            q_limit = self._auto_generated_conc_ops[0][0]
        else:
            q_limit = len(self.args.q)
        return dict(
            # we don't want to store all the items from self.args.q in case auto generated
            # operations are present (we will store them individually later).
            user_id=self.session_get('user', 'id'),
            q=self.args.q[:q_limit],
            corpora=self.get_current_aligned_corpora(),
            usesubcorp=self.args.usesubcorp,
            lines_groups=self._lines_groups.serialize()
        )

    def acknowledge_auto_generated_conc_op(self, q_idx, query_form_args):
        """
        In some cases, KonText automatically (either
        based on user's settings or for an internal reason)
        appends user-editable (which is a different situation
        compared e.g. with aligned corpora where there are
        also auto-added "q" elements but this is hidden from
        user) operations right after the current operation
        in self.args.q.

        E.g. user adds OP1, but we have to add also OP2, OP3
        where all the operations are user-editable (e.g. filters).
        In such case we must add OP1 but also "acknowledge"
        OP2 and OP3.

        Please note that it is expected that these operations
        come right after the query (no matter what q_idx says - it is
        used just to split original encoded query when storing
        the multi-operation as separate entities in query storage).

        Arguments:
        q_idx -- defines where the added operation resides within the q list
        query_form_args -- ConcFormArgs instance
        """
        self._auto_generated_conc_ops.append((q_idx, query_form_args))

    def _save_query_to_history(self, query_id, conc_data):
        if conc_data.get('lastop_form', {}).get('form_type') == 'query' and not self.user_is_anonymous():
            with plugins.runtime.QUERY_STORAGE as qh:
                qh.write(user_id=self.session_get('user', 'id'), query_id=query_id)

    def _store_conc_params(self):
        """
        Stores concordance operation if the conc_persistence plugin is installed
        (otherwise nothing is done).

        returns:
        string ID of the stored operation (or the current ID of nothing was stored)
        """
        with plugins.runtime.CONC_PERSISTENCE as cp:
            prev_data = self._prev_q_data if self._prev_q_data is not None else {}
            curr_data = self.get_saveable_conc_data()
            q_id = cp.store(self.session_get('user', 'id'),
                            curr_data=curr_data, prev_data=self._prev_q_data)
            self._save_query_to_history(q_id, curr_data)
            lines_groups = prev_data.get('lines_groups', self._lines_groups.serialize())
            for q_idx, op in self._auto_generated_conc_ops:
                prev = dict(id=q_id, lines_groups=lines_groups, q=self.args.q[:q_idx])
                curr = dict(lines_groups=lines_groups,
                            q=self.args.q[:q_idx + 1], lastop_form=op.to_dict())
                q_id = cp.store(self.session_get('user', 'id'), curr_data=curr, prev_data=prev)
            return q_id

    def _clear_prev_conc_params(self):
        self._prev_q_data = None

    def _redirect_to_conc(self):
        """
        Redirects to the current concordance
        """
        args = self._get_mapped_attrs(ConcArgsMapping)
        if self._q_code:
            args.append(('q', '~%s' % self._q_code))
        else:
            args += [('q', q) for q in self.args.q]
        href = werkzeug.urls.Href(self.get_root_url() + 'view')
        self.redirect(href(MultiDict(args)))

    def _update_output_with_conc_params(self, op_id, tpl_data):
        """
        Updates template data dictionary tpl_data with stored operation values.

        arguments:
        op_id -- unique operation ID
        tpl_data -- a dictionary used along with HTML template to render the output
        """
        if plugins.runtime.CONC_PERSISTENCE.exists:
            if op_id:
                tpl_data['Q'] = ['~%s' % op_id]
                tpl_data['conc_persistence_op_id'] = op_id
                if self._prev_q_data:  # => main query already entered; user is doing something else
                    # => additional operation => ownership is clear
                    if self._prev_q_data.get('id', None) != op_id:
                        tpl_data['user_owns_conc'] = True
                    else:  # some other action => we have to check if user is the author
                        tpl_data['user_owns_conc'] = self._prev_q_data.get(
                            'user_id', None) == self.session_get('user', 'id')
                else:  # initial query => ownership is clear
                    tpl_data['user_owns_conc'] = True
            else:
                tpl_data['Q'] = []
                tpl_data['conc_persistence_op_id'] = None
        else:
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

    def _fix_interdependent_attrs(self):
        """
        Some self.args values may not play well together with some default
        values of dependent attributes. This method should ensure that all
        the values are consistent.
        """
        if self.args.attr_vmode in ('mouseover', 'mixed') and self.args.attr_allpos == 'kw':
            self.args.attr_allpos = 'all'

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
            if len(req_args.getlist(k)) > 0:
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
        self._fix_interdependent_attrs()

    def _check_corpus_access(self, action_name, form, action_metadata):
        """
        Args:
            action_name:
            form:
            action_metadata:

        Returns: a 2-tuple (copus id, corpus variant)
        """
        def validate_access(cn, allowed):
            if cn in allowed:
                return True, allowed[cn]
            else:
                return False, ''

        with plugins.runtime.AUTH as auth:
            allowed_corpora = auth.permitted_corpora(self.session_get('user'))
            if not action_metadata['skip_corpus_init']:
                corpname, redirect = self._determine_curr_corpus(form, allowed_corpora)
                has_access, variant = validate_access(corpname, allowed_corpora)
                if has_access and redirect:
                    url_pref = self.get_mapping_url_prefix()
                    if len(url_pref) > 0:
                        url_pref = url_pref[1:]
                    self.redirect(self.create_url(url_pref + action_name, dict(corpname=corpname)))
                elif not has_access:
                    auth.on_forbidden_corpus(self._plugin_api, corpname, variant)
                for al_corp in form.getlist('align'):
                    al_access, al_variant = validate_access(al_corp, allowed_corpora)
                    # we cannot accept aligned corpora without access right
                    # or with different variant (from implementation reasons in this case)
                    # than the main corpus has
                    if not al_access or al_variant != variant:
                        raise AlignedCorpusForbiddenException(al_corp, al_variant)
            else:
                corpname = ''
                variant = ''
            return corpname, variant

    def _apply_semi_persistent_args(self, form_proxy):
        """
        Update self.args using semi persistent attributes. Only values
        not present in provided form_proxy are updated.

        arguments:
        form_proxy -- a RequestArgsProxy instance

        """
        for k, v in self._session.get('semi_persistent_attrs', []):
            if k not in form_proxy:
                self.PARAM_TYPES[k].update_attr(self.args, k, v)

    def _store_semi_persistent_attrs(self, attr_list):
        """
        Store all the semi-persistent (Parameter.SEMI_PERSISTENT) args listed in attr_list.

        arguments:
            explicit_list -- a list of attributes to store (the ones
                             without Parameter.SEMI_PERSISTENT flag will be ignored)
        """
        semi_persist_attrs = self._get_items_by_persistence(Parameter.SEMI_PERSISTENT)
        tmp = MultiDict(self._session.get('semi_persistent_attrs', {}))
        for attr_name in attr_list:
            if attr_name in semi_persist_attrs:
                v = getattr(self.args, attr_name)
                if type(v) in (list, tuple):
                    tmp.setlist(attr_name, v)
                else:
                    tmp[attr_name] = v
        # we have to ensure Werkzeug sets 'should_save' attribute (mishaps of mutable data structures)
        self._session['semi_persistent_attrs'] = tmp.items(multi=True)

    def pre_dispatch(self, action_name, named_args, action_metadata=None):
        """
        Runs before main action is processed. The action includes
        mapping of URL/form parameters to self.args, loading user
        options, validating corpus access rights, scheduled actions.
        """
        super(Kontext, self).pre_dispatch(action_name, named_args, action_metadata)

        with plugins.runtime.DISPATCH_HOOK as dhook:
            dhook.pre_dispatch(self._plugin_api, action_name, action_metadata, self._request)

        def validate_corpus():
            if isinstance(self.corp, fallback_corpus.ErrorCorpus):
                return self.corp.get_error()
            info = self.get_corpus_info(self.args.corpname)
            if isinstance(info, BrokenCorpusInfo):
                return NotFoundException(translate('Corpus \"{0}\" not available'.format(info.name)),
                                         internal_message='Failed to fetch configuration for {0}'.format(info.name))
            return None
        if not action_metadata['skip_corpus_init']:
            self.add_validator(validate_corpus)

        form = RequestArgsProxy(self._request.form, self._request.args)

        if action_metadata['apply_semi_persist_args']:
            self._apply_semi_persistent_args(form)

        options, corp_options = self._load_user_settings()
        self._scheduled_actions(options)
        # only general setting can be applied now because
        # we do not know final corpus name yet
        self._apply_general_user_settings(options, self._init_default_settings)

        self.cm = corplib.CorpusManager(self.subcpath)

        self._restore_prev_conc_params(form)
        # corpus access check and modify path in case user cannot access currently requested corp.
        corpname, corpus_variant = self._check_corpus_access(action_name, form, action_metadata)

        # now we can apply also corpus-dependent settings
        # because the corpus name is already known
        if len(corpname) > 0:
            self._apply_corpus_user_settings(corp_options, corpname)
        self._map_args_to_attrs(form, named_args)
        self.args.corpname = corpname  # always prefer corpname returned by _check_corpus_access()
        self._corpus_variant = corpus_variant

        # return url (for 3rd party pages etc.)
        args = {}
        if self.args.corpname:
            args['corpname'] = self.args.corpname
        if self.get_http_method() == 'GET':
            self.return_url = self.updated_current_url(args)
        else:
            self.return_url = '%sfirst_form?%s' % (self.get_root_url(),
                                                   '&'.join(['%s=%s' % (k, v)
                                                             for k, v in args.items()]))
        # by default, each action is public
        access_level = action_metadata['access_level']
        if access_level and self.user_is_anonymous():
            raise ForbiddenException(translate('Access forbidden - please log-in.'))

        # plugins setup
        for p in plugins.runtime:
            if callable(getattr(p.instance, 'setup', None)):
                p.instance.setup(self)
        return named_args

    def post_dispatch(self, methodname, action_metadata, tmpl, result):
        """
        Runs after main action is processed but before any rendering (incl. HTTP headers)
        """
        if self.user_is_anonymous():
            disabled_set = set(self.disabled_menu_items)
            self.disabled_menu_items = tuple(disabled_set.union(
                set(Kontext.ANON_FORBIDDEN_MENU_ITEMS)))
        super(Kontext, self).post_dispatch(methodname, action_metadata, tmpl, result)

        # create and store concordance query key
        if type(result) is DictType:
            if action_metadata['mutates_conc']:
                next_query_key = self._store_conc_params()
            else:
                next_query_key = self._prev_q_data.get('id', None) if self._prev_q_data else None
            self._update_output_with_conc_params(next_query_key, result)

        # log user request
        log_data = self._create_action_log(self._get_items_by_persistence(Parameter.PERSISTENT), '%s' % methodname,
                                           proc_time=self._proc_time)
        if not settings.get_bool('logging', 'skip_user_actions', False):
            logging.getLogger('QUERY').info(json.dumps(log_data))
        with plugins.runtime.DISPATCH_HOOK as dhook:
            dhook.post_dispatch(self._plugin_api, methodname, action_metadata, log_data)

    def _add_save_menu_item(self, label, save_format=None, hint=None):
        if save_format is None:
            event_name = 'MAIN_MENU_SHOW_SAVE_FORM'
            self._save_menu.append(
                EventTriggeringItem(MainMenu.SAVE, label, event_name, key_code=83, key_mod='shift',
                                    hint=hint).mark_indirect())  # key = 's'

        else:
            event_name = 'MAIN_MENU_DIRECT_SAVE'
            self._save_menu.append(EventTriggeringItem(MainMenu.SAVE, label, event_name, hint=hint
                                                       ).add_args(('saveformat', save_format)))

    def _determine_curr_corpus(self, form, corp_list):
        """
        This method tries to determine which corpus is currently in use.
        If no answer is found or in case there is a conflict between selected
        corpus and user access rights then some fallback alternative is found -
        in such case the returned 'fallback' value is set to a URL leading to the
        fallback corpus.

        Parameters:
        form -- currently processed HTML form (if any)
        corp_list -- a dict (corpus_id => corpus_variant) representing all the corpora user can access

        Return:
        2-tuple with (current corpus, whether we should reload to the main page)
        """
        cn = ''
        redirect = False

        # 1st option: fetch required corpus name from html form or from URL params
        if 'corpname' in form:
            cn = form.getvalue('corpname')

        # 2nd option: try currently initialized corpname (e.g. from restored semi-persistent args)
        if not cn:
            cn = self.args.corpname

        # 3rd option: try user's last
        if not cn and not self.user_is_anonymous():
            with plugins.runtime.QUERY_STORAGE as qs:
                queries = qs.get_user_queries(self.session_get('user', 'id'), self.cm, limit=1)
                if len(queries) > 0:
                    cn = queries[0].get('corpname', '')
                    redirect = True

        # 4th option (fallback): if no current corpus is set then we try previous user's corpus
        # and if no such exists then we try default one as configured
        # in settings.xml
        if not cn:
            cn = settings.get_default_corpus(corp_list)
            redirect = True
        return cn, redirect

    @property
    def corp_encoding(self):
        enc = corpus_get_conf(self.corp, 'ENCODING')
        return enc if enc else 'iso-8859-1'

    def handle_dispatch_error(self, ex):
        if isinstance(self.corp, fallback_corpus.ErrorCorpus):
            self._status = 404
            self.add_system_message('error', _(
                'Failed to open corpus {0}').format(self.args.corpname))
        else:
            self._status = 500
            super(Kontext, self).handle_dispatch_error(ex)

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
                if not self._curr_corpus or (self.args.usesubcorp and not hasattr(self._curr_corpus, 'subcname')):
                    self._curr_corpus = self.cm.get_Corpus(self.args.corpname,
                                                           subcname=self.args.usesubcorp,
                                                           corp_variant=self._corpus_variant)
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
        a dict (corpus_id, corpus_variant)
        """
        return plugins.runtime.AUTH.instance.permitted_corpora(self.session_get('user'))

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

        if hasattr(self.corp, 'subcname'):
            self.args.usesubcorp = self.corp.subcname

        usesubcorp = self.args.usesubcorp if self.args.usesubcorp else None
        result['corpus_ident'] = dict(
            id=self.args.corpname,
            variant=self._corpus_variant,
            name=self._human_readable_corpname(),
            usesubcorp=usesubcorp,
            origSubcorpName=getattr(self.corp, 'orig_subcname', usesubcorp),
            foreignSubcorp=self.corp.author_id is not None and self.session_get('user', 'id') != self.corp.author_id)

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
        result['default_attr'] = corpus_get_conf(maincorp, 'DEFAULTATTR')
        for listname in ['AttrList', 'StructAttrList']:
            if listname in result:
                continue
            result[listname] = \
                [{'label': corpus_get_conf(maincorp, n + '.LABEL') or n, 'n': n}
                 for n in corpus_get_conf(maincorp, listname.upper()).split(',')
                 if n]

        if corpus_get_conf(maincorp, 'FREQTTATTRS'):
            ttcrit_attrs = corpus_get_conf(maincorp, 'FREQTTATTRS')
        else:
            ttcrit_attrs = corpus_get_conf(maincorp, 'SUBCORPATTRS')
        result['ttcrit'] = [('fcrit', '%s 0' % a)
                            for a in ttcrit_attrs.replace('|', ',').split(',') if a]
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
        result['righttoleft'] = True if self.corp.get_conf('RIGHTTOLEFT') else False

    def _setup_optional_plugins_js(self, result):
        """
        Updates result dict with JavaScript module paths required to
        run client-side parts of some optional plugins. Template document.tmpl
        (i.e. layout template) configures RequireJS module accordingly.
        """
        import plugins
        ans = {}
        result['active_plugins'] = []
        for opt_plugin in plugins.runtime:
            ans[opt_plugin.name] = None
            if opt_plugin.exists:
                js_file = settings.get('plugins', opt_plugin.name, {}).get('js_module')
                if js_file:
                    ans[opt_plugin.name] = js_file
                    if (not (isinstance(opt_plugin.instance, plugins.abstract.CorpusDependentPlugin)) or
                            opt_plugin.is_enabled_for(self._plugin_api, self.args.corpname)):
                        result['active_plugins'].append(opt_plugin.name)
        result['plugin_js'] = ans

    def _get_mapped_attrs(self, attr_names, force_values=None):
        """
        Returns required attributes (= passed attr_names) and their respective values found
        in 'self.args'. Only attributes initiated via class attributes and the Parameter class
        are considered valid.
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
            logo_title = translate('Click to enter a new query')
        else:
            logo_title = unicode(logo_href)

        theme_favicon = settings.get('theme', 'favicon', None)

        data['theme'] = dict(
            name=settings.get('theme', 'name'),
            logo_path=os.path.normpath(os.path.join(
                self._files_path, 'themes', theme_name, logo_img)),
            logo_mouseover_path=os.path.normpath(os.path.join(
                self._files_path, 'themes', theme_name, logo_alt_img)),
            logo_href=logo_href,
            logo_title=logo_title,
            logo_inline_css=settings.get('theme', 'logo_inline_css', ''),
            online_fonts=settings.get_list('theme', 'fonts'),
            favicon='{0}/{1}'.format(theme_name, theme_favicon) if theme_favicon else None
        )

    def _configure_auth_urls(self, out):
        with plugins.runtime.AUTH as auth:
            if plugins.runtime.AUTH.exists and isinstance(auth, AbstractInternalAuth):
                out['login_url'] = auth.get_login_url(self.return_url)
                out['logout_url'] = auth.get_logout_url(self.get_root_url())
            else:
                out['login_url'] = None
                out['logout_url'] = None

    def add_globals(self, result, methodname, action_metadata):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts
        """
        super(Kontext, self).add_globals(result, methodname, action_metadata)
        result['corpus_ident'] = {}
        result['Globals'] = DummyGlobals()
        result['base_attr'] = Kontext.BASE_ATTR
        result['root_url'] = self.get_root_url()
        result['files_path'] = self._files_path
        result['debug'] = settings.is_debug_mode()
        result['_version'] = (corplib.manatee_version(), settings.get('global', '__version__'))
        result['multilevel_freq_dist_max_levels'] = settings.get(
            'corpora', 'multilevel_freq_dist_max_levels', 3)
        result['last_freq_level'] = self.session_get('last_freq_level')  # TODO enable this
        if result['last_freq_level'] is None:
            result['last_freq_level'] = 1

        if self.args.maincorp:
            thecorp = corplib.open_corpus(self.args.maincorp)
        else:
            thecorp = self.corp
        if not action_metadata['skip_corpus_init']:
            self._add_corpus_related_globals(result, thecorp)
            result['uses_corp_instance'] = True
        else:
            result['uses_corp_instance'] = False

        result['supports_password_change'] = self._uses_internal_user_pages()
        result['undo_q'] = self.urlencode([('q', q) for q in self.args.q[:-1]])
        result['session_cookie_name'] = settings.get('plugins', 'auth').get('auth_cookie_name', '')
        result['shuffle_min_result_warning'] = settings.get_int(
            'global', 'shuffle_min_result_warning', 100000)

        result['user_info'] = self._session.get('user', {'fullname': None})
        result['_anonymous'] = self.user_is_anonymous()
        result['anonymous_user_conc_login_prompt'] = settings.get_bool(
            'global', 'anonymous_user_conc_login_prompt', False)

        self._configure_auth_urls(result)

        if plugins.runtime.APPLICATION_BAR.exists:
            application_bar = plugins.runtime.APPLICATION_BAR.instance
            result['app_bar'] = application_bar.get_contents(plugin_api=self._plugin_api,
                                                             return_url=self.return_url)
            result['app_bar_css'] = application_bar.get_styles(plugin_api=self._plugin_api)
            result['app_bar_js'] = application_bar.get_scripts(plugin_api=self._plugin_api)
        else:
            result['app_bar'] = None
            result['app_bar_css'] = []
            result['app_bar_js'] = []

        result['footer_bar'] = None
        result['footer_bar_css'] = None
        with plugins.runtime.FOOTER_BAR as fb:
            result['footer_bar'] = fb.get_contents(self._plugin_api, self.return_url)
            result['footer_bar_css'] = fb.get_css_url()

        self._apply_theme(result)

        # updates result dict with javascript modules paths required by some of the optional plugins
        self._setup_optional_plugins_js(result)

        result['bib_conf'] = self.get_corpus_info(self.args.corpname).metadata

        # available languages; used just by UI language switch
        if plugins.runtime.GETLANG.exists:
            result['avail_languages'] = ()  # getlang plug-in provides customized switch
        else:
            result['avail_languages'] = settings.get_full('global', 'translations')

        result['uiLang'] = self.ui_lang.replace('_', '-') if self.ui_lang else 'en-US'

        # util functions
        result['to_str'] = lambda s: unicode(s) if s is not None else u''
        # the output of 'to_json' is actually only json-like (see the function val_to_js)
        result['to_json'] = val_to_js
        result['camelize'] = l10n.camelize
        result['create_action'] = lambda a, p=None: self.create_url(a, p if p is not None else {})
        with plugins.runtime.ISSUE_REPORTING as irp:
            result['issue_reporting_action'] = irp.export_report_action(
                self._plugin_api).to_dict() if irp else None
        page_model = action_metadata['page_model'] if action_metadata['page_model'] else l10n.camelize(
            methodname)
        result['page_model'] = page_model
        result['has_subcmixer'] = plugins.runtime.SUBCMIXER.exists
        result['can_send_mail'] = bool(settings.get('mailing'))
        result['use_conc_toolbar'] = settings.get_bool('global', 'use_conc_toolbar')
        result['conc_url_ttl_days'] = plugins.runtime.CONC_PERSISTENCE.instance.get_conc_ttl_days(
            self.session_get('user', 'id'))

        result['multi_sattr_allowed_structs'] = []
        with plugins.runtime.LIVE_ATTRIBUTES as lattr:
            result['multi_sattr_allowed_structs'] = lattr.get_supported_structures(
                self.args.corpname)
        # we export plug-ins data KonText core does not care about (it is used
        # by a respective plug-in client-side code)
        result['plugin_data'] = {}
        for plg in plugins.runtime:
            if hasattr(plg.instance, 'export'):
                result['plugin_data'][plg.name] = plg.instance.export(self._plugin_api)

        result['explicit_conc_persistence_ui'] = settings.get_bool(
            'global', 'explicit_conc_persistence_ui', False)

        # main menu
        menu_items = MenuGenerator(result, self.args, self._plugin_api).generate(
            disabled_items=self.disabled_menu_items,
            save_items=self._save_menu,
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
        result['help_links'] = settings.get_help_links(self.ui_lang)
        result['ui_testing_flag'] = settings.get_bool('global', 'ui_testing_flag', '0')
        result['use_phantom_polyfills'] = 'phantomjs' in self._request.environ.get(
            'HTTP_USER_AGENT', '').lower()
        if 'popup_server_messages' not in result:
            result['popup_server_messages'] = True
        result['websocket_url'] = settings.get('global', 'websocket_url', None)
        return result

    def _human_readable_corpname(self):
        """
        Returns an user-readable name of the current corpus (i.e. it cannot be used
        to identify the corpus in KonText's code as it is only intended to be printed
        somewhere on a page).
        """
        if self.corp.get_conf('NAME'):
            return corpus_get_conf(self.corp, 'NAME')
        elif self.args.corpname:
            return self.args.corpname
        else:
            return ''

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

    def _get_checked_text_types(self, request):
        """
        Collects data required to restore checked/entered values in text types form.

        arguments:
        request -- Werkzeug request instance

        returns:
        2-tuple (dict structattr->[list of values], dict bib_id->bib_label)
        """
        ans = {}
        bib_mapping = {}
        src_obj = request.args if self.get_http_method() == 'GET' else request.form
        for p in src_obj.keys():
            if p.startswith('sca_'):
                ans[p[4:]] = src_obj.getlist(p)

        if plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(self._plugin_api, self.args.corpname):
            corpus_info = plugins.runtime.CORPARCH.instance.get_corpus_info(
                self.ui_lang, self.args.corpname)
            id_attr = corpus_info.metadata.id_attr
            if id_attr in ans:
                bib_mapping = dict(plugins.runtime.LIVE_ATTRIBUTES.instance.find_bib_titles(self._plugin_api,
                                                                                            self.args.corpname,
                                                                                            ans[id_attr]))
        return ans, bib_mapping

    def _export_subcorpora_list(self, corpname, curr_subcorp, out):
        """
        Updates passed dictionary by information about available sub-corpora.
        Listed values depend on current user and corpus.
        If there is a list already present in 'out' then it is extended
        by the new values.

        The function also adds a current subcorpus in case it is a published
        foreign (= of a different user) subcorpus.

        arguments:
        corpname -- corpus id
        curr_subcorp -- current subcorpus (even a public foreign one)
        out -- a dictionary used by templating system
        """
        basecorpname = corpname.split(':')[0]
        subcorp_list = l10n.sort(self.user_subc_names(basecorpname),
                                 loc=self.ui_lang, key=lambda x: x['n'])

        if self.corp and self.corp.is_published and self.corp.subcname == curr_subcorp:
            try:
                srch = (x for x in subcorp_list if x['pub'] == self.corp.subcname).next()
            except StopIteration:
                srch = None
            if srch is None:
                subcorp_list.insert(0, dict(v=self.corp.orig_subcname, n=self.corp.orig_subcname,
                                            pub=self.corp.subcname, foreign=True))
        if len(subcorp_list) > 0:
            subcorp_list = [{'n': '--%s--' % translate('whole corpus'), 'v': ''}] + subcorp_list

        if out.get('SubcorpList', None) is None:
            out['SubcorpList'] = []
        out['SubcorpList'].extend(subcorp_list)

    @staticmethod
    def _uses_internal_user_pages():
        return isinstance(plugins.runtime.AUTH.instance, AbstractInternalAuth)

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

    @exposed(return_type='json')
    def concdesc_json(self, _=None):
        out = {'Desc': []}
        conc_desc = conclib.get_conc_desc(corpus=self.corp, q=self.args.q,
                                          subchash=getattr(self.corp, 'subchash', None))

        def nicearg(arg):
            args = arg.split('"')
            niceargs = []
            prev_val = ''
            prev_other = ''
            for i in range(len(args)):
                if i % 2:
                    tmparg = args[i].strip('\\').replace('(?i)', '')
                    if tmparg != prev_val or '|' not in prev_other:
                        niceargs.append(tmparg)
                    prev_val = tmparg
                else:
                    if args[i].startswith('within'):
                        niceargs.append('within')
                    prev_other = args[i]
            return ', '.join(niceargs)

        for o, a, u1, u2, s, opid in conc_desc:
            u2.append(('corpname', self.args.corpname))
            if self.args.usesubcorp:
                u2.append(('usesubcorp', self.args.usesubcorp))
            out['Desc'].append(dict(
                op=o,
                opid=opid,
                arg=a,
                nicearg=nicearg(a),
                churl=self.urlencode(u1),
                tourl=self.urlencode(u2),
                size=s))
        return out

    @exposed(return_type='json', skip_corpus_init=True)
    def check_tasks_status(self, request):
        backend = settings.get('calc_backend', 'type')
        if backend in('celery', 'konserver'):
            import bgcalc
            app = bgcalc.calc_backend_client(settings)
            at_list = self.get_async_tasks()
            for at in at_list:
                r = app.AsyncResult(at.ident)
                at.status = r.status
                if at.status == 'FAILURE':
                    if hasattr(r.result, 'message'):
                        at.error = r.result.message
                    else:
                        at.error = str(r.result)
            self._set_async_tasks(at_list)
            return dict(data=[d.to_dict() for d in at_list])
        else:
            return dict(data=[])  # other backends are not supported

    @exposed(return_type='json', skip_corpus_init=True, http_method='DELETE')
    def remove_task_info(self, request):
        task_ids = request.form.getlist('tasks')
        self._set_async_tasks(filter(lambda x: x.ident not in task_ids, self.get_async_tasks()))
        return self.check_tasks_status(request)

    @exposed(accept_kwargs=True, skip_corpus_init=True, page_model='message')
    def message(self, *args, **kwargs):
        kwargs['last_used_corp'] = dict(corpname=None, human_corpname=None)
        if self.cm:
            with plugins.runtime.QUERY_STORAGE as qs:
                queries = qs.get_user_queries(self.session_get('user', 'id'), self.cm, limit=1)
                if len(queries) > 0:
                    kwargs['last_used_corp'] = dict(corpname=queries[0].get('corpname', None),
                                                    human_corpname=queries[0].get('human_corpname', None))
        kwargs['popup_server_messages'] = False
        return kwargs

    @exposed(accept_kwargs=True, legacy=True, skip_corpus_init=True, return_type='json')
    def message_json(self, *args, **kwargs):
        return self.message(*args, **kwargs)

    @exposed(skip_corpus_init=True, template='compatibility.tmpl')
    def compatibility(self, req):
        return {}
