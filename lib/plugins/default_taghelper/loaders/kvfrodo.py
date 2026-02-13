# Copyright (c) 2026 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2026 Tomas Machalek <tomas.machalek@gmail.com>
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

from collections import defaultdict
from urllib.parse import urljoin
import logging

import aiofiles
import aiofiles.os
import ujson as json

from action.plugin.ctx import PluginCtx
from plugin_types.taghelper import AbstractTagsetInfoLoader


class KeyvalFrodoLoader(AbstractTagsetInfoLoader):

    def __init__(self, corpus_name, tagset_name, frodo_url):
        self.corpus_name = corpus_name
        self.tagset_name = tagset_name
        self.frodo_url = frodo_url

    async def get_variant(self, plugin_ctx, filter_values, lang, translate):
        http_client = plugin_ctx.request.ctx.http_client
        async with http_client.post(
                urljoin(self.frodo_url, f'/liveTokens/{self.corpus_name}/query'), json=filter_values) as resp:
            return await resp.json()

    async def get_initial_values(self, plugin_ctx, lang, translate):
        args = {}
        http_client = plugin_ctx.request.ctx.http_client
        async with http_client.post(
                urljoin(self.frodo_url, f'/liveTokens/{self.corpus_name}/query'), json=args) as resp:
            return await resp.json()

    async def is_available(self, plugin_ctx, translate):
        return True  # TODO


