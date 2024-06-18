# Copyright (c) 2024 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2024 Tomas Machalek <tomas.machalek@gmail.com>
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
from abc import ABC
from contextlib import AbstractAsyncContextManager, AbstractContextManager
from typing import Generic, TypeVar


N = TypeVar('N')
R = TypeVar('R')
SN = TypeVar('SN')
SR = TypeVar('SR')

T = TypeVar('T')


class AsyncDbContextManager(AbstractAsyncContextManager, Generic[T], ABC):
    async def __aenter__(self) -> T:
        pass


class DbContextManager(AbstractContextManager, Generic[T], ABC):
    def __enter__(self) -> T:
        pass


class DatabaseAdapter(abc.ABC, Generic[N, R, SN, SR]):
    """
    DatabaseAdapter is a general purpose adapter for accessing an SQL database.
    While KonText mainly relies on async database access, some parts
    (miscellaneous scripts, worker jobs) rely on traditional synchronous access.
    For this reason, the DatabaseAdapter interface requires both.

    Please note the important distinction between sync and async function:

    1) the async variants expect the adapter to handle a connection internally
    and keep it properly scoped and shared among multiple calls of connection(),
    cursor() etc. I.e. the respective context managers are expected to lie a bit
    as the connection does not exist only within the scope of a respective `with`
    block. We use it rather as a reminder saying
    "You are working with a connection which is handled for you".

    2) The sync variants (e.g. connection_sync()) should create a new connection
    for a respective `with` block and close the connection once the block is done
    (i.e. that it the typical way how `with` is expected to behave in general).
    For that matter, the sync variants of the corresponding methods take
    the connection as a parameter.
    """

    @property
    @abc.abstractmethod
    def is_autocommit(self):
        """
        Return True if autocommit is enabled for the connection; else False.

        It is expected that even with autocommit ON, it is possible to open
        a transaction using the begin_tx method.
        """
        pass

    @property
    @abc.abstractmethod
    def info(self) -> str:
        """
        Provide a brief info about the database. This is mainly for administrators
        as it is typically written to the application log during KonText start.
        """
        pass


    @abc.abstractmethod
    async def connection(self) -> AsyncDbContextManager[N]:
        """
        Return a database connection for the current scope.
        Please note that it is important for this function not to return
        a new connection each time it is called. Otherwise, functions
        like commit_tx, rollback_tx won't likely work as expected.
        I.e. it should work more like a lazy "singleton" connection provider.
        """
        pass

    @abc.abstractmethod
    def connection_sync(self) -> DbContextManager[SN]:
        """
        This is a synchronous variant of the connection() method.
        """
        pass

    @abc.abstractmethod
    async def cursor(self, dictionary=True) -> AsyncDbContextManager[R]:
        """
        Create a new async database cursor with scope limited
        to the respective `with` block.
        """
        pass

    @abc.abstractmethod
    def cursor_sync(self, dictionary=True) -> DbContextManager[SR]:
        """
        This is a synchronous variant of the cursor() method.
        """
        pass

    @abc.abstractmethod
    async def begin_tx(self, cursor: R):
        """
        Start a transaction within the current connection.
        """
        pass

    @abc.abstractmethod
    async def commit_tx(self):
        """
        Commit a transaction running within
        the current database connection.
        """
        pass

    @abc.abstractmethod
    async def rollback_tx(self):
        """
        Rollback a transaction running within
        the current database connection.
        """
        pass

    @abc.abstractmethod
    def begin_tx_sync(self, cursor: SR):
        """
        This is a synchronous variant of begin_tx
        """
        pass

    @abc.abstractmethod
    def commit_tx_sync(self, conn: SN):
        """
        This is a synchronous variant of commit_tx
        """
        pass

    @abc.abstractmethod
    def rollback_tx_sync(self, conn: SN):
        """
        This is a synchronous variant of rollback_tx
        """
        pass

