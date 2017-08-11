from typing import TypeVar, Generic, Any, List, Callable

from .abstract.general_storage import KeyValueStorage
from .abstract.settings_storage import AbstractSettingsStorage
from .abstract.auth import AbstractAuth
from .abstract.conc_persistence import AbstractConcPersistence
from .abstract.conc_cache import AbstractCacheMappingFactory
from .export import Loader
from .abstract.user_items import AbstractUserItems
from .abstract.menu_items import AbstractMenuItems
from .abstract.getlang import AbstractGetLang
from .abstract.corpora import AbstractCorporaArchive
from .abstract.query_storage import AbstractQueryStorage
from .abstract.appbar import AbstractApplicationBar
from .abstract.footer_bar import AbstractFootbar
from .abstract.live_attributes import AbstractLiveAttributes
from .abstract.subc_restore import AbstractSubcRestore
from .abstract.taghelper import AbstractTaghelper
from .abstract.syntax_viewer import AbstractSyntaxViewerPlugin
from .abstract.subcmixer import AbstractSubcMixer

T = TypeVar('T')

class _ID(Generic[T]):

    def __init__(self, ident:str): ...

    @property
    def instance(self) -> T: ...

    def __call__(self, fn:Callable[None, None]) -> None: ...

    @property
    def name(self) -> str: ...


class _Names(object):
    DB:_ID[KeyValueStorage]
    SESSIONS:_ID[werkzeug.contrib.sessions.Session]
    SETTINGS_STORAGE:_ID[AbstractSettingsStorage]
    AUTH:_ID[AbstractAuth]
    CONC_PERSISTENCE:_ID[AbstractConcPersistence]
    CONC_CACHE:_ID[AbstractCacheMappingFactory]
    EXPORT:_ID[Loader]
    USER_ITEMS:_ID[AbstractUserItems]
    MENU_ITEMS:_ID[AbstractMenuItems]

    GETLANG:_ID[AbstractGetLang]
    CORPARCH:_ID[AbstractCorporaArchive]
    QUERY_STORAGE:_ID[AbstractQueryStorage]
    APPLICATION_BAR:_ID[AbstractApplicationBar]
    FOOTER_BAR:_ID[AbstractFootbar]
    LIVE_ATTRIBUTES:_ID[AbstractLiveAttributes]
    SUBC_RESTORE:_ID[AbstractSubcRestore]
    TAGHELPER:_ID[AbstractTaghelper]
    SYNTAX_VIEWER:_ID[AbstractSyntaxViewerPlugin]
    SUBCMIXER:_ID[AbstractSubcMixer]


runtime:_Names

def install_plugin(name, module, config) -> None: ...

def inject_plugin(name:str, obj:object) -> None: ...

def add_missing_plugin(name:str) -> None: ...

def flush_plugins() -> None: ...

def has_plugin(name:str) -> bool: ...

def get(*names:List[str]) -> List[Any]: ...

def get_plugins(include_missing:bool) -> List[Any]: ...
