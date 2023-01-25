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

import plugins
import settings
import ujson as json
from action.errors import NotFoundException
from action.krequest import KRequest
from action.model import ModelsSharedData
from action.model.user import UserActionModel
from action.props import ActionProps
from bgcalc import calc_backend_client
from bgcalc.errors import CalcTaskNotFoundError
from conclib.calc import cancel_conc_task
from corplib import CorpusFactory
from corplib.abstract import SubcorpusIdent
from corplib.corpus import KCorpus
from sanic import Blueprint, Request, Sanic, Websocket
from views.root import _check_tasks_status

bp = Blueprint('websocket', 'ws')


async def _init_user_action_model(req: Request) -> UserActionModel:
    application = Sanic.get_app('kontext')
    app_url_prefix = application.config['action_path_prefix']
    req = KRequest(req, app_url_prefix, None)

    if req.path.startswith(app_url_prefix):
        norm_path = req.path[len(app_url_prefix):]
    else:
        norm_path = req.path
    path_elms = norm_path.split('/')
    action_name = path_elms[-1]
    action_prefix = '/'.join(path_elms[:-1]) if len(path_elms) > 1 else ''
    runtime_access_level = 2 if settings.get_bool('global', 'no_anonymous_access', False) else 1
    aprops = ActionProps(
        action_name=action_name, action_prefix=action_prefix,
        access_level=runtime_access_level,
        return_type='plain',  # TODO
        mutates_result=False, action_log_mapper=None)

    shared_data = ModelsSharedData(application.ctx.tt_cache, dict())
    amodel = UserActionModel(req, None, aprops, shared_data)
    await amodel.init_session()
    if amodel.user_is_anonymous():
        raise PermissionError
    return amodel


@bp.websocket('/task_status')
async def check_tasks_status(req: Request, ws: Websocket):
    try:
        amodel = await _init_user_action_model(req)

    except PermissionError:
        await ws.send('Access forbidden - please log-in.')
        return

    watched_tasks = req.args.get('taskId')
    if not watched_tasks:
        await ws.send('Missing `taskId` parameter.')
        return

    tasks = {t.ident: t for t in (await _check_tasks_status(amodel, req, None))}
    await ws.send(json.dumps([v.to_dict() for v in tasks.values()]))
    watched_tasks = [x for x in watched_tasks if x in tasks]
    while watched_tasks:
        await asyncio.sleep(1)  # TODO move constant to settings or something
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
    user_id = int(req.args['user_id'][0])
    corp_id = req.args['corp_id'][0]
    subc_id = req.args.get('subc_id')
    conc_id = req.args['conc_id'][0]

    cf = CorpusFactory(subc_root=settings.get('corpora', 'subcorpora_dir'))
    corp = await cf.get_corpus(
        SubcorpusIdent(id=subc_id, corpus_name=corp_id) if subc_id else corp_id
    )
    while True:
        try:
            response = await get_conc_cache_status(corp, conc_id)
        except Exception as e:
            response = {'error': str(e), 'finished': True}
        await ws.send(json.dumps(response))

        if response['finished']:
            return
        else:
            await asyncio.sleep(1)  # TODO move constant to settings or something


async def get_conc_cache_status(corp: KCorpus, conc_id: str):
    with plugins.runtime.CONC_CACHE as cc:
        cache_map = cc.get_mapping(corp)

    q = []
    try:
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            data = await qp.open(conc_id)
            q = data.get('q', [])
        cache_status = await cache_map.get_calc_status(corp.cache_key, data.get('q', []))
        if cache_status is None:  # conc is not cached nor calculated
            raise Exception('Concordance calculation is lost')
        elif not cache_status.finished and cache_status.task_id:
            # we must also test directly a respective task as might have been killed
            # and thus failed to store info to cache metadata
            worker = calc_backend_client(settings)
            err = worker.get_task_error(cache_status.task_id)
            if err is not None:
                raise err
        return {
            'finished': cache_status.finished,
            'concsize': cache_status.concsize,
            'fullsize': cache_status.fullsize,
            'relconcsize': cache_status.relconcsize,
            'arf': cache_status.arf
        }
    except CalcTaskNotFoundError as ex:
        await cancel_conc_task(cache_map, corp.cache_key, q)
        raise Exception(f'Concordance calculation is lost: {ex}')
    except Exception as ex:
        await cancel_conc_task(cache_map, corp.cache_key, q)
        raise ex
