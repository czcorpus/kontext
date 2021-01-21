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
from plugins.abstract.integration_db import IntegrationDatabase

N = TypeVar('N')
R = TypeVar('R')


class DefaultIntegrationDb(IntegrationDatabase[None, None]):
    """
    Default integration database is empty, returning None for both the connection and
    the cursor().
    """

    @property
    def connection(self) -> N:
        return None

    def cursor(self, dictionary=True, buffered=False) -> R:
        return None

    @property
    def is_active(self):
        return False

    @property
    def info(self):
        return 'Empty integration DB.'

    def execute(self, sql, args):
        return None

    def executemany(self, sql, args_rows):
        return None

    def commit(self):
        pass

    def rollback(self):
        pass
