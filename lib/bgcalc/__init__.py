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

from __future__ import absolute_import
import imp


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
    in case async=1).
    """
    pass


def load_config_module(path):
    return imp.load_source('celeryconfig', path)


def _init_backend_app(conf):
    app_type = conf.get('calc_backend', 'type')
    app_conf = conf.get('calc_backend', 'conf')
    if app_type == 'celery':
        import celery
        return celery.Celery('tasks', config_source=load_config_module(app_conf))
    elif app_type == 'multiprocessing':  # legacy stuff
        return None
    else:
        raise CalcBackendInitError('Failed to init calc backend {0} (conf: {1})'.format(app_type, app_conf))


def calc_backend_app(conf):
    global _backend_app
    if _backend_app is None:
        _backend_app = _init_backend_app(conf)
    return _backend_app
