from typing import Any, Dict

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
settings.load(os.path.join(APP_PATH, 'conf', 'config.xml'))

TASK_LIMIT = settings.get_int('calc_backend', 'task_time_limit')
REFRESH_PERIOD = 1.0  # in seconds
STATUS_KONTEXT_MAP = dict(
    queued='PENDING',
    started='STARTED',
    deferred='deferred',  # TODO Rq specific
    finished='SUCCESS',
    failed='FAILURE'
)


def prepare_response(jobs: Dict[str, Job]):
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


async def job_status_ws_handler(redis_client: Redis, request: web.Request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    jobs = {}
    job_status = {}

    async def check_status(job: Job):
        await asyncio.sleep(REFRESH_PERIOD)
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
                        if (job.is_queued or job.is_started) and now - job.enqueued_at > TASK_LIMIT:
                            jobs[job_id].exc_info = 'task time limit exceeded'
                            change = True

                else:
                    job_status[job_id] = None
                    change = True

            if change:
                await ws.send_json(prepare_response(jobs))

    return ws


async def app_factory(redis_client: Redis=None):
    app = web.Application()
    if redis_client is None:
        redis_client = Redis(
            host=settings.get('calc_backend', 'rq_redis_host'),
            port=settings.get('calc_backend', 'rq_redis_port'),
            db=settings.get('calc_backend', 'rq_redis_db')
        )

    if settings.get('calc_backend', 'type') == 'rq':
        app.router.add_get('/job_status', functools.partial(job_status_ws_handler, redis_client))
    else:
        logging.warn('WebSocket status check is supported only for Rq backend')

    return app


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="aiohttp server example")
    parser.add_argument('--host', default='localhost')
    parser.add_argument('--port', default=8080)
    parser.add_argument('--redis_host', default=settings.get('calc_backend', 'rq_redis_host'))
    parser.add_argument('--redis_port', default=settings.get('calc_backend', 'rq_redis_port'))
    parser.add_argument('--redis_db', default=settings.get('calc_backend', 'rq_redis_db'))
    args = parser.parse_args()

    redis_client = Redis(host=args.redis_host, port=args.redis_port, db=args.redis_db)
    web.run_app(app_factory(redis_client), path=args.host, port=args.port)
