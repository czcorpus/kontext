from sanic.request import Request
from sanic import HTTPResponse, Sanic
from sanic import response
from typing import Optional, Union, Callable, Any, Type, Coroutine, List
from functools import wraps
from action.templating import CustomJSONEncoder, TplEngine, ResultType
from action import ActionProps
from action.krequest import KRequest
from action.response import KResponse
from dataclasses_json import DataClassJsonMixin
from action.errors import ImmediateRedirectException, UserActionException
from action.model.base import BaseActionModel
import json


async def _output_result(
        app: Sanic,
        action_model: BaseActionModel,
        action_props: ActionProps,
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
        result = await action_model.add_globals(app, action_props, result)
        return tpl_engine.render(template, result, action_model.plugin_ctx.translate)
    raise RuntimeError(
        f'Unknown source ({result.__class__.__name__}) or return type ({return_type})')


def create_mapped_args(tp: Type, req: Request):
    # TODO handle Optional vs. default_factory etc.
    props = tp.__annotations__
    data = {}
    for mk, mtype in props.items():
        v = req.args.getlist(mk, [])
        if len(v) == 0:
            v = req.form.get(mk, [])
        if mtype == str:
            if len(v) == 0:
                raise UserActionException(f'Missing request argument {mk}')
            elif len(v) > 1:
                raise UserActionException(f'Argument {mk} is cannot be multi-valued')
            data[mk] = v[0]
        elif mtype == Union[str, None]:
            if len(v) > 1:
                raise UserActionException(f'Argument {mk} is cannot be multi-valued')
            elif len(v) == 1:
                data[mk] = v[0]
        elif mtype == List[str]:
            if len(v) == 0:
                raise UserActionException(f'Missing request argument {mk}')
            data[mk] = v
        elif mtype == Union[List[str], None]:
            if len(v) > 0:
                data[mk] = v
        elif mtype == int:
            if len(v) == 0:
                raise UserActionException(f'Missing request argument {mk}')
            elif len(v) > 1:
                raise UserActionException(f'Argument {mk} is cannot be multi-valued')
            data[mk] = int(v[0])
        elif mtype == Union[int, None]:
            if len(v) > 1:
                raise UserActionException(f'Argument {mk} is cannot be multi-valued')
            elif len(v) == 1:
                data[mk] = int(v[0])
        elif mtype == List[int]:
            if len(v) == 0:
                raise UserActionException(f'Missing request argument {mk}')
            data[mk] = [int(x) for x in v]
        elif mtype == Union[List[int], None]:
            if len(v) > 0:
                data[mk] = [int(x) for x in v]
    return tp(**data)


def http_action(
        access_level: int = 0,
        template: Optional[str] = None,
        action_model: Optional[Type[BaseActionModel]] = None,
        page_model: Optional[str] = None,
        mapped_args: Optional[Type] = None,
        mutates_result: bool = False,
        apply_semi_persist_args: bool = False,
        return_type: str = 'template',
        action_log_mapper: Callable[[Request], Any] = False):
    """
    This decorator allows more convenient way how to
    set methods' attributes. Please note that there is
    always an implicit property '__exposed__' set to True.

    arguments:
    access_level -- 0,1,... (0 = public user, 1 = logged in user)
    template -- a Jinja2 template source path
    vars -- deprecated; do not use
    page_model -- a JavaScript page module
    mapped_args -- any class (typically, a dataclass) request arguments will be mapped to; the class must
                   provide
    skip_corpus_init -- True/False (if True then all the corpus init. procedures are skipped
    mutates_result -- store a new set of result parameters under a new key to query_peristence db
    apply_semi_persist_args -- if True hen use session to initialize action args first
    return_type -- {plain, json, template, xml}
    """
    def decorator(func: Callable[[BaseActionModel, KRequest, KResponse], Coroutine[Any, Any, Optional[ResultType]]]):
        @wraps(func)
        async def wrapper(request: Request, *args, **kw):
            application = Sanic.get_app('kontext')
            app_url_prefix = application.config['action_path_prefix']
            if request.path.startswith(app_url_prefix):
                norm_path = request.path[len(app_url_prefix):]
            else:
                norm_path = request.path
            path_elms = norm_path.split('/')
            action_name = path_elms[-1]
            action_prefix = '/'.join(path_elms[:-1]) if len(path_elms) > 1 else ''
            aprops = ActionProps(
                action_name=action_name, action_prefix=action_prefix, access_level=access_level,
                return_type=return_type, page_model=page_model,
                mutates_result=mutates_result)
            if mapped_args:
                marg = create_mapped_args(mapped_args, request)
            else:
                marg = None
            req = KRequest(request, aprops, app_url_prefix, marg)
            resp = KResponse(
                root_url=req.get_root_url(),
                redirect_safe_domains=application.config['redirect_safe_domains'],
                cookies_same_site=application.config['cookies_same_site']
            )
            if action_model:
                amodel = action_model(req, resp, aprops, application.ctx.tt_cache)
            else:
                amodel = BaseActionModel(req, resp, aprops, application.ctx.tt_cache)

            try:
                amodel.init_session()
                await amodel.pre_dispatch(None)
                ans = await func(amodel, req, resp)
                await amodel.post_dispatch(aprops, ans, None)  # TODO error desc
                return HTTPResponse(
                    body=await _output_result(
                        app=application,
                        action_model=amodel,
                        action_props=aprops,
                        tpl_engine=application.ctx.templating,
                        template=template,
                        result=ans,
                        status=resp.http_status_code,
                        return_type=aprops.return_type),
                    status=resp.http_status_code,
                    headers=resp.output_headers(return_type))
            except ImmediateRedirectException as ex:
                return response.redirect(ex.url, status=ex.code)

        return wrapper
    return decorator
