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
from typing import Type, TypeVar

import settings
import ujson as json
from action.krequest import KRequest
from action.model import ModelsSharedData
from action.model.abstract import AbstractPageModel, AbstractUserModel
from action.model.concordance import ConcActionModel
from action.model.user import UserActionModel
from action.props import ActionProps
from sanic import Blueprint, Request, Sanic, Websocket
from views.concordance import _get_conc_cache_status
from views.root import _check_tasks_status

bp = Blueprint('websocket', 'ws')

T = TypeVar('T')

# intervals in seconds
WEBSOCKET_TASK_CHECK_INTERVAL = 1
WEBSOCKET_CONC_CHECK_INTERVAL = 1


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
    await amodel.init_session()
    if not _is_authorized_to_execute_action(amodel, aprops):
        raise PermissionError
    await amodel.pre_dispatch(None)
    return amodel


async def _prepare_websocket_amodel(req: Request, ws: Websocket, amodel: Type[T], access_level: int) -> T:
    try:
        return await _init_action_model(req, amodel, access_level)

    except PermissionError:
        await ws.close(code=1008, reason='Access forbidden - please log-in.')


@bp.websocket('/task_status')
async def check_tasks_status(req: Request, ws: Websocket):
    amodel = await _prepare_websocket_amodel(req, ws, UserActionModel, 1)
    watched_tasks = req.args.get('taskId')
    if not watched_tasks:
        await ws.close(code=1007, reason='Missing `taskId` parameter.')

    tasks = {t.ident: t for t in (await _check_tasks_status(amodel, req, None))}
    await ws.send(json.dumps([v.to_dict() for v in tasks.values()]))
    watched_tasks = [x for x in watched_tasks if x in tasks]  # TODO remove?
    while watched_tasks:
        await asyncio.sleep(WEBSOCKET_TASK_CHECK_INTERVAL)
        changed = []
        for t in await _check_tasks_status(amodel, req, None):
            # AsyncTaskStatus has defined __eq__ method to check change
            if t.ident in watched_tasks and (t.ident not in tasks or t != tasks[t.ident]):
                tasks[t.ident] = t
                changed.append(t.to_dict())
                if t.is_finished():
                    watched_tasks = [x for x in watched_tasks if x != t.ident]
        if changed:
            await ws.send(json.dumps(changed))


@bp.websocket('/conc_cache_status')
async def conc_cache_status(req: Request, ws: Websocket):
    amodel = await _prepare_websocket_amodel(req, ws, ConcActionModel, 0)
    while True:
        try:
            response = await _get_conc_cache_status(amodel)
        except Exception as e:
            await ws.close(code=1011, reason=str(e))
        await ws.send(json.dumps(response))

        if response['finished']:
            await ws.close()
        else:
            await asyncio.sleep(WEBSOCKET_CONC_CHECK_INTERVAL)
