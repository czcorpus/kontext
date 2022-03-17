from typing import Dict, Any
from sanic import Sanic, response, Blueprint
from sanic.views import HTTPMethodView
from sanic.response import text
from sanic.request import Request
from action.decorators import http_action
from action.errors import FunctionNotSupported, ImmediateRedirectException, CorpusForbiddenException

import settings
import plugins
import bgcalc


bp = Blueprint('root')


@bp.route('/')
@http_action()
async def root_action(amodel, req, resp):
    raise ImmediateRedirectException(req.create_url('query', {}))


@bp.route('/check_tasks_status')
@http_action(return_type='json')
def check_tasks_status(amodel, req, resp) -> Dict[str, Any]:
    backend = settings.get('calc_backend', 'type')
    if backend in ('celery', 'rq'):
        worker = bgcalc.calc_backend_client(settings)
        at_list = amodel.get_async_tasks()
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
        amodel.mark_timeouted_tasks(*upd_list)
        amodel.set_async_tasks(upd_list)
        return dict(data=[d.to_dict() for d in upd_list])
    else:
        raise FunctionNotSupported(f'Backend {backend} does not support status checking')


@bp.route('/get_task_result')
@http_action(return_type='json')
def get_task_result(amodel, req, resp):
    worker = bgcalc.calc_backend_client(settings)
    result = worker.AsyncResult(req.args.get('task_id'))
    return dict(result=result.get())


@bp.route('/remove_task_info', methods=['DELETE'])
@http_action(return_type='json')
def remove_task_info(amodel, req, resp) -> Dict[str, Any]:
    task_ids = req.form.getlist('tasks')
    amodel.set_async_tasks([x for x in amodel.get_async_tasks() if x.ident not in task_ids])
    return amodel.check_tasks_status(req)


@bp.exception(CorpusForbiddenException, Exception)
@bp.route('/message')
@http_action(page_model='message', template='message.html')
def message(amodel, req, resp):
    # TODO kwargs... replace with mapped args
    kw['last_used_corp'] = dict(corpname=None, human_corpname=None)
    if amodel.cm:
        with plugins.runtime.QUERY_HISTORY as qh:
            queries = qh.get_user_queries(amodel.session_get('user', 'id'), amodel.cm, limit=1)
            if len(queries) > 0:
                kw['last_used_corp'] = dict(
                    corpname=queries[0].get('corpname', None),
                    human_corpname=queries[0].get('human_corpname', None))
    kw['popup_server_messages'] = False
    return kw


@bp.route('/message_json')
@http_action(return_type='json')
def message_json(amodel, req, resp):
    return message(amodel, req, resp)


@bp.route('/message_xml')
@http_action(return_type='xml')
def message_xml(amodel, req, resp):
    return message(amodel, req, resp)


@bp.route('/compatibility')
@http_action(template='compatibility.html')
def compatibility(amodel, req, resp):
    return {}
