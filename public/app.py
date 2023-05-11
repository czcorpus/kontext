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
import asyncio
import locale
import logging
import os
import signal
import sys
from datetime import datetime, timedelta, timezone
from logging.handlers import QueueListener

from concurrent_log_handler import ConcurrentRotatingFileHandler

try:
    from queue import SimpleQueue as Queue
except ImportError:
    from queue import Queue
try:
    from setproctitle import setproctitle
except ImportError:
    def setproctitle(s):
        pass

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'lib'))  # application libraries

CONF_PATH = os.getenv(
    'KONTEXT_CONF', os.path.realpath(f'{os.path.dirname(os.path.realpath(__file__))}/../conf/config.xml'))
LOCALE_PATH = os.path.realpath(os.path.join(os.path.dirname(__file__), '../locale'))
JWT_COOKIE_NAME = 'kontext_jwt'
JWT_ALGORITHM = 'HS256'
DFLT_HTTP_CLIENT_TIMEOUT = 20

from typing import Optional

import aiohttp
import jwt
import plugins
import plugins.export
import settings
from action.context import ApplicationContext
from action.cookie import KonTextCookie
from action.plugin.initializer import install_plugin_actions, setup_plugins
from action.templating import TplEngine
from babel import support
from jwt.exceptions import ExpiredSignatureError, InvalidSignatureError
from log_formatter import KontextLogFormatter
from sanic import Request, Sanic
from sanic.response import HTTPResponse
from texttypes.cache import TextTypesCache
from views.colls import bp as colls_bp
from views.concordance import bp as conc_bp
from views.corpora import bp as corpora_bp
from views.dispersion import bp as dispersion_bp
from views.fcs import bp_common as fcs_common_bp
from views.fcs import bp_v1 as fcs_v1_bp
from views.freqs import bp as freqs_bp
from views.keywords import bp as keywords_bp
from views.options import bp as options_bp
from views.pquery import bp as pquery_bp
from views.root import bp as root_bp
from views.subcorpus import bp as subcorpus_bp
from views.tools import bp as tools_bp
from views.user import bp as user_bp
from views.websocket import bp as websocket_bp
from views.wordlist import bp as wordlist_bp

# we ensure that the application's locale is always the same
locale.setlocale(locale.LC_ALL, 'en_US.utf-8')
logger = logging.getLogger()  # root logger


def setup_logger(conf) -> Optional[logging.handlers.QueueListener]:
    """
    Sets up file-based rotating logger based on XML config.xml.
    """
    if conf.contains('logging', 'stderr'):
        handler = logging.StreamHandler(sys.stderr)
        listener = None
    elif conf.contains('logging', 'stdout'):
        handler = logging.StreamHandler(sys.stdout)
        listener = None
    else:
        handler = ConcurrentRotatingFileHandler(
            conf.get('logging', 'path').format(pid=os.getpid()),
            maxBytes=conf.get_int('logging', 'file_size', 8000000),
            backupCount=conf.get_int('logging', 'num_files', 10))
        queue = Queue()
        listener = QueueListener(queue, handler)
        listener.start()

    handler.setFormatter(KontextLogFormatter())
    logger.addHandler(handler)
    logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)
    return listener


settings.load(path=CONF_PATH)

if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

# please note that some environments may provide umask setting themselves
if settings.get('global', 'umask', None):
    os.umask(int(settings.get('global', 'umask'), 8))

os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')

log_listener = setup_logger(settings)

application = Sanic('kontext')

application.config['action_path_prefix'] = settings.get_str('global', 'action_path_prefix', '/')
application.config['redirect_safe_domains'] = settings.get('global', 'redirect_safe_domains', ())
application.config['cookies_same_site'] = settings.get('global', 'cookies_same_site', None)
application.config['static_files_prefix'] = settings.get(
    'global', 'static_files_prefix', '../files')

application.blueprint(root_bp)
application.blueprint(conc_bp)
application.blueprint(user_bp)
application.blueprint(corpora_bp)
application.blueprint(wordlist_bp)
application.blueprint(keywords_bp)
application.blueprint(freqs_bp)
application.blueprint(dispersion_bp)
application.blueprint(colls_bp)
application.blueprint(options_bp)
application.blueprint(pquery_bp)
application.blueprint(tools_bp)
application.blueprint(subcorpus_bp)
application.blueprint(fcs_common_bp)
application.blueprint(fcs_v1_bp)
if settings.get_bool('global', 'enabled_websockets'):
    application.blueprint(websocket_bp)
setup_plugins()
install_plugin_actions(application)

with plugins.runtime.DB as db:
    tt_cache = TextTypesCache(db)

application.ctx = ApplicationContext(
    templating=TplEngine(settings),
    tt_cache=tt_cache)


async def sigusr1_handler():
    logging.getLogger(__name__).warning('Caught signal SIGUSR1')
    for p in plugins.runtime:
        fn = getattr(p.instance, 'on_soft_reset', None)
        if callable(fn):
            await fn()
    await tt_cache.clear_all()


def load_translations(app: Sanic):
    app.ctx.translations = {}
    for loc in settings.get_list('global', 'translations'):
        loc = loc.replace('-', '_')
        catalog = support.Translations.load(LOCALE_PATH, [loc])
        app.ctx.translations[loc] = catalog


@application.listener('before_server_start')
async def server_init(app: Sanic, loop: asyncio.BaseEventLoop):
    setproctitle(f'sanic-kontext [{CONF_PATH}][worker]')
    loop.add_signal_handler(signal.SIGUSR1, lambda: asyncio.create_task(sigusr1_handler()))
    # init extensions fabrics
    app.ctx.client_session = aiohttp.ClientSession()
    # runtime conf (this should have its own module in the future)
    http_client_conf = settings.get_int('global', 'http_client_timeout_secs', 0)
    if not http_client_conf:
        http_client_conf = DFLT_HTTP_CLIENT_TIMEOUT
        logging.getLogger(__name__).warning(
            f'Internal HTTP client timeout not configured, using default {DFLT_HTTP_CLIENT_TIMEOUT} sec.')
    app.ctx.kontext_conf = {'http_client_timeout_secs': http_client_conf}
    # load all translations
    load_translations(app)


@application.listener('after_server_stop')
async def server_init(app: Sanic, loop: asyncio.BaseEventLoop):
    await app.ctx.client_session.close()


@application.middleware('request')
async def extract_jwt(request: Request):
    if JWT_COOKIE_NAME in request.cookies:
        try:
            request.ctx.session = jwt.decode(
                request.cookies.get(JWT_COOKIE_NAME), settings.get('global', 'jwt_secret'), algorithms=[JWT_ALGORITHM])
            return
        except InvalidSignatureError as ex:
            logging.getLogger(__name__).warning(f'failed to extract JWT token: {ex}')
            request.ctx.session = {}
        except ExpiredSignatureError:
            # in case a client uses too old token, we clear the session and user
            # must log in again (or the 'revalidation' mechanism will resolve
            # this in case KonText uses "remote auth" type of auth plug-in).
            pass
    request.ctx.session = {}


@application.middleware('request')
async def set_locale(request: Request):
    request.ctx.locale = get_locale(request)
    if request.ctx.locale in application.ctx.translations:
        request.ctx.translations = application.ctx.translations[request.ctx.locale]
    else:
        request.ctx.translations = support.NullTranslations()
        logging.getLogger(__name__).warning(f'Requested unsupported locale {request.ctx.locale}')


@application.middleware('response')
async def store_jwt(request: Request, response: HTTPResponse):
    ttl = settings.get_int('global', 'jwt_ttl_secs', 3600)
    request.ctx.session['exp'] = datetime.now(timezone.utc) + timedelta(seconds=ttl)
    response.cookies[JWT_COOKIE_NAME] = jwt.encode(
        request.ctx.session,  settings.get('global', 'jwt_secret'), algorithm=JWT_ALGORITHM)
    response.cookies[JWT_COOKIE_NAME]['httponly'] = True
    response.cookies[JWT_COOKIE_NAME]['secure'] = bool(
        request.conn_info.ssl or request.headers.get('x-forwarded-protocol', '') == 'https'
        or request.headers.get('x-forwarded-proto') == 'https')


@application.signal('kontext.internal.reset')
async def handle_internal_soft_reset_signal():
    for p in plugins.runtime:
        fn = getattr(p.instance, 'on_soft_reset', None)
        if callable(fn):
            await fn()
    logging.getLogger(__name__).warning('performed internal soft reset (Sanic signal)')


def get_locale(request: Request) -> str:
    """
    Gets user locale based on request data
    """
    cookies = KonTextCookie(request.headers.get('cookie', ''))

    with plugins.runtime.GETLANG as getlang:
        if getlang is not None:
            lgs_string = getlang.fetch_current_language(cookies)
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


if __name__ == '__main__':
    import argparse

    DEFAULT_PORT = 5000
    DEFAULT_ADDR = '127.0.0.1'

    parser = argparse.ArgumentParser(description='Starts a local development server')
    parser.add_argument(
        '--port', dest='port_num', default=DEFAULT_PORT,
        help=f'a port the server listens on (default is {DEFAULT_PORT})')
    parser.add_argument(
        '--address', dest='address', default=DEFAULT_ADDR,
        help=f'an address the server listens on (default is {DEFAULT_ADDR})')
    parser.add_argument('--workers', type=int, default=2, help='Number of worker processes')
    parser.add_argument(
        '--use-reloader', action='store_true', default=False,
        help='Set embedded web server to watch for source code changes and reload itself if needed')
    parser.add_argument(
        '--debugpy', action='store_true', default=False, help='Use debugpy for debugging')
    parser.add_argument('--debugmode', action='store_true', default=False, help='Force debug mode')
    args = parser.parse_args()

    if args.debugpy:
        if '_DEBUGPY_RUNNING' not in os.environ:
            import debugpy
            debugpy.listen((args.address, 5678))
            os.environ['_DEBUGPY_RUNNING'] = '1'

    try:
        setproctitle(f'sanic-kontext [{CONF_PATH}][master]')
        if args.debugmode and not settings.is_debug_mode():
            settings.activate_debug()
        if settings.is_debug_mode():
            application.config.INSPECTOR = True
            application.config.INSPECTOR_HOST = args.address
            application.config.INSPECTOR_PORT = 6457
        application.run(
            host=args.address, port=int(args.port_num), workers=args.workers, debug=settings.is_debug_mode(),
            access_log=False, auto_reload=args.use_reloader)
    finally:
        if log_listener:
            log_listener.stop()
