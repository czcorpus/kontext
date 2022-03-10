# Copyright (c) 2013 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

from typing import Any, Optional, Dict
from action.krequest import KRequest
from action.cookie import KonTextCookie
from plugin_types.auth import UserInfo
from corplib.abstract import AbstractKCorpus
from corplib import CorpusManager
import abc


class AbstractBasePluginCtx(abc.ABC):

    """
    AbstractBasePluginCtx defines a subset of features from BaseActionModel for plug-ins.
    """

    @abc.abstractmethod
    def set_shared(self, key: str, value: Any):
        pass

    @abc.abstractmethod
    def get_shared(self, key: str, default: Optional[Any] = None) -> Any:
        pass

    @property
    @abc.abstractmethod
    def client_ip(self) -> str:
        pass

    @property
    @abc.abstractmethod
    def http_headers(self) -> Dict[str, str]:
        pass

    @property
    @abc.abstractmethod
    def request(self) -> KRequest:
        pass

    @property
    @abc.abstractmethod
    def current_url(self) -> str:
        pass

    @property
    @abc.abstractmethod
    def root_url(self) -> str:
        pass

    @abc.abstractmethod
    def create_url(self, action, params) -> str:
        pass

    @abc.abstractmethod
    def updated_current_url(self, args) -> str:
        pass

    @abc.abstractmethod
    def redirect(self, url: str, code: int = 303) -> None:
        pass

    @abc.abstractmethod
    def set_not_found(self):
        pass

    @abc.abstractmethod
    def set_respose_status(self, status: int):
        pass

    @abc.abstractmethod
    def add_system_message(self, msg_type, text):
        pass

    @property
    @abc.abstractmethod
    def cookies(self) -> KonTextCookie:
        pass

    @property
    @abc.abstractmethod
    def session(self):
        pass

    @property
    @abc.abstractmethod
    def user_lang(self) -> str:
        pass


class AbstractUserPluginCtx(AbstractBasePluginCtx, abc.ABC):

    @abc.abstractmethod
    def refresh_session_id(self) -> None:
        pass

    @property
    @abc.abstractmethod
    def user_is_anonymous(self) -> bool:
        pass

    @property
    @abc.abstractmethod
    def user_id(self) -> int:
        pass

    @property
    @abc.abstractmethod
    def user_dict(self) -> UserInfo:
        pass


class AbstractCorpusPluginCtx(AbstractUserPluginCtx, abc.ABC):

    @property
    @abc.abstractmethod
    def current_corpus(self) -> AbstractKCorpus:
        pass

    @property
    @abc.abstractmethod
    def aligned_corpora(self):
        pass

    @property
    @abc.abstractmethod
    def available_aligned_corpora(self):
        pass

    @property
    @abc.abstractmethod
    def corpus_manager(self) -> CorpusManager:
        pass


class PluginCtx(AbstractCorpusPluginCtx, abc.ABC):
    pass







