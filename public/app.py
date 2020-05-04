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
This module is an entry point of KonText WSGI application.

It can be run in two modes:
 1) as a standalone application (useful for development/testing purposes)
 2) within a WSGI-enabled web server (Gunicorn, uwsgi, Apache + mod_wsgi)
"""

import sys
import os
import wsgiref.util
import logging
import locale
import signal

from werkzeug.http import parse_accept_header
from werkzeug.wrappers import Request, Response

sys.path.insert(0, '%s/../lib' % os.path.dirname(__file__))  # application libraries
sys.path.insert(0, '%s/..' % os.path.dirname(__file__))   # compiled template modules

CONF_PATH = os.getenv('KONTEXT_CONF', os.path.realpath('%s/../conf/config.xml' % os.path.dirname(__file__)))

import plugins
import plugins.export
import settings
import translation
from controller import KonTextCookie
from initializer import setup_plugins

# we ensure that the application's locale is always the same
locale.setlocale(locale.LC_ALL, 'en_US.utf-8')
logger = logging.getLogger('')  # root logger


class WsgiApp(object):

    def __init__(self):
        self.setup_logger(settings)
        self._installed_langs = dict([(x.split('_')[0], x)
                                      for x in os.listdir('%s/../locale' % os.path.dirname(__file__))])

    def __call__(self, environ, start_response):
        raise NotImplementedError()

    @staticmethod
    def setup_logger(conf):
        """
        Sets up file-based rotating logger. All the parameters are extracted
        from conf argument:
        path: /kontext/global/log_path
        maximum file size (optional, default is 8MB): /kontext/global/log_file_size
        number of backed-up files (optional, default is 10): /kontext/global/log_num_files
        """
        try:
            from concurrent_log_handler import ConcurrentRotatingFileHandler as HandlerClass
        except ImportError:
            from logging.handlers import RotatingFileHandler as HandlerClass
        handler = HandlerClass(conf.get('logging', 'path').format(pid=os.getpid()),
                               maxBytes=conf.get_int(
                                   'logging', 'file_size', 8000000),
                               backupCount=conf.get_int('logging', 'num_files', 10))
        handler.setFormatter(logging.Formatter(
            fmt='%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)

    @staticmethod
    def cleanup_runtime_modules():
        """
        Makes app to forget previously faked modules which
        ensures proper plugins initialization if not starting from scratch.
        """
        plugins.flush_plugins()

    def get_lang(self, environ):
        """
        Detects user's preferred language (either via the 'getlang' plugin or from HTTP_ACCEPT_LANGUAGE env value)

        arguments:
        environ -- WSGI environment variable

        returns:
        underscore-separated ISO 639 language code and ISO 3166 country code
        """
        cookies = KonTextCookie(environ.get('HTTP_COOKIE', ''))

        if plugins.runtime.GETLANG.exists:
            lgs_string = plugins.runtime.GETLANG.instance.fetch_current_language(cookies)
        else:
            lang_cookie = cookies.get('kontext_ui_lang')
            if not lang_cookie:
                lgs_string = parse_accept_header(environ.get('HTTP_ACCEPT_LANGUAGE')).best
            else:
                lgs_string = lang_cookie.value
            if lgs_string is None:
                lgs_string = 'en_US'
            if len(lgs_string) == 2:  # in case we obtain just an ISO 639 language code
                lgs_string = self._installed_langs.get(lgs_string)
            else:
                lgs_string = lgs_string.replace('-', '_')
        if lgs_string is None:
            lgs_string = 'en_US'
        return lgs_string

    @staticmethod
    def load_controller_class(path_info):
        """
        Loads appropriate action controller class according to the provided
        path info. Classes selection is based on path_info prefix (e.g. / prefix
        maps to the main action controller actions.py, /fcs maps to a fcs.py
        controller etc.).

        Please note that currently there is no general automatized loading
        (i.e. all the path->class mapping is hardcoded in this function).

        arguments:
        path_info -- a string as found in environment['PATH_INFO']

        returns:
        a class matching provided path_info
        """
        if path_info.startswith('/fcs'):
            from actions.fcs import Actions as ControllerClass
        elif path_info.startswith('/user'):
            from actions.user import User as ControllerClass
        elif path_info.startswith('/subcorpus'):
            from actions.subcorpus import Subcorpus as ControllerClass
        elif path_info.startswith('/options'):
            from actions.options import Options as ControllerClass
        elif path_info.startswith('/admin'):
            from actions.admin import Admin as ControllerClass
        elif path_info.startswith('/corpora'):
            from actions.corpora import Corpora as ControllerClass
        elif path_info.startswith('/wordlist'):
            from actions.wordlist import Wordlist as ControllerClass
        else:
            from actions.concordance import Actions as ControllerClass
        return ControllerClass


class MaintenanceWsgiApp(WsgiApp):
    """
    This WSGI application shows only a single page informing about
    current maintenance. It is activated via config.xml.
    """

    def __init__(self):
        super(MaintenanceWsgiApp, self).__init__()
        translation.load_translations(settings.get('global', 'translations'))

    def __call__(self, environ, start_response):
        from controller.maintenance import MaintenanceController
        ui_lang = self.get_lang(environ)
        translation.activate(ui_lang)
        request = Request(environ)
        app = MaintenanceController(request=request, ui_lang=ui_lang)
        status, headers, sid_is_valid, body = app.run()
        response = Response(response=body, status=status, headers=headers)
        return response(environ, start_response)


class KonTextWsgiApp(WsgiApp):
    """
    KonText WSGI application
    """

    def __init__(self):
        """
        Initializes the application and persistent objects/modules (settings, plugins,...)
        """
        super(KonTextWsgiApp, self).__init__()
        self.cleanup_runtime_modules()
        os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')
        setup_plugins()
        translation.load_translations(settings.get('global', 'translations'))

        def signal_handler(signal, frame):
            for p in plugins.runtime:
                fn = getattr(p.instance, 'on_soft_reset', None)
                if callable(fn):
                    fn()

        signal.signal(signal.SIGUSR1, signal_handler)

    def __call__(self, environ, start_response):
        ui_lang = self.get_lang(environ)
        translation.activate(ui_lang)
        environ['REQUEST_URI'] = wsgiref.util.request_uri(environ)  # TODO remove?
        app_url_prefix = settings.get_str('global', 'action_path_prefix', '')
        if app_url_prefix and environ['PATH_INFO'].startswith(app_url_prefix):
            environ['PATH_INFO'] = environ['PATH_INFO'][len(app_url_prefix):]

        sessions = plugins.runtime.SESSIONS.instance
        request = Request(environ)
        sid = request.cookies.get(sessions.get_cookie_name())
        if sid is None:
            request.session = sessions.new()
        else:
            request.session = sessions.get(sid)

        sid_is_valid = True
        if environ['PATH_INFO'] in ('/', ''):
            url = environ['REQUEST_URI'].split('?')[0]
            if not url.endswith('/'):
                url += '/'
            status = '303 See Other'
            headers = [('Location', '%sfirst_form' % url)]
            body = ''
        # old-style (CGI version) URLs are redirected to new ones
        elif '/run.cgi/' in environ['REQUEST_URI']:
            status = '301 Moved Permanently'
            headers = [('Location', environ['REQUEST_URI'].replace('/run.cgi/', '/'))]
            body = ''
        else:
            controller_class = self.load_controller_class(environ['PATH_INFO'])
            app = controller_class(request=request, ui_lang=ui_lang)
            status, headers, sid_is_valid, body = app.run()
        response = Response(response=body, status=status, headers=headers)
        if not sid_is_valid:
            curr_data = dict(request.session)
            request.session = sessions.new()
            request.session.update(curr_data)
            request.session.modified = True
        if request.session.should_save:
            sessions.save(request.session)
            cookie_path = settings.get_str('global', 'cookie_path_prefix', '/')
            response.set_cookie(sessions.get_cookie_name(), request.session.sid, path=cookie_path)
        return response(environ, start_response)


settings.load(path=CONF_PATH)

if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

# please note that some environments may provide umask setting themselves
if settings.get('global', 'umask', None):
    os.umask(int(settings.get('global', 'umask'), 8))

if not settings.get_bool('global', 'maintenance'):
    application = KonTextWsgiApp()
else:
    application = MaintenanceWsgiApp()

robots_path = os.path.join(os.path.dirname(__file__), 'files/robots.txt')
if os.path.isfile(robots_path):
    from werkzeug.wsgi import SharedDataMiddleware
    application = SharedDataMiddleware(application, {
        '/robots.txt': robots_path
    })

if settings.is_debug_mode():
    from werkzeug.debug import DebuggedApplication
    application = DebuggedApplication(application)
    # profiling
    if settings.debug_level() == settings.DEBUG_AND_PROFILE:
        from werkzeug.contrib.profiler import ProfilerMiddleware, MergeStream
        stream = MergeStream(sys.stdout, open(settings.get('global', 'profile_log_path'), 'w'))
        application = ProfilerMiddleware(application, stream)


if __name__ == '__main__':
    from werkzeug.serving import run_simple
    from werkzeug.wsgi import SharedDataMiddleware
    import argparse

    DEFAULT_PORT = 5000
    DEFAULT_ADDR = '127.0.0.1'

    parser = argparse.ArgumentParser(description='Starts a local development server')
    parser.add_argument('--port', dest='port_num', action=None, default=DEFAULT_PORT,
                        help='a port the server listens on (default is %s)' % DEFAULT_PORT)
    parser.add_argument('--address', dest='address', action=None, default=DEFAULT_ADDR,
                        help='an address the server listens on (default is %s)' % DEFAULT_ADDR)
    parser.add_argument('--use-reloader', action='store_true', default=False,
                        help='Set embedded web server to watch for source code changes and reload itself if needed')
    args = parser.parse_args()
    application = SharedDataMiddleware(application, {
        '/files':  os.path.join(os.path.dirname(__file__), 'files')
    })
    run_simple(args.address, int(args.port_num), application,
               use_debugger=True, use_reloader=args.use_reloader)
