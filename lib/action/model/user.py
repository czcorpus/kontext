# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

import inspect
import logging
import os
import time
from dataclasses import fields
from typing import Any, Dict, Iterable, List, Optional, Tuple

import corplib
import plugins
import scheduled
import settings
from action.argmapping import UserActionArgs
from action.errors import UserReadableException
from action.krequest import KRequest
from action.model import ModelsSharedData
from action.model.abstract import AbstractUserModel
from action.model.base import BaseActionModel, BasePluginCtx
from action.plugin.ctx import AbstractUserPluginCtx
from action.props import ActionProps
from action.response import KResponse
from bgcalc.task import AsyncTaskStatus
from corplib import CorpusFactory
from main_menu import MainMenu, generate_main_menu
from plugin_types import CorpusDependentPlugin
from plugin_types.auth import AbstractInternalAuth, UserInfo
from plugin_types.subc_storage import SubcListFilterArgs
from sanic import Sanic


class UserActionModel(BaseActionModel, AbstractUserModel):
    """
    UserActionModel represents a minimal model for any user action
    (i.e. an action where we distinguish between anonymous
    and authenticated user). Any more complicated action model
    will likely inherit from this one.

    The model also provides a CorpusFactory instance but it
    does not perform any implicit actions on it. It is provided
    purely for the 'view' functions.
    """
    USER_ACTIONS_DISABLED_ITEMS = (
        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.VIEW)

    # main menu items disabled for public users (this is applied automatically during
    # post_dispatch())
    ANON_FORBIDDEN_MENU_ITEMS = (
        MainMenu.NEW_QUERY('history', 'wordlist'),
        MainMenu.CORPORA('my-subcorpora', 'create-subcorpus'),
        MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER,
        MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)

    CONCORDANCE_ACTIONS = (
        MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER, MainMenu.FREQUENCY,
        MainMenu.COLLOCATIONS, MainMenu.VIEW('kwic-sent-switch'),
        MainMenu.CORPORA('create-subcorpus'))

    FORBIDDEN_CORPUS_MENU_ITEMS = (
        MainMenu.NEW_QUERY('new-query', 'wordlist', 'paradigmatic-query'),
        MainMenu.CORPORA('create-subcorpus'),
        MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER,
        MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.VIEW('kwic-sent-switch', 'structs-attrs'), MainMenu.HELP('how-to-cite'))

    def __init__(
            self, req: KRequest, resp: KResponse, action_props: ActionProps, shared_data: ModelsSharedData):
        super().__init__(req, resp, action_props, shared_data)
        self.return_url: Optional[str] = None
        self._plugin_ctx: Optional[UserPluginCtx] = None
        self.args = UserActionArgs()
        self.subcpath: Optional[str] = None
        # a CorpusFactory instance (created in pre_dispatch() phase)
        # generates (sub)corpus objects with additional properties
        self.cf: Optional[corplib.CorpusFactory] = None

    async def pre_dispatch(self, req_args):
        """
        pre_dispatch calls its descendant first and the it
        initializes scheduled actions, user settings, user paths
        and the CorpusFactory.
        """
        req_args = await super().pre_dispatch(req_args)
        with plugins.runtime.DISPATCH_HOOK as dhook:
            await dhook.pre_dispatch(self.plugin_ctx, self._action_props, self._req)

        options = {}
        await self._scheduled_actions(options)

        # only general setting can be applied now because
        # we do not know final corpus name yet
        self._init_default_settings(options)

        try:
            options.update(await self._load_general_settings())
            self.args.map_args_to_attrs(options)
            self._setup_user_paths()
            self.cf = corplib.CorpusFactory(self.subcpath)
        except ValueError as ex:
            raise UserReadableException(ex)
        return req_args

    async def post_dispatch(self, action_props, result, err_desc):
        """
        Runs after main action is processed but before any rendering (incl. HTTP headers)
        """

        # disable menu items for anonymous user
        if self.user_is_anonymous():
            self.disabled_menu_items = self.disabled_menu_items + self.ANON_FORBIDDEN_MENU_ITEMS

        with plugins.runtime.ACTION_LOG as alog:
            alog.log_action(
                self._req, self.args, action_props.action_log_mapper,
                f'{action_props.action_prefix}{action_props.action_name}',
                err_desc=err_desc)

        with plugins.runtime.DISPATCH_HOOK as dhook:
            await dhook.post_dispatch(self.plugin_ctx, action_props.action_name, action_props)

    @staticmethod
    def _init_default_settings(options):
        if 'shuffle' not in options:
            options['shuffle'] = int(settings.get_bool('global', 'shuffle_conc_by_default', False))

    def _setup_user_paths(self):
        user_id = self.session_get('user', 'id')
        self.subcpath = settings.get('corpora', 'subcorpora_dir')
        self._conc_dir = os.path.join(settings.get('corpora', 'conc_dir'), str(user_id))

    # missing return statement type check error
    def _user_has_persistent_settings(self) -> bool:  # type: ignore
        with plugins.runtime.SETTINGS_STORAGE as sstorage:
            return (self.session_get('user', 'id') not in getattr(sstorage, 'get_excluded_users')()
                    and not self.user_is_anonymous())

    async def _load_general_settings(self) -> Dict[str, Any]:
        """
        """
        if self._user_has_persistent_settings():
            with plugins.runtime.SETTINGS_STORAGE as settings_plg:
                return await settings_plg.load(self.session_get('user', 'id'))
        else:
            data = self.session_get('settings')
            if not data:
                data = {}
            return data

    @staticmethod
    def _get_save_excluded_attributes() -> Tuple[str, ...]:
        return 'corpname', BaseActionModel.SCHEDULED_ACTIONS_KEY

    async def save_options(self, optlist: Optional[Iterable] = None, corpus_id: Optional[str] = None):
        """
        Saves user's options to a storage

        Arguments:
        optlist -- a list of options/arguments to be saved
        corpus_id --
        """
        if optlist is None:
            optlist = []
        tosave = [(att.name, getattr(self.args, att.name))
                  for att in fields(self.args) if att.name in optlist]

        def merge_incoming_opts_to(opts):
            if opts is None:
                return {}
            excluded_attrs = self._get_save_excluded_attributes()
            for attr, val in tosave:
                if attr not in excluded_attrs:
                    opts[attr] = val
            return opts

        # data must be loaded (again) because in-memory settings are
        # in general a subset of the ones stored in db (and we want
        # to store (again) even values not used in this particular request)
        with plugins.runtime.SETTINGS_STORAGE as settings_storage:
            if self._user_has_persistent_settings():
                if corpus_id:
                    options = await settings_storage.load(self.session_get('user', 'id'), corpus_id)
                    options = merge_incoming_opts_to(options)
                    await settings_storage.save(self.session_get('user', 'id'), corpus_id, options)
                else:
                    options = await settings_storage.load(self.session_get('user', 'id'))
                    options = merge_incoming_opts_to(options)
                    await settings_storage.save(self.session_get('user', 'id'), None, options)
            else:
                options = {}
                sess_options = self.session_get('settings')
                if sess_options:
                    options.update(sess_options)
                merge_incoming_opts_to(options)
                self._req.ctx.session['settings'] = options

    async def _scheduled_actions(self, user_settings):
        actions = []
        if BaseActionModel.SCHEDULED_ACTIONS_KEY in user_settings:
            value = user_settings[BaseActionModel.SCHEDULED_ACTIONS_KEY]
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
                                self._resp.add_system_message('message', ans['message'])
                            continue
                        except Exception as e:
                            logging.getLogger('SCHEDULING').error('task_id: {}, error: {} ({})'.format(
                                action.get('id', '??'), e.__class__.__name__, e))
                # avoided by 'continue' in case everything is OK
                logging.getLogger('SCHEDULING').error('task_id: {}, Failed to invoke scheduled action: {}'.format(
                    action.get('id', '??'), action,))
            await self.save_options()  # this causes scheduled task to be removed from settings

    @property
    def plugin_ctx(self):
        if self._plugin_ctx is None:
            self._plugin_ctx = UserPluginCtx(self, self._req, self._resp, self._plg_shared)
        return self._plugin_ctx

    def session_get_user(self) -> UserInfo:
        """
        This is a convenience method for obtaining typed user info from HTTP session
        """
        return self._req.ctx.session['user']

    def session_get(self, *nested_keys: str) -> Any:
        """
        Retrieve any HTTP session value. The method supports nested
        keys - e.g. to get self._session['user']['car']['name'] we
        can just call self.session_get('user', 'car', 'name').
        If no matching keys are found then None is returned.

        Arguments:
        *nested_keys -- keys to access required value

        TODO this is probably too general to be in action model
        """
        curr = dict(self._req.ctx.session)
        for k in nested_keys:
            if k in curr:
                curr = curr[k]
            else:
                return None
        return curr

    # mypy error: missing return statement
    def user_is_anonymous(self) -> bool:  # type: ignore
        with plugins.runtime.AUTH as auth:
            return getattr(auth, 'is_anonymous')(self.session_get('user', 'id'))

    @staticmethod
    def is_anonymous_id(user_id):
        with plugins.runtime.AUTH as auth:
            return auth.is_anonymous(user_id)

    @staticmethod
    def uses_internal_user_pages():
        return isinstance(plugins.runtime.AUTH.instance, AbstractInternalAuth)

    async def init_session(self) -> None:
        """
        Starts/reloads user's web session data.
        """
        with plugins.runtime.AUTH as auth:

            if 'user' not in self._req.ctx.session:
                self._req.ctx.session['user'] = auth.anonymous_user(self.plugin_ctx)

            if hasattr(auth, 'revalidate'):
                try:
                    await auth.revalidate(self.plugin_ctx)  # type: ignore
                except Exception as ex:
                    self._req.ctx.session['user'] = auth.anonymous_user(self.plugin_ctx)
                    logging.getLogger(__name__).error('Revalidation error: %s' % ex)
                    self._resp.add_system_message(
                        'error',
                        self._req.translate(
                            'User authentication error. Please try to reload the page or '
                            'contact system administrator.'))

    def clear_session(self) -> None:
        """
        """
        self._req.ctx.session = {}

    async def _export_optional_plugins_conf(self, result, active_corpora: List[str]):
        """
        Updates result dict with JavaScript module paths required to
        run client-side parts of some optional plugins. Template document.tmpl
        (i.e. layout template) configures RequireJS module accordingly.
        """
        ans = {}
        result['active_plugins'] = []
        for opt_plugin in plugins.runtime:
            ans[opt_plugin.name] = None
            if opt_plugin.exists:
                js_file = settings.get('plugins', opt_plugin.name, {}).get('js_module')
                if js_file:
                    ans[opt_plugin.name] = js_file
                    if (not (isinstance(opt_plugin.instance, CorpusDependentPlugin)) or
                            await opt_plugin.is_enabled_for(self.plugin_ctx, active_corpora)):
                        result['active_plugins'].append(opt_plugin.name)
        result['plugin_js'] = ans

    def configure_auth_urls(self, out):
        try:
            with plugins.runtime.AUTH as auth:
                out['login_url'] = auth.get_login_url(self.return_url)
                out['logout_url'] = auth.get_logout_url(self._req.get_root_url())
        except plugins.PluginNotInstalled:
            out['login_url'] = None
            out['logout_url'] = None

    async def _attach_plugin_exports(self, result, active_corpora: List[str], direct):
        """
        Method exports plug-ins' specific data for their respective client parts.
        KonText core does not care about particular formats - it just passes JSON-encoded
        data to the client.
        """
        key = 'pluginData' if direct else 'plugin_data'
        result[key] = {}
        for plg in plugins.runtime:
            if (hasattr(plg.instance, 'export') and (not isinstance(plg.instance, CorpusDependentPlugin) or
                                                     await plg.is_enabled_for(self.plugin_ctx, active_corpora))):
                result[key][plg.name] = await plg.instance.export(self.plugin_ctx)

    async def attach_plugin_exports(self, result, direct):
        await self._attach_plugin_exports(result, [], direct)

    async def export_optional_plugins_conf(self, result):
        await self._export_optional_plugins_conf(result, [])

    def get_async_tasks(self, category: Optional[str] = None) -> List[AsyncTaskStatus]:
        """
        Returns a list of tasks user is explicitly informed about.

        Args:
            category (str): task category filter
        Returns:
            (list of AsyncTaskStatus)
        """
        if 'async_tasks' in self._req.ctx.session:
            ans = [AsyncTaskStatus.from_dict(d) for d in self._req.ctx.session['async_tasks']]
        else:
            ans = []
        if category is not None:
            return [item for item in ans if item.category == category]
        else:
            return ans

    def set_async_tasks(self, task_list: Iterable[AsyncTaskStatus]):
        self._req.ctx.session['async_tasks'] = [at.to_dict() for at in task_list]

    @staticmethod
    def mark_timeouted_tasks(*tasks):
        now = time.time()
        task_limit = settings.get_int('calc_backend', 'task_time_limit')
        for at in tasks:
            if (at.status == 'PENDING' or at.status == 'STARTED') and now - at.created > task_limit:
                at.status = 'FAILURE'
                if not at.error:
                    at.error = 'task time limit exceeded'

    def store_async_task(self, async_task_status) -> List[AsyncTaskStatus]:
        at_list = [t for t in self.get_async_tasks() if t.status != 'FAILURE']
        self.mark_timeouted_tasks(*at_list)
        at_list.append(async_task_status)
        self.set_async_tasks(at_list)
        return at_list

    async def add_globals(self, app: Sanic, action_props: ActionProps, result: Dict[str, Any]):
        # updates result dict with javascript modules paths required by some of the optional plugins
        result = await super().add_globals(app, action_props, result)
        await self.export_optional_plugins_conf(result)
        self.configure_auth_urls(result)
        result['conc_url_ttl_days'] = None
        result['explicit_conc_persistence_ui'] = False
        result['corpus_ident'] = {}
        result['corp_sample_size'] = None
        result['Globals'] = {}
        result['base_attr'] = BaseActionModel.BASE_ATTR
        result['user_info'] = self._req.ctx.session.get('user', {'fullname': None})
        result['_anonymous'] = self.user_is_anonymous()
        result['anonymous_user_conc_login_prompt'] = settings.get_bool(
            'global', 'anonymous_user_conc_login_prompt', False)
        result['supports_password_change'] = self.uses_internal_user_pages()
        result['session_cookie_name'] = settings.get('plugins', 'auth').get('auth_cookie_name', '')

        result['app_bar'] = None
        result['app_bar_css'] = []
        result['app_bar_js'] = []
        with plugins.runtime.APPLICATION_BAR as application_bar:
            result['app_bar'] = await application_bar.get_contents(plugin_ctx=self.plugin_ctx,
                                                                   return_url=self.return_url)
            result['app_bar_css'] = application_bar.get_styles(plugin_ctx=self.plugin_ctx)
            result['app_bar_js'] = application_bar.get_scripts(plugin_ctx=self.plugin_ctx)

        result['footer_bar'] = None
        result['footer_bar_css'] = None
        with plugins.runtime.FOOTER_BAR as fb:
            result['footer_bar'] = await fb.get_contents(self.plugin_ctx, self.return_url)
            result['footer_bar_css'] = fb.get_css_url()

        with plugins.runtime.GETLANG as gl:
            result['lang_switch_ui'] = gl.allow_default_lang_switch_ui()

        # util functions
        result['to_str'] = lambda s: str(s) if s is not None else ''
        # the output of 'to_json' is actually only json-like (see the function val_to_js)

        # asynchronous tasks
        result['async_tasks'] = [t.to_dict() for t in self.get_async_tasks()]
        result['help_links'] = settings.get_help_links(self._req.ui_lang)
        result['integration_testing_env'] = settings.get_bool(
            'global', 'integration_testing_env', '0')
        result['job_status_service_url'] = os.environ.get(
            'STATUS_SERVICE_URL', settings.get('calc_backend', 'status_service_url', None))

        result['issue_reporting_action'] = None
        with plugins.runtime.ISSUE_REPORTING as irp:
            result['issue_reporting_action'] = irp.export_report_action(self.plugin_ctx).to_dict()

        result['can_send_mail'] = bool(settings.get('mailing'))
        await self.attach_plugin_exports(result, direct=False)
        result['_version'] = (corplib.manatee_version(), settings.get('global', '__version__'))

        if self.user_is_anonymous():
            disabled_set = set(self.disabled_menu_items)
            self.disabled_menu_items = tuple(disabled_set.union(
                set(BaseActionModel.ANON_FORBIDDEN_MENU_ITEMS)))

        return result

    async def user_subc_names(self, corpname):
        if self.user_is_anonymous():
            return []
        with plugins.runtime.SUBC_STORAGE as subc_arch:
            return await subc_arch.list(
                self._req.session_get('user', 'id'), SubcListFilterArgs(), corpname=corpname)

    @staticmethod
    def parse_sorting_param(k):
        if k[0] == '-':
            revers = True
            k = k[1:]
        else:
            revers = False
        return k, revers

    def init_menu(self, result):
        # main menu
        menu_items = generate_main_menu(
            tpl_data=result,
            args=self.args,
            disabled_items=self.disabled_menu_items,
            dynamic_items=self._dynamic_menu_items,
            corpus_dependent=result['uses_corp_instance'],
            plugin_ctx=self.plugin_ctx,
        )
        result['menu_data'] = menu_items
        # We will also generate a simplified static menu which is rewritten
        # as soon as JS stuff is initiated. It can be used e.g. by search engines.
        result['static_menu'] = [
            dict(label=x[1]['label'], disabled=x[1].get(
                'disabled', False), action=x[1].get('fallback_action'))
            for x in menu_items['submenuItems']]

    async def resolve_error_state(self, req, resp, result, err):
        if self.cf:
            with plugins.runtime.QUERY_HISTORY as qh:
                queries = await qh.get_user_queries(self.session_get('user', 'id'), self.cf, limit=1)
                if len(queries) > 0:
                    corpname = queries[0].get('corpname', None)
                    if corpname is not None:
                        with plugins.runtime.AUTH as auth:
                            has_access, _ = await auth.validate_access(corpname, self.plugin_ctx.user_dict)
                            if not has_access:
                                corpname = None

                    result['last_used_corp'] = dict(
                        corpname=corpname,
                        human_corpname=None if corpname is None else queries[0].get('human_corpname', None))
        result['popup_server_messages'] = False

    def disable_menu_on_forbidden_corpus(self):
        self.disabled_menu_items = self.FORBIDDEN_CORPUS_MENU_ITEMS


class UserPluginCtx(BasePluginCtx, AbstractUserPluginCtx):

    def __init__(
            self,
            action_model: UserActionModel,
            request: KRequest,
            response: KResponse,
            plg_shared: Dict[str, Any]
    ):
        super().__init__(action_model, request, response, plg_shared)
        self._action_model = action_model

    def clear_session(self) -> None:
        return self._action_model.clear_session()

    @property
    def user_is_anonymous(self) -> bool:
        return self._action_model.user_is_anonymous()

    @property
    def user_id(self) -> int:
        return self._request.ctx.session.get('user', {'id': None}).get('id')

    @property
    def user_dict(self) -> UserInfo:
        return self._request.ctx.session.get('user', {'id': None})

    @property
    def corpus_factory(self) -> CorpusFactory:
        return self._action_model.cf
