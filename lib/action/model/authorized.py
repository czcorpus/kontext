import os
import time
from sanic import Sanic
from action.model.base import BaseActionModel, BasePluginCtx
from action.krequest import KRequest
from action.response import KResponse
from action.argmapping import MinArgs
from action.errors import UserActionException
from action import ActionProps
from typing import Any, Optional, Dict, List, Iterable
from texttypes.cache import TextTypesCache
from plugin_types.auth import UserInfo, AbstractInternalAuth
from plugin_types import CorpusDependentPlugin
from action.plugin.ctx import AbstractUserPluginCtx
from bgcalc.task import AsyncTaskStatus
import scheduled
import logging
import inspect
from main_menu import MainMenu, generate_main_menu
import settings
import corplib
import plugins  # note - plugins are stateful
import babel


class UserActionModel(BaseActionModel):
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

    def __init__(
            self, req: KRequest, resp: KResponse, action_props: ActionProps, tt_cache: TextTypesCache):
        super().__init__(req, resp, action_props, tt_cache)
        self._uses_valid_sid: bool = True
        self.return_url: Optional[str] = None
        self._plugin_ctx: Optional[UserPluginCtx] = None
        self.args = MinArgs()
        self.subcpath: List[str] = []
        # a CorpusManager instance (created in pre_dispatch() phase)
        # generates (sub)corpus objects with additional properties
        self.cm: Optional[corplib.CorpusManager] = None

    def pre_dispatch(self, req_args):
        req_args = super().pre_dispatch(req_args)
        with plugins.runtime.DISPATCH_HOOK as dhook:
            dhook.pre_dispatch(self.plugin_ctx, self._action_props, self._req)

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
        except ValueError as ex:
            raise UserActionException(ex)
        return req_args

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
            return (self.session_get('user', 'id') not in getattr(sstorage, 'get_excluded_users')()
                    and not self.user_is_anonymous())

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

    def _scheduled_actions(self, user_settings):
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
                            ans = fn(*(), **action, translate=self._req.translate)
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

    @property
    def plugin_ctx(self):
        if self._plugin_ctx is None:
            self._plugin_ctx = UserPluginCtx(self, self._req, self._resp)
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
        return plugins.runtime.AUTH.instance.is_anonymous(user_id)

    @staticmethod
    def _uses_internal_user_pages():
        return isinstance(plugins.runtime.AUTH.instance, AbstractInternalAuth)

    def init_session(self) -> None:
        """
        Starts/reloads user's web session data. It can be called even
        if there is no 'sessions' plugin installed (in such case, it just
        creates an empty dictionary with some predefined keys to allow other
        parts of the application to operate properly)
        """
        with plugins.runtime.AUTH as auth:
            if auth is None:
                raise RuntimeError('Auth plugin was not initialized')

            if 'user' not in self._req.ctx.session:
                self._req.ctx.session['user'] = auth.anonymous_user(self.plugin_ctx)

            if hasattr(auth, 'revalidate'):
                try:
                    auth.revalidate(self.plugin_ctx)  # type: ignore
                except Exception as ex:
                    self._req.ctx.session['user'] = auth.anonymous_user(self.plugin_ctx)
                    logging.getLogger(__name__).error('Revalidation error: %s' % ex)
                    self.add_system_message(
                        'error',
                        self._req.translate(
                            'User authentication error. Please try to reload the page or '
                            'contact system administrator.'))

    def refresh_session_id(self) -> None:
        """
        This tells the wrapping WSGI app to create a new session with
        the same data as the current session.
        """
        self._uses_valid_sid = False

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
        with plugins.runtime.AUTH as auth:
            if plugins.runtime.AUTH.exists and isinstance(auth, AbstractInternalAuth):
                out['login_url'] = auth.get_login_url(self.return_url)
                out['logout_url'] = auth.get_logout_url(self._req.get_root_url())
            else:
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

    def _set_async_tasks(self, task_list: Iterable[AsyncTaskStatus]):
        self._req.ctx.session['async_tasks'] = [at.to_dict() for at in task_list]

    def _mark_timeouted_tasks(self, *tasks):
        now = time.time()
        task_limit = settings.get_int('calc_backend', 'task_time_limit')
        for at in tasks:
            if (at.status == 'PENDING' or at.status == 'STARTED') and now - at.created > task_limit:
                at.status = 'FAILURE'
                if not at.error:
                    at.error = 'task time limit exceeded'

    def _store_async_task(self, async_task_status) -> List[AsyncTaskStatus]:
        at_list = [t for t in self.get_async_tasks() if t.status != 'FAILURE']
        self._mark_timeouted_tasks(*at_list)
        at_list.append(async_task_status)
        self._set_async_tasks(at_list)
        return at_list

    async def add_globals(self, app: Sanic, action_props: ActionProps, result: Dict[str, Any]):
        # updates result dict with javascript modules paths required by some of the optional plugins
        result = await super().add_globals(app, action_props, result)
        await self.export_optional_plugins_conf(result)
        self.configure_auth_urls(result)
        result['conc_url_ttl_days'] = None
        result['explicit_conc_persistence_ui'] = False
        result['corpus_ident'] = {}
        result['Globals'] = {}
        result['base_attr'] = BaseActionModel.BASE_ATTR
        result['user_info'] = self._req.ctx.session.get('user', {'fullname': None})
        result['_anonymous'] = self.user_is_anonymous()
        result['anonymous_user_conc_login_prompt'] = settings.get_bool(
            'global', 'anonymous_user_conc_login_prompt', False)
        result['supports_password_change'] = self._uses_internal_user_pages()
        result['session_cookie_name'] = settings.get('plugins', 'auth').get('auth_cookie_name', '')

        if plugins.runtime.APPLICATION_BAR.exists:
            application_bar = plugins.runtime.APPLICATION_BAR.instance
            result['app_bar'] = application_bar.get_contents(plugin_ctx=self.plugin_ctx,
                                                             return_url=self.return_url)
            result['app_bar_css'] = application_bar.get_styles(plugin_ctx=self.plugin_ctx)
            result['app_bar_js'] = application_bar.get_scripts(plugin_ctx=self.plugin_ctx)
        else:
            result['app_bar'] = None
            result['app_bar_css'] = []
            result['app_bar_js'] = []

        result['footer_bar'] = None
        result['footer_bar_css'] = None
        with plugins.runtime.FOOTER_BAR as fb:
            result['footer_bar'] = fb.get_contents(self.plugin_ctx, self.return_url)
            result['footer_bar_css'] = fb.get_css_url()

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

        # asynchronous tasks
        result['async_tasks'] = [t.to_dict() for t in self.get_async_tasks()]
        result['help_links'] = settings.get_help_links(self.ui_lang)
        result['integration_testing_env'] = settings.get_bool(
            'global', 'integration_testing_env', '0')
        if 'popup_server_messages' not in result:
            result['popup_server_messages'] = True
        result['job_status_service_url'] = os.environ.get(
            'STATUS_SERVICE_URL', settings.get('calc_backend', 'status_service_url', None))

        with plugins.runtime.ISSUE_REPORTING as irp:
            result['issue_reporting_action'] = irp.export_report_action(
                self.plugin_ctx).to_dict() if irp else None
        result['can_send_mail'] = bool(settings.get('mailing'))
        await self.attach_plugin_exports(result, direct=False)

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
        result['static_menu'] = [dict(label=x[1]['label'], disabled=x[1].get('disabled', False),
                                      action=x[1].get('fallback_action'))
                                 for x in menu_items['submenuItems']]
        result['_version'] = (corplib.manatee_version(), settings.get('global', '__version__'))
        return result


class UserPluginCtx(BasePluginCtx, AbstractUserPluginCtx):

    def __init__(self, action_model: UserActionModel, request: KRequest, response: KResponse):
        super().__init__(action_model, request, response)
        self._action_model = action_model

    def refresh_session_id(self) -> None:
        return self._action_model.refresh_session_id()

    @property
    def user_is_anonymous(self) -> bool:
        return self._action_model.user_is_anonymous()

    @property
    def user_id(self) -> int:
        return self._request.ctx.session.get('user', {'id': None}).get('id')

    @property
    def user_dict(self) -> UserInfo:
        return self._request.ctx.session.get('user', {'id': None})
