# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
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


import logging

import plugins
import plugins.export
import plugins.export_freq2d
import settings
from plugins.errors import PluginException
from sanic import Sanic


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
            plg = plugins.install_plugin(name, plugin_module, settings)
            if hasattr(plg, 'wait_for_environment') and callable(plg.wait_for_environment):
                logging.getLogger(__name__).info(
                    f'Plug-in {plg.__class__.__name__} is waiting for environment')
                err = plg.wait_for_environment()
                if err:
                    logging.getLogger(__name__).error(f'{plg.__class__.__name__}: {err}')
                else:
                    logging.getLogger(__name__).info(
                        f'Plug-in {plg.__class__.__name__} environment OK')

        except ImportError as e:
            logging.getLogger(__name__).warning(
                f'Plugin [{name}] configured but the following error occurred: {e}')
        except PluginException as e:
            logging.getLogger(__name__).critical(
                'Failed to initiate plug-in %s: %s', name, e, exc_info=e)
            raise e from e
        except Exception as e:
            logging.getLogger(__name__).critical(
                'Failed to initiate plug-in %s: %s', name, e, exc_info=e)
            raise PluginException(f'Failed to initiate plug-in {name} with error {e.__class__.__name__}: {e}') from e
    else:
        plugins.add_missing_plugin(name)


def setup_plugins():
    """
    Sets-up all the plugins. Please note that they are expected
    to be accessed concurrently by multiple requests which means any stateful
    properties should be considered carefully.
    """
    plugins.runtime.EXPORT.force_module(plugins.export)
    plugins.runtime.EXPORT_FREQ2D.force_module(plugins.export_freq2d)
    for plugin in plugins.runtime:
        init_plugin(plugin.name, optional=plugin.is_optional, module=plugin.forced_module)


def install_plugin_actions(app: Sanic) -> None:
    """
    Tests plug-ins whether they provide method 'export_actions' and if so
    then attaches functions they provide to itself (if exported function's required
    controller class matches current instance's one).
    """
    for plg in plugins.runtime:
        if callable(getattr(plg.instance, 'export_actions', None)):
            app.blueprint(getattr(plg.instance, 'export_actions')())
            # TODO watch for conflicting paths?
