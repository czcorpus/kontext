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


_backend_app = None


class CalcBackendInitError(Exception):
    pass


class ExternalTaskError(Exception):
    pass


class UnfinishedConcordanceError(Exception):
    """
    This error is used whenever a concordance
    used by some background calculation is
    not completed yet (i.e. this applies only
    in case asnc=1).
    """
    pass


def _init_backend_app(conf, fn_prefix):
    app_type = conf.get('calc_backend', 'type')
    app_conf = conf.get('calc_backend', 'conf')
    if app_type == 'celery':
        from bgcalc.celery import Config
        import celery

        if app_conf:
            cconf = SourceFileLoader('celeryconfig', app_conf).load_module()
        else:
            cconf = Config()
            cconf.broker_url = conf.get('calc_backend', 'celery_broker_url')
            cconf.result_backend = conf.get('calc_backend', 'celery_result_backend')
            cconf.task_serializer = conf.get('calc_backend', 'celery_task_serializer')
            cconf.result_serializer = conf.get('calc_backend', 'celery_result_serializer')
            cconf.accept_content = conf.get('calc_backend', 'celery_accept_content')
            cconf.timezone = conf.get('calc_backend', 'celery_timezone')
        app = celery.Celery('bgcalc')
        app.config_from_object(cconf)
        return app
    elif app_type == 'konserver':
        from bgcalc.konserver import KonserverApp, Config

        if app_conf:
            kconf = SourceFileLoader('konserverconfig', app_conf).load_module()
        else:
            kconf = Config()
            kconf.SERVER = conf.get('calc_backend', 'konserver_server')
            kconf.PORT = conf.get_int('calc_backend', 'konserver_port')
            kconf.PATH = conf.get('calc_backend', 'konserver_path')
            kconf.HTTP_CONNECTION_TIMEOUT = conf.get_int(
                'calc_backend', 'konserver_http_connection_timeout')
            kconf.RESULT_WAIT_MAX_TIME = conf.get_int(
                'calc_backend', 'konserver_result_wait_max_time')
        return KonserverApp(conf=kconf, fn_prefix=fn_prefix)
    elif app_type == 'rq':
        from bgcalc.rq import RqClient, RqConfig
        rqconf = RqConfig()
        rqconf.HOST = conf.get('calc_backend', 'rq_redis_host')
        rqconf.PORT = conf.get('calc_backend', 'rq_redis_port')
        rqconf.DB = conf.get('calc_backend', 'rq_redis_db')
        rqconf.SCHEDULER_CONF_PATH = conf.get('job_scheduler', 'conf', None)
        return RqClient(rqconf, 'rqworker')
    else:
        raise CalcBackendInitError(
            'Failed to init calc backend {0} (conf: {1})'.format(app_type, app_conf))


def _calc_backend_app(conf, fn_prefix=''):
    global _backend_app
    if _backend_app is None:
        _backend_app = _init_backend_app(conf, fn_prefix)
    return _backend_app


def calc_backend_client(conf):
    return _calc_backend_app(conf, '')


def calc_backend_server(conf, fn_prefix):
    return _calc_backend_app(conf, fn_prefix)
