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
from plugins.common.sqldb import DatabaseAdapter, N, R, SN, SR
from typing import Optional


class IntegrationDatabase(DatabaseAdapter[N, R, SN, SR]):
    """
    Integration DB plugin allows sharing a single database connection within
    a scope of an HTTP action handler (i.e. one connection per HTTP request).

    Although not explicitly stated, the interface is tailored for use with SQL databases.
    where terms like 'cursor', 'commit', 'rollback' are common. But in general it should be possible
    to wrap some NoSQL databases if needed.

    Please also note that while the primary function of the plug-in is to allow integration of KonText
    with existing SQL databases, it can also be used to create standalone KonText installations based
    on MySQL/MariaDB.
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

    @abc.abstractmethod
    def wait_for_environment(self) -> Optional[Exception]:
        """
        This function is called each time KonText service is started,
        and it should block the execution until either an internally
        defined/configured timeout has elapsed or some external condition
        allowing plug-in initialization has been fulfilled.

        This can be e.g. used when KonText run within a Docker container, and
        it has to wait for a database container to initialize. In such case
        it should e.g. try to select from a table to make sure there is a
        working connection along with database, tables and data.

        returns:
        if None then the environment is ready, else provide an error for further processing
        """
        pass

    async def on_request(self):
        """
        The function is called by the Sanic 'request' middleware.
        This is the right place to open a db connection.
        But please be aware of the scope of the connection. The plug-in
        instance's scope is always "per-web worker", which means it is
        shared among multiple action handlers running simultaneously.
        So it is essential that the connection is scoped/isolated properly.
        See e.g. Python's contextvars.ContextVar for a convenient solution.
        """
        pass

    async def on_response(self):
        """
        The function is called by the Sanic 'response' middleware.
        This is the right place to close the connection.
        """
        pass
