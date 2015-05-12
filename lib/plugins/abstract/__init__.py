"""
This package contains base classes for miscellaneous plug-ins
implementation. Although KonText uses the duck typing approach
here (i.e. you can the abstract classes as long as you provide
a compatible interface) it is recommended to extend these
classes to keep the plug-in implementation clear and consistent.
"""


class CorpusDependentPlugin(object):
    """
    This class prescribes methods required by optional plug-ins which
    must remain inactive in case of some corpora.
    """
    def is_enabled_for(self, corpname):
        """
        arguments:
        corpname -- a name of the corpus

        returns:
        True if plug-in supports corpus 'corpname' else False
        """
        raise NotImplementedError('OptionalPlugin instance must implement method is_enabled_for(corpname)')


class PluginException(Exception):
    pass


class PluginDependencyException(PluginException):
    pass