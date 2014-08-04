"""
"""
import sys


def has_plugin(name):
    m = sys.modules[__name__]
    return hasattr(m, name) \
        and not name.startswith('__') \
        and getattr(m, name) is not None


def load_plugin(name):
    _tmp = __import__('plugins', fromlist=[name])
    try:
        module = getattr(_tmp, name)
    except AttributeError:
        module = None
    return module


def list_plugins():
    m = sys.modules[__name__]
    return [getattr(m, item) for item in dir(m) if not callable(getattr(m, item))
            and not item.startswith('__')
            and not item in sys.builtin_module_names]


class CorpusDependentPlugin(object):
    """
    This class prescribes methods required by optional plug-ins to
    run without internal errors
    """
    def is_enabled_for(self, corpname):
        raise NotImplementedError('OptionalPlugin instance must implement method is_enabled_for(corpname)')


class PluginException(Exception):
    """
    General error in a plug-in (e.g. configuration problem, resource problem).
    User actions should not produce this kind of error.
    """
    pass