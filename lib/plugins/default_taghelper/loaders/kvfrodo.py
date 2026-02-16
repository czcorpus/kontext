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

from urllib.parse import urljoin
from plugin_types.taghelper import AbstractTagsetInfoLoader


class KeyvalFrodoLoader(AbstractTagsetInfoLoader):
    """
    KeyvalFrodoLoader uses Frodo backend for obtaining Key-Value tagset information.
    The class caches its information about backend availability.
    """

    def __init__(self, corpus_name, tagset_name, frodo_url):
        self.corpus_name = corpus_name
        self.tagset_name = tagset_name
        self.frodo_url = frodo_url
        self._is_available = None

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
        if self._is_available is None:
            resp = await plugin_ctx.request.ctx.http_client.get(
                urljoin(self.frodo_url, f'/liveTokens/{self.corpus_name}/conf'))
            self._is_available = resp.status == 200
        return self._is_available
