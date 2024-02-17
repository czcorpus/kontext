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
    async def fetch_data(
            self,
            plugin_ctx: PluginCtx,
            provider_ids,
            corpus_id,
            token_id,
            token_length,
            token_ranges,
            lang
    ) -> List[Dict[str, Any]]:
        """
        Fetch data based on clicked token ID and currelt corpora
        Args:
            plugin_ctx: plug-in environment providing access to key runtime "per-request" resources
            provider_ids: providers we want to ask data for
            corpus_id: main corpus we work with
            token_id: clicked token ID
            token_length: number of words in token
            token_ranges: is a dictionary [corpus ID] -> [text start ID, text end ID]
                So it allows for specifying context in which we evaluate the clicked token.
                Typically, this is something like an original sentence and its translation.
            lang: language of the UI (in case we want some messages, labels etc. from the providers)

        Returns:
            responses from each provider
        """
        pass

    @abc.abstractmethod
    async def get_required_attrs(self, plugin_ctx: PluginCtx, provider_ids: List[str], corpora: List[str]) -> List[str]:
        """
        Return list of positional attributes our configured providers need to be able
        to respond. KonText uses this fetch proper attributes from a corpus when preparing requests
        for individual providers.
        Args:
            plugin_ctx: plug-in environment
            provider_ids: providers we want to ask data for
            corpora: involved corpora (one for most corpora, two or more for aligned corpora)
        Returns:

        """
        pass
