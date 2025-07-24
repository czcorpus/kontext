# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
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

import os
from typing import Any, Dict, Optional

import aiofiles
import aiofiles.os
import bgcalc
import settings
from action.control import http_action
from action.errors import ImmediateRedirectException, NotFoundException
from action.krequest import KRequest
from action.model.base import BaseActionModel
from action.model.user import UserActionModel
from action.response import KResponse
from bgcalc.task import AsyncTaskStatus
from sanic import Blueprint

bp = Blueprint('root')


@bp.route('/')
@http_action()
async def root_action(amodel: BaseActionModel, req: KRequest, resp: KResponse):
    raise ImmediateRedirectException(req.create_url('query', {}))


async def _check_task_status(amodel: UserActionModel, task_id: str) -> Optional[AsyncTaskStatus]:
    task = None
    for t in (await amodel.get_async_tasks()):
        if t.ident == task_id:
            task = t
            break
    if task is None: # not found but it can still be present on worker; TODO problem is, not all attrs will be preserved
        task = AsyncTaskStatus(ident=task_id, label='', status='PENDING', category='')
    found = await amodel.update_async_task_status(task)
    return task if found else None


@bp.route('/check_tasks_status')
@http_action(return_type='json', action_model=UserActionModel)
async def check_tasks_status(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    task = await _check_task_status(amodel, req.args.get('task_id'))
    if not task:
        resp.add_system_message('error', 'task not found')
        resp.set_not_found()
        return dict(data=None)
    return dict(data=task.to_dict())


@bp.route('/get_task_result')
@http_action(return_type='json')
async def get_task_result(amodel: BaseActionModel, req: KRequest, resp: KResponse):
    worker = bgcalc.calc_backend_client(settings)
    result = worker.AsyncResult(req.args.get('task_id'))
    return dict(result=await result.get())


@bp.route('/remove_task_info', methods=['DELETE'])
@http_action(return_type='json', action_model=UserActionModel)
async def remove_task_info(amodel: UserActionModel, req: KRequest, resp: KResponse) -> Dict[str, Any]:
    task_ids = req.form_getlist('tasks')
    amodel.set_async_tasks([x for x in (await amodel.get_async_tasks()) if x.ident not in task_ids])
    return dict(data=[t.to_dict() for t in (await amodel.get_async_tasks())])


@bp.route('/compatibility')
@http_action(action_model=UserActionModel, template='compatibility.html')
async def compatibility(amodel: UserActionModel, req: KRequest, resp: KResponse):
    return {'_version': (None, None)}


@bp.route('/robots.txt')
@http_action(action_model=UserActionModel, return_type='plain')
async def robots(amodel: UserActionModel, req: KRequest, resp: KResponse):
    rpath = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'files', 'robots.txt')
    if await aiofiles.os.path.isfile(rpath):
        async with aiofiles.open(rpath) as fr:
            return await fr.read()
    raise NotFoundException('File robots.txt is not defined')
