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

It can be run in two modes:
 1) as a standalone application (useful for development/testing purposes)
 2) within a WSGI-enabled web server (Apache + mod_wsgi etc.).
"""

import sys
import os
import wsgiref.util
import logging
from logging import handlers
import locale

from werkzeug.http import parse_accept_header
from werkzeug.wrappers import Request, Response

sys.path.insert(0, '%s/../lib' % os.path.dirname(__file__))  # application libraries
sys.path.insert(0, '%s/..' % os.path.dirname(__file__))   # compiled template modules

CONF_PATH = os.path.realpath('%s/../conf/config.xml' % os.path.dirname(__file__))

import plugins
import plugins.export
from plugins.abstract import PluginException
import settings
import translation
import l10n
from controller import KonTextCookie

locale.setlocale(locale.LC_ALL, 'en_US.utf-8')  # we ensure that the application's locale is always the same
logger = logging.getLogger('')  # root logger


def setup_logger(conf):
    """
    Sets up file-based rotating logger. All the parameters are extracted
    from conf argument:
    path: /kontext/global/log_path
    maximum file size (optional, default is 8MB): /kontext/global/log_file_size
    number of backed-up files (optional, default is 10): /kontext/global/log_num_files
    """
    handler = handlers.RotatingFileHandler(conf.get('global', 'log_path'),
                                           maxBytes=conf.get('global', 'log_file_size', 8000000),
                                           backupCount=conf.get('global', 'log_num_files', 10))
    handler.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)


def has_configured_plugin(name):
    """
    Tests whether there is a properly configured plugin of a specified name. Only
    config.xml is tested (i.e. no actual python modules are involved).

    arguments:
    name -- name of the plugin
    """
    return settings.contains('plugins', name) and settings.get('plugins', name).get('module', None)


def init_plugin(name, module=None, optional=False):
    """
    Installs a plug-in specified by the supplied name (or name and module).

    arguments:
    name -- a name of the plugin
    module -- if supplied then name->module inference is skipped and init_plugin
              uses this module as a source of the plug-in
    optional -- if True then the module is installed only if it is configured
    """
    if not optional or has_configured_plugin(name):
        try:
            if module is None:
                if not settings.contains('plugins', name):
                    raise PluginException('Missing configuration for the "%s" plugin' % name)
                plugin_module = plugins.load_plugin_module(settings.get('plugins', name)['module'])
            else:
                plugin_module = module
            plugins.install_plugin(name, plugin_module, settings)
        except ImportError as e:
            logging.getLogger(__name__).warn('Plugin [%s] configured but following error occurred: %r'
                                             % (settings.get('plugins', 'getlang')['module'], e))
        except (PluginException, Exception) as e:
            logging.getLogger(__name__).critical('Failed to initiate plug-in %s: %s' % (name, e))
            raise e
    else:
        plugins.add_missing_plugin(name)


def cleanup_runtime_modules():
    """
    Makes app to forget previously faked modules which
    ensures proper plugins initialization if not starting from scratch.
    """
    plugins.flush_plugins()


def setup_plugins():
    """
    Sets-up all the plugins. Please note that they are expected
    to be accessed concurrently by multiple requests which means any stateful
    properties should be considered carefully.
    """
    # required plugins
    init_plugin('db')
    init_plugin('sessions')
    init_plugin('settings_storage')
    init_plugin('auth')
    init_plugin('conc_persistence')  # TODO make this optional
    init_plugin('locking')
    init_plugin('conc_cache')
    init_plugin('export', module=plugins.export)
    init_plugin('user_items')
    init_plugin('menu_items')
    # Optional plugins
    init_plugin('getlang', optional=True)
    init_plugin('corparch', optional=True)
    init_plugin('query_storage', optional=True)
    init_plugin('application_bar', optional=True)
    init_plugin('live_attributes', optional=True)
    init_plugin('query_mod', optional=True)
    init_plugin('subc_restore', optional=True)
    init_plugin('taghelper', optional=True)


def get_lang(environ):
    """
    Detects user's preferred language (either via the 'getlang' plugin or from HTTP_ACCEPT_LANGUAGE env value)

    arguments:
    environ -- WSGI environment variable

    returns:
    underscore-separated ISO 639 language code and ISO 3166 country code
    """
    installed = dict([(x.split('_')[0], x) for x in os.listdir('%s/../locale' % os.path.dirname(__file__))])

    if plugins.has_plugin('getlang'):
        lgs_string = plugins.get('getlang').fetch_current_language(KonTextCookie(
            environ.get('HTTP_COOKIE', '')))
    else:
        lgs_string = parse_accept_header(environ.get('HTTP_ACCEPT_LANGUAGE')).best
        if len(lgs_string) == 2:  # in case we obtain just an ISO 639 language code
            lgs_string = installed.get(lgs_string)
        else:
            lgs_string = lgs_string.replace('-', '_')
    if lgs_string is None:
        lgs_string = 'en_US'
    return lgs_string


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
    if settings.get_bool('global', 'maintenance'):
        from maintenance import MaintenanceController as ControllerClass
    elif path_info.startswith('/fcs'):
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
    else:
        from actions.concordance import Actions as ControllerClass
    return ControllerClass


class App(object):
    """
    WSGI application
    """

    def __init__(self):
        """
        Initializes the application and persistent objects/modules (settings, plugins,...)
        """
        setup_logger(settings)
        cleanup_runtime_modules()
        setup_plugins()
        translation.load_translations(settings.get('global', 'translations'))
        l10n.configure(settings.get('global', 'translations'))
        os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')

    def __call__(self, environ, start_response):
        """
        Works as specified by the WSGI
        """
        ui_lang = get_lang(environ)
        translation.activate(ui_lang)
        l10n.activate(ui_lang)
        environ['REQUEST_URI'] = wsgiref.util.request_uri(environ)  # TODO remove?

        sessions = plugins.get('sessions')
        request = Request(environ)
        sid = request.cookies.get(sessions.get_cookie_name())
        if sid is None:
            request.session = sessions.new()
        else:
            request.session = sessions.get(sid)

        if environ['PATH_INFO'] in ('/', ''):
            url = environ['REQUEST_URI']
            if not url.endswith('/'):
                url += '/'
            status = '303 See Other'
            headers = [('Location', '%sfirst_form' % url)]
            body = ''
        elif '/run.cgi/' in environ['REQUEST_URI']:  # old-style (CGI version) URLs are redirected to new ones
            status = '301 Moved Permanently'
            headers = [('Location', environ['REQUEST_URI'].replace('/run.cgi/', '/'))]
            body = ''
        else:
            controller_class = load_controller_class(environ['PATH_INFO'])
            app = controller_class(request=request, ui_lang=ui_lang)
            status, headers, body = app.run(request)
        response = Response(response=body, status=status, headers=headers)
        if request.session.should_save:
            sessions.save(request.session)
            response.set_cookie(sessions.get_cookie_name(), request.session.sid)
        start_response(status, headers)
        return response(environ, start_response)


settings.load(path=CONF_PATH)

if settings.contains('global', 'manatee_path'):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

if not settings.contains('corpora', 'calc_pid_dir'):
    raise Exception('Missing configuration: calc_pid_dir')
elif not os.path.exists(settings.get('corpora', 'calc_pid_dir')):
    os.makedirs(settings.get('corpora', 'calc_pid_dir'))

application = App()

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
    args = parser.parse_args()

    application = SharedDataMiddleware(application, {
        '/files':  os.path.join(os.path.dirname(__file__), 'files')
    })
    run_simple(args.address, int(args.port_num), application, use_debugger=True, use_reloader=True)
