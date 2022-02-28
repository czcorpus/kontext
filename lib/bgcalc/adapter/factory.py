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
from .errors import BgCalcAdapterError
from bgcalc.adapter.abstract import AbstractBgClient

_backend_app = None


def init_backend(conf, fn_prefix) -> AbstractBgClient:
    worker_type = conf.get('calc_backend', 'type')
    worker_conf = conf.get('calc_backend', 'conf')
    if worker_type == 'celery':
        import celery
        from bgcalc.adapter.celery import Config, CeleryClient

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
        raise BgCalcAdapterError(
            'Failed to init calc backend {0} (conf: {1})'.format(worker_type, worker_conf))

