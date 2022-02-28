# Copyright (c) 2020 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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
from typing import TypeVar, Type, Generic, Union

T = TypeVar('T')


class AbstractResultWrapper(abc.ABC, Generic[T]):

    @abc.abstractmethod
    def get(self, timeout=None) -> Union[T, Exception]:
        pass

    @property
    @abc.abstractmethod
    def status(self) -> str:
        pass

    @property
    @abc.abstractmethod
    def id(self) -> str:
        pass


class AbstractBgClient(abc.ABC):

    @abc.abstractmethod
    def send_task(
            self, name, ans_type: Type[T], args=None, time_limit=None, soft_time_limit=None) -> AbstractResultWrapper:
        pass

    @abc.abstractmethod
    def get_task_error(self, task_id):
        pass

    @abc.abstractmethod
    def AsyncResult(self, ident):
        pass

    @property
    @abc.abstractmethod
    def control(self):
        pass
