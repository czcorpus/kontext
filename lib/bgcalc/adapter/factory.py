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


from bgcalc.adapter.abstract import AbstractBgClient

from .errors import BgCalcAdapterError

_backend_app = None


def init_backend(conf, fn_prefix) -> AbstractBgClient:
    worker_type = conf.get('calc_backend', 'type')
    worker_conf = conf.get('calc_backend', 'conf')
    if worker_type == 'rq':
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
