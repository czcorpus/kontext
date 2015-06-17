"""
"""
import logging

from abstract import PluginException

_plugins = {}


def install_plugin(name, obj):
    _plugins[name] = obj


def flush_plugins():
    _plugins.clear()


def has_plugin(name):
    return name in _plugins


def load_plugin_module(name):
    _tmp = __import__('plugins', fromlist=[name])
    try:
        module = getattr(_tmp, name)
    except AttributeError:
        logging.getLogger(__name__).error('Plugin %s configured but not installed (missing Python module?)' % name)
        module = None
    return module


def _factory(name):
    if name in _plugins:
        return _plugins[name]
    else:
        raise PluginException('Plugin %s not installed' % name)


def get(*names):
    if len(names) == 1:
        return _factory(names[0])
    else:
        return tuple([_factory(obj) for obj in names])


def get_plugins():
    """
    returns:
    a dict (plugin_name, plugin_object)
    """
    return _plugins
