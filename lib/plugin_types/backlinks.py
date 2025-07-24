# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
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
from sanic.blueprints import Blueprint


class AbstractBacklinks(abc.ABC):

    @abc.abstractmethod
    def export_actions(self) -> Blueprint:
        """
        Export a Blueprint containing custom actions for KonText.
        These actions are mostly meant for backlink access from
        external applications to KonText.

        Please note that any plug-in type can define export_actions()
        but in case of AbstractBacklinks this is obligatory as this is
        the main and only reason for AbstractBacklinks existence.
        """
        pass
