from action.model.base import BaseActionModel
from action.krequest import KRequest
from action import ActionProps
from typing import Any
from texttypes.cache import TextTypesCache
from plugin_types.auth import UserInfo
import logging
from translation import ugettext
from main_menu import MainMenu
import plugins  # note - plugins are stateful


class AuthActionModel(BaseActionModel):

    # main menu items disabled for public users (this is applied automatically during
    # post_dispatch())
    ANON_FORBIDDEN_MENU_ITEMS = (
        MainMenu.NEW_QUERY('history', 'wordlist'),
        MainMenu.CORPORA('my-subcorpora', 'create-subcorpus'),
        MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER,
        MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)

    def __init__(self, request: KRequest, action_props: ActionProps, tt_cache: TextTypesCache) -> None:
        super().__init__(request, action_props, tt_cache)
        self._uses_valid_sid: bool = True

    def session_get_user(self) -> UserInfo:
        """
        This is a convenience method for obtaining typed user info from HTTP session
        """
        return self._request.ctx.session['user']

    def session_get(self, *nested_keys: str) -> Any:
        """
        Retrieve any HTTP session value. The method supports nested
        keys - e.g. to get self._session['user']['car']['name'] we
        can just call self.session_get('user', 'car', 'name').
        If no matching keys are found then None is returned.

        Arguments:
        *nested_keys -- keys to access required value
        """
        curr = dict(self._request.ctx.session)
        for k in nested_keys:
            if k in curr:
                curr = curr[k]
            else:
                return None
        return curr

    def init_session(self) -> None:
        """
        Starts/reloads user's web session data. It can be called even
        if there is no 'sessions' plugin installed (in such case, it just
        creates an empty dictionary with some predefined keys to allow other
        parts of the application to operate properly)
        """
        with plugins.runtime.AUTH as auth:
            if auth is None:
                raise RuntimeError('Auth plugin was not initialized')

            if 'user' not in self._request.ctx.session:
                self._request.ctx.session['user'] = auth.anonymous_user()

            if hasattr(auth, 'revalidate'):
                try:
                    auth.revalidate(self._plugin_ctx)  # type: ignore
                except Exception as ex:
                    self._request.ctx.session['user'] = auth.anonymous_user()
                    logging.getLogger(__name__).error('Revalidation error: %s' % ex)
                    self.add_system_message(
                        'error',
                        ugettext(
                            'User authentication error. Please try to reload the page or '
                            'contact system administrator.'))

    def refresh_session_id(self) -> None:
        """
        This tells the wrapping WSGI app to create a new session with
        the same data as the current session.
        """
        self._uses_valid_sid = False
