# Copyright (c) 2023 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2023 Martin Zimandl <martin.zimandl@gmail.com>
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
from typing import Any, Dict, List

from action.plugin.ctx import PluginCtx
from plugin_types import CorpusDependentPlugin


class AbstractTokensLinking(CorpusDependentPlugin):

    @abc.abstractmethod
    def map_providers(self, provider_ids):
        pass

    @abc.abstractmethod
    async def fetch_data(self, plugin_ctx: PluginCtx, provider_ids, corpora, row, lang) -> List[Dict[str, Any]]:
        pass

    @abc.abstractmethod
    async def get_required_attrs(self, plugin_ctx: PluginCtx, provider_ids, corpora, row, lang) -> List[str]:
        pass
