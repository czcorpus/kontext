# Copyright (c) 2014 Institute of the Czech National Corpus
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

"""
This module is an entry point of a WSGI application.
It replaces run.cgi from the previous versions of bonito2
and KonText which were CGI-based.

It can be run as a standalone application (using wsgiref.simple_server) or
within a WSGI-enabled server (Apache etc.).
"""

import sys
import os
import wsgiref.util
import logging
from logging import handlers
import __builtin__

if __name__ == '__main__':
    sys.path.insert(0, '.')
    sys.path.insert(0, './lib')  # to be able to import application libraries
    CONF_PATH = '../config.xml'
else:
    sys.path.insert(0, '%s/../lib' % os.path.dirname(__file__))  # to be able to import application libraries
    sys.path.insert(0, '%s/..' % os.path.dirname(__file__))   # to be able to import compiled template modules
    CONF_PATH = '%s/../config.xml' % os.path.dirname(__file__)

import plugins
import settings
from actions import Actions

logger = logging.getLogger('')  # root logger
__builtin__.__dict__['_'] = lambda s: s  # default '_' (gettext) function is just the identity


def setup_logger(conf):
    handler = handlers.RotatingFileHandler(conf.get('global', 'log_path'), maxBytes=(1 << 23), backupCount=50)
    handler.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)


def setup_plugins():
    """
    Sets-up all the plugins. Please note that they are expected
    to be run as persistent and shared between requests.
    """
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


class StaticDispatcher(object):
    """
    A simple static file dispatcher for standalone mode
    """
    def __init__(self, environ):
        self.environ = environ

    def run(self):
        path = './public%s' % self.environ.get('PATH_INFO')
        if os.path.exists(path):
            return '200 OK', [('Content-Length', str(os.path.getsize(path)))], open(path).read()
        else:
            return '404 Not Found', (), ''


class App(object):
    """
    WSGI application
    """

    def __init__(self, controller_class, static_dispatcher_class=None):
        """
        Initializes the application and persistent objects/modules (settings, plugins,...)
        """
        self.controller_class = controller_class
        self.static_dispatcher_class = static_dispatcher_class

        settings.load(conf_path=CONF_PATH)
        setup_logger(settings)
        setup_plugins()
        os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')

    def __call__(self, environ, start_response):
        """
        Works as specified by the WSGI
        """
        environ['REQUEST_URI'] = wsgiref.util.request_uri(environ)
        if '/run.cgi/' in environ['REQUEST_URI']:  # old-style (CGI version) URLs are redirected to new ones
            status = '301 Moved Permanently'
            headers = [('Location', environ['REQUEST_URI'].replace('/run.cgi/', '/'))]
            body = ''
        elif self.static_dispatcher_class and environ['PATH_INFO'].startswith('/files'):
            app = self.static_dispatcher_class(environ=environ)
            status, headers, body = app.run()
        else:
            app = self.controller_class(environ=environ)
            status, headers, body = app.run()
        start_response(status, headers)
        return [body]

application = App(Actions, StaticDispatcher)


if __name__ == '__main__':
    from wsgiref.simple_server import make_server
    httpd = make_server('localhost', 8088, application)
    httpd.serve_forever()