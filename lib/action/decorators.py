from sanic.request import Request
from sanic import HTTPResponse
from typing import Optional, Tuple, Union, Callable, Any, Dict
from functools import wraps
from .templating import CustomJSONEncoder, TplEngine
from dataclasses_json import DataClassJsonMixin
import json


ResultType = Union[
    Callable[[], Union[str, bytes, DataClassJsonMixin, Dict[str, Any]]],
    Dict[str, Any],
    str,
    bytes,
    DataClassJsonMixin]


def _output_result(
        tpl_engine: TplEngine,
        template: str,
        result: ResultType,
        status: int,
        return_type: str) -> Union[str, bytes]:
    """
    Renders a response body out of a provided data. The concrete form of data transformation
    depends on the combination of the 'return_type' argument and a type of the 'result'.
    Typical combinations are (ret. type, data type):
    'template' + dict
    'json' + dict (which may contain dataclass_json instances)
    'json' + dataclass_json
    'plain' + str
    A callable 'result' can be used for lazy result evaluation or for JSON encoding with a custom encoder
    """
    if 300 <= status < 400 or result is None:
        return ''
    if callable(result):
        result = result()
    if return_type == 'json':
        try:
            if type(result) in (str, bytes):
                return result
            else:
                return json.dumps(result, cls=CustomJSONEncoder)
        except Exception as e:
            status = 500
            return json.dumps(dict(messages=[('error', str(e))]))
    elif return_type == 'xml':
        from templating import Type2XML
        return Type2XML.to_xml(result)
    elif return_type == 'plain' and not isinstance(result, (dict, DataClassJsonMixin)):
        return result
    elif isinstance(result, dict):
        return tpl_engine.render(template, result)
    raise RuntimeError(f'Unknown source ({result.__class__.__name__}) or return type ({return_type})')


def handler(
        access_level: int = 0, template: Optional[str] = None, page_model: Optional[str] = None,
        func_arg_mapped: bool = False, skip_corpus_init: bool = False, mutates_result: bool = False,
        http_method: Union[Optional[str], Tuple[str, ...]] = 'GET', accept_kwargs: bool = None,
        apply_semi_persist_args: bool = False, return_type: str = 'template',
        action_log_mapper: Callable[[Request], Any] = False) -> Callable[..., Any]:
    """
    This decorator allows more convenient way how to
    set methods' attributes. Please note that there is
    always an implicit property '__exposed__' set to True.

    arguments:
    access_level -- 0,1,... (0 = public user, 1 = logged in user)
    template -- a Jinja2 template source path
    vars -- deprecated; do not use
    page_model -- a JavaScript page module
    func_arg_mapped -- True/False (False - provide only self.args and request, True: maps URL args to action func args)
    skip_corpus_init -- True/False (if True then all the corpus init. procedures are skipped
    mutates_result -- store a new set of result parameters under a new key to query_peristence db
    http_method -- required HTTP method (POST, GET, PUT,...), either a single string or a tuple of strings
    accept_kwargs -- True/False
    apply_semi_persist_args -- if True hen use session to initialize action args first
    return_type -- {plain, json, template, xml}
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kw):
            ans, status = func(request, *args, **kw)
            return HTTPResponse(_output_result(
                tpl_engine=request.ctx.templating,
                template=func.__dict__.get('template'),
                result=ans,
                status=status,
                return_type=return_type))
        return wrapper
    return decorator

