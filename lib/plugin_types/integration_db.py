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
from contextlib import AbstractAsyncContextManager, AbstractContextManager
from typing import TypeVar, Generic, Optional

N = TypeVar('N')
R = TypeVar('R')
SN = TypeVar('SN')
SR = TypeVar('SR')

T = TypeVar('T')


class AsyncDbContextManager(AbstractAsyncContextManager, Generic[T]):
    async def __aenter__(self) -> T:
        return await super().__aenter__()


class DbContextManager(AbstractContextManager, Generic[T]):
    def __enter__(self) -> T:
        return super().__enter__()


class IntegrationDatabase(abc.ABC, Generic[N, R, SN, SR]):
    """
    Integration DB plugin allows sharing a single database connection pool across multiple plugins
    which can be convenient in case KonText is integrated into an existing information system with
    existing user accounts, corpora information, settings storage etc.

    Even if it is not stated explicitly the interface is tailored for use with SQL databases
    where terms like 'cursor', 'commit', 'rollback' are common. But in general, it should be possible
    to wrap also some NoSQL databases if needed.

    Also please note that "integration database" is not to be meant for a standalone KonText
    installations. KonText itself (with default plug-ins) uses the DB (aka KeyValueStorage) plugin
    for its operations. But if you have an existing information system and do not want redundant
    information in KonText's db, the "integration_db" is the way to go.
    """

    @property
    @abc.abstractmethod
    def is_active(self):
        """
        Return true if the integration plug-in is active. I.e. it actually provides
        access to an actual database.

        Plug-in with optional support for integration_db should use this method
        to decide whether to use integration_db or some custom connection of their own.
        """
        pass

    @property
    @abc.abstractmethod
    def is_autocommit(self):
        """
        Return True if autocommit is enabled for the connection; else False
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
    def wait_for_environment(self) -> Optional[Exception]:
        """
        This function is called each time KonText service is started
        and it should block the execution until either an internally
        defined/configured timeout has elapsed or some external condition
        allowing plug-in initialization has been fulfilled.

        This can be e.g. used when KonText run within a Docker container and
        it has to wait for a database container to initialize. In such case
        it should e.g. try to select from a table to make sure there is a
        working connection along with database, tables and data.

        returns:
        if None then the environment is ready else provide an error for further processing
        """
        pass

    @abc.abstractmethod
    def connection(self) -> AsyncDbContextManager[N]:
        """
        Return an async connection to the integration database from pool
        """
        pass

    @abc.abstractmethod
    def cursor(self, dictionary=True) -> AsyncDbContextManager[R]:
        """
        Create a new async database cursor
        """
        pass

    @abc.abstractmethod
    def connection_sync(self) -> DbContextManager[SN]:
        pass

    @abc.abstractmethod
    def cursor_sync(self, dictionary=True) -> DbContextManager[SR]:
        pass
