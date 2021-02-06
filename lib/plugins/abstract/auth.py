# Copyright (c) 2013 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; version 2
# dated June, 1991.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.

from typing import Dict, Any, Optional, Tuple, List, TYPE_CHECKING
from secure_cookie.session import Session
# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from controller.plg import PluginApi

import abc
from translation import ugettext as _
from controller.errors import CorpusForbiddenException, ImmediateRedirectException


class MetaAbstractAuth(abc.ABCMeta):
    """
    This meta-class is used to wrap calls for permitted_corpora
    and optionally normalize all the corpora IDs to lowercase without requiring
    this from individual plug-ins or different code chunks where
    the method is called.
    """
    def __init__(cls, name, bases, clsdict):
        super().__init__(name, bases, clsdict)
        if 'permitted_corpora' in clsdict:
            def wrapped_perm_corp(self, user_dict):
                corpora = clsdict['permitted_corpora'](self, user_dict)
                if self.ignores_corpora_names_case():
                    return [c.lower() for c in corpora]
                else:
                    return corpora
            setattr(cls, 'permitted_corpora', wrapped_perm_corp)

        if 'corpus_access' in clsdict:
            def wrapped_corp_acc(self, user_dict, corpus_name):
                if self.ignores_corpora_names_case():
                    return clsdict['corpus_access'](self, user_dict, corpus_name.lower())
                else:
                    return clsdict['corpus_access'](self, user_dict, corpus_name)
            setattr(cls, 'corpus_access', wrapped_corp_acc)


class AbstractAuth(abc.ABC, metaclass=MetaAbstractAuth):
    """
    Represents general authentication module.
    Custom implementations should inherit from this.
    """

    def __init__(self, anonymous_id: int) -> None:
        """
        arguments:
        anonymous_id -- a numeric ID of anonymous user
        """
        self._anonymous_id = anonymous_id

    def anonymous_user(self) -> Dict[str, Any]:
        """
        Returns a dictionary containing (key, value) pairs
        specifying anonymous user. By default it is ID = 0,
        user = 'anonymous', fullname = _('anonymous')
        """
        return dict(
            id=self._anonymous_id,
            user='anonymous',
            fullname=_('anonymous'))

    def is_anonymous(self, user_id: int) -> bool:
        return user_id == self._anonymous_id

    def is_administrator(self, user_id: int) -> bool:
        """
        Should return True if user has administrator's privileges
        else False

        arguments:
        user_id -- user's database ID
        """
        return False

    @abc.abstractmethod
    def corpus_access(self, user_dict: Dict[str, Any], corpus_name: str) -> Tuple[bool, bool, str]:
        """
        Return a 3-tuple (is owner, has read access, corpus variant)
        """

    @abc.abstractmethod
    def permitted_corpora(self, user_dict: Dict[str, Any]) -> List[str]:
        """
        Return a list of corpora accessible by a user

        arguments:
        user_dict -- user credentials as returned by validate_user()
                     (or as written to session by revalidate() in case
                     of AbstractRemoteAuth implementations).
        """

    def validate_access(self, corpus_name: str, user_dict: Dict[str, Any]) -> Tuple[bool, str]:
        """
        returns a 2-tuple ( "has access?", accessible variant )
        """
        if not corpus_name:
            return False, ''
        if self.ignores_corpora_names_case():
            corpus_name = corpus_name.lower()
        _, access, variant = self.corpus_access(user_dict, corpus_name)
        return access, variant

    def on_forbidden_corpus(self, plugin_api: 'PluginApi', corpname: str, corp_variant: str):
        """
        Optional method run in case KonText finds out that user
        does not have access rights to a corpus specified by 'corpname'.
        There are two main action types you can perform here:
        1) Redirect to a different page or set 'not found'.
        2) Set some system message user can read.
        """
        if corpname:
            raise CorpusForbiddenException(corpname, corp_variant)
        else:
            # no default accessible corpus for the current user
            raise ImmediateRedirectException(plugin_api.create_url('corpora/corplist', {}))

    @abc.abstractmethod
    def get_user_info(self, plugin_api: 'PluginApi') -> Dict[str, Any]:
        """
        Return a dictionary containing all the data about a user.
        Sensitive information like password hashes, recovery questions
        etc. are not expected/required to be included.
        """

    def logout_hook(self, plugin_api: 'PluginApi'):
        """
        An action performed after logout process finishes
        """
        pass

    def ignores_corpora_names_case(self):
        return True


class AbstractSemiInternalAuth(AbstractAuth):

    @abc.abstractmethod
    def validate_user(self, plugin_api: 'PluginApi', username: str, password: str) -> Dict[str, Any]:
        """
        Tries to find a user with matching 'username' and 'password'.
        If a match is found then proper credentials of the user are
        returned. Otherwise an anonymous user's credentials should be
        returned.

        arguments:
        plugin_api -- a kontext.PluginApi instance
        username -- login username
        password -- login password

        returns:
        a dict {'id': ..., 'user': ..., 'fullname'} where 'user' means
        actually 'username'.
        """


class AbstractInternalAuth(AbstractSemiInternalAuth):
    """
    A general authentication running within KonText.
    """

    @abc.abstractmethod
    def get_login_url(self, return_url: Optional[str] = None) -> str:
        """
        Specifies where should KonText redirect a user in case
        he wants to log in. In general, it can be KonText's URL
        or a URL of some other authentication application.
        """

    @abc.abstractmethod
    def get_logout_url(self, return_url: Optional[str] = None) -> str:
        """
        Specifies where should KonText redirect a user in case
        he wants to log out. In general, it can be KonText's URL
        or a URL of some other authentication application.
        """

    @abc.abstractmethod
    def update_user_password(self, user_id: int, password: str):
        """
        Changes a password of provided user.
        """

    @abc.abstractmethod
    def logout(self, session: Session):
        """
        Logs-out current user (identified by passed session object).
        """

    @abc.abstractmethod
    def get_required_password_properties(self) -> str:
        """
        Returns a text description of required password
        properties (e.g.: "at least 5 characters long, at least one digit)
        This should be consistent with validate_new_password().
        """

    @abc.abstractmethod
    def validate_new_password(self, password: str) -> bool:
        """
        Tests whether the provided password matches all the
        required properties. This should be consistent with
        get_required_password_properties().
        """

    @abc.abstractmethod
    def get_required_username_properties(self, plugin_api: 'PluginApi') -> str:
        pass

    @abc.abstractmethod
    def validate_new_username(self, plugin_api: 'PluginApi', username: str) -> Tuple[bool, bool]:
        """
        returns:
            a 2-tuple (availability, validity) (both bool)
        """

    @abc.abstractmethod
    def sign_up_user(self, plugin_api: 'PluginApi', credentials: Dict[str, Any]) -> Dict[str, str]:
        """
        returns:
            a dict where keys are form item identifiers where error occurred
            and values are respective error messsages
        """
        pass

    @abc.abstractmethod
    def sign_up_confirm(self, plugin_api: 'PluginApi', key: str) -> bool:
        pass

    @abc.abstractmethod
    def get_form_props_from_token(self, key: str) -> Dict[str, Any]:
        pass


class AbstractRemoteAuth(AbstractAuth):
    """
    A general authentication based on an external authentication service.
    """

    @abc.abstractmethod
    def revalidate(self, plugin_api: 'PluginApi'):
        """
        Re-validates user authentication against external database with central
        authentication ticket (stored as a cookie) and session data.
        Resulting user data are written to the session (typically - if a remote
        service marks auth. cookie as invalid we store an anonymous user into
        the session. The method returns no value.

        Please note that in case this method raises an exception, KonText
        automatically sets current user as 'anonymous' to prevent security issues.

        The method is expected to write a proper user credentials dict to
        the session. Please see AbstractSemiInternalAuth.validate_user for details.

        arguments:
        plugin_api -- a controller.PluginApi instance
        """


class AuthException(Exception):
    """
    General authentication/authorization exception
    """
    pass


class SignUpNeedsUpdateException(AuthException):
    pass
