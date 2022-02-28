# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

from typing import TypeVar, Generic, Any, Iterator, Callable, Optional, Dict, TYPE_CHECKING, List
from types import ModuleType
from secure_cookie.session import Session
from plugin_types.general_storage import KeyValueStorage
from plugin_types.integration_db import IntegrationDatabase
from plugin_types.settings_storage import AbstractSettingsStorage
from plugin_types.query_persistence import AbstractQueryPersistence
from plugin_types.conc_cache import AbstractCacheMappingFactory
from .export import Loader
from .export_freq2d import Loader as LoaderFreq2d
from plugin_types.user_items import AbstractUserItems
from plugin_types.menu_items import AbstractMenuItems
from plugin_types.getlang import AbstractGetLang
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.query_history import AbstractQueryHistory
from plugin_types.appbar import AbstractApplicationBar
from plugin_types.footer_bar import AbstractFootbar
from plugin_types.live_attributes import AbstractLiveAttributes
from plugin_types.subc_restore import AbstractSubcRestore
from plugin_types.taghelper import AbstractTaghelper
from plugin_types.syntax_viewer import AbstractSyntaxViewerPlugin
from plugin_types.subcmixer import AbstractSubcMixer
from plugin_types.chart_export import AbstractChartExportPlugin
from plugin_types.issue_reporting import AbstractIssueReporting
from plugin_types.dispatch_hook import AbstractDispatchHook
from plugin_types.token_connect import AbstractTokenConnect
from plugin_types.kwic_connect import AbstractKwicConnect
from plugin_types.query_suggest import AbstractQuerySuggest
from plugin_types.action_log import AbstractActionLog
from plugin_types.audio_provider import AbstractAudioProvider
# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from plugin_types.auth import AbstractAuth
    from action.plugin.ctx import PluginCtx

import logging

T = TypeVar('T')

_plugins: Dict[str, Any] = {}


class _ID(Generic[T]):
    """
    A wrapper class used to represent a plug-in as
    an abstract entity which is always instantiated
    (even if its respective plug-in does not exist)
    and which can be asked for basic information
    (name, exists?, is avail. for a corpus?,...).
    """

    def __init__(self, ident: str, optional: bool = False) -> None:
        self._ident: str = ident
        self._optional: bool = optional
        self._forced_module: Optional[ModuleType] = None

    def __repr__(self):
        return 'Plugin {0} ({1})'.format(self._ident, self.instance)

    @property
    def instance(self) -> Optional[T]:
        """
        Returns an instance of the plug-in. The instance
        is shared between all the requests (within a single
        web server worker)
        """
        if _has_plugin(self._ident):
            return _plugins[self._ident]
        return None

    @property
    def is_optional(self) -> bool:
        return self._optional

    @property
    def forced_module(self) -> Optional[ModuleType]:
        return self._forced_module

    def force_module(self, mod: ModuleType):
        self._forced_module = mod

    def __enter__(self) -> Optional[T]:
        if _has_plugin(self._ident):
            return self.instance
        return None

    def __exit__(self, type, value, traceback) -> bool:
        # we ignore accessing plugins which are not installed
        return self.instance is None and type is AttributeError

    @property
    def name(self) -> str:
        return self._ident

    @property
    def exists(self) -> bool:
        """
        Returns True if the plug-in is instantiated (i.e. it
        is properly configured in config.xml). For corpus-dependent
        plug-ins (e.g. live_attributes) please use method
        is_enabled_for()
        """
        return _plugins.get(self._ident) is not None

    def is_enabled_for(self, plugin_ctx: 'PluginCtx', corpora: List[str]) -> bool:
        """
        Returns True if the plugin exists and is enabled for a specified
        corpus or it is corpus independent (e.g. db plugin, session,...)
        """
        if self.exists:
            if hasattr(self.instance, 'is_enabled_for'):
                # ignoring type check here, error: None type has no attribute is_enabled_for
                # but we check if it exists
                return self.instance.is_enabled_for(plugin_ctx, corpora)  # type: ignore
            else:
                return True
        else:
            return False


class _Names(object):
    DB: _ID[KeyValueStorage] = _ID('db')
    INTEGRATION_DB: _ID[IntegrationDatabase] = _ID('integration_db')
    SESSIONS: _ID[Session] = _ID('sessions')
    SETTINGS_STORAGE: _ID[AbstractSettingsStorage] = _ID('settings_storage')
    AUTH: _ID['AbstractAuth'] = _ID('auth')
    QUERY_PERSISTENCE: _ID[AbstractQueryPersistence] = _ID('query_persistence')
    CONC_CACHE: _ID[AbstractCacheMappingFactory] = _ID('conc_cache')
    EXPORT: _ID[Loader] = _ID('export')
    EXPORT_FREQ2D: _ID[LoaderFreq2d] = _ID('export_freq2d')
    USER_ITEMS: _ID[AbstractUserItems] = _ID('user_items')
    MENU_ITEMS: _ID[AbstractMenuItems] = _ID('menu_items')
    AUDIO_PROVIDER: _ID[AbstractAudioProvider] = _ID('audio_provider')

    GETLANG: _ID[AbstractGetLang] = _ID('getlang', optional=True)
    CORPARCH: _ID[AbstractCorporaArchive] = _ID('corparch')
    QUERY_HISTORY: _ID[AbstractQueryHistory] = _ID('query_history', optional=True)
    APPLICATION_BAR: _ID[AbstractApplicationBar] = _ID('application_bar', optional=True)
    FOOTER_BAR: _ID[AbstractFootbar] = _ID('footer_bar', optional=True)
    LIVE_ATTRIBUTES: _ID[AbstractLiveAttributes] = _ID('live_attributes', optional=True)
    SUBC_RESTORE: _ID[AbstractSubcRestore] = _ID('subc_restore', optional=True)
    TAGHELPER: _ID[AbstractTaghelper] = _ID('taghelper', optional=True)
    SYNTAX_VIEWER: _ID[AbstractSyntaxViewerPlugin] = _ID('syntax_viewer', optional=True)
    SUBCMIXER: _ID[AbstractSubcMixer] = _ID('subcmixer', optional=True)
    CHART_EXPORT: _ID[AbstractChartExportPlugin] = _ID('chart_export', optional=True)
    ISSUE_REPORTING: _ID[AbstractIssueReporting] = _ID('issue_reporting', optional=True)
    TOKEN_CONNECT: _ID[AbstractTokenConnect] = _ID('token_connect', optional=True)
    KWIC_CONNECT: _ID[AbstractKwicConnect] = _ID('kwic_connect', optional=True)
    DISPATCH_HOOK: _ID[AbstractDispatchHook] = _ID('dispatch_hook', optional=True)
    QUERY_SUGGEST: _ID[AbstractQuerySuggest] = _ID('query_suggest', optional=True)
    ACTION_LOG: _ID[AbstractActionLog] = _ID('action_log', optional=True)

    def __iter__(self) -> Iterator[_ID]:
        return iter([
            self.DB, self.INTEGRATION_DB, self.SESSIONS, self.SETTINGS_STORAGE, self.AUTH,
            self.QUERY_PERSISTENCE, self.CONC_CACHE, self.EXPORT, self.EXPORT_FREQ2D, self.USER_ITEMS,
            self.MENU_ITEMS, self.AUDIO_PROVIDER, self.GETLANG, self.CORPARCH, self.QUERY_HISTORY,
            self.APPLICATION_BAR, self.FOOTER_BAR, self.LIVE_ATTRIBUTES, self.SUBC_RESTORE, self.TAGHELPER,
            self.SYNTAX_VIEWER, self.SUBCMIXER, self.CHART_EXPORT, self.ISSUE_REPORTING, self.TOKEN_CONNECT,
            self.KWIC_CONNECT, self.DISPATCH_HOOK, self.QUERY_SUGGEST, self.ACTION_LOG])


runtime: _Names = _Names()


def install_plugin(name: str, module, config) -> Any:
    """
    returns:
        an initialized plug-in instance
    """
    logging.getLogger(__name__).info(f'installing plug-in {name}')
    _plugins[name] = module.create_instance(*(config,))
    return _plugins[name]


def inject_plugin(ident: _ID, obj: object) -> None:
    """
    Inject a plug-in object directly. This is mainly
    for testing.
    """
    _plugins[ident.name] = obj


def add_missing_plugin(name: str) -> None:
    _plugins[name] = None


def flush_plugins() -> None:
    _plugins.clear()


def _has_plugin(name: str) -> bool:
    return _plugins.get(name) is not None


def load_plugin_module(name: str) -> Optional[ModuleType]:
    _tmp = __import__('plugins', fromlist=[name])
    try:
        module = getattr(_tmp, name)
    except AttributeError:
        logging.getLogger(__name__).error(
            f'Plugin {name} configured but not installed (missing Python module?)')
        module = None
    return module


class _PluginFactory(object):
    def __init__(self, fn, *args):
        self._fn = fn
        self._args = args

    def __call__(self, conf: ModuleType('settings')):
        return self._fn(*(conf,) + tuple(v.instance for v in self._args))


def inject(*args: _ID) -> Callable[[Any], Any]:
    """
    A decorator allowing a declarative injection of plug-in
    dependencies (= other plug-ins). Plug-ins are injected
    as positional arguments. The first argument is always
    the 'settings' object.

    @inject(plugins.runtime.DB, plugins.runtime.SESSIONS, plugins.runtime.AUTH)
    def create_instance(conf, db, sessions, auth):
      pass

    arguments:
    one or more plug-in names (see the example)
    """
    def decorator(func):
        return _PluginFactory(func, *args)
    return decorator
