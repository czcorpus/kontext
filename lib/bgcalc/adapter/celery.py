# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

from celery import Celery


class Config(object):
    broker_url = None
    result_backend = None
    task_serializer = 'json'
    result_serializer = 'json'
    accept_content = ['json']
    timezone = None


class CeleryClient:

    def __init__(self, worker: Celery):
        self._worker = worker

    @property
    def worker_impl(self):
        return self._worker

    def send_task(self, name, args=None, time_limit=None, soft_time_limit=None):
        return self._worker.send_task(name=name, args=args, time_limit=time_limit, soft_time_limit=soft_time_limit)

    def get_task_error(self, task_id):
        return None

    def AsyncResult(self, ident):
        return self._worker.AsyncResult(ident)

    @property
    def control(self):
        return self._worker.control

    @staticmethod
    def _is_celery_error(err):
        """
        Because Celery when using json serialization cannot (de)serialize original exceptions,
        errors it throws to a client are derived ones dynamically generated within package
        'celery.backends.base'. It means that static 'except' blocks are impossible and we
        must catch Exception and investigate further. This function helps with that.
        """
        return isinstance(err, Exception) and err.__class__.__module__ == 'celery.backends.base'

    def is_wrapped_user_error(self, err):
        """
        Tests whether a provided exception is a Celery derived exception generated from
        KonText's UserActionException. Please see is_bgcalc_error for more explanation.

        """
        return self._is_celery_error(err) and err.__class__.__name__ == 'UserActionException'
