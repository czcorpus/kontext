# Copyright (c) 2016 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2016 Tomas Machalek <tomas.machalek@gmail.com>
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
from typing import Optional, TYPE_CHECKING
# this is to fix cyclic imports when running the app caused by typing
if TYPE_CHECKING:
    from action.plugin.ctx import PluginCtx


class AbstractFootbar(abc.ABC):

    @abc.abstractmethod
    def get_contents(self, plugin_ctx: 'PluginCtx', return_url: Optional[str] = None):
        """
        arguments:
        plugin_ctx -- an instance of kontext.PluginCtx
        return_url -- ??

        returns:
        an HTML string
        """

    def get_css_url(self) -> Optional[str]:
        """
        Return a URL of a custom CSS resource or None if not needed.
        """
        return None
