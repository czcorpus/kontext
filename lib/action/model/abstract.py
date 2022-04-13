# Copyright (c) 2013 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

from typing import Any, Dict, Union
from abc import abstractmethod, ABC
from action.req_args import RequestArgsProxy, JSONRequestArgsProxy
from action.props import ActionProps

from sanic import Sanic


class AbstractPageModel(ABC):
    """
    AbstractPageModel represents a general, minimal action model.
    """

    @abstractmethod
    async def add_globals(self, app: Sanic, action_props: ActionProps, result: Dict[str, Any]):
        pass

    @abstractmethod
    def init_menu(self, result):
        pass

    @abstractmethod
    async def pre_dispatch(
            self,
            args_proxy: Union[None, RequestArgsProxy, JSONRequestArgsProxy]
    ) -> Union[RequestArgsProxy, JSONRequestArgsProxy]:
        pass

    @abstractmethod
    async def post_dispatch(self, action_props: ActionProps, result, err_desc):
        pass


class AbstractUserModel(AbstractPageModel, ABC):
    """
    AbstractUserModel is an extended AbstractPageModel which can be used to determine
    whether a user is authorized to access actions (not corpora!)
    """

    @abstractmethod
    def user_is_anonymous(self) -> bool:
        pass
