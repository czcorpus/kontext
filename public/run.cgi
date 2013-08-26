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

import cgitb
import sys
import os
import re
import json

sys.path.insert(0, '../lib')  # to be able to import application libraries
sys.path.insert(0, '..')   # to be able to import compiled template modules

import plugins
import settings
settings.load()

if settings.is_debug_mode():
    cgitb.enable()

manatee_dir = settings.get('global', 'manatee_path')
if manatee_dir and manatee_dir not in sys.path:
    sys.path.insert(0, manatee_dir)

import manatee

import CGIPublisher
from actions import Actions
from usercgi import UserCGI

MANATEE_REGISTRY = settings.get('corpora', 'manatee_registry')

# implicit plugins BEGIN ###

db_module = plugins.load_plugin(settings.get('plugins', 'db')['module'])
plugins.db = db_module.create_instance(settings.get('plugins', 'db'))

session_module = plugins.load_plugin(settings.get('plugins', 'sessions')['module'])
plugins.sessions = session_module.create_instance(settings, plugins.db)

auth_module = plugins.load_plugin(settings.get('plugins', 'auth')['module'])
plugins.auth = auth_module.create_instance(settings, plugins.sessions, plugins.db)

try:
    query_storage_module = plugins.load_plugin(settings.get('plugins', 'query_storage')['module'])
    if query_storage_module:
        plugins.query_storage = query_storage_module.QueryStorage(settings, plugins.db)
except ImportError:
    pass

try:
    appbar_module = plugins.load_plugin(settings.get('plugins', 'appbar')['module'])
    if appbar_module:
        plugins.application_bar = appbar_module.AppBar(settings)
except ImportError:
    pass

# implicit plugins END ###


class BonitoCGI (Actions, UserCGI):

    # UserCGI options
    _options_dir = settings.get('corpora', 'options_dir')

    # Actions options
    cache_dir = settings.get('corpora', 'cache_dir')
    gdexpath = [] # [('confname', '/path/to/gdex.conf'), ...]

    helpsite = 'https://trac.sketchengine.co.uk/wiki/SkE/Help/PageSpecificHelp/'

    def __init__(self, user=None, environ=os.environ):
        UserCGI.__init__(self, environ=environ, user=user)
        Actions.__init__(self, environ=environ)

    def _user_defaults (self, user):
        if user is not self._default_user:
            self.subcpath.append ('%s/%s' % (settings.get('corpora', 'users_subcpath'), user))
        self._conc_dir = '%s/%s' % (settings.get('corpora', 'conc_dir'), user)
        self._wseval_dir = '%s/%s' % (settings.get('corpora', 'wseval_dir'), user)


if __name__ == '__main__':
    import logging
    from logging import handlers

    # logging setup
    logger = logging.getLogger('') # root logger
    hdlr = handlers.RotatingFileHandler(settings.get('global', 'log_path'), maxBytes=(1 << 23), backupCount=50)
    hdlr.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(hdlr)
    logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)

    if ";prof=" in os.environ['REQUEST_URI'] or "&prof=" in os.environ['REQUEST_URI']:
        import cProfile, pstats, tempfile
        proffile = tempfile.NamedTemporaryFile()
        cProfile.run('''BonitoCGI().run_unprotected (selectorname="corpname",
                        outf=open(os.devnull, "w"))''', proffile.name)
        profstats = pstats.Stats(proffile.name)
        print "<pre>"
        profstats.sort_stats('time','calls').print_stats(50)
        profstats.sort_stats('cumulative').print_stats(50)
        print "</pre>"
    elif not settings.is_debug_mode():
        BonitoCGI(environ=os.environ).run(selectorname='corpname')
    else:
        BonitoCGI(environ=os.environ).run_unprotected(selectorname='corpname')
