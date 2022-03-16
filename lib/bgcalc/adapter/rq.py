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
from rq.job import Job
from rq.exceptions import NoSuchJobError
from redis import Redis
from rq_scheduler import Scheduler
from bgcalc.errors import CalcTaskNotFoundError, BgCalcError
from bgcalc.adapter.abstract import AbstractBgClient, AbstractResultWrapper
from action.errors import UserActionException
import json
import re
import importlib
import sys
from typing import TypeVar, Generic, Union, Type

T = TypeVar('T')


class ResultWrapper(AbstractResultWrapper[T]):

    status_map = dict(
        queued='PENDING',
        started='STARTED',
        deferred='deferred',  # TODO Rq specific
        finished='SUCCESS',
        failed='FAILURE'
    )

    def __init__(self, job):
        self._job = job
        self.result: Union[T, Exception] = None

    def _infer_error(self, exc_info, job_id):
        last = [x for x in re.split(r'\n', exc_info) if x.strip() != ''][-1]
        srch = re.match(r'^([\w_\.]+):\s+(.+)$', last)
        if srch is not None:
            path = srch.group(1)
            if '.' in path:
                module, cls_name = srch.group(1).rsplit('.', 1)
                try:
                    m = importlib.import_module(module)
                    cls = getattr(m, cls_name, None)
                    err = cls(srch.group(2)) if cls else Exception(srch.group(2))
                except ModuleNotFoundError:
                    logging.getLogger(__name__).warning(
                        'Failed to infer calc backend job error {}'.format(path))
                    err = Exception(f'Task failed: {job_id}')
            else:
                cls = getattr(sys.modules['builtins'], path, None)
                err = cls(srch.group(2)) if cls else Exception(srch.group(2))
            return err
        return Exception(f'Task failed: {job_id}')

    def get(self, timeout=None):
        try:
            total_time = 0
            while True:
                time.sleep(0.5)
                if self._job.is_finished:
                    self.result = self._job.result
                    break
                elif self._job.is_failed:
                    self._job.refresh()
                    self.result = self._infer_error(self._job.exc_info, self._job.id)
                    break
                elif timeout and total_time > timeout:
                    self.result = Exception(f'Task result timeout: {self._job}')
                    break
                total_time += 0.5
        except Exception as e:
            self.result = e
        return self.result

    @property
    def status(self):
        if self._job and self._job.get_status():
            return ResultWrapper.status_map[self._job.get_status()]
        return 'FAILURE'

    @property
    def id(self):
        return self._job.id


class RqConfig:
    HOST = None
    PORT = None
    DB = None
    SCHEDULER_CONF_PATH = None


class Control:

    def __init__(self, redis_conn):
        self._conn = redis_conn

    def revoke(self, task_id, terminate=None, signal=None):
        try:
            job = Job.fetch(task_id, connection=self._conn)
            job.cancel()
        except NoSuchJobError as ex:
            raise CalcTaskNotFoundError(str(ex))


class RqClient(AbstractBgClient):

    def __init__(self, conf: RqConfig, prefix: str = ''):
        self.redis_conn = Redis(host=conf.HOST, port=conf.PORT, db=conf.DB)
        self.queue = Queue(connection=self.redis_conn)
        self.prefix = prefix
        self.scheduler = Scheduler(connection=self.redis_conn, queue=self.queue)
        self.scheduler_conf_path = conf.SCHEDULER_CONF_PATH
        self._control = Control(self.redis_conn)

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
                        kwargs=entry['kwargs'] if 'kwargs' in entry else None,
                        use_local_timezone=True,
                    )
            logging.getLogger(__name__).info(f'Loaded configuration for Rq-scheduler from {self.scheduler_conf_path}')
        else:
            logging.getLogger(__name__).warning(
                'No Rq-scheduler configuration path defined. '
                'Regular system maintenance will be disabled which may lead to disks becoming full.')

    @staticmethod
    def _resolve_limit(softl, hardl):
        if softl is not None and hardl is not None:
            return min(softl, hardl)
        elif softl is not None:
            return softl
        elif hardl is not None:
            return hardl
        return None

    @property
    def control(self):
        return self._control

    def send_task(self, name, ans_type: Type[T], args=None, time_limit=None, soft_time_limit=None) -> ResultWrapper[T]:
        """
        Send a task to the worker.

        Please note that Rq does not know hard vs. soft time limit. In case both
        values are filled in (time_limit, soft_time_limit), the smaller one is
        selected. Otherwise, the non-None is applied.
        """
        time_limit = self._resolve_limit(time_limit, soft_time_limit)
        try:
            job = self.queue.enqueue(f'{self.prefix}.{name}', job_timeout=time_limit, args=args)
            return ResultWrapper(job)
        except Exception as ex:
            logging.getLogger(__name__).error(ex)

    def get_task_error(self, task_id):
        try:
            job = Job.fetch(task_id, connection=self.redis_conn)
            if job.get_status() == 'failed':
                return BgCalcError(job.exc_info)
        except NoSuchJobError as ex:
            return CalcTaskNotFoundError(ex)
        return None

    def AsyncResult(self, ident):
        try:
            return ResultWrapper(Job.fetch(ident, connection=self.redis_conn))
        except NoSuchJobError:
            logging.getLogger(__name__).warning(f'Job {ident} not found')
            return None

    def is_wrapped_user_error(self, err):
        return isinstance(err, UserActionException)
