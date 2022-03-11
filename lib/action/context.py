import os
from typing import Callable
from .templating import TplEngine
from texttypes.model import TextTypesCache
import plugins
from sanic_babel import Babel


class ApplicationContext:

    def __init__(self, templating: TplEngine, tt_cache: Callable[[], TextTypesCache], babel_instance: Babel):
        self._templating = templating
        self._installed_langs = {
            x.split('_')[0]: x
            for x in os.listdir(os.path.join(os.path.dirname(__file__), '..', '..', 'locale'))
        }
        self._tt_cache = None
        self._tt_cache_factory = tt_cache
        self._babel_instance = babel_instance
        self.redis = None  # TODO TYPE

    @property
    def templating(self):
        return self._templating

    @property
    def tt_cache(self):
        return self._tt_cache if self._tt_cache is not None else self._tt_cache_factory()

    @property
    def babel_instance(self):
        return self._babel_instance

    @staticmethod
    def cleanup_runtime_modules():
        """
        Makes app to forget previously faked modules which
        ensures proper plugins initialization if not starting from scratch.
        """
        plugins.flush_plugins()

    @property
    def installed_langs(self):
        return self._installed_langs
