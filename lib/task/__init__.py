# Copyright (c) 2015 Institute of the Czech National Corpus
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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import imp

import celery

_celery_app = None


def load_config_module(path):
    return imp.load_source('celeryconfig', path)


def get_celery_app(conf_path):
    global _celery_app
    if _celery_app is None:
        _celery_app = celery.Celery('tasks', config_source=load_config_module(conf_path))
    return _celery_app


class ExternalTaskError(Exception):
    pass
