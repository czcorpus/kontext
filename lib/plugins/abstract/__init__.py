"""
This package contains base classes for miscellaneous plug-ins
implementation. Although KonText uses the duck typing approach
here (i.e. you can the abstract classes as long as you provide
a compatible interface) it is recommended to extend these
classes to keep the plug-in implementation clear and consistent.
"""

import abc
from typing import TYPE_CHECKING
# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from controller.plg import PluginApi


class CorpusDependentPlugin(abc.ABC):
    """
    This class prescribes methods required by optional plug-ins which
    must remain inactive in case of some corpora.
    """

    @abc.abstractmethod
    def is_enabled_for(self, plugin_api: 'PluginApi', corpname: str) -> bool:
        """
        arguments:
        corpname -- a name of the corpus

        returns:
        True if plug-in supports corpus 'corpname' else False
        """


class PluginException(Exception):
    pass


class PluginDependencyException(PluginException):
    pass
