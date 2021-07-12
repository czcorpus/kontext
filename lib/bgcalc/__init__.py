# Copyright (c) 2017 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2017 Tomas Machalek <tomas.machalek@gmail.com>
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


from importlib.machinery import SourceFileLoader
from .errors import CalcBackendInitError
from typing import Dict, Any, Optional
import time


_backend_app = None


def _init_backend_app(conf, fn_prefix):
    worker_type = conf.get('calc_backend', 'type')
    worker_conf = conf.get('calc_backend', 'conf')
    if worker_type == 'celery':
        from bgcalc.adapter.celery import Config, CeleryClient
        import celery

        if worker_conf:
            cconf = SourceFileLoader('celeryconfig', worker_conf).load_module()
        else:
            cconf = Config()
            cconf.broker_url = conf.get('calc_backend', 'celery_broker_url')
            cconf.result_backend = conf.get('calc_backend', 'celery_result_backend')
            cconf.task_serializer = conf.get('calc_backend', 'celery_task_serializer')
            cconf.result_serializer = conf.get('calc_backend', 'celery_result_serializer')
            cconf.accept_content = conf.get('calc_backend', 'celery_accept_content')
            cconf.timezone = conf.get('calc_backend', 'celery_timezone')
        worker = celery.Celery('bgcalc')
        worker.config_from_object(cconf)
        return CeleryClient(worker)
    elif worker_type == 'rq':
        from bgcalc.adapter.rq import RqClient, RqConfig
        rqconf = RqConfig()
        rqconf.HOST = conf.get('calc_backend', 'rq_redis_host')
        rqconf.PORT = conf.get('calc_backend', 'rq_redis_port')
        rqconf.DB = conf.get('calc_backend', 'rq_redis_db')
        rqconf.SCHEDULER_CONF_PATH = conf.get('job_scheduler', 'conf', None)
        return RqClient(rqconf, 'rqworker')
    else:
        raise CalcBackendInitError(
            'Failed to init calc backend {0} (conf: {1})'.format(worker_type, worker_conf))


def _calc_backend_app(conf, fn_prefix=''):
    global _backend_app
    if _backend_app is None:
        _backend_app = _init_backend_app(conf, fn_prefix)
    return _backend_app


def calc_backend_client(conf):
    return _calc_backend_app(conf, '')


def calc_backend_server(conf, fn_prefix):
    return _calc_backend_app(conf, fn_prefix)


class AsyncTaskStatus(object):
    """
    Keeps information about background tasks which are visible to a user
    (i.e. user is informed that some calculation/task takes a long time
    and that it is going to run in background and that the user will
    be notified once it is done).

    Please note that concordance calculation uses a different mechanism
    as it requires continuous update of its status.

    Status string is taken from Celery and should always equal
    one of the following: PENDING, STARTED, RETRY, FAILURE, SUCCESS

    Attributes:
        ident (str): task identifier (unique per specific task instance)
        label (str): user-readable task label
        status (str): one of
    """
    CATEGORY_SUBCORPUS = 'subcorpus'
    CATEGORY_PQUERY = 'pquery'
    CATEGORY_FREQ_PRECALC = 'freqPrecalc'

    def __init__(self, ident: str, label: str, status: int, category: str, args: Dict[str, Any],
                 created: Optional[float] = None, error: Optional[str] = None, url: Optional[str] = None) -> None:
        self.ident: str = ident
        self.label: str = label
        self.status: int = status
        self.category: str = category
        self.created: Optional[float] = created if created else time.time()
        self.args: Dict[str, Any] = args
        self.error: Optional[str] = error
        self.url: Optional[str] = url

    def is_finished(self) -> bool:
        return self.status in ('FAILURE', 'SUCCESS')

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> 'AsyncTaskStatus':
        """
        Creates an instance from the 'dict' type. This is used
        to unserialize instances from session.
        """
        return AsyncTaskStatus(status=data['status'], ident=data['ident'], label=data['label'],
                               category=data['category'], created=data.get('created'), args=data.get('args', {}),
                               error=data.get('error'), url=data.get('url'))

    def to_dict(self) -> Dict[str, Any]:
        """
        Transforms an instance to the 'dict' type. This is used
        to serialize instances to session.
        """
        return self.__dict__
