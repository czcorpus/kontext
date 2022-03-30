from typing import Dict, Any
from sanic import Blueprint
import os
import aiofiles
from action.decorators import http_action
from action.errors import FunctionNotSupported, ImmediateRedirectException, NotFoundException
from action.krequest import KRequest
from action.model.authorized import UserActionModel
from action.response import KResponse

import settings
import bgcalc


bp = Blueprint('root')


@bp.route('/')
@http_action()
async def root_action(amodel, req, resp):
    raise ImmediateRedirectException(req.create_url('query', {}))


async def _check_tasks_status(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
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


@bp.route('/check_tasks_status')
@http_action(return_type='json', action_model=UserActionModel)
async def check_tasks_status(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    return await _check_tasks_status(amodel, req, resp)


@bp.route('/get_task_result')
@http_action(return_type='json')
async def get_task_result(amodel, req, resp):
    worker = bgcalc.calc_backend_client(settings)
    result = worker.AsyncResult(req.args.get('task_id'))
    return dict(result=result.get())


@bp.route('/remove_task_info', methods=['DELETE'])
@http_action(return_type='json', action_model=UserActionModel)
async def remove_task_info(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    task_ids = req.form_getlist('tasks')
    amodel.set_async_tasks([x for x in amodel.get_async_tasks() if x.ident not in task_ids])
    return await _check_tasks_status(amodel, req, resp)


@bp.route('/compatibility')
@http_action(action_model=UserActionModel, template='compatibility.html')
async def compatibility(amodel, req, resp):
    return {'_version': (None, None)}


@bp.route('/robots.txt')
@http_action(action_model=UserActionModel, return_type='plain')
async def robots(amodel, req, resp):
    rpath = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'files', 'robots.txt')
    if os.path.isfile(rpath):
        async with aiofiles.open(rpath) as fr:
            return await fr.read()
    raise NotFoundException('File robots.txt is not defined')
