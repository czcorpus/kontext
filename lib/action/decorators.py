from sanic.request import Request
from sanic import HTTPResponse, Sanic
from sanic import response
from typing import Optional, Union, Callable, Any, Type
from functools import wraps
from action.templating import CustomJSONEncoder, TplEngine, ResultType
from action import ActionProps
from action.krequest import KRequest
from action.response import KResponse
from dataclasses_json import DataClassJsonMixin
from action.errors import ImmediateRedirectException
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
        return tpl_engine.render(template, result)
    raise RuntimeError(
        f'Unknown source ({result.__class__.__name__}) or return type ({return_type})')


def http_action(
        access_level: int = 0, template: Optional[str] = None, action_model: Type[BaseActionModel] = None,
        page_model: Optional[str] = None, func_arg_mapped: bool = False,
        mutates_result: bool = False, accept_kwargs: bool = None, apply_semi_persist_args: bool = False,
        return_type: str = 'template', action_log_mapper: Callable[[Request], Any] = False):
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
    accept_kwargs -- True/False
    apply_semi_persist_args -- if True hen use session to initialize action args first
    return_type -- {plain, json, template, xml}
    """
    def decorator(func: Callable[[BaseActionModel, KRequest, KResponse], Optional[ResultType]]):
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
            req = KRequest(request, aprops, app_url_prefix)
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
                ans = await func(amodel, req, resp, **kw)
                amodel.post_dispatch(aprops, ans, None)  # TODO error desc
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
