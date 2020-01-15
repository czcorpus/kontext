from typing import Optional, Dict, Any, TypeVar
from manatee import Corpus
from .kontext import Kontext
from . import KonTextCookie
import werkzeug.contrib.sessions

T = TypeVar('T')


class PluginApi(object):

    _controller:Kontext

    def __init__(self, controller:Kontext, request:werkzeug.Request, cookies:KonTextCookie) -> None: ...

    def set_shared(self, key:str, value:Any): ...

    def get_shared(self, key:str, default:Optional[T] = None) -> T: ...

    def get_from_environ(self, key:str, default:Optional[T] = None) -> T: ...

    @property
    def request(self) -> werkzeug.Request: ...

    @property
    def cookies(self) -> KonTextCookie: ...

    @property
    def session(self) -> werkzeug.contrib.sessions.Session: ...

    def refresh_session_id(self) -> None: ...

    @property
    def user_lang(self) -> str: ...

    @property
    def user_id(self) -> int: ...

    @property
    def user_dict(self) -> Dict[str, Any]: ...

    @property
    def user_is_anonymous(self) -> bool: ...

    @property
    def current_corpus(self) -> Corpus: ...

    @property
    def current_url(self) -> str: ...

    @property
    def root_url(self) -> str: ...

    def redirect(self, url:str, code:int = 303) -> None: ...

    @property
    def text_types(self) -> Dict: ...
