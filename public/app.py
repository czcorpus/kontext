#!/usr/bin/python
# -*- Python -*-
# Copyright (c) 2003-2009  Pavel Rychly
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

import sys
import os
import wsgiref.util
import logging
from logging import handlers
import __builtin__

sys.path.insert(0, '%s/../lib' % os.path.dirname(__file__))  # to be able to import application libraries
sys.path.insert(0, '%s/..' % os.path.dirname(__file__))   # to be able to import compiled template modules

CONF_PATH = '%s/../config.xml' % os.path.dirname(__file__)

import plugins
import settings

logger = logging.getLogger('')  # root logger


def setup_logger(conf):

    handler = handlers.RotatingFileHandler(conf.get('global', 'log_path'), maxBytes=(1 << 23), backupCount=50)
    handler.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)


def setup_plugins():
    db_module = plugins.load_plugin(settings.get('plugins', 'db')['module'])
    plugins.db = db_module.create_instance(settings.get('plugins', 'db'))

    session_module = plugins.load_plugin(settings.get('plugins', 'sessions')['module'])
    plugins.sessions = session_module.create_instance(settings, plugins.db)

    settings_storage_module = plugins.load_plugin(settings.get('plugins', 'settings_storage')['module'])
    plugins.settings_storage = settings_storage_module.create_instance(settings, plugins.db)

    auth_module = plugins.load_plugin(settings.get('plugins', 'auth')['module'])
    plugins.auth = auth_module.create_instance(settings, plugins.sessions, plugins.db)

    if not hasattr(plugins, 'corptree'):
        corptree_module = plugins.load_plugin(settings.get('plugins', 'corptree')['module'])
        plugins.corptree = corptree_module.create_instance(settings)

    try:
        query_storage_module = plugins.load_plugin(settings.get('plugins', 'query_storage')['module'])
        if query_storage_module:
            plugins.query_storage = query_storage_module.QueryStorage(settings, plugins.db)
    except ImportError:
        pass

    if settings.get('plugins', 'appbar').get('module', None):
        try:
            appbar_module = plugins.load_plugin(settings.get('plugins', 'appbar')['module'])
            if appbar_module:
                plugins.application_bar = appbar_module.create_instance(settings, plugins.auth)
        except ImportError:
            pass


class App(object):

    def __init__(self, controller_class):
        self.controller_class = controller_class

    def __call__(self, environ, start_response):
        # TODO major flaws here in terms of object/module persistence
        environ['REQUEST_URI'] = wsgiref.util.request_uri(environ)
        settings.load(env=environ, conf_path=CONF_PATH)
        setup_logger(settings)
        setup_plugins()
        app = self.controller_class(environ=environ)
        status, headers, body = app.run()
        start_response(status, headers)

        return [body]



__builtin__.__dict__['_'] = lambda s: s
from actions import Actions

application = App(Actions)

if __name__ == '__main__':
    from wsgiref.simple_server import make_server
    httpd = make_server('localhost', 8051, application)
    httpd.serve_forever()


"""


if settings.is_debug_mode():
    #cgitb.enable()
    pass

manatee_dir = settings.get('global', 'manatee_path')
if manatee_dir:
    if not os.path.exists(manatee_dir):
        raise Exception('Incorrect <manatee_path> configuration. Use either empty value or a valid directory path.')
    elif manatee_dir not in sys.path:
        sys.path.insert(0, manatee_dir)
"""