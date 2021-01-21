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

# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software
# Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

import abc
from typing import TypeVar, Generic

N = TypeVar('N')
R = TypeVar('R')


class IntegrationDatabase(abc.ABC, Generic[N, R]):
    """
    Integration DB plugin allows sharing a single database connection pool across multiple plugins
    which can be convenient in case KonText is integrated into an existing information system with
    existing user accounts, corpora information etc.
    """

    @property
    @abc.abstractmethod
    def connection(self) -> N:
        pass

    @abc.abstractmethod
    def cursor(self, dictionary=True, buffered=False) -> R:
        pass

    @property
    @abc.abstractmethod
    def is_active(self):
        pass

    @property
    @abc.abstractmethod
    def info(self) -> str:
        pass

    @abc.abstractmethod
    def execute(self, sql, args):
        pass

    @abc.abstractmethod
    def executemany(self, sql, args_rows):
        pass

    @abc.abstractmethod
    def commit(self):
        pass

    @abc.abstractmethod
    def rollback(self):
        pass
