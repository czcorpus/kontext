from action.model.base import BaseActionModel, BasePluginCtx
from action.krequest import KRequest
from action.response import KResponse
from action import ActionProps
from typing import Any, Optional
from texttypes.cache import TextTypesCache
from plugin_types.auth import UserInfo, AbstractInternalAuth
import logging
from translation import ugettext
from main_menu import MainMenu
import plugins  # note - plugins are stateful


class UserActionModel(BaseActionModel):

    USER_ACTIONS_DISABLED_ITEMS = (
        MainMenu.FILTER, MainMenu.FREQUENCY, MainMenu.COLLOCATIONS, MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.VIEW)

    # main menu items disabled for public users (this is applied automatically during
    # post_dispatch())
    ANON_FORBIDDEN_MENU_ITEMS = (
        MainMenu.NEW_QUERY('history', 'wordlist'),
        MainMenu.CORPORA('my-subcorpora', 'create-subcorpus'),
        MainMenu.SAVE, MainMenu.CONCORDANCE, MainMenu.FILTER,
        MainMenu.FREQUENCY, MainMenu.COLLOCATIONS)

    def __init__(
            self, req: KRequest, resp: KResponse, action_props: ActionProps, tt_cache: TextTypesCache):
        super().__init__(req, resp, action_props, tt_cache)
        self._uses_valid_sid: bool = True
        self.return_url: Optional[str] = None
        self._plugin_ctx: Optional[UserPluginCtx] = None

    @property
    def plugin_ctx(self):
        if self._plugin_ctx is None:
            self._plugin_ctx = UserPluginCtx(self, self._req, self._resp)
        return self._plugin_ctx

    def session_get_user(self) -> UserInfo:
        """
        This is a convenience method for obtaining typed user info from HTTP session
        """
        return self._req.ctx.session['user']

    def session_get(self, *nested_keys: str) -> Any:
        """
        Retrieve any HTTP session value. The method supports nested
        keys - e.g. to get self._session['user']['car']['name'] we
        can just call self.session_get('user', 'car', 'name').
        If no matching keys are found then None is returned.

        Arguments:
        *nested_keys -- keys to access required value

        TODO this is probably too general to be in action model
        """
        curr = dict(self._req.ctx.session)
        for k in nested_keys:
            if k in curr:
                curr = curr[k]
            else:
                return None
        return curr

    # mypy error: missing return statement
    def user_is_anonymous(self) -> bool:  # type: ignore
        with plugins.runtime.AUTH as auth:
            return getattr(auth, 'is_anonymous')(self.session_get('user', 'id'))

    @staticmethod
    def is_anonymous_id(user_id):
        return plugins.runtime.AUTH.instance.is_anonymous(user_id)

    @staticmethod
    def _uses_internal_user_pages():
        return isinstance(plugins.runtime.AUTH.instance, AbstractInternalAuth)

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

            if 'user' not in self._req.ctx.session:
                self._req.ctx.session['user'] = auth.anonymous_user()

            if hasattr(auth, 'revalidate'):
                try:
                    auth.revalidate(self._plugin_ctx)  # type: ignore
                except Exception as ex:
                    self._req.ctx.session['user'] = auth.anonymous_user()
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


class UserPluginCtx(BasePluginCtx):

    def __init__(self, action_model: UserActionModel, request: KRequest, response: KResponse):
        super().__init__(action_model, request, response)
        self._action_model = action_model

    def refresh_session_id(self) -> None:
        return self._action_model.refresh_session_id()

    @property
    def user_is_anonymous(self) -> bool:
        return self._action_model.user_is_anonymous()

    @property
    def user_id(self) -> int:
        return self._request.ctx.session.get('user', {'id': None}).get('id')

    @property
    def user_dict(self) -> UserInfo:
        return self._request.ctx.session.get('user', {'id': None})