from dataclasses import dataclass, field
from typing import Union, Optional, Tuple, Dict, Callable, Any
from sanic.request import Request


@dataclass
class ActionProps:

    action_name: str

    action_prefix: str

    access_level: int = 0

    http_method: Union[Optional[str], Tuple[str, ...]] = 'GET'

    page_model: Optional[str] = None
    """A module name for TypeScript page model"""

    return_type: str = 'template'

    mutates_result: bool = False

    action_log_mapper: Callable[[Request], Any] = False


def get_protocol(environ):
    if 'HTTP_X_FORWARDED_PROTO' in environ:
        return environ['HTTP_X_FORWARDED_PROTO']
    elif 'HTTP_X_FORWARDED_PROTOCOL' in environ:
        return environ['HTTP_X_FORWARDED_PROTOCOL']
    else:
        return environ['wsgi.url_scheme']
