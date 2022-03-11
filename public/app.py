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


sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))  # application libraries

CONF_PATH = os.getenv('KONTEXT_CONF', os.path.realpath(
    '%s/../conf/config.xml' % os.path.dirname(__file__)))

import plugins
import plugins.export
import settings
import translation
from action.plugin.initializer import setup_plugins, install_plugin_actions
from texttypes.cache import TextTypesCache
from sanic import Sanic
from sanic_babel import Babel
from sanic_session import Session, AIORedisSessionInterface
from redis import asyncio as aioredis
from views.root import bp as root_bp
from views.concordance import bp as conc_bp
from views.user import bp as user_bp
from views.corpora import bp as corpora_bp
from action import get_protocol
from action.templating import TplEngine
from action.context import ApplicationContext
from plugin_types.auth import UserInfo
from action.cookie import KonTextCookie


# we ensure that the application's locale is always the same
locale.setlocale(locale.LC_ALL, 'en_US.utf-8')
logger = logging.getLogger('')  # root logger


def setup_logger(conf):
    """
    Sets up file-based rotating logger based on XML config.xml.
    """
    if conf.contains('logging', 'stderr'):
        handler = logging.StreamHandler(sys.stderr)
    elif conf.contains('logging', 'stdout'):
        handler = logging.StreamHandler(sys.stdout)
    else:
        try:
            from concurrent_log_handler import ConcurrentRotatingFileHandler as HandlerClass
        except ImportError:
            from logging.handlers import RotatingFileHandler as HandlerClass
        handler = HandlerClass(conf.get('logging', 'path').format(pid=os.getpid()),
                               maxBytes=conf.get_int(
                                   'logging', 'file_size', 8000000),
                               backupCount=conf.get_int('logging', 'num_files', 10))

    handler.setFormatter(logging.Formatter(fmt='%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)


class KonTextWsgiApp:
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
            self._tt_cache.clear_all()

        signal.signal(signal.SIGUSR1, signal_handler)
        self._tt_cache = TextTypesCache(plugins.runtime.DB.instance)

    @staticmethod
    def _root_url(environ):
        protocol = get_protocol(environ)
        host = settings.get_str('global', 'http_host', environ.get('HTTP_HOST'))
        app_url_prefix = settings.get_str('global', 'action_path_prefix', '/')
        return f'{protocol}://{host}{app_url_prefix}/'

    def __call__(self, environ, start_response):
        ui_lang = self.get_lang(environ)
        translation.activate(ui_lang)
        environ['REQUEST_URI'] = wsgiref.util.request_uri(environ)  # TODO remove?
        app_url_prefix = settings.get_str('global', 'action_path_prefix', '')
        if app_url_prefix and environ['PATH_INFO'].startswith(app_url_prefix):
            environ['PATH_INFO'] = environ['PATH_INFO'][len(app_url_prefix):]

        sessions = plugins.runtime.SESSIONS.instance
        request = JSONRequest(environ)
        sid = request.cookies.get(sessions.get_cookie_name())
        if sid is None:
            request.ctx.session = sessions.new()
        else:
            request.ctx.session = sessions.get(sid)

        sid_is_valid = True
        if environ['PATH_INFO'] in ('/', ''):
            url = environ['REQUEST_URI'].split('?')[0]
            if not url.endswith('/'):
                url += '/'
            status = '303 See Other'
            headers = [('Location', f'{self._root_url(environ)}query')]
            body = ''
        # old-style (CGI version) URLs are redirected to new ones
        elif '/run.cgi/' in environ['REQUEST_URI']:
            status = '301 Moved Permanently'
            headers = [('Location', environ['REQUEST_URI'].replace('/run.cgi/', '/'))]
            body = ''
        else:
            app = self.create_controller(environ['PATH_INFO'], request=request, ui_lang=ui_lang)
            status, headers, sid_is_valid, body = app.run()
        response = Response(response=body, status=status, headers=headers)
        if not sid_is_valid:
            curr_data = dict(request.ctx.session)
            request.ctx.session = sessions.new()
            request.ctx.session.update(curr_data)
            request.ctx.session.modified = True
        if request.ctx.session.should_save:
            sessions.save(request.ctx.session)
            cookie_path = settings.get_str('global', 'cookie_path_prefix', '/')
            cookies_same_site = settings.get('global', 'cookies_same_site', None)
            response.set_cookie(
                sessions.get_cookie_name(),
                request.ctx.session.sid,
                path=cookie_path,
                secure=cookies_same_site is not None,
                samesite=cookies_same_site
            )

        return response(environ, start_response)


settings.load(path=CONF_PATH)

if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

# please note that some environments may provide umask setting themselves
if settings.get('global', 'umask', None):
    os.umask(int(settings.get('global', 'umask'), 8))

os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')

application = Sanic('kontext')
application.ctx = ApplicationContext(
    templating=TplEngine(settings),
    tt_cache=lambda: TextTypesCache(plugins.runtime.DB.instance),
)
application.config['action_path_prefix'] = settings.get_str('global', 'action_path_prefix', '/')
application.config['redirect_safe_domains'] = settings.get('global', 'redirect_safe_domains', ())
application.config['cookies_same_site'] = settings.get('global', 'cookies_same_site', None)
session = Session()
application.blueprint(root_bp)
application.blueprint(conc_bp)
application.blueprint(user_bp)
application.blueprint(corpora_bp)
setup_plugins()
install_plugin_actions(application)


@application.listener('before_server_start')
async def server_init(app, loop):
    app.ctx.redis = aioredis.from_url('redis://ktm_redis_1:6379', decode_responses=True)
    # init extensions fabrics
    session.init_app(app, interface=AIORedisSessionInterface(app.ctx.redis))


@application.middleware('request')
async def extract_user(request):
    request.ctx.user_info = UserInfo(
        id=0, user='anonymous', api_key=None, email=None, fullname='Anonymous User')  # TODO


babel = Babel(application, configure_jinja=False)


@babel.localeselector
def get_locale(request):
    """
    Detects user's preferred language (either via the 'getlang' plugin or from HTTP_ACCEPT_LANGUAGE env value)

    arguments:
    environ -- WSGI environment variable

    returns:
    underscore-separated ISO 639 language code and ISO 3166 country code
    """
    cookies = KonTextCookie(request.headers.get('cookie', ''))

    if plugins.runtime.GETLANG.exists:
        lgs_string = plugins.runtime.GETLANG.instance.fetch_current_language(cookies)
    else:
        lang_cookie = cookies.get('kontext_ui_lang')
        if not lang_cookie:
            langs = request.headers.get('accept-language')
            if langs:
                lgs_string = langs.split(';')[0].split(',')[0].replace('-', '_')
            else:
                lgs_string = None
        else:
            lgs_string = lang_cookie.value
        if lgs_string is None:
            lgs_string = 'en_US'
        if len(lgs_string) == 2:  # in case we obtain just an ISO 639 language code
            lgs_string = request.ctx.installed_langs.get(
                lgs_string)  # TODO replace by application ctx?
        else:
            lgs_string = lgs_string.replace('-', '_')
    if lgs_string is None:
        lgs_string = 'en_US'
    return lgs_string


#robots_path = os.path.join(os.path.dirname(__file__), 'files/robots.txt')
# if os.path.isfile(robots_path):
#    from werkzeug.wsgi import SharedDataMiddleware
#    application = SharedDataMiddleware(application, {
#        '/robots.txt': robots_path
#    })


if __name__ == '__main__':
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
    parser.add_argument('--debugpy', action='store_true', default=False,
                        help='Use debugpy for debugging')
    parser.add_argument('--debugmode', action='store_true', default=False,
                        help='Force debug mode')
    args = parser.parse_args()

    if args.debugpy:
        if '_DEBUGPY_RUNNING' not in os.environ:
            import debugpy
            debugpy.listen(('0.0.0.0', 5678))
            os.environ['_DEBUGPY_RUNNING'] = '1'

    if args.debugmode and not settings.is_debug_mode():
        settings.activate_debug()
    application.run(host=args.address, port=int(args.port_num),
                    workers=2, debug=settings.is_debug_mode())
