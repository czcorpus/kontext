# Copyright (c) 2021 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2021 Tomas Machalek <tomas.machalek@gmail.com>
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
from typing import TypeVar, Generic

T = TypeVar('T')


class AbstractSignUpToken(Generic[T]):

    @abc.abstractmethod
    async def save(self, db: T):
        pass

    @abc.abstractmethod
    async def load(self, db: T):
        pass

    @abc.abstractmethod
    async def delete(self, db: T):
        pass

    @abc.abstractmethod
    async def is_valid(self, db: T):
        pass

    @abc.abstractmethod
    def is_stored(self):
        pass
