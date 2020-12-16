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

from typing import Any, Optional, TypeVar, Dict, List, Iterator, Tuple, Union, Iterable, cast, Callable
from main_menu import AbstractMenuItem
from argmapping.query import ConcFormArgs
from manatee import Corpus
from werkzeug import Request
import werkzeug.urls
from werkzeug.datastructures import MultiDict
import attr

import json
import logging
import inspect
import os.path
import time
import babel

from . import Controller
import corplib
import conclib
from . import exposed
from .errors import (UserActionException, ForbiddenException,
                     AlignedCorpusForbiddenException, NotFoundException,
                     ImmediateRedirectException)
import plugins
from plugins.abstract.corpora import BrokenCorpusInfo, CorpusInfo
from plugins.abstract.auth import AbstractInternalAuth
import settings
import l10n
from l10n import corpus_get_conf
from translation import ugettext as translate
import scheduled
import fallback_corpus
from argmapping import ConcArgsMapping, Persistence, Args
from main_menu import MainMenu, MenuGenerator, EventTriggeringItem
from .plg import PluginApi
from templating import DummyGlobals
from .req_args import RequestArgsProxy
from texttypes import TextTypes, TextTypesCache


JSONVal = Union[str, int, float, bool, None, Dict[str, Any], List[Any]]
T = TypeVar('T')


class LinesGroups(object):
    """
    Handles concordance lines groups manually defined by a user.
    It is expected that the controller has always an instance of
    this class available (i.e. no None value).
    """

    def __init__(self, data: List[Any]) -> None:
        if not isinstance(data, list):
            raise ValueError('LinesGroups data argument must be a list')
        self.data = data
        self.sorted = False

    def __len__(self) -> int:
        return len(self.data) if self.data else 0

    def __iter__(self) -> Iterator:
        return iter(self.data) if self.data else iter([])

    def serialize(self) -> Dict[str, Any]:
        return {'data': self.data, 'sorted': self.sorted}

    def as_list(self) -> List[Any]:
        return self.data if self.data else []

    def is_defined(self) -> bool:
        return len(self.data) > 0

    @staticmethod
    def deserialize(data: Union[Dict, List[Any]]) -> 'LinesGroups':
        data_dict = dict(data) if isinstance(data, list) else data
        ans = LinesGroups(data_dict.get('data', []))
        ans.sorted = data_dict.get('sorted', False)
        return ans


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

    def __init__(self, ident: str, label: str, status: int, category: str, args: Dict[str, Any], created: Optional[float] = None, error: Optional[str] = None) -> None:
        self.ident: str = ident
        self.label: str = label
        self.status: int = status
        self.category: str = category
        self.created: Optional[float] = created if created else time.time()
        self.args: Dict[str, Any] = args
        self.error: Optional[str] = error

    def is_finished(self) -> bool:
        return self.status in ('FAILURE', 'SUCCESS')

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'AsyncTaskStatus':
        """
        Creates an instance from the 'dict' type. This is used
        to unserialize instances from session.
        """
        return AsyncTaskStatus(status=data['status'], ident=data['ident'], label=data['label'],
                               category=data['category'], created=data.get('created'), args=data.get('args', {}),
                               error=data.get('error'))

    def to_dict(self) -> Dict[str, Any]:
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
                       'rich_query_editor')

    LOCAL_COLL_OPTIONS = ('cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr', 'cbgrfns', 'csortfn')

    BASE_ATTR: str = 'word'  # TODO this value is actually hardcoded throughout the code

    # a user settings key entry used to access user's scheduled actions
    SCHEDULED_ACTIONS_KEY = '_scheduled'

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang)
        # Note: always use _corp() method to access current corpus even from inside the class
        self._curr_corpus: Optional[Corpus] = None
        self._corpus_variant: str = ''  # a prefix for a registry file

        self.return_url: Optional[str] = None

        # a CorpusManager instance (created in pre_dispatch() phase)
        # generates (sub)corpus objects with additional properties
        self.cm: Optional[corplib.CorpusManager] = None

        self.disabled_menu_items: List[str] = []

        # menu items - they should not be handled directly
        self._save_menu: List[AbstractMenuItem] = []

        self.subcpath: List[str] = []

        self._conc_dir: str = ''

        self._files_path: str = settings.get('global', 'static_files_prefix', '../files')

        # data of the current manual concordance line selection/categorization
        self._lines_groups: LinesGroups = LinesGroups(data=[])

        self._plugin_api: PluginApi = PluginApi(self, self._request, self._cookies)

        # conc_persistence plugin related attributes
        self._q_code: Optional[str] = None  # a key to 'code->query' database

        # data of the previous operation are stored here
        self._prev_q_data: Optional[Dict[str, Any]] = None

        self._auto_generated_conc_ops: List[Tuple[int, ConcFormArgs]] = []

        self.on_conc_store: Callable[[List[str]], None] = lambda s: None

        self._tt_cache = tt_cache
        self._tt = None  # this will be instantiated lazily

    def get_corpus_info(self, corp: str) -> CorpusInfo:
        with plugins.runtime.CORPARCH as plg:
            return plg.get_corpus_info(self.ui_lang, corp)

    def get_mapping_url_prefix(self) -> str:
        return super().get_mapping_url_prefix()

    def _create_action_log(self, user_settings: Dict[str, Any], action_name: str, err_desc: Tuple[str, str], proc_time: Optional[float] = None) -> Dict[str, JSONVal]:
        """
        Logs user's request by storing URL parameters, user settings and user name

        arguments:
        user_settings -- a dict containing user settings
        action_name -- name of current action
        err_desc -- 2-tuple (Exception class name along with optional application log anchor ID) or None
        proc_time -- float specifying how long the action took;
        default is None - in such case no information is stored

        returns:
        log record dict
        """
        import datetime

        logged_values = settings.get('logging', 'values', ())
        log_data: Dict[str, JSONVal] = {}

        if err_desc:
            log_data['error'] = dict(name=err_desc[0], anchor=err_desc[1])

        params = {}
        if self.environ.get('QUERY_STRING'):
            params.update(dict(list(self._request.args.items())))

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
                log_data['params'] = dict([(k, v) for k, v in list(params.items()) if v])
            elif val == 'settings':
                log_data['settings'] = dict([(k, v) for k, v in list(user_settings.items()) if v])
            elif val == 'proc_time' and proc_time is not None:
                log_data['proc_time'] = proc_time
            elif val.find('environ:') == 0:
                try:
                    request = cast(Dict[str, Any], log_data['request'])
                except KeyError:
                    log_data['request'] = request = {}
                k = val.split(':')[-1]
                request[k] = self.environ.get(k)
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
        self._conc_dir = os.path.join(settings.get('corpora', 'conc_dir'), str(user_id))

    # missing return statement type check error
    def _user_has_persistent_settings(self) -> bool:  # type: ignore
        with plugins.runtime.SETTINGS_STORAGE as sstorage:
            return self.session_get('user', 'id') not in getattr(sstorage, 'get_excluded_users')() and not self.user_is_anonymous()

    def get_current_aligned_corpora(self) -> List[str]:
        return [getattr(self.args, 'corpname')] + getattr(self.args, 'align')

    def get_available_aligned_corpora(self) -> List[str]:
        return [getattr(self.args, 'corpname')] + [c for c in self.corp.get_conf('ALIGNED').split(',') if len(c) > 0]

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

    def _load_user_settings(self, options: Dict[str, Any], corp_options: Dict[str, Any]):
        """
        Loads user settings via settings_storage plugin. The settings are divided
        into two groups:
        1. corpus independent (e.g. listing page sizes)
        2. corpus dependent (e.g. selected attributes to be presented on concordance page)

        returns:
        2-tuple of dicts ([general settings], [corpus dependent settings])
        """
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
        if callable(actions):
            actions(options)
        self.args.map_args_to_attrs(options)
        self._setup_user_paths()

    def _apply_corpus_user_settings(self, options, corpname):
        """
        Applies corpus-dependent settings in the similar way
        to self._apply_general_user_settings. But in this case,
        a corpus name must be provided to be able to filter out
        settings of other corpora. Otherwise, no action is performed.
        """
        ans = {}
        ans.update(self.get_corpus_info(corpname).default_view_opts)
        for k, v in options.items():
            # e.g. public/syn2010:structattrs => ['public/syn2010', 'structattrs']
            tokens = k.rsplit(':', 1)
            if len(tokens) == 2:
                if tokens[0] == corpname and tokens[1] not in self.GENERAL_OPTIONS:
                    ans[tokens[1]] = v
        self.args.map_args_to_attrs(ans)

    @staticmethod
    def _get_save_excluded_attributes() -> Tuple[str, ...]:
        return 'corpname', Kontext.SCHEDULED_ACTIONS_KEY

    def _save_options(self, optlist: Optional[Iterable] = None, selector: str = ''):
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
            tosave = [(selector + ':' + att.name, getattr(self.args, att.name))
                      for att in attr.fields(Args) if att.name in optlist]
        else:
            tosave = [(att.name, getattr(self.args, att.name))
                      for att in attr.fields(Args) if att.name in optlist]

        def normalize_opts(opts):
            if opts is None:
                opts = {}
            ans = {}
            excluded_attrs = self._get_save_excluded_attributes()
            for k in opts.keys():
                corp = k.split(':')[0] if ':' in k else None
                if k not in excluded_attrs and selector != corp:
                    ans[k] = opts[k]
            ans.update(tosave)
            return ans

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
                    form.add_forced_arg('q', *(self._prev_q_data['q'][:] + url_q[1:]))
                    corpora = self._prev_q_data.get('corpora', [])
                    if len(corpora) > 0:
                        orig_corpora = form.add_forced_arg('corpname', corpora[0])
                        if len(orig_corpora) > 0 and orig_corpora[0] != corpora[0]:
                            raise UserActionException(translate(
                                f'URL argument corpname={orig_corpora[0]} collides with corpus {corpora[0]} stored as part of original concordance'))
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

    def get_saveable_conc_data(self) -> Dict[str, Any]:
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
            usesubcorp=getattr(self.args, 'usesubcorp'),
            lines_groups=self._lines_groups.serialize()
        )

    def acknowledge_auto_generated_conc_op(self, q_idx: int, query_form_args: ConcFormArgs) -> None:
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
        if conc_data.get('lastop_form', {}).get('form_type') in ('query', 'filter') and not self.user_is_anonymous():
            with plugins.runtime.QUERY_STORAGE as qh:
                qh.write(user_id=self.session_get('user', 'id'), query_id=query_id)

    def _store_conc_params(self) -> List[str]:
        """
        Stores concordance operation if the conc_persistence plugin is installed
        (otherwise nothing is done).

        returns:
        string ID of the stored operation (or the current ID of nothing was stored)
        """
        with plugins.runtime.CONC_PERSISTENCE as cp:
            prev_data = self._prev_q_data if self._prev_q_data is not None else {}
            curr_data = self.get_saveable_conc_data()
            ans = [cp.store(self.session_get('user', 'id'),
                            curr_data=curr_data, prev_data=self._prev_q_data)]
            self._save_query_to_history(ans[0], curr_data)
            lines_groups = prev_data.get('lines_groups', self._lines_groups.serialize())
            for q_idx, op in self._auto_generated_conc_ops:
                prev = dict(id=ans[-1], lines_groups=lines_groups, q=getattr(self.args, 'q')[:q_idx],
                            user_id=self.session_get('user', 'id'))
                curr = dict(lines_groups=lines_groups,
                            q=getattr(self.args, 'q')[:q_idx + 1], lastop_form=op.to_dict(),
                            user_id=self.session_get('user', 'id'))
                ans.append(cp.store(self.session_get('user', 'id'), curr_data=curr, prev_data=prev))
            return ans

    def _clear_prev_conc_params(self):
        self._prev_q_data = None

    def _get_curr_conc_args(self):
        args = self._get_mapped_attrs(ConcArgsMapping)
        if self._q_code:
            args.append(('q', '~%s' % self._q_code))
        else:
            args += [('q', q) for q in getattr(self.args, 'q')]
        return args

    def _redirect_to_conc(self):
        """
        Redirects to the current concordance
        """
        args = self._get_curr_conc_args()
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
                if '__latest__' in tpl_data.get('conc_forms_args', {}):
                    tpl_data['conc_forms_args'][op_id] = tpl_data['conc_forms_args']['__latest__']
                    del tpl_data['conc_forms_args']['__latest__']
            else:
                tpl_data['Q'] = []
                tpl_data['conc_persistence_op_id'] = None
        else:
            tpl_data['Q'] = getattr(self.args, 'q')[:]
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
                            ans = fn(*(), **action)
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

    def _check_corpus_access(self, action_name, form, action_metadata):
        """
        Args:
            action_name:
            form:
            action_metadata:

        Returns: a 2-tuple (copus id, corpus variant)
        """
        with plugins.runtime.AUTH as auth:
            if not action_metadata['skip_corpus_init']:
                corpname, redirect = self._determine_curr_corpus(form)
                has_access, variant = auth.validate_access(corpname, self.session_get('user'))
                if has_access and redirect:
                    url_pref = self.get_mapping_url_prefix()
                    if len(url_pref) > 0:
                        url_pref = url_pref[1:]
                    raise ImmediateRedirectException(self.create_url(
                        url_pref + action_name, dict(corpname=corpname)))
                elif not has_access:
                    auth.on_forbidden_corpus(self._plugin_api, corpname, variant)
                for al_corp in form.getlist('align'):
                    al_access, al_variant = auth.validate_access(al_corp, self.session_get('user'))
                    # we cannot accept aligned corpora without access right
                    # or with different variant (from implementation reasons in this case)
                    # than the main corpus has
                    if not al_access or al_variant != variant:
                        raise AlignedCorpusForbiddenException(al_corp, al_variant)
            else:
                corpname = ''
                variant = ''
            return corpname, variant

    def pre_dispatch(self, action_name, action_metadata=None) -> RequestArgsProxy:
        """
        Runs before main action is processed. The action includes
        mapping of URL/form parameters to self.args, loading user
        options, validating corpus access rights, scheduled actions.
        """
        req_args = super().pre_dispatch(action_name, action_metadata)

        with plugins.runtime.DISPATCH_HOOK as dhook:
            dhook.pre_dispatch(self._plugin_api, action_name, action_metadata, self._request)

        def validate_corpus():
            if isinstance(self.corp, fallback_corpus.ErrorCorpus):
                return self.corp.get_error()
            info = self.get_corpus_info(getattr(self.args, 'corpname'))
            if isinstance(info, BrokenCorpusInfo):
                return NotFoundException(translate('Corpus \"{0}\" not available'.format(info.name)),
                                         internal_message='Failed to fetch configuration for {0}'.format(info.name))
            return None
        if not action_metadata['skip_corpus_init']:
            self.add_validator(validate_corpus)

        options = {}
        corp_options = {}
        self._load_user_settings(options, corp_options)
        self._scheduled_actions(options)
        # only general setting can be applied now because
        # we do not know final corpus name yet
        self._apply_general_user_settings(options, self._init_default_settings)

        self.cm = corplib.CorpusManager(self.subcpath)

        self._restore_prev_conc_params(req_args)
        # corpus access check and modify path in case user cannot access currently requested corp.
        corpname, corpus_variant = self._check_corpus_access(action_name, req_args, action_metadata)

        # now we can apply also corpus-dependent settings
        # because the corpus name is already known
        if len(corpname) > 0:
            self._apply_corpus_user_settings(corp_options, corpname)

        # now we apply args from URL (highest priority)
        self.args.map_args_to_attrs(req_args)
        # always prefer corpname returned by _check_corpus_access()
        setattr(self.args, 'corpname', corpname)
        self._corpus_variant = corpus_variant

        # return url (for 3rd party pages etc.)
        args = {}
        if getattr(self.args, 'corpname'):
            args['corpname'] = getattr(self.args, 'corpname')
        if self.get_http_method() == 'GET':
            self.return_url = self.updated_current_url(args)
        else:
            self.return_url = '%squery?%s' % (self.get_root_url(),
                                              '&'.join(['%s=%s' % (k, v)
                                                        for k, v in list(args.items())]))
        # by default, each action is public
        access_level = action_metadata['access_level']
        if access_level and self.user_is_anonymous():
            raise ForbiddenException(translate('Access forbidden - please log-in.'))

        # plugins setup
        for p in plugins.runtime:
            if callable(getattr(p.instance, 'setup', None)):
                p.instance.setup(self)
        return req_args

    def post_dispatch(self, methodname, action_metadata, tmpl, result, err_desc):
        """
        Runs after main action is processed but before any rendering (incl. HTTP headers)
        """
        if self.user_is_anonymous():
            disabled_set = set(self.disabled_menu_items)
            self.disabled_menu_items = tuple(disabled_set.union(
                set(Kontext.ANON_FORBIDDEN_MENU_ITEMS)))
        super(Kontext, self).post_dispatch(methodname, action_metadata, tmpl, result, err_desc)

        def encode_err(e): return None if e[0] is None else (e[0].__class__.__name__, e[1])

        # create and store concordance query key
        if type(result) is dict:
            if action_metadata['mutates_conc']:
                next_query_keys = self._store_conc_params()
            else:
                next_query_keys = [self._prev_q_data.get('id', None)] if self._prev_q_data else []
            self.on_conc_store(next_query_keys)
            self._update_output_with_conc_params(
                next_query_keys[-1] if len(next_query_keys) else None, result)

        # log user request
        log_data = self._create_action_log(self._get_items_by_persistence(Persistence.PERSISTENT), '%s' % methodname,
                                           err_desc=encode_err(err_desc), proc_time=self._proc_time)
        if not settings.get_bool('logging', 'skip_user_actions', False):
            logging.getLogger('QUERY').info(json.dumps(log_data))
        with plugins.runtime.DISPATCH_HOOK as dhook:
            dhook.post_dispatch(self._plugin_api, methodname, action_metadata, log_data)

    def _add_save_menu_item(self, label: str, save_format: Optional[str] = None, hint: Optional[str] = None):
        if save_format is None:
            event_name = 'MAIN_MENU_SHOW_SAVE_FORM'
            self._save_menu.append(
                EventTriggeringItem(MainMenu.SAVE, label, event_name, key_code=83, key_mod='shift',
                                    hint=hint).mark_indirect())  # key = 's'

        else:
            event_name = 'MAIN_MENU_DIRECT_SAVE'
            self._save_menu.append(EventTriggeringItem(MainMenu.SAVE, label, event_name, hint=hint
                                                       ).add_args(('saveformat', save_format)))

    def _determine_curr_corpus(self, form: RequestArgsProxy):
        """
        This method tries to determine which corpus is currently in use.
        If no answer is found or in case there is a conflict between selected
        corpus and user access rights then some fallback alternative is found -
        in such case the returned 'fallback' value is set to a URL leading to the
        fallback corpus.

        Parameters:
        form -- currently processed HTML form (if any)

        Return:
        2-tuple with (current corpus, whether we should reload to the main page)
        """
        cn = ''
        redirect = False
        if len(form.corpora) > 0:
            cn = form.corpora[0]
        elif not self.user_is_anonymous():
            with plugins.runtime.QUERY_STORAGE as qs, plugins.runtime.AUTH as auth:
                queries = qs.get_user_queries(self.session_get('user', 'id'), self.cm, limit=1)
                if len(queries) > 0:
                    cn = queries[0].get('corpname', '')
                    redirect = True

        # fallback option: if no current corpus is set then we try previous user's corpus
        # and if no such exists then we try default one as configured in settings.xml
        def test_fn(cname):
            auth.validate_access(cname, self.session_get('user'))
        if not cn:
            cn = settings.get_default_corpus(test_fn)
            redirect = True
        return cn, redirect

    @property
    def corp_encoding(self) -> str:
        enc = corpus_get_conf(self.corp, 'ENCODING')
        return enc if enc else 'iso-8859-1'

    def handle_dispatch_error(self, ex: Exception):
        if isinstance(self.corp, fallback_corpus.ErrorCorpus):
            self._status = 404
            self.add_system_message('error', 'Failed to open corpus {0}'.format(
                getattr(self.args, 'corpname')))
        else:
            self._status = 500

    @property
    def corp(self) -> Union[Corpus, fallback_corpus.ErrorCorpus, fallback_corpus.EmptyCorpus]:
        """
        Contains the current corpus. The property always contains a corpus-like object
        (even in case of an error). Possible values:

        1. a manatee.Corpus instance in case everything is OK (corpus is known, object is initialized
        without errors)
        2. an ErrorCorpus instance in case an exception occurred
        3. an Empty corpus instance in case the action does not need one (but KonText's internals do).

        This should be always preferred over accessing _curr_corpus attribute.

        """
        if getattr(self.args, 'corpname'):
            try:
                if not self._curr_corpus or self.args.usesubcorp and not hasattr(self._curr_corpus, 'subcname'):
                    self._curr_corpus = self.cm.get_Corpus(self.args.corpname, subcname=self.args.usesubcorp,
                                                           corp_variant=self._corpus_variant)
                self._curr_corpus._conc_dir = self._conc_dir
                return self._curr_corpus
            except Exception as ex:
                return fallback_corpus.ErrorCorpus(ex)
        else:
            return fallback_corpus.EmptyCorpus()

    @property
    def tt(self) -> TextTypes:
        """
        Provides access to text types of the current corpus
        """
        return self._tt if self._tt is not None else TextTypes(
            self.corp, self.corp.corpname, self._tt_cache, self._plugin_api)

    def permitted_corpora(self) -> Dict[str, str]:
        """
        Returns corpora identifiers accessible by the current user.

        returns:
        a dict (corpus_id, corpus_variant)
        """
        return getattr(plugins.runtime.AUTH.instance, 'permitted_corpora')(self.session_get('user'))

    def _add_corpus_related_globals(self, result, maincorp):
        """
        arguments:
        result -- template data dict
        maincorp -- currently focused corpus; please note that in case of aligned
                    corpora this can be a different one than self.corp
                    (or self.args.corpname) represents.
        """
        result['corpname'] = getattr(self.args, 'corpname')
        result['align'] = getattr(self.args, 'align')
        result['human_corpname'] = self._human_readable_corpname()

        result['corp_description'] = maincorp.get_info()
        result['corp_size'] = self.corp.size()

        if hasattr(self.corp, 'subcname'):
            setattr(self.args, 'usesubcorp', self.corp.subcname)

        usesubcorp = getattr(self.args, 'usesubcorp') if getattr(self.args, 'usesubcorp') else None
        result['corpus_ident'] = dict(
            id=getattr(self.args, 'corpname'),
            variant=self._corpus_variant,
            name=self._human_readable_corpname(),
            usesubcorp=usesubcorp,
            origSubcorpName=getattr(self.corp, 'orig_subcname', usesubcorp),
            foreignSubcorp=self.corp.author_id is not None and self.session_get('user', 'id') != self.corp.author_id)

        if getattr(self.args, 'usesubcorp'):
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
            result[listname] = [{
                'label': corpus_get_conf(maincorp, n + '.LABEL') or n,
                'n': n,
                **({'multisep': corpus_get_conf(maincorp, n + '.MULTISEP')} if listname == 'AttrList' else {})
            } for n in corpus_get_conf(maincorp, listname.upper()).split(',') if n]
        result['StructList'] = corpus_get_conf(self.corp, 'STRUCTLIST').split(',')

        if corpus_get_conf(maincorp, 'FREQTTATTRS'):
            ttcrit_attrs = corpus_get_conf(maincorp, 'FREQTTATTRS')
        else:
            ttcrit_attrs = corpus_get_conf(maincorp, 'SUBCORPATTRS')
        result['ttcrit'] = [('fcrit', '%s 0' % a)
                            for a in ttcrit_attrs.replace('|', ',').split(',') if a]
        result['corp_uses_tag'] = 'tag' in corpus_get_conf(
            maincorp, 'ATTRLIST').split(',')  # legacy value
        result['interval_chars'] = (
            settings.get('corpora', 'left_interval_char', None),
            settings.get('corpora', 'interval_char', None),
            settings.get('corpora', 'right_interval_char', None),
        )
        result['righttoleft'] = True if self.corp.get_conf('RIGHTTOLEFT') else False
        corp_info = self.get_corpus_info(getattr(self.args, 'corpname'))
        result['bib_conf'] = corp_info.metadata
        result['simple_query_default_attrs'] = corp_info.simple_query_default_attrs

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
                            opt_plugin.is_enabled_for(self._plugin_api, getattr(self.args, 'corpname'))):
                        result['active_plugins'].append(opt_plugin.name)
        result['plugin_js'] = ans

    def _get_mapped_attrs(self, attr_names: Iterable[str], force_values: Optional[Dict] = None) -> List[Tuple[str, str]]:
        """
        Returns required attributes (= passed attr_names) and their respective values found
        in 'self.args'. Only attributes initiated via class attributes and the Parameter class
        are considered valid.
        """
        if force_values is None:
            force_values = {}

        def is_valid(name, value):
            return hasattr(self.args, name) and value != ''

        def get_val(k):
            return force_values[k] if k in force_values else getattr(self.args, k, None)

        ans = []
        for attr in attr_names:
            v_tmp = get_val(attr)
            if not is_valid(attr, v_tmp):
                continue
            if type(v_tmp) in (str, float, int, bool) or v_tmp is None:
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
            logo_href = str(settings.get('theme', 'logo_href'))
        else:
            logo_href = self.get_root_url()

        if theme_name == 'default':
            logo_title = translate('Click to enter a new query')
        else:
            logo_title = str(logo_href)

        theme_favicon = settings.get('theme', 'favicon', None)
        theme_favicon_type = settings.get('theme', 'favicon_type', None)
        if (theme_favicon and not (theme_favicon.startswith('/') or theme_favicon.startswith('http://') or
                                   theme_favicon.startswith('https://'))):
            theme_favicon = '{0}/themes/{1}/{2}'.format(self._files_path, theme_name, theme_favicon)

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
            favicon=theme_favicon,
            favicon_type=theme_favicon_type
        )

    def _configure_auth_urls(self, out):
        with plugins.runtime.AUTH as auth:
            if plugins.runtime.AUTH.exists and isinstance(auth, AbstractInternalAuth):
                out['login_url'] = auth.get_login_url(self.return_url)
                out['logout_url'] = auth.get_logout_url(self.get_root_url())
            else:
                out['login_url'] = None
                out['logout_url'] = None

    def _attach_plugin_exports(self, result, direct):
        """
        Method exports plug-ins' specific data for their respective client parts.
        KonText core does not care about particular formats - it just passes JSON-encoded
        data to the client.
        """
        key = 'pluginData' if direct else 'plugin_data'
        result[key] = {}
        for plg in plugins.runtime:
            if hasattr(plg.instance, 'export'):
                result[key][plg.name] = plg.instance.export(self._plugin_api)

    def add_globals(self, result, methodname, action_metadata):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts.
        Please note that self.args mapping is not exported here even though some of the values
        from self.args are used here in specific ways.
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

        if getattr(self.args, 'maincorp'):
            thecorp = corplib.open_corpus(getattr(self.args, 'maincorp'))
        else:
            thecorp = self.corp
        if not action_metadata['skip_corpus_init']:
            self._add_corpus_related_globals(result, thecorp)
            result['uses_corp_instance'] = True
        else:
            result['uses_corp_instance'] = False

        result['supports_password_change'] = self._uses_internal_user_pages()
        result['undo_q'] = self.urlencode([('q', q) for q in getattr(self.args, 'q')[:-1]])
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

        # available languages; used just by UI language switch
        if plugins.runtime.GETLANG.exists:
            result['avail_languages'] = ()  # getlang plug-in provides customized switch
        else:
            result['avail_languages'] = settings.get_full('global', 'translations')

        result['uiLang'] = self.ui_lang.replace('_', '-') if self.ui_lang else 'en-US'
        day_map = {0: 'mo', 1: 'tu', 2: 'we', 3: 'th', 4: 'fr', 5: 'sa', 6: 'su'}
        result['first_day_of_week'] = day_map[
            babel.Locale(self.ui_lang if self.ui_lang else 'en_US').first_week_day
        ]

        # util functions
        result['to_str'] = lambda s: str(s) if s is not None else ''
        # the output of 'to_json' is actually only json-like (see the function val_to_js)

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

        self._attach_plugin_exports(result, direct=False)

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
        elif getattr(self.args, 'corpname'):
            return getattr(self.args, 'corpname')
        else:
            return ''

    def _get_struct_opts(self) -> str:
        """
        Returns structures and structural attributes the current concordance should display.
        Note: current solution is little bit confusing - there are two overlapping parameters
        here: structs & structattrs where the former is the one used in URL and the latter
        stores user's persistent settings (but can be also passed via URL with some limitations).
        """
        return ','.join(x for x in (getattr(self.args, 'structs'), ','.join(getattr(self.args, 'structattrs'))) if x)

    @staticmethod
    def _parse_sorting_param(k):
        if k[0] == '-':
            revers = True
            k = k[1:]
        else:
            revers = False
        return k, revers

    def _get_tt_bib_mapping(self, tt_data):
        bib_mapping = {}
        if plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(self._plugin_api, getattr(self.args, 'corpname')):
            corpus_info = plugins.runtime.CORPARCH.instance.get_corpus_info(
                self.ui_lang, getattr(self.args, 'corpname'))
            id_attr = corpus_info.metadata.id_attr
            if id_attr in tt_data:
                bib_mapping = dict(
                    plugins.runtime.LIVE_ATTRIBUTES.instance.find_bib_titles(
                        self._plugin_api, getattr(self.args, 'corpname'), tt_data[id_attr]))
        return bib_mapping

    def _export_subcorpora_list(self, corpname: str, curr_subcorp: str, out: Dict[str, Any]):
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
                srch = next((x for x in subcorp_list if x['pub'] == self.corp.subcname))
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

    def get_async_tasks(self, category: Optional[str] = None) -> List[AsyncTaskStatus]:
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
            return [item for item in ans if item.category == category]
        else:
            return ans

    def _set_async_tasks(self, task_list: Iterable[AsyncTaskStatus]):
        self._session['async_tasks'] = [at.to_dict() for at in task_list]

    def _store_async_task(self, async_task_status):
        at_list = self.get_async_tasks()
        at_list.append(async_task_status)
        self._set_async_tasks(at_list)

    @exposed(return_type='json')
    def concdesc_json(self, _: Optional[Request] = None) -> Dict[str, List[Dict[str, Any]]]:
        out_list: List[Dict[str, Any]] = []
        conc_desc = conclib.get_conc_desc(corpus=self.corp, q=getattr(self.args, 'q'),
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
            u2.append(('corpname', getattr(self.args, 'corpname')))
            if getattr(self.args, 'usesubcorp'):
                u2.append(('usesubcorp', getattr(self.args, 'usesubcorp')))
            out_list.append(dict(
                op=o,
                opid=opid,
                arg=a,
                nicearg=nicearg(a),
                tourl=self.urlencode(u2),
                size=s))
        return {'Desc': out_list}

    @exposed(return_type='json', skip_corpus_init=True)
    def check_tasks_status(self, request: Request) -> Dict[str, Any]:
        backend = settings.get('calc_backend', 'type')
        now = time.time()
        if backend in ('celery', 'konserver', 'rq'):
            import bgcalc
            app = bgcalc.calc_backend_client(settings)
            at_list = self.get_async_tasks()
            upd_list = []
            for at in at_list:
                r = app.AsyncResult(at.ident)
                if r:
                    at.status = r.status
                    if at.status == 'FAILURE':
                        if hasattr(r.result, 'message'):
                            at.error = r.result.message
                        else:
                            at.error = str(r.result)
                else:
                    at.status = 'FAILURE'
                    at.error = 'job not found'
                if now - at.created < 1800:
                    upd_list.append(at)
            self._set_async_tasks(upd_list)
            return dict(data=[d.to_dict() for d in upd_list])
        else:
            return dict(data=[])  # other backends are not supported

    @exposed(return_type='json', skip_corpus_init=True, http_method='DELETE')
    def remove_task_info(self, request: Request) -> Dict[str, Any]:
        task_ids = request.form.getlist('tasks')
        self._set_async_tasks([x for x in self.get_async_tasks() if x.ident not in task_ids])
        return self.check_tasks_status(request)

    @exposed(accept_kwargs=True, skip_corpus_init=True, page_model='message', template='message.html')
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

    @exposed(accept_kwargs=True, func_arg_mapped=True, skip_corpus_init=True, return_type='json')
    def message_json(self, *args, **kwargs):
        return self.message(*args, **kwargs)

    @exposed(accept_kwargs=True, func_arg_mapped=True, skip_corpus_init=True, return_type='xml')
    def message_xml(self, *args, **kwargs):
        return self.message(*args, **kwargs)

    @exposed(skip_corpus_init=True, template='compatibility.html')
    def compatibility(self, req):
        return {}
