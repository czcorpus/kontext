import os
from .templating import TplEngine
from texttypes import TextTypesCache
import plugins
from werkzeug.http import parse_accept_header
from action.cookie import KonTextCookie
from sanic.request import Request


class ActionContext:

    def __init__(self, templating: TplEngine, tt_cache: TextTypesCache):
        self._templating = templating
        self._installed_langs = dict(
            [(x.split('_')[0], x) for x in os.listdir(os.path.join(os.path.dirname(__file__), '..', '..', 'locale'))])
        self._tt_cache = tt_cache

    @property
    def templating(self):
        return self._templating

    @property
    def tt_cache(self):
        return self._tt_cache

    @staticmethod
    def cleanup_runtime_modules():
        """
        Makes app to forget previously faked modules which
        ensures proper plugins initialization if not starting from scratch.
        """
        plugins.flush_plugins()

    def get_lang(self, request: Request):
        """
        Detects user's preferred language (either via the 'getlang' plugin or from HTTP_ACCEPT_LANGUAGE env value)

        arguments:
        environ -- WSGI environment variable

        returns:
        underscore-separated ISO 639 language code and ISO 3166 country code
        """
        cookies = KonTextCookie(request.cookies.get('HTTP_COOKIE', ''))

        if plugins.runtime.GETLANG.exists:
            lgs_string = plugins.runtime.GETLANG.instance.fetch_current_language(cookies)
        else:
            lang_cookie = cookies.get('kontext_ui_lang')
            if not lang_cookie:
                lgs_string = parse_accept_header(request.headers.get('HTTP_ACCEPT_LANGUAGE')).best
            else:
                lgs_string = lang_cookie.value
            if lgs_string is None:
                lgs_string = 'en_US'
            if len(lgs_string) == 2:  # in case we obtain just an ISO 639 language code
                lgs_string = self._installed_langs.get(lgs_string)
            else:
                lgs_string = lgs_string.replace('-', '_')
        if lgs_string is None:
            lgs_string = 'en_US'
        return lgs_string
