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

import json
import logging
from functools import wraps
from typing import Any, Callable, Coroutine, Optional, Type, Union

import settings
from action.argmapping.action import create_mapped_args
from action.errors import (
    AlignedCorpusForbiddenException, CorpusForbiddenException,
    ForbiddenException, ImmediateRedirectException, UserReadableException)
from action.krequest import KRequest
from action.model import ModelsSharedData
from action.model.abstract import AbstractPageModel, AbstractUserModel
from action.model.base import BaseActionModel
from action.model.user import UserActionModel
from action.props import ActionProps
from action.response import KResponse
from action.result.base import BaseResult
from action.templating import CustomJSONEncoder, ResultType, TplEngine
from action.theme import apply_theme
from dataclasses_json import DataClassJsonMixin
from sanic import HTTPResponse, Sanic, Websocket, response
from sanic.request import Request
from templating import Type2XML


async def _output_result(
        app: Sanic,
        action_model: AbstractPageModel,
        action_props: ActionProps,
        tpl_engine: TplEngine,
        translate: Callable[[str], str],
        resp: KResponse) -> Union[str, bytes]:
    """
    Renders a response body out of a provided data (result). The concrete form of data transformation
    depends on the combination of the 'return_type' argument and a type of the 'result'.
    Typical combinations are (ret. type, data type):
    'template' + dict
    'json' + dict (which may contain dataclass_json instances)
    'json' + dataclass_json
    'plain' + str
    A callable 'result' can be used for lazy result evaluation or for JSON encoding with a custom encoder
    """
    if 300 <= resp.http_status_code < 400 or resp.result is None:
        return ''
    result = resp.result() if callable(resp.result) else resp.result
    if action_props.return_type == 'json':
        try:
            if type(result) in (str, bytes):
                return result
            elif type(result) is dict:
                result['messages'] = resp.system_messages
                return json.dumps(result)
            else:
                if hasattr(result, 'messages'):
                    setattr(result, 'messages', resp.system_messages)
                return json.dumps(result, cls=CustomJSONEncoder)
        except Exception as e:
            return json.dumps(dict(messages=[('error', str(e))]))
    elif action_props.return_type == 'xml':
        return Type2XML.to_xml(result)
    elif action_props.return_type == 'plain' and not isinstance(result, (dict, DataClassJsonMixin)):
        return result
    elif action_props.return_type == 'template' and (result is None or isinstance(result, dict)):
        result = await action_model.add_globals(app, action_props, result)
        if isinstance(result, dict):
            result['messages'] = resp.system_messages
        apply_theme(result, app, translate)
        action_model.init_menu(result)
        return tpl_engine.render(action_props.template, result, translate)

    if (isinstance(result, dict) and
            'messages' in result and
            any(x[0] == 'error' for x in result['messages'])):
        raise RuntimeError(f'Exceptions occured: {result["messages"]}')
    raise RuntimeError(
        f'Unsupported result and return_type combination: {result.__class__.__name__},  {action_props.return_type}')


async def resolve_error(
        amodel: BaseActionModel, req: KRequest, resp: KResponse, err: Exception, is_debug: bool):
    """
    resolve_error provides a way how to finish an action with some
    reasonable output in case the action has thrown an error.
    """

    ans = {
        'last_used_corp': dict(corpname=None, human_corpname=None),
        'Q': [],
        'messages': resp.system_messages[:]
    }
    await amodel.resolve_error_state(req, resp, ans, err)
    if isinstance(err, UserReadableException):
        resp.add_system_message('error', str(err))
        resp.set_http_status(err.code)
        if err.error_args:
            ans['error_args'] = err.error_args
    elif is_debug:
        resp.add_system_message('error', str(err))
        resp.set_http_status(500)
    else:
        resp.add_system_message('error', 'System problem detected. Please contact administrator.')
        resp.set_http_status(500)

    if is_debug:
        logging.getLogger(__name__).exception(err)
        import traceback
        resp.add_system_message('error', traceback.format_exc())

    resp.set_result(ans)


def get_explicit_return_type(req: KRequest) -> Optional[str]:
    f = req.args_getlist('format')
    if len(f) == 0:
        f = req.form_getlist('format')
    if len(f) == 0:
        f = [req.json.get('format')]
    return f[0] if len(f) > 0 else None


def _is_authorized_to_execute_action(amodel: AbstractPageModel, aprops: ActionProps):
    return not isinstance(amodel, AbstractUserModel) or aprops.access_level <= 1 or not amodel.user_is_anonymous()


def http_action(
        access_level: int = 1,
        template: Optional[str] = None,
        action_model: Optional[Type[BaseActionModel]] = None,
        page_model: Optional[Union[str, Type[BaseResult]]] = None,
        mapped_args: Optional[Type] = None,
        mutates_result: bool = False,
        return_type: Optional[str] = None,
        action_log_mapper: Optional[Callable[[KRequest], Any]] = None):
    """
    http_action decorator wraps Sanic view functions to provide more
    convenient arguments (including important action models). KonText
    action function has a signature:

    def some_action(action_model: BaseActionModel, req: KRequest, resp: KResponse) -> ResultType

    arguments:
    access_level -- 0, 1, 2 (0 = public user always, 1 = public user iff no_public_access is False, 2 = logged in user)
    template -- a Jinja2 template source path (a relative path starting in the 'templates' dir)
    action_model -- a model providing functions for handling user session (session in a general sense),
                    accessing corpora and misc. search results
    page_model -- a JavaScript page module or action.result.base.BaseResult providing also response data container
    mapped_args -- any class (typically, a dataclass) request arguments will be mapped to; the class must
                   provide one of the following typed arguments: int, List[int], str, List[str].
                   All the values can be also Optional.
    mutates_result -- If set to True, then after a respective action a configured action model is notified
                      it should store actual result data. This is particularly important for concordance
                      actions like filters, sorting etc. where the concordance changes based on the previous
                      state.
    return_type -- specifies how the result data should be interpreted for the client {plain, json, template, xml}.
                   In some cases, a single result type (typically a Dict) can be transformed into multiple formats
                   (html page, xml file, json file, plain text file) but in other cases the choice is limited
                   (e.g. when returning some binary data, only 'plain' return_type makes sense).
                   In case a custom Content-Type is needed, return_type must be set to 'plain', otherwise KonText
                   will force predefined type (e.g. for template it is text/html etc.).
    """
    def decorator(func: Callable[[AbstractPageModel, KRequest, KResponse], Coroutine[Any, Any, Optional[ResultType]]]):
        @wraps(func)
        async def wrapper(request: Request, *args, **kw):
            application = Sanic.get_app('kontext')
            app_url_prefix = application.config['action_path_prefix']
            if mapped_args:
                marg = create_mapped_args(mapped_args, request)
            else:
                marg = None
            req = KRequest(request, app_url_prefix, marg)
            resp = KResponse(
                root_url=req.get_root_url(),
                redirect_safe_domains=application.config['redirect_safe_domains'],
                cookies_same_site=application.config['cookies_same_site'],
                result=page_model if isinstance(page_model, BaseResult) else None
            )

            if request.path.startswith(app_url_prefix):
                norm_path = request.path[len(app_url_prefix):]
            else:
                norm_path = request.path
            path_elms = norm_path.split('/')
            action_name = path_elms[-1]
            action_prefix = '/'.join(path_elms[:-1]) if len(path_elms) > 1 else ''
            no_anonymous_access = settings.get_bool('global', 'no_anonymous_access', False)
            if no_anonymous_access and access_level == 1:
                runtime_access_level = 2
            else:
                runtime_access_level = access_level
            aprops = ActionProps(
                action_name=action_name, action_prefix=action_prefix,
                access_level=runtime_access_level,
                return_type=return_type, page_model=page_model, template=template,
                mutates_result=mutates_result, action_log_mapper=action_log_mapper)
            expl_return_type = get_explicit_return_type(req)
            if expl_return_type:
                aprops.return_type = expl_return_type
            elif not return_type and template:
                aprops.return_type = 'template'

            shared_data = ModelsSharedData(application.ctx.tt_cache, dict())
            if action_model:
                amodel = action_model(req, resp, aprops, shared_data)
            else:
                amodel = BaseActionModel(req, resp, aprops, shared_data)
            try:
                await amodel.init_session()
                if _is_authorized_to_execute_action(amodel, aprops):
                    await amodel.pre_dispatch(None)
                    ans = await func(amodel, req, resp)
                    if resp.result and ans:
                        raise RuntimeError(
                            'Cannot use both KResponse result container and legacy result return')
                    elif ans is not None:
                        resp.set_result(ans)
                    await amodel.post_dispatch(aprops, resp, None)
                else:
                    amodel = UserActionModel(req, resp, aprops, shared_data)
                    await amodel.pre_dispatch(None)
                    await amodel.post_dispatch(aprops, None, None)
                    raise ForbiddenException(req.translate('Access forbidden - please log-in.'))

            except ImmediateRedirectException as ex:
                return response.redirect(ex.url, status=ex.code)

            except Exception as ex:
                if aprops.return_type == 'plain':
                    raise
                await resolve_error(amodel, req, resp, ex, settings.is_debug_mode())
                if aprops.template:
                    aprops.template = 'message.html'
                    aprops.page_model = 'message'
                    resp.result['popup_server_messages'] = False
                    if isinstance(ex, (CorpusForbiddenException, AlignedCorpusForbiddenException)):
                        amodel.disable_menu_on_forbidden_corpus()
                if not aprops.return_type:
                    aprops.return_type = 'template'

            if resp.result is None:
                resp_body = None
            else:
                resp_body = await _output_result(
                    app=application,
                    action_model=amodel,
                    action_props=aprops,
                    tpl_engine=application.ctx.templating,
                    translate=req.translate,
                    resp=resp)
            return HTTPResponse(
                body=resp_body,
                status=resp.http_status_code,
                headers=resp.output_headers(aprops.return_type))

        return wrapper
    return decorator
