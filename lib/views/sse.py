# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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

import asyncio
import aiohttp
from typing import Type, TypeVar

import settings
import plugins
import ujson as json
from action.krequest import KRequest
from action.model import ModelsSharedData
from action.model.abstract import AbstractPageModel, AbstractUserModel
from action.model.concordance import ConcActionModel
from action.model.user import UserActionModel
from action.props import ActionProps
from sanic import Blueprint, Request, Sanic, text
from views.concordance import _get_conc_cache_status
from views.root import _check_task_status

bp = Blueprint('eventsource')

T = TypeVar('T')

# intervals in seconds
TASK_CHECK_INTERVAL = 1
CONC_CHECK_INTERVAL = 1
MAX_STREAMING_ITERATIONS = 1000


def _is_authorized_to_execute_action(amodel: AbstractPageModel, aprops: ActionProps):
    return not isinstance(amodel, AbstractUserModel) or aprops.access_level <= 1 or not amodel.user_is_anonymous()


async def _init_action_model(req: Request, action_model: Type[T], access_level: int) -> T:
    application = Sanic.get_app('kontext')
    app_url_prefix = application.config['action_path_prefix']
    if req.path.startswith(app_url_prefix):
        norm_path = req.path[len(app_url_prefix):]
    else:
        norm_path = req.path
    path_elms = norm_path.split('/')
    action_name = path_elms[-1]
    action_prefix = '/'.join(path_elms[:-1]) if len(path_elms) > 1 else ''
    if settings.get_bool('global', 'no_anonymous_access', False) and access_level == 1:
        runtime_access_level = 2
    else:
        runtime_access_level = access_level
    aprops = ActionProps(
        action_name=action_name, action_prefix=action_prefix,
        access_level=runtime_access_level,
        return_type='plain',  # TODO
        mutates_result=False, action_log_mapper=None)

    shared_data = ModelsSharedData(application.ctx.tt_cache, dict())
    krequest = KRequest(req, app_url_prefix, None)
    amodel = action_model(krequest, None, aprops, shared_data)
    async with aiohttp.ClientSession() as client:
        req.ctx.http_client = client
        await amodel.init_session()
        if not _is_authorized_to_execute_action(amodel, aprops):
            raise PermissionError
        await amodel.pre_dispatch(None)
        return amodel


@bp.route('/task_status')
async def check_tasks_status(req: Request):
    amodel = await _init_action_model(req, UserActionModel, 1)
    task_id = req.args.get('taskId')
    if not task_id:
        return text('task not found', status=404)

    response = await req.respond(
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )
    task = await _check_task_status(amodel, task_id)
    await response.send(f"data: {json.dumps(task.to_dict())}\n\n")
    i = 0
    while task and not task.is_finished() and i < MAX_STREAMING_ITERATIONS:
        await asyncio.sleep(TASK_CHECK_INTERVAL)
        task = await _check_task_status(amodel, task_id)
        await response.send(f"data: {json.dumps(task.to_dict())}\n\n")
        i += 1
    # now we must manually close plug-ins as Sanic's response middleware
    # does not wait for the stream end.
    for p in plugins.runtime:
        if hasattr(p.instance, 'on_response'):
            await p.instance.on_response()


@bp.route('/conc_cache_status')
async def conc_cache_status(req: Request):
    amodel = await _init_action_model(req, ConcActionModel, 0)
    response = await req.respond(
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    )

    for i in range(MAX_STREAMING_ITERATIONS):
        status = await _get_conc_cache_status(amodel)
        await response.send(f"data: {json.dumps(status)}\n\n")
        if status['finished']:
            break
        await asyncio.sleep(CONC_CHECK_INTERVAL)
    # now we must manually close plug-ins as Sanic's response middleware
    # does not wait for the stream end.
    for p in plugins.runtime:
        if hasattr(p.instance, 'on_response'):
            await p.instance.on_response()