import asyncio
from aiohttp import web, WSMsgType

import os
import sys
import json
import argparse
from redis import Redis
from rq.job import Job
from rq.exceptions import NoSuchJobError
import functools

REFRESH_RATE = 1.0

APP_PATH = os.path.realpath(f'{os.path.dirname(os.path.abspath(__file__))}/..')
sys.path.insert(0, os.path.join(APP_PATH, 'lib'))  # application libraries

import settings
settings.load(os.path.join(APP_PATH, 'conf', 'config.xml'))


async def tasks_status_ws_handler(redis_client: Redis, request: web.Request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    print('Client connected')

    jobs = {}
    job_status = {}

    async def check_status(job: Job):
        await asyncio.sleep(REFRESH_RATE)
        try:
            job.refresh()
        except NoSuchJobError:
            jobs[job.id] = None
        return job.id

    recieve_msg = asyncio.ensure_future(ws.receive())
    pending = set([recieve_msg])
    while not ws.closed:
        done, pending = await asyncio.wait(
            pending,
            return_when=asyncio.FIRST_COMPLETED
        )

        # update job list when received message
        if recieve_msg in done:
            msg = recieve_msg.result()
            if msg.type == WSMsgType.ERROR:
                print(f'WS connection closed with exception {ws.exception()}')

            elif msg.type == WSMsgType.TEXT:
                if msg.data == 'close':
                    print('Connection closed')
                    await ws.close()

                else:
                    new_job_ids = json.loads(msg.data)
                    print(f'Watching jobs {new_job_ids}')

                    jobs = {}
                    for job_id in new_job_ids:
                        try:
                            jobs[job_id] = Job.fetch(job_id, redis_client)
                        except NoSuchJobError:
                            jobs[job_id] = None

                    pending = set(check_status(job) for job in jobs.values() if job is not None)
                    recieve_msg = asyncio.ensure_future(ws.receive())
                    pending.add(recieve_msg)

                    job_status = {
                        job_id: job.get_status()
                        if job is not None
                        else 'not found'
                        for job_id, job in jobs.items()
                    }
                    await ws.send_json(job_status)

        # handle job status check
        else:
            for done_task in done:
                job_id = done_task.result()

                if jobs[job_id] is not None:
                    pending.add(check_status(jobs[job_id]))
                    if job_status[job_id] != jobs[job_id].get_status():
                        job_status[job_id] = jobs[job_id].get_status()
                        await ws.send_json(job_status)

                else:
                    job_status[job_id] = 'not found'
                    await ws.send_json(job_status)

    return ws


async def status_app(redis_client: Redis=None):
    app = web.Application()
    if redis_client is None:
        redis_client = Redis(
            host=settings.get('calc_backend', 'rq_redis_host'),
            port=settings.get('calc_backend', 'rq_redis_port'),
            db=settings.get('calc_backend', 'rq_redis_db')
        )
    app.add_routes([web.get('/job_status', functools.partial(tasks_status_ws_handler, redis_client))])
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
    web.run_app(status_app(redis_client), path=args.host, port=args.port)
