from typing import Any, Dict, List

import asyncio
from aiohttp import web, WSMsgType

import os
import sys
import json
import time
import argparse
from redis import Redis
from rq.job import Job
from rq.exceptions import NoSuchJobError
import functools
import logging

APP_PATH = os.path.realpath(f'{os.path.dirname(os.path.abspath(__file__))}/..')
sys.path.insert(0, os.path.join(APP_PATH, 'lib'))  # application libraries

import settings
from conclib.calc import cancel_conc_task
from corplib.corpus import KCorpus
from corplib import CorpusManager
from bgcalc.errors import CalcTaskNotFoundError
from bgcalc import calc_backend_client
import plugins
import initializer
settings.load(os.path.join(APP_PATH, 'conf', 'config.xml'))
os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')
initializer.init_plugin('db')
initializer.init_plugin('integration_db')
initializer.init_plugin('query_persistence')
initializer.init_plugin('conc_cache')
initializer.init_plugin('auth')

TASK_LIMIT = settings.get_int('calc_backend', 'task_time_limit')
JOB_REFRESH_PERIOD = 1.0  # in seconds
CONC_CACHE_STATUS_REFRESH_PERIOD = 0.2  # in seconds
STATUS_KONTEXT_MAP = dict(
    queued='PENDING',
    started='STARTED',
    deferred='deferred',  # TODO Rq specific
    finished='SUCCESS',
    failed='FAILURE'
)


def prepare_response(jobs: Dict[str, Job]) -> List[Dict[str, Any]]:
    return [
        {
            'ident': job_id,
            'label': None,  # TODO
            'category': None,  # TODO
            'status': STATUS_KONTEXT_MAP[job.get_status(refresh=False) if job is not None else 'failed'],
            'created': job.enqueued_at.timestamp() if job is not None else None,
            'error': job.exc_info if job is not None else 'job not found',
            'args': None,  # TODO
            'url': None,  # TODO
        }
        for job_id, job in jobs.items()
    ]


async def job_status_ws_handler(redis_client: Redis, request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    logging.debug('Client connected to job status')

    jobs = {}
    job_status = {}

    async def check_status(job: Job) -> str:
        await asyncio.sleep(JOB_REFRESH_PERIOD)
        try:
            job.refresh()
        except NoSuchJobError:
            jobs[job.id] = None
        return job.id

    recieve_msg_task = asyncio.ensure_future(ws.receive())
    pending = set([recieve_msg_task])
    while not ws.closed:
        done, pending = await asyncio.wait(
            pending,
            return_when=asyncio.FIRST_COMPLETED
        )

        # update job list when received message
        if recieve_msg_task in done:
            msg = recieve_msg_task.result()
            if msg.type == WSMsgType.ERROR:
                logging.error(f'WS connection closed with exception {ws.exception()}')

            elif msg.type == WSMsgType.TEXT:
                if msg.data == 'close':
                    await ws.close()

                else:
                    new_job_ids = json.loads(msg.data)
                    logging.debug('Watching new job ids: %s', new_job_ids)
                    jobs = dict(zip(new_job_ids, Job.fetch_many(new_job_ids, redis_client)))

                    pending = set(
                        asyncio.ensure_future(check_status(job))
                        for job in jobs.values()
                        if job is not None
                    )
                    recieve_msg_task = asyncio.ensure_future(ws.receive())
                    pending.add(recieve_msg_task)

                    job_status = {
                        job_id: job.get_status(refresh=False)
                        if job is not None
                        else None
                        for job_id, job in jobs.items()
                    }
                    await ws.send_json(prepare_response(jobs))

        # handle job status check
        else:
            change = False
            for done_task in done:
                job_id = done_task.result()

                if jobs[job_id] is not None:
                    job = jobs[job_id]
                    new_status = job.get_status(refresh=False)
                    pending.add(check_status(jobs[job_id]))
                    if job_status[job_id] != new_status:
                        job_status[job_id] = new_status
                        change = True
                    else:
                        now = time.time()
                        if (job.is_queued or job.is_started) and now - job.enqueued_at.timestamp() > TASK_LIMIT:
                            jobs[job_id].exc_info = 'task time limit exceeded'
                            change = True

                else:
                    job_status[job_id] = None
                    change = True

            if change:
                await ws.send_json(prepare_response(jobs))

    logging.debug('Client disconnected from job status')
    return ws


async def conc_cache_status_ws_handler(request: web.Request) -> web.WebSocketResponse:
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    logging.debug('Client connected to conc cache status')

    # wait for concordance parameters
    msg = await ws.receive()
    params = json.loads(msg.data)
    logging.debug('Received conc parameters: %s', params)

    subcpath = [os.path.join(settings.get('corpora', 'users_subcpath'), 'published')]
    with plugins.runtime.AUTH as auth:
        if not auth.is_anonymous(params['user_id']):
            subcpath.insert(0, os.path.join(settings.get(
                'corpora', 'users_subcpath'), str(params['user_id'])))
    cm = CorpusManager(subcpath)
    corp = cm.get_corpus(corpname=params['corp_id'], subcname=params.get('subc_path', None))

    # check until finished
    while not ws.closed:
        try:
            response = get_conc_cache_status(corp, params['conc_id'])
        except Exception as e:
            response = {'error': str(e), 'finished': True}
        await ws.send_json(response)

        if response['finished']:
            await ws.close()
        else:
            await asyncio.sleep(CONC_CACHE_STATUS_REFRESH_PERIOD)

    logging.debug('Client disconnected from conc cache status')
    return ws


def get_conc_cache_status(corp: KCorpus, conc_id: str):
    cache_map = plugins.runtime.CONC_CACHE.instance.get_mapping(corp)
    q = []
    try:
        with plugins.runtime.QUERY_PERSISTENCE as qp:
            data = qp.open(conc_id)
            q = data.get('q', [])
        cache_status = cache_map.get_calc_status(corp.subchash, data.get('q', []))
        if cache_status is None:  # conc is not cached nor calculated
            return Exception('Concordance calculation is lost')
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
        cancel_conc_task(cache_map, corp.subchash, q)
        raise Exception(f'Concordance calculation is lost: {ex}')
    except Exception as ex:
        cancel_conc_task(cache_map, corp.subchash, q)
        raise ex


async def app_factory(redis_client: Redis=None) -> web.Application:
    app = web.Application()
    if redis_client is None:
        redis_client = Redis(
            host=settings.get('calc_backend', 'rq_redis_host'),
            port=settings.get('calc_backend', 'rq_redis_port'),
            db=settings.get('calc_backend', 'rq_redis_db')
        )

    app.router.add_get('/conc_cache_status', conc_cache_status_ws_handler)
    if settings.get('calc_backend', 'type') == 'rq':
        app.router.add_get('/job_status', functools.partial(job_status_ws_handler, redis_client))
    else:
        logging.error('WebSocket status check is supported only for Rq backend')

    return app


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="aiohttp server example")
    parser.add_argument('--host', default='localhost')
    parser.add_argument('--port', default=8080)
    parser.add_argument('--redis_host', default=settings.get('calc_backend', 'rq_redis_host'))
    parser.add_argument('--redis_port', default=settings.get('calc_backend', 'rq_redis_port'))
    parser.add_argument('--redis_db', default=settings.get('calc_backend', 'rq_redis_db'))
    parser.add_argument('--log', default='warning',
                        help="Provide logging level (debug, info, warning, ...), default: warning")
    args = parser.parse_args()

    levels = {
        'critical': logging.CRITICAL,
        'error': logging.ERROR,
        'warn': logging.WARNING,
        'warning': logging.WARNING,
        'info': logging.INFO,
        'debug': logging.DEBUG
    }

    level = levels.get(args.log.lower())
    if level is None:
        raise ValueError(
            f"log level given: {args.log} -- must be one of: {' | '.join(levels.keys())}")

    logging.basicConfig(level=level)

    redis_client = Redis(host=args.redis_host, port=args.redis_port, db=args.redis_db)
    web.run_app(app_factory(redis_client), host=args.host, port=args.port)
