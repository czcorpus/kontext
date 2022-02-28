"""
This package contains base classes for miscellaneous plug-ins
implementation. Although KonText uses the duck typing approach
here (i.e. you can the abstract classes as long as you provide
a compatible interface) it is recommended to extend these
classes to keep the plug-in implementation clear and consistent.
"""

import abc
from typing import TYPE_CHECKING, List
# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from action.plg import PluginCtx


class CorpusDependentPlugin(abc.ABC):
    """
    This class prescribes methods required by optional plug-ins which
    must remain inactive in case of some corpora.
    """

    @abc.abstractmethod
    def is_enabled_for(self, plugin_ctx: 'PluginCtx', corpora: List[str]) -> bool:
        """
        arguments:
        corpora -- primary and aligned corpora (if applicable),
                   the list should not be empty in any case

        returns:
        True if plug-in supports corpora else False. It is up to a specific
        plug-in implementation whether it considers all of the passed corpora.
        """
