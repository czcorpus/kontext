from typing import Dict, Any
from sanic import Sanic, response, Blueprint
from sanic.views import HTTPMethodView
from sanic.response import text
from sanic.request import Request
from action.decorators import http_action
from action.errors import FunctionNotSupported, ImmediateRedirectException

import settings
import plugins
import bgcalc
from action.model.base import BaseActionModel

bp = Blueprint('root')


@bp.route('/')
@http_action()
async def root_action(request, _):
    raise ImmediateRedirectException('/query')


@bp.route('/check_tasks_status')
@http_action(return_type='json', skip_corpus_init=True)
def check_tasks_status(request: Request, action_model: BaseActionModel) -> Dict[str, Any]:
    backend = settings.get('calc_backend', 'type')
    if backend in ('celery', 'rq'):
        worker = bgcalc.calc_backend_client(settings)
        at_list = action_model.get_async_tasks()
        upd_list = []
        for at in at_list:
            r = worker.AsyncResult(at.ident)
            if r:
                at.status = r.status
                if at.status == 'FAILURE':
                    if hasattr(r.result, 'message'):
                        at.error = r.result.message
                    else:
                        at.error = str(r.result)
            else:
                at.status = 'FAILURE'
                at.error = 'job not found'
            upd_list.append(at)
        action_model._mark_timeouted_tasks(*upd_list)
        action_model._set_async_tasks(upd_list)
        return dict(data=[d.to_dict() for d in upd_list])
    else:
        raise FunctionNotSupported(f'Backend {backend} does not support status checking')


@bp.route('/get_task_result')
@http_action(return_type='json', skip_corpus_init=True)
def get_task_result(request, action_model: BaseActionModel):
    worker = bgcalc.calc_backend_client(settings)
    result = worker.AsyncResult(request.args.get('task_id'))
    return dict(result=result.get())


@bp.route('/remove_task_info')
@http_action(return_type='json', skip_corpus_init=True, http_method='DELETE')
def remove_task_info(request: Request, action_model: BaseActionModel) -> Dict[str, Any]:
    task_ids = request.form.getlist('tasks')
    action_model._set_async_tasks([x for x in action_model.get_async_tasks() if x.ident not in task_ids])
    return action_model.check_tasks_status(request)


@bp.route('/message')
@http_action(accept_kwargs=True, skip_corpus_init=True, page_model='message', template='message.html')
def message(request, action_model: BaseActionModel, *args, **kwargs):
    kwargs['last_used_corp'] = dict(corpname=None, human_corpname=None)
    if action_model.cm:
        with plugins.runtime.QUERY_HISTORY as qh:
            queries = qh.get_user_queries(action_model.session_get('user', 'id'), action_model.cm, limit=1)
            if len(queries) > 0:
                kwargs['last_used_corp'] = dict(corpname=queries[0].get('corpname', None),
                                                human_corpname=queries[0].get('human_corpname', None))
    kwargs['popup_server_messages'] = False
    return kwargs


@bp.route('/message_json')
@http_action(accept_kwargs=True, func_arg_mapped=True, skip_corpus_init=True, return_type='json')
def message_json(request, action_model: BaseActionModel, *args, **kwargs):
    return message(request, action_model, *args, **kwargs)


@bp.route('/message_xml')
@http_action(accept_kwargs=True, func_arg_mapped=True, skip_corpus_init=True, return_type='xml')
def message_xml(request, action_model: BaseActionModel, *args, **kwargs):
    return message(request, action_model, *args, **kwargs)


@bp.route('/compatibility')
@http_action(skip_corpus_init=True, template='compatibility.html')
def compatibility(request, action_model):
    return {}
