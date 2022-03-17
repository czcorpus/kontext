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

from typing import TypeVar
from plugin_types.integration_db import IntegrationDatabase
from plugins.errors import PluginCompatibilityException
import logging

N = TypeVar('N')
R = TypeVar('R')


class DefaultIntegrationDb(IntegrationDatabase[None, None]):
    """
    The default integration database is designed to make sure no plug-in will try to
    use integration_db without proper status check. It means that a correct plug-in
    depending on the integration_db must first test if integration_db.is_active is True.
    In case False is provided then the plug-in should use its own database connection mechanism
    or report that it requires a working installation of integration_db.

    This plug-in version throws PluginCompatibilityException on each method call
    and logs some more information for an administrator to be able to handle the problem.
    """

    @property
    def is_autocommit(self):
        return True

    @staticmethod
    def _err_msg():
        logging.getLogger(__name__).warning('It looks like there is no concrete integration_db enabled '
                                            'and one of the active plug-ins either requires it or assumes '
                                            'incorrectly that a concrete instance is enabled.')
        return 'DefaultIntegrationDb provides no true database integration'

    async def connection(self) -> N:
        raise PluginCompatibilityException(self._err_msg())

    def cursor(self, dictionary=True, buffered=False):
        raise PluginCompatibilityException(self._err_msg())

    @property
    def is_active(self):
        return False

    @property
    def info(self):
        return 'Empty integration DB.'

    def wait_for_environment(self):
        return None

    async def execute(self, sql, args) -> R:
        raise PluginCompatibilityException(self._err_msg())

    async def executemany(self, sql, args_rows) -> R:
        raise PluginCompatibilityException(self._err_msg())

    async def start_transaction(self, isolation_level=None):
        raise PluginCompatibilityException(self._err_msg())

    async def commit(self):
        raise PluginCompatibilityException(self._err_msg())

    async def rollback(self):
        raise PluginCompatibilityException(self._err_msg())


def create_instance(_):
    return DefaultIntegrationDb()
