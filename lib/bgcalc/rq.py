# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import logging
import time
from rq import Queue
from redis import Redis
from rq_scheduler import Scheduler
import json


class ResultWrapper:

    status_map = dict(
        queued='PENDING',
        started='STARTED',
        deferred='deferred',  # TODO Rq specific
        finished='SUCCESS',
        failed='FAILURE'
    )

    def __init__(self, job):
        self.job = job

    def get(self, timeout=None):
        try:
            total_time = 0
            while True:
                time.sleep(0.5)
                if self.job.is_finished:
                    return self.job.result
                elif self.job.is_failed:
                    raise Exception(f'Task failed: {self.job}')
                elif timeout and total_time > timeout:
                    raise Exception(f'Task result timeout: {self.job}')
                total_time += 0.5
        except Exception as e:
            logging.getLogger(__name__).error(e)

    @property
    def status(self):
        return ResultWrapper.status_map[self.job.get_status()]

    @property
    def id(self):
        return self.job.id


class RqConfig(object):
    HOST = None
    PORT = None
    DB = None
    SCHEDULER_CONF_PATH = None


class RqClient:

    def __init__(self, conf: RqConfig, prefix: str=''):
        self.redis_conn = Redis(host=conf.HOST, port=conf.PORT, db=conf.DB)
        self.queue = Queue(connection=self.redis_conn)
        self.prefix = prefix
        self.scheduler = Scheduler(connection=self.redis_conn, queue=self.queue)
        self.scheduler_conf_path = conf.SCHEDULER_CONF_PATH

    def init_scheduler(self):
        # remove old scheduled tasks
        for job in self.scheduler.get_jobs():
            self.scheduler.cancel(job)

        # create new tasks from config file
        if self.scheduler_conf_path:
            with open(self.scheduler_conf_path) as f:
                for entry in json.load(f):
                    self.scheduler.cron(
                        entry['schedule'],
                        f'{self.prefix}.{entry["task"]}',
                        kwargs=entry['kwargs'] if 'kwargs' in entry else None
                    )

    def send_task(self, name, args=None, time_limit=None, soft_time_limit=None):
        try:
            job = self.queue.enqueue(f'{self.prefix}.{name}', ttl=time_limit, args=args)
            return ResultWrapper(job)
        except Exception as ex:
            logging.getLogger(__name__).error(ex)
