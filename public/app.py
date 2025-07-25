# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Department of Linguistics
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
import hashlib
import locale
import logging
import os
import secrets
import signal
import sys
import tempfile
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

LOCALE_PATH = os.path.realpath(os.path.join(os.path.dirname(__file__), '../locale'))
JWT_COOKIE_NAME = 'kontext_jwt'
JWT_ALGORITHM = 'HS256'
DFLT_HTTP_CLIENT_TIMEOUT = 20
SIGNAL_CHANNEL_ID = "channel:signals"

from typing import Optional

import jwt
import plugins
import plugins.export
import settings
from action.context import ApplicationContext
from action.plugin.initializer import install_plugin_actions, setup_plugins
from action.templating import TplEngine
from babel import support
from jwt.exceptions import ExpiredSignatureError, InvalidSignatureError
from log_formatter import KontextLogFormatter
from sanic import Request, Sanic
from sanic.exceptions import NotFound
from sanic.response import HTTPResponse, json
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
from views.sse import bp as sse_bp
from views.wordlist import bp as wordlist_bp
from views.tt_select import bp as tt_select_bp

# we ensure that the application's locale is always the same
locale.setlocale(locale.LC_ALL, 'en_US.utf-8')
logger = logging.getLogger()  # root logger
# a file for storing soft-reset token (the stored value is auto-generated on each (re)start)
SOFT_RESET_TOKEN_FILE = os.path.join(
    tempfile.gettempdir(), 'kontext_srt', hashlib.sha1(settings.CONF_PATH.encode()).hexdigest())


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
    if settings.is_debug_mode():
        logging.getLogger('sanic').setLevel(logging.INFO)
        logging.getLogger('mysql.connector').setLevel(logging.INFO)
    return listener


if settings.get('global', 'manatee_path', None):
    sys.path.insert(0, settings.get('global', 'manatee_path'))

# please note that some environments may provide umask setting themselves
if settings.get('global', 'umask', None):
    os.umask(int(settings.get('global', 'umask'), 8))

os.environ['MANATEE_REGISTRY'] = settings.get('corpora', 'manatee_registry')

log_listener = setup_logger(settings)

application = Sanic('kontext')

application.config['debug_level'] = settings.debug_level()
application.config['action_path_prefix'] = settings.get_str('global', 'action_path_prefix', '/')
application.config['redirect_safe_domains'] = settings.get('global', 'redirect_safe_domains', ())
application.config['csp_domains'] = settings.get('global', 'csp_domains', ())
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
application.blueprint(tt_select_bp)
application.blueprint(sse_bp)
setup_plugins()
install_plugin_actions(application)

with plugins.runtime.DB as db:
    tt_cache = TextTypesCache(db)

application.ctx = ApplicationContext(
    templating=TplEngine(settings),
    tt_cache=tt_cache)


def load_translations(app: Sanic):
    app.ctx.translations = {}
    for loc in settings.get_list('global', 'translations'):
        loc = loc.replace('-', '_')
        catalog = support.Translations.load(LOCALE_PATH, [loc])
        app.ctx.translations[loc] = catalog


@application.listener('main_process_start')
async def main_process_init(*_):
    # create a token file for soft restart
    if not os.path.isdir(os.path.dirname(SOFT_RESET_TOKEN_FILE)):
        os.mkdir(os.path.dirname(SOFT_RESET_TOKEN_FILE))
    key = secrets.token_hex(32)
    with open(SOFT_RESET_TOKEN_FILE, 'w') as ttf:
        ttf.write(key)
    logging.getLogger(__name__).info(
        f'setting soft restart token {key[:5]}..., file {os.path.basename(SOFT_RESET_TOKEN_FILE)[:5]}...')


@application.listener('before_server_start')
async def server_init(app: Sanic, loop: asyncio.BaseEventLoop):
    setproctitle(f'sanic-kontext [{settings.CONF_PATH}][worker]')
    # workers will handle SIGUSR1
    loop.add_signal_handler(signal.SIGUSR1, lambda: asyncio.create_task(sigusr1_handler()))
    # init extensions fabrics
    # runtime conf (this should have its own module in the future)
    http_client_conf = settings.get_int('global', 'http_client_timeout_secs', 0)
    if not http_client_conf:
        http_client_conf = DFLT_HTTP_CLIENT_TIMEOUT
        logging.getLogger(__name__).warning(
            f'Internal HTTP client timeout not configured, using default {DFLT_HTTP_CLIENT_TIMEOUT} sec.')
    app.ctx.kontext_conf = {'http_client_timeout_secs': http_client_conf}
    # load all translations
    load_translations(app)
    # load restart token
    with open(SOFT_RESET_TOKEN_FILE, 'r') as ttf:
        app.ctx.soft_restart_token = ttf.read().strip()
        logging.getLogger(__name__).info(
            f'worker is attaching soft-restart token {app.ctx.soft_restart_token[:5]}...')
    for p in plugins.runtime:
        if hasattr(p.instance, 'on_init'):
            await p.instance.on_init()


@application.listener('after_server_start')
async def run_receiver(app: Sanic, loop: asyncio.BaseEventLoop):
    return
    async def receiver():
        # signal handler propagates received signals between all Sanic workers
        async def signal_handler(msg: str):
            await app.dispatch(msg)
            return False  # returns if receiver should stop

        with plugins.runtime.DB as db:
            await db.subscribe_channel(SIGNAL_CHANNEL_ID, signal_handler)
            logging.getLogger(__name__).debug(
                "Worker `%s` subscribed to `%s`", app.m.pid, SIGNAL_CHANNEL_ID)

    logging.getLogger(__name__).debug("Starting receiver %s", app.m.pid)
    receiver = loop.create_task(receiver(), name=app.m.pid)
    # wait so receiver gains control and can raise exception
    await asyncio.sleep(0.5)
    try:
        receiver.result()
    except NotImplementedError:
        logging.info("DB subscribe_channel not implemented, crossworker signal handler disabled")
    except Exception as e:
        logging.error("Error while running receiver", exc_info=e)
    app.ctx.receiver = receiver


@application.listener('before_server_stop')
async def stop_receiver(app: Sanic, loop: asyncio.BaseEventLoop):
    if app.ctx.receiver and not app.ctx.receiver.done():
        logging.getLogger(__name__).debug(
            "Stopping receiver %s", app.ctx.receiver.get_name())
        app.ctx.receiver.cancel()


@application.middleware('request')
async def extract_jwt(request: Request):
    jwt_cookie = request.cookies.get(JWT_COOKIE_NAME)
    if jwt_cookie is not None:
        try:
            request.ctx.session = jwt.decode(jwt_cookie, settings.get(
                'global', 'jwt_secret'), algorithms=[JWT_ALGORITHM])
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
    for p in plugins.runtime:
        if hasattr(p.instance, 'on_request'):
            await p.instance.on_request()


@application.middleware('response')
async def store_jwt(request: Request, response: HTTPResponse):
    ttl = settings.get_int('global', 'jwt_ttl_secs', 3600)
    request.ctx.session['exp'] = datetime.now(timezone.utc) + timedelta(seconds=ttl)
    response.cookies.add_cookie(
        JWT_COOKIE_NAME,
        jwt.encode(request.ctx.session,  settings.get(
            'global', 'jwt_secret'), algorithm=JWT_ALGORITHM),
        httponly=True,
        secure=bool(
            request.conn_info.ssl or request.headers.get('x-forwarded-protocol', '') == 'https'
            or request.headers.get('x-forwarded-proto') == 'https'
        )
    )
    if response.content_type != 'text/event-stream':
        for p in plugins.runtime:
            if hasattr(p.instance, 'on_response'):
                await p.instance.on_response()


@application.signal('kontext.internal.reset')
async def handle_soft_reset_signal():
    for p in plugins.runtime:
        fn = getattr(p.instance, 'on_soft_reset', None)
        if callable(fn):
            await fn()
    await tt_cache.clear_all()
    logging.getLogger(__name__).warning('performed internal soft reset (Sanic signal)')


@application.route('/soft-reset', methods=['POST'])
async def soft_reset(req):
    logging.getLogger(__name__).warning("key = {}".format(req.args.get('key')))
    logging.getLogger(__name__).warning("expected = {}".format(application.ctx.soft_restart_token))
    if req.args.get('key') == application.ctx.soft_restart_token:
        with plugins.runtime.DB as db:
            await db.publish_channel(SIGNAL_CHANNEL_ID, 'kontext.internal.reset')
        return json(dict(ok=True))
    else:
        raise NotFound()


async def sigusr1_handler():
    logging.getLogger(__name__).warning('Caught signal SIGUSR1')
    with plugins.runtime.DB as db:
        await db.publish_channel(SIGNAL_CHANNEL_ID, 'kontext.internal.reset')


def get_locale(request: Request) -> str:
    """
    Gets user locale based on request data
    """
    with plugins.runtime.GETLANG as getlang:
        if getlang is not None:
            lgs_string = getlang.fetch_current_language(request.cookies)
        else:
            lang_cookie = request.cookies.get('kontext_ui_lang')
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
    parser.add_argument('--soft-reset', action='store_true', default=False,
                        help='Only publish soft reset signal')
    args = parser.parse_args()

    if args.soft_reset:
        with plugins.runtime.DB as db:
            asyncio.run(db.publish_channel(SIGNAL_CHANNEL_ID, 'kontext.internal.reset'))
            print('Soft reset signal published')
        sys.exit(0)

    if args.debugpy:
        if '_DEBUGPY_RUNNING' not in os.environ:
            import debugpy
            debugpy.listen((args.address, 5678))
            os.environ['_DEBUGPY_RUNNING'] = '1'

    try:
        setproctitle(f'sanic-kontext [{settings.CONF_PATH}][master]')
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
