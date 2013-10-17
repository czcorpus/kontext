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
if manatee_dir:
    if not os.path.exists(manatee_dir):
        raise Exception('Incorrect <manatee_path> configuration. Use either empty value or a valid directory path.')
    elif manatee_dir not in sys.path:
        sys.path.insert(0, manatee_dir)

MANATEE_REGISTRY = settings.get('corpora', 'manatee_registry')

###### implicit plugins BEGIN ######

db_module = plugins.load_plugin(settings.get('plugins', 'db')['module'])
plugins.db = db_module.create_instance(settings.get('plugins', 'db'))

session_module = plugins.load_plugin(settings.get('plugins', 'sessions')['module'])
plugins.sessions = session_module.create_instance(settings, plugins.db)

settings_storage_module = plugins.load_plugin(settings.get('plugins', 'settings_storage')['module'])
plugins.settings_storage = settings_storage_module.create_instance(settings, plugins.db)

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
        plugins.application_bar = appbar_module.create_instance(settings, plugins.auth)
except ImportError:
    pass

###### implicit plugins END ######

if __name__ == '__main__':
    import logging
    from logging import handlers
    import __builtin__
    __builtin__.__dict__['_'] = lambda s: s
    from actions import Actions

    # logging setup
    logger = logging.getLogger('') # root logger
    hdlr = handlers.RotatingFileHandler(settings.get('global', 'log_path'), maxBytes=(1 << 23), backupCount=50)
    hdlr.setFormatter(logging.Formatter('%(asctime)s [%(name)s] %(levelname)s: %(message)s'))
    logger.addHandler(hdlr)
    logger.setLevel(logging.INFO if not settings.is_debug_mode() else logging.DEBUG)

    if not settings.is_debug_mode():
        Actions(environ=os.environ).run(selectorname='corpname')
    else:
        Actions(environ=os.environ).run_unprotected(selectorname='corpname')
