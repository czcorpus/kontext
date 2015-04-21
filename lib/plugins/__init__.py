"""
"""
import sys
import logging


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
        logging.getLogger(__name__).error('Plugin %s configured but not installed (missing Python module?)' % name)
        module = None
    return module


def get_plugins():
    """
    returns:
    a dict (plugin_name, plugin_object)
    """
    m = sys.modules[__name__]
    is_plugin = lambda name: not callable(getattr(m, name)) and not name.startswith('__') \
        and name not in sys.builtin_module_names
    return dict([(m, getattr(m, item)) for item in dir(m) if is_plugin(item)])
