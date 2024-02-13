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

import abc
from typing import Any, Dict, Optional
from sanic.cookies.request import CookieRequestParameters
from aiohttp import ClientSession

from action.krequest import KRequest
from corplib import CorpusFactory
from corplib.abstract import AbstractKCorpus
from plugin_types.auth import UserInfo


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
    def http_client(self) -> ClientSession:
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

    @property
    @abc.abstractmethod
    def cookies(self) -> CookieRequestParameters:
        pass

    @property
    @abc.abstractmethod
    def session(self) -> Dict[str, Any]:
        pass

    @property
    @abc.abstractmethod
    def user_lang(self) -> str:
        pass

    @abc.abstractmethod
    def translate(self, string: str) -> str:
        pass


class AbstractUserPluginCtx(AbstractBasePluginCtx, abc.ABC):

    @abc.abstractmethod
    def clear_session(self) -> None:
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

    @property
    @abc.abstractmethod
    def corpus_factory(self) -> CorpusFactory:
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




class AbstractPqueryPluginCtx(AbstractCorpusPluginCtx, abc.ABC):
    pass


class AbstractWordlistPluginCtx(AbstractCorpusPluginCtx, abc.ABC):
    pass


class PluginCtx(AbstractCorpusPluginCtx, abc.ABC):
    pass

