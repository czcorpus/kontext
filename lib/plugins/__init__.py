"""
"""
import sys


def has_plugin(name):
    return name in globals() and globals()[name] is not None


def load_plugin(name):
    _tmp = __import__('plugins', fromlist=[name])
    try:
        module = getattr(_tmp, name)
    except AttributeError:
        module = None
    return module


def list_plugins():
    m = sys.modules[__name__]
    return [item for item in dir(m) if not callable(getattr(m, item))
            and not item.startswith('__')
            and not item in sys.builtin_module_names]