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

from typing import Any, Optional, TypeVar, Dict, List, Iterator, Tuple, Union, Iterable, Callable
from corplib.abstract import AbstractKCorpus
from main_menu import AbstractMenuItem
from argmapping.conc.query import ConcFormArgs
from werkzeug import Request
import werkzeug.urls
from werkzeug.datastructures import MultiDict
from functools import partial
from dataclasses import fields

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
                     ImmediateRedirectException, FunctionNotSupported)
import plugins
from plugins.abstract.corparch.corpus import BrokenCorpusInfo, CorpusInfo
from plugins.abstract.auth import AbstractInternalAuth
import settings
import l10n
from translation import ugettext as translate
import scheduled
from corplib.fallback import ErrorCorpus, EmptyCorpus
from corplib.corpus import KCorpus
from argmapping import ConcArgsMapping, Args
from main_menu import MainMenu, MenuGenerator, EventTriggeringItem
from .plg import PluginCtx
from templating import DummyGlobals
from .req_args import RequestArgsProxy, JSONRequestArgsProxy
from texttypes import TextTypes, TextTypesCache
import bgcalc
from bgcalc import AsyncTaskStatus


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
                           MainMenu.COLLOCATIONS, MainMenu.VIEW('kwic-sent-switch'),
                           MainMenu.CORPORA('create-subcorpus'))

    GENERAL_OPTIONS = ('pagesize', 'kwicleftctx', 'kwicrightctx', 'multiple_copy', 'ctxunit',
                       'shuffle', 'citemsperpage', 'pqueryitemsperpage', 'fmaxitems', 'wlpagesize', 'line_numbers',
                       'rich_query_editor')

    LOCAL_COLL_OPTIONS = ('cattr', 'cfromw', 'ctow', 'cminfreq', 'cminbgr', 'cbgrfns', 'csortfn')

    BASE_ATTR: str = 'word'  # TODO this value is actually hardcoded throughout the code

    # a user settings key entry used to access user's scheduled actions
    SCHEDULED_ACTIONS_KEY = '_scheduled'

    def __init__(self, request: Request, ui_lang: str, tt_cache: TextTypesCache) -> None:
        super().__init__(request=request, ui_lang=ui_lang)
        # Note: always use _corp() method to access current corpus even from inside the class
        self._curr_corpus: Optional[KCorpus] = None
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

        self._plugin_ctx: PluginCtx = PluginCtx(self, self._request, self._cookies)

        # query_persistence plugin related attributes
        self._q_code: Optional[str] = None  # a key to 'code->query' database

        # data of the previous operation are stored here
        self._prev_q_data: Optional[Dict[str, Any]] = None

        self._auto_generated_conc_ops: List[Tuple[int, ConcFormArgs]] = []

        self.on_conc_store: Callable[[List[str], bool, Any], None] = lambda s, uh, res: None

        self._tt_cache = tt_cache
        self._tt = None  # this will be instantiated lazily

    def get_corpus_info(self, corp: str) -> CorpusInfo:
        with plugins.runtime.CORPARCH as plg:
            return plg.get_corpus_info(self._plugin_ctx, corp)

    def get_mapping_url_prefix(self) -> str:
        return super().get_mapping_url_prefix()

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
        """
        Return currently active corpora

        note: the name is a bit confusing considering how 'align(ed)' is used elsewhere
        here we mean: all the aligned corpora including the primary one
        """
        return [getattr(self.args, 'corpname')] + getattr(self.args, 'align')

    def get_available_aligned_corpora(self) -> List[str]:
        """
        note: the name is a bit confusing considering how 'align(ed)' is used elsewhere
        here we mean: all the aligned corpora including the primary one
        """
        return [getattr(self.args, 'corpname')] + [c for c in self.corp.get_conf('ALIGNED').split(',') if len(c) > 0]

    def _load_general_settings(self) -> Dict[str, Any]:
        """
        """
        if self._user_has_persistent_settings():
            with plugins.runtime.SETTINGS_STORAGE as settings_plg:
                return settings_plg.load(self.session_get('user', 'id'))
        else:
            data = self.session_get('settings')
            if not data:
                data = {}
            return data

    def _load_corpus_settings(self, corpus_id):
        """
        """
        if self._user_has_persistent_settings():
            with plugins.runtime.SETTINGS_STORAGE as settings_plg:
                data = settings_plg.load(self.session_get('user', 'id'), corpus_id)
        else:
            data = self.session_get('corpus_settings')
        if not data:
            data = {}
        return data

    @staticmethod
    def _get_save_excluded_attributes() -> Tuple[str, ...]:
        return 'corpname', Kontext.SCHEDULED_ACTIONS_KEY

    def _save_options(self, optlist: Optional[Iterable] = None, corpus_id: Union[str, None] = None):
        """
        Saves user's options to a storage

        Arguments:
        optlist -- a list of options/arguments to be saved
        corpus_id --
        """
        if optlist is None:
            optlist = []
        tosave = [(att.name, getattr(self.args, att.name))
                  for att in fields(Args) if att.name in optlist]

        def merge_incoming_opts_to(opts):
            if opts is None:
                opts = {}
            excluded_attrs = self._get_save_excluded_attributes()
            for attr, val in tosave:
                if attr not in excluded_attrs:
                    opts[attr] = val

        # data must be loaded (again) because in-memory settings are
        # in general a subset of the ones stored in db (and we want
        # to store (again) even values not used in this particular request)
        with plugins.runtime.SETTINGS_STORAGE as settings_storage:
            if self._user_has_persistent_settings():
                if corpus_id:
                    options = settings_storage.load(self.session_get('user', 'id'), corpus_id)
                    merge_incoming_opts_to(options)
                    settings_storage.save(self.session_get('user', 'id'), corpus_id, options)
                else:
                    options = settings_storage.load(self.session_get('user', 'id'))
                    merge_incoming_opts_to(options)
                    settings_storage.save(self.session_get('user', 'id'), None, options)
            else:
                options = {}
                sess_options = self.session_get('settings')
                if sess_options:
                    options.update(sess_options)
                merge_incoming_opts_to(options)
                self._session['settings'] = options

    def _restore_prev_query_params(self, form):
        """
        Restores previously stored concordance/pquery/wordlist query data using an ID found in request arg 'q'.
        To even begin the search, two conditions must be met:
        1. query_persistence plugin is installed
        2. request arg 'q' contains a string recognized as a valid ID of a stored concordance query
           at the position 0 (other positions may contain additional regular query operations
           (shuffle, filter,...)

        Restored values will be stored in 'form' instance as forced ones preventing 'form'
        from returning its original values (no matter what is there).

        In case the query_persistence is installed and invalid ID is encountered
        UserActionException will be raised.

        arguments:
            form -- RequestArgsProxy
        """
        url_q = form.getlist('q')[:]
        with plugins.runtime.QUERY_PERSISTENCE as query_persistence:
            if len(url_q) > 0 and query_persistence.is_valid_id(url_q[0]):
                self._q_code = url_q[0][1:]
                self._prev_q_data = query_persistence.open(self._q_code)
                # !!! must create a copy here otherwise _q_data (as prev query)
                # will be rewritten by self.args.q !!!
                if self._prev_q_data is not None:
                    form.add_forced_arg('q', *(self._prev_q_data.get('q', [])[:] + url_q[1:]))
                    corpora = self._prev_q_data.get('corpora', [])
                    if len(corpora) > 0:
                        orig_corpora = form.add_forced_arg('corpname', corpora[0])
                        if len(orig_corpora) > 0 and orig_corpora[0] != corpora[0]:
                            raise UserActionException(translate(
                                f'URL argument corpname={orig_corpora[0]} collides with corpus '
                                f'{corpora[0]} stored as part of original concordance'))
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

    def export_query_data(self) -> Tuple[bool, Dict[str, Any]]:
        """
        Export query data for query_persistence

        Return a 2-tuple with the following elements
            1) a flag specifying whether the query should be stored to user query history
               (please note that query history != stored/persistent query; query history is just a personal
               list of recent queries)
            2) values to be stored as a representation of user's query (here we mean all the data needed
               to reach the current result page including data needed to restore involved query forms).
        """
        if len(self._auto_generated_conc_ops) > 0:
            q_limit = self._auto_generated_conc_ops[0][0]
        else:
            q_limit = len(self.args.q)
        return (
            False,
            dict(
                # we don't want to store all the items from self.args.q in case auto generated
                # operations are present (we will store them individually later).
                user_id=self.session_get('user', 'id'),
                q=self.args.q[:q_limit],
                corpora=self.get_current_aligned_corpora(),
                usesubcorp=getattr(self.args, 'usesubcorp'),
                lines_groups=self._lines_groups.serialize()
            )
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
            with plugins.runtime.QUERY_HISTORY as qh:
                qh.store(user_id=self.session_get('user', 'id'),
                         query_id=query_id, q_supertype='conc')

    def _clear_prev_conc_params(self):
        self._prev_q_data = None

    def _get_curr_conc_args(self):
        args = self._get_mapped_attrs(ConcArgsMapping)
        if self._q_code:
            args.append(('q', f'~{self._q_code}'))
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
                            logging.getLogger('SCHEDULING').error('task_id: {}, error: {} ({})'.format(
                                action.get('id', '??'), e.__class__.__name__, e))
                # avoided by 'continue' in case everything is OK
                logging.getLogger('SCHEDULING').error('task_id: {}, Failed to invoke scheduled action: {}'.format(
                    action.get('id', '??'), action,))
            self._save_options()  # this causes scheduled task to be removed from settings

    def _check_corpus_access(self, action_name, form, action_metadata) -> Tuple[Union[str, None], str]:
        """
        Args:
            action_name:
            form:
            action_metadata:

        Returns: a 2-tuple (corpus id, corpus variant)
        """
        with plugins.runtime.AUTH as auth:
            if not action_metadata['skip_corpus_init']:
                is_api = action_metadata['return_type'] == 'json' or form.getvalue(
                    'format') == 'json'
                corpname, redirect = self._determine_curr_corpus(form, is_api)
                has_access, variant = auth.validate_access(corpname, self.session_get('user'))
                if has_access and redirect:
                    url_pref = self.get_mapping_url_prefix()
                    if len(url_pref) > 0:
                        url_pref = url_pref[1:]
                    raise ImmediateRedirectException(self.create_url(
                        url_pref + action_name, dict(corpname=corpname)))
                elif not has_access:
                    auth.on_forbidden_corpus(self._plugin_ctx, corpname, variant)
                for al_corp in form.getlist('align'):
                    al_access, al_variant = auth.validate_access(al_corp, self.session_get('user'))
                    # we cannot accept aligned corpora without access right
                    # or with different variant (from implementation reasons in this case)
                    # than the main corpus has
                    if not al_access or al_variant != variant:
                        raise AlignedCorpusForbiddenException(al_corp, al_variant)
            else:
                corpname = None
                variant = ''
            return corpname, variant

    def pre_dispatch(self, action_name, action_metadata=None) -> Union[RequestArgsProxy, JSONRequestArgsProxy]:
        """
        Runs before main action is processed. The action includes
        mapping of URL/form parameters to self.args, loading user
        options, validating corpus access rights, scheduled actions.

        It is OK to override this method but the super().pre_dispatch()
        should be always called before performing custom actions.
        It is also OK to raise UserActionException types if necessary.
        """
        req_args = super().pre_dispatch(action_name, action_metadata)

        with plugins.runtime.DISPATCH_HOOK as dhook:
            dhook.pre_dispatch(self._plugin_ctx, action_name, action_metadata, self._request)

        def validate_corpus():
            if isinstance(self.corp, ErrorCorpus):
                return self.corp.get_error()
            info = self.get_corpus_info(getattr(self.args, 'corpname'))
            if isinstance(info, BrokenCorpusInfo):
                return NotFoundException(translate('Corpus \"{0}\" not available'.format(info.name)),
                                         internal_message='Failed to fetch configuration for {0}'.format(info.name))
            return None
        if not action_metadata['skip_corpus_init']:
            self.add_validator(validate_corpus)

        options = {}
        self._scheduled_actions(options)

        # only general setting can be applied now because
        # we do not know final corpus name yet
        self._init_default_settings(options)

        try:
            options.update(self._load_general_settings())
            self.args.map_args_to_attrs(options)

            self._setup_user_paths()
            self.cm = corplib.CorpusManager(self.subcpath)

            self._restore_prev_query_params(req_args)
            # corpus access check and modify path in case user cannot access currently requested corp.
            corpname, self._corpus_variant = self._check_corpus_access(
                action_name, req_args, action_metadata)

            # now we can apply also corpus-dependent settings
            # because the corpus name is already known
            if corpname is None:
                # make sure no unwanted corpname arg is used
                req_args.set_forced_arg('corpname', '')
            else:
                corpus_options = {}
                corpus_options.update(self.get_corpus_info(corpname).default_view_opts)
                corpus_options.update(self._load_corpus_settings(corpname))
                self.args.map_args_to_attrs(corpus_options)
                req_args.set_forced_arg('corpname', corpname)

            # always prefer corpname returned by _check_corpus_access()
            # TODO we should reflect align here if corpus has changed

            # now we apply args from URL (highest priority)
            self.args.map_args_to_attrs(req_args)
        except ValueError as ex:
            raise UserActionException(ex)

        # return url (for 3rd party pages etc.)
        args = {}
        if getattr(self.args, 'corpname'):
            args['corpname'] = getattr(self.args, 'corpname')
        if self.get_http_method() == 'GET':
            self.return_url = self.updated_current_url(args)
        else:
            self.return_url = '{}query?{}'.format(self.get_root_url(),
                                                  '&'.join([f'{k}={v}' for k, v in list(args.items())]))
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

        with plugins.runtime.ACTION_LOG as alog:
            alog.log_action(
                self._request, self.args, action_metadata.get('action_log_mapper'),
                f'{self.get_mapping_url_prefix()[1:]}{methodname}',
                err_desc=err_desc, proc_time=self._proc_time)
        with plugins.runtime.DISPATCH_HOOK as dhook:
            dhook.post_dispatch(self._plugin_ctx, methodname, action_metadata)

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

    def _determine_curr_corpus(self, form: RequestArgsProxy, is_api: bool):
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
        if is_api and len(form.corpora) == 0:
            raise UserActionException('No corpus specified')
        if len(form.corpora) > 0:
            cn = form.corpora[0]
        elif not self.user_is_anonymous():
            with plugins.runtime.QUERY_HISTORY as qh:
                queries = qh.get_user_queries(self.session_get('user', 'id'), self.cm, limit=1)
                if len(queries) > 0:
                    cn = queries[0].get('corpname', '')
                    redirect = True

        # fallback option: if no current corpus is set then we try previous user's corpus
        # and if no such exists then we try default one as configured in settings.xml
        def test_fn(auth_plg, cname):
            return auth_plg.validate_access(cname, self.session_get('user'))

        if not cn:
            with plugins.runtime.AUTH as auth:
                cn = settings.get_default_corpus(partial(test_fn, auth))
                redirect = True
        return cn, redirect

    @property
    def corp_encoding(self) -> str:
        enc = self.corp.get_conf('ENCODING')
        return enc if enc else 'iso-8859-1'

    def handle_dispatch_error(self, ex: Exception):
        if isinstance(self.corp, ErrorCorpus):
            self._status = 404
            self.add_system_message('error', 'Failed to open corpus {0}'.format(
                getattr(self.args, 'corpname')))
        else:
            self._status = 500

    @property
    def corp(self) -> AbstractKCorpus:
        """
        Contains the current corpus. The property always contains a corpus-like object
        (even in case of an error). Possible values:

        1. a KCorpus (or KSubcorpus) instance in case everything is OK (corpus is known, object is initialized
        without errors)
        2. an ErrorCorpus instance in case an exception occurred
        3. an Empty corpus instance in case the action does not need one (but KonText's internals do).

        This should be always preferred over accessing _curr_corpus attribute.

        """
        if self.args.corpname:
            try:
                if not self._curr_corpus or self.args.usesubcorp and not self._curr_corpus.is_subcorpus:
                    self._curr_corpus = self.cm.get_corpus(self.args.corpname, subcname=self.args.usesubcorp,
                                                           corp_variant=self._corpus_variant)
                self._curr_corpus._conc_dir = self._conc_dir
                return self._curr_corpus
            except Exception as ex:
                return ErrorCorpus(ex)
        else:
            return EmptyCorpus()

    @property
    def tt(self) -> TextTypes:
        """
        Provides access to text types of the current corpus
        """
        return self._tt if self._tt is not None else TextTypes(
            self.corp, self.corp.corpname, self._tt_cache, self._plugin_ctx)

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
        result['corp_size'] = self.corp.size

        if self.corp.is_subcorpus:
            self.args.usesubcorp = self.corp.subcname

        result['corpus_ident'] = dict(
            id=getattr(self.args, 'corpname'),
            variant=self._corpus_variant,
            name=self._human_readable_corpname(),
            usesubcorp=self.args.usesubcorp,
            origSubcorpName=self.corp.orig_subcname,
            foreignSubcorp=self.corp.author_id is not None and self.session_get('user', 'id') != self.corp.author_id)
        if self.corp.is_subcorpus:
            result['subcorp_size'] = self.corp.search_size
        else:
            result['subcorp_size'] = None
        sref = maincorp.get_conf('SHORTREF')
        result['fcrit_shortref'] = '+'.join([a.strip('=') + ' 0'
                                             for a in sref.split(',')])
        result['default_attr'] = maincorp.get_conf('DEFAULTATTR')
        for listname in ['AttrList', 'StructAttrList']:
            if listname in result:
                continue
            result[listname] = [{
                'label': maincorp.get_conf(f'{n}.LABEL') or n,
                'n': n,
                **({'multisep': maincorp.get_conf(f'{n}.MULTISEP')} if listname == 'AttrList' else {})
            } for n in maincorp.get_conf(listname.upper()).split(',') if n]
        result['StructList'] = self.corp.get_structs()

        if maincorp.get_conf('FREQTTATTRS'):
            ttcrit_attrs = maincorp.get_conf('FREQTTATTRS')
        else:
            ttcrit_attrs = maincorp.get_conf('SUBCORPATTRS')
        result['ttcrit'] = [('fcrit', f'{a} 0')
                            for a in ttcrit_attrs.replace('|', ',').split(',') if a]
        result['interval_chars'] = (
            settings.get('corpora', 'left_interval_char', None),
            settings.get('corpora', 'interval_char', None),
            settings.get('corpora', 'right_interval_char', None),
        )
        result['righttoleft'] = True if self.corp.get_conf('RIGHTTOLEFT') else False
        corp_info = self.get_corpus_info(getattr(self.args, 'corpname'))
        result['bib_conf'] = corp_info.metadata
        result['simple_query_default_attrs'] = corp_info.simple_query_default_attrs

        poslist = []
        for tagset in corp_info.tagsets:
            if tagset.ident == corp_info.default_tagset:
                poslist = tagset.pos_category
                break
        result['Wposlist'] = [{'n': x.pos, 'v': x.pattern} for x in poslist]

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
                            opt_plugin.is_enabled_for(self._plugin_ctx, self.args.corpname)):
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
                result[key][plg.name] = plg.instance.export(self._plugin_ctx)

    def add_globals(self, request, result, methodname, action_metadata):
        """
        Fills-in the 'result' parameter (dict or compatible type expected) with parameters need to render
        HTML templates properly.
        It is called after an action is processed but before any output starts.
        Please note that self.args mapping is not exported here even though some of the values
        from self.args are used here in specific ways.
        """
        super().add_globals(request, result, methodname, action_metadata)
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
            thecorp = self.cm.get_corpus(self.args.maincorp)
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
            result['app_bar'] = application_bar.get_contents(plugin_ctx=self._plugin_ctx,
                                                             return_url=self.return_url)
            result['app_bar_css'] = application_bar.get_styles(plugin_ctx=self._plugin_ctx)
            result['app_bar_js'] = application_bar.get_scripts(plugin_ctx=self._plugin_ctx)
        else:
            result['app_bar'] = None
            result['app_bar_css'] = []
            result['app_bar_js'] = []

        result['footer_bar'] = None
        result['footer_bar_css'] = None
        with plugins.runtime.FOOTER_BAR as fb:
            result['footer_bar'] = fb.get_contents(self._plugin_ctx, self.return_url)
            result['footer_bar_css'] = fb.get_css_url()

        self._apply_theme(result)

        # updates result dict with javascript modules paths required by some of the optional plugins
        self._setup_optional_plugins_js(result)

        avail_languages = settings.get_full('global', 'translations')
        ui_lang = self.ui_lang.replace('_', '-') if self.ui_lang else 'en-US'
        # available languages; used just by UI language switch
        result['avail_languages'] = avail_languages
        result['uiLang'] = ui_lang
        with plugins.runtime.GETLANG as gl:
            result['lang_switch_ui'] = gl.allow_default_lang_switch_ui()
        result['is_local_ui_lang'] = any(settings.import_bool(meta.get('local', '0'))
                                         for code, meta in avail_languages if code == ui_lang)

        day_map = {0: 'mo', 1: 'tu', 2: 'we', 3: 'th', 4: 'fr', 5: 'sa', 6: 'su'}
        result['first_day_of_week'] = day_map[
            babel.Locale(self.ui_lang if self.ui_lang else 'en_US').first_week_day
        ]

        # util functions
        result['to_str'] = lambda s: str(s) if s is not None else ''
        # the output of 'to_json' is actually only json-like (see the function val_to_js)

        with plugins.runtime.ISSUE_REPORTING as irp:
            result['issue_reporting_action'] = irp.export_report_action(
                self._plugin_ctx).to_dict() if irp else None
        page_model = action_metadata['page_model'] if action_metadata['page_model'] else l10n.camelize(
            methodname)
        result['page_model'] = page_model
        result['has_subcmixer'] = plugins.runtime.SUBCMIXER.exists
        result['can_send_mail'] = bool(settings.get('mailing'))
        result['use_conc_toolbar'] = settings.get_bool('global', 'use_conc_toolbar')
        result['conc_url_ttl_days'] = plugins.runtime.QUERY_PERSISTENCE.instance.get_conc_ttl_days(
            self.session_get('user', 'id'))

        self._attach_plugin_exports(result, direct=False)

        result['explicit_conc_persistence_ui'] = settings.get_bool(
            'global', 'explicit_conc_persistence_ui', False)

        # main menu
        menu_items = MenuGenerator(result, self.args, self._plugin_ctx).generate(
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
        result['job_status_service_url'] = os.environ.get(
            'STATUS_SERVICE_URL', settings.get('calc_backend', 'status_service_url', None))
        return result

    def _human_readable_corpname(self):
        """
        Returns an user-readable name of the current corpus (i.e. it cannot be used
        to identify the corpus in KonText's code as it is only intended to be printed
        somewhere on a page).
        """
        if self.corp.get_conf('NAME'):
            return self.corp.get_conf('NAME')
        elif self.args.corpname:
            return self.args.corpname
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
        if plugins.runtime.LIVE_ATTRIBUTES.is_enabled_for(self._plugin_ctx, self.args.corpname):
            corpus_info = plugins.runtime.CORPARCH.instance.get_corpus_info(
                self._plugin_ctx, self.args.corpname)
            id_attr = corpus_info.metadata.id_attr
            if id_attr in tt_data:
                bib_mapping = dict(
                    plugins.runtime.LIVE_ATTRIBUTES.instance.find_bib_titles(
                        self._plugin_ctx, getattr(self.args, 'corpname'), tt_data[id_attr]))
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
        subcorp_list = l10n.sort(self.user_subc_names(corpname),
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
            subcorp_list = [
                {'n': '--{}--'.format(translate('whole corpus')), 'v': ''}] + subcorp_list

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

    def _store_async_task(self, async_task_status) -> List[AsyncTaskStatus]:
        at_list = [t for t in self.get_async_tasks() if t.status != 'FAILURE']
        self._mark_timeouted_tasks(*at_list)
        at_list.append(async_task_status)
        self._set_async_tasks(at_list)
        return at_list

    def _store_last_search(self, op_type: str, conc_id: str):
        """
        Store last search operation ID. This is used when
        a new form of the same search type is opened and
        we need some relevant defaults.

        possible types: pquery, conc, wlist
        """
        curr = self._session.get('last_search', {})
        curr[op_type] = conc_id
        self._session['last_search'] = curr

    def _load_last_search(self, op_type: str):
        """
        See _store_last_search for more info.

        possible op. types: pquery, conc, wlist
        """
        curr = self._session.get('last_search', {})
        return curr.get(op_type, None)

    @exposed(return_type='json')
    def concdesc_json(self, _: Optional[Request] = None) -> Dict[str, List[Dict[str, Any]]]:
        out_list: List[Dict[str, Any]] = []
        conc_desc = conclib.get_conc_desc(corpus=self.corp, q=getattr(self.args, 'q'))

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

    def _mark_timeouted_tasks(self, *tasks):
        now = time.time()
        task_limit = settings.get_int('calc_backend', 'task_time_limit')
        for at in tasks:
            if (at.status == 'PENDING' or at.status == 'STARTED') and now - at.created > task_limit:
                at.status = 'FAILURE'
                if not at.error:
                    at.error = 'task time limit exceeded'

    @exposed(return_type='json', skip_corpus_init=True)
    def check_tasks_status(self, request: Request) -> Dict[str, Any]:
        backend = settings.get('calc_backend', 'type')
        if backend in ('celery', 'rq'):
            worker = bgcalc.calc_backend_client(settings)
            at_list = self.get_async_tasks()
            upd_list = []
            for at in at_list:
                r = worker.AsyncResult(at.ident)
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
                upd_list.append(at)
            self._mark_timeouted_tasks(*upd_list)
            self._set_async_tasks(upd_list)
            return dict(data=[d.to_dict() for d in upd_list])
        else:
            raise FunctionNotSupported(f'Backend {backend} does not support status checking')

    @exposed(return_type='json', skip_corpus_init=True)
    def get_task_result(self, request):
        worker = bgcalc.calc_backend_client(settings)
        result = worker.AsyncResult(request.args.get('task_id'))
        return dict(result=result.get())

    @exposed(return_type='json', skip_corpus_init=True, http_method='DELETE')
    def remove_task_info(self, request: Request) -> Dict[str, Any]:
        task_ids = request.form.getlist('tasks')
        self._set_async_tasks([x for x in self.get_async_tasks() if x.ident not in task_ids])
        return self.check_tasks_status(request)

    @exposed(accept_kwargs=True, skip_corpus_init=True, page_model='message', template='message.html')
    def message(self, *args, **kwargs):
        kwargs['last_used_corp'] = dict(corpname=None, human_corpname=None)
        if self.cm:
            with plugins.runtime.QUERY_HISTORY as qh:
                queries = qh.get_user_queries(self.session_get('user', 'id'), self.cm, limit=1)
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
