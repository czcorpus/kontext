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

import abc
from typing import Dict, Optional, Any, TYPE_CHECKING
# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from action.plugin.ctx import PluginCtx

"""
All the application_bar plug-in implementations should inherit from AbstractApplicationBar
"""


class AbstractApplicationBar(abc.ABC):

    @abc.abstractmethod
    def get_fallback_content(self):
        """
        Returns an HTML content usable as a fallback replacement for the standard content
        """

    def get_styles(self, plugin_ctx: 'PluginCtx'):
        """
        Returns a list of dicts {'url': ...} defining external CSS requirements KonText
        must load.

        Returns an empty list if not overridden.

        arguments:
        plugin_ctx -- a controller.PluginCtx instance
        """
        return []

    def get_scripts(self, plugin_ctx: 'PluginCtx') -> Optional[Dict[str, Any]]:
        """
        Returns a dict:
            'main': ... url of the main script ...,
            'deps': [ {'module': ... module name..., 'url': ... module url, 'shim': {...}},...]

            (note: 'shim' is optional)

        Returns none if not overridden.

        arguments:
        plugin_ctx -- a controller.PluginCtx instance
        """
        return None

    @abc.abstractmethod
    async def get_contents(self, plugin_ctx: 'PluginCtx', return_url: str) -> str:
        """
        Returns standard HTML content based on set language and user identification/settings stored in cookies.

        arguments:
        plugin_ctx -- a controller.PluginCtx instance
        return_url -- a URL user returns to in case she uses some of he appbar's links/services
        """
