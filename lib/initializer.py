# Copyright (c) 2015 Institute of the Czech National Corpus
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
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
# 02110-1301, USA.

import logging

import settings
import plugins
import plugins.export_freq2d
import plugins.export
from plugins.abstract import PluginException


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
                                             % (name, e))
        except (PluginException, Exception) as e:
            logging.getLogger(__name__).critical('Failed to initiate plug-in %s: %s' % (name, e))
            raise e
    else:
        plugins.add_missing_plugin(name)


def setup_plugins():
    """
    Sets-up all the plugins. Please note that they are expected
    to be accessed concurrently by multiple requests which means any stateful
    properties should be considered carefully.
    """
    init_plugin('db')
    init_plugin('sessions')
    init_plugin('settings_storage')
    init_plugin('auth')
    init_plugin('conc_persistence')
    init_plugin('conc_cache')
    init_plugin('export', module=plugins.export)
    init_plugin('export_freq2d', module=plugins.export_freq2d)
    init_plugin('user_items')
    init_plugin('menu_items')

    init_plugin('getlang', optional=True)
    init_plugin('corparch')
    init_plugin('query_storage', optional=True)
    init_plugin('application_bar', optional=True)
    init_plugin('footer_bar', optional=True)
    init_plugin('live_attributes', optional=True)
    init_plugin('subc_restore', optional=True)
    init_plugin('taghelper', optional=True)
    init_plugin('syntax_viewer', optional=True)
    init_plugin('subcmixer', optional=True)
    init_plugin('chart_export', optional=True)
    init_plugin('issue_reporting', optional=True)
    init_plugin('token_detail', optional=True)
