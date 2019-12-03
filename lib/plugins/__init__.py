# Copyright (c) 2014 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2014 Tomas Machalek <tomas.machalek@gmail.com>
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

import logging
from .abstract import PluginException


_plugins = {}


class _ID(object):
    """
    A wrapper class used to represent a plug-in as
    an abstract entity which is always instantiated
    (even if its respective plug-in does not exist)
    and which can be asked for basic information
    (name, exists?, is avail. for a corpus?,...).
    """

    def __init__(self, ident, optional=False):
        self._ident = ident
        self._optional = optional
        self._forced_module = None

    def __repr__(self):
        return 'Plugin {0} ({1})'.format(self._ident, self.instance)

    @property
    def instance(self):
        """
        Returns an instance of the plug-in. The instance
        is shared between all the requests (within a single
        web server worker)
        """
        if _has_plugin(self._ident):
            return _plugins[self._ident]
        return None

    @property
    def is_optional(self):
        return self._optional

    @property
    def forced_module(self):
        return self._forced_module

    def force_module(self, mod):
        self._forced_module = mod

    def __enter__(self):
        if _has_plugin(self._ident):
            return self.instance
        return None

    def __exit__(self, type, value, traceback):
        # we ignore accessing plugins which are not installed
        return self.instance is None and type is AttributeError

    @property
    def name(self):
        return self._ident

    @property
    def exists(self):
        """
        Returns True if the plug-in is instantiated (i.e. it
        is properly configured in config.xml). For corpus-dependent
        plug-ins (e.g. live_attributes) please use method
        is_enabled_for()
        """
        return _plugins.get(self._ident) is not None

    def is_enabled_for(self, plugin_api, corpus_id):
        """
        Returns True if the plugin exists and is enabled for a specified
        corpus or it is corpus independent (e.g. db plugin, session,...)
        """
        if self.exists:
            if hasattr(self.instance, 'is_enabled_for'):
                return self.instance.is_enabled_for(plugin_api, corpus_id)
            else:
                return True
        else:
            return False


class _Names(object):
    DB = _ID('db')
    SESSIONS = _ID('sessions')
    SETTINGS_STORAGE = _ID('settings_storage')
    AUTH = _ID('auth')
    CONC_PERSISTENCE = _ID('conc_persistence')
    CONC_CACHE = _ID('conc_cache')
    EXPORT = _ID('export')
    EXPORT_FREQ2D = _ID('export_freq2d')
    USER_ITEMS = _ID('user_items')
    MENU_ITEMS = _ID('menu_items')

    GETLANG = _ID('getlang', optional=True)
    CORPARCH = _ID('corparch')
    QUERY_STORAGE = _ID('query_storage', optional=True)
    APPLICATION_BAR = _ID('application_bar', optional=True)
    FOOTER_BAR = _ID('footer_bar', optional=True)
    LIVE_ATTRIBUTES = _ID('live_attributes', optional=True)
    SUBC_RESTORE = _ID('subc_restore', optional=True)
    TAGHELPER = _ID('taghelper', optional=True)
    SYNTAX_VIEWER = _ID('syntax_viewer', optional=True)
    SUBCMIXER = _ID('subcmixer', optional=True)
    CHART_EXPORT = _ID('chart_export', optional=True)
    ISSUE_REPORTING = _ID('issue_reporting', optional=True)
    TOKEN_CONNECT = _ID('token_connect', optional=True)
    KWIC_CONNECT = _ID('kwic_connect', optional=True)
    DISPATCH_HOOK = _ID('dispatch_hook', optional=True)

    def __iter__(self):
        return iter([self.DB, self.SESSIONS, self.SETTINGS_STORAGE, self.AUTH, self.CONC_PERSISTENCE,
                     self.CONC_CACHE, self.EXPORT, self.EXPORT_FREQ2D, self.USER_ITEMS, self.MENU_ITEMS,
                     self.GETLANG, self.CORPARCH, self.QUERY_STORAGE, self.APPLICATION_BAR, self.FOOTER_BAR,
                     self.LIVE_ATTRIBUTES, self.SUBC_RESTORE, self.TAGHELPER, self.SYNTAX_VIEWER, self.SUBCMIXER,
                     self.CHART_EXPORT, self.ISSUE_REPORTING, self.TOKEN_CONNECT, self.KWIC_CONNECT,
                     self.DISPATCH_HOOK])


runtime = _Names()


def install_plugin(name, module, config):
    if isinstance(module.create_instance, _PluginFactory):
        _plugins[name] = module.create_instance(*(config,))
    else:  # modules without @inject will get just the configuration
        _plugins[name] = module.create_instance(*(config,))


def inject_plugin(ident, obj):
    """
    Inject a plug-in object directly. This is mainly
    for testing.
    """
    _plugins[ident.name] = obj


def add_missing_plugin(name):
    _plugins[name] = None


def flush_plugins():
    _plugins.clear()


def _has_plugin(name):
    return _plugins.get(name) is not None


def load_plugin_module(name):
    _tmp = __import__('plugins', fromlist=[name])
    try:
        module = getattr(_tmp, name)
    except AttributeError:
        logging.getLogger(__name__).error(
            'Plugin %s configured but not installed (missing Python module?)' % name)
        module = None
    return module


class _PluginFactory(object):
    def __init__(self, fn, *args):
        self._fn = fn
        self._args = args

    def __call__(self, conf):
        return self._fn(*(conf,) + self._args)


def inject(*args):
    """
    A decorator allowing a declarative injection of plug-in
    dependencies (= other plug-ins). Plug-ins are injected
    as positional arguments. The first argument is always
    the 'settings' object.

    @inject(plugins.runtime.DB, plugins.runtime.SESSIONS, plugins.runtime.AUTH)
    def create_instance(conf, db, sessions, auth):
      pass

    arguments:
    one or more plug-in names (see the example)
    """
    def wrapper(func):
        return _PluginFactory(func, *[p.instance for p in args])
    return wrapper
