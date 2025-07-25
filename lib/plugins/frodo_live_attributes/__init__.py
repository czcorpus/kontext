# Copyright (c) 2022 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2022 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright (c) 2022 Martin Zimandl <martin.zimandl@gmail.com>
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

import os
import urllib.parse
from urllib.parse import urljoin
from typing import Any, List

import plugins
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.live_attributes import (
    AbstractLiveAttributes, AttrValuesResponse, BibTitle, LiveAttrsException)

from plugin_types.live_attributes.doclist import DocListItem, mk_cache_key
from plugin_types.live_attributes.doclist.writer import export_csv, export_jsonl, export_xlsx, export_xml


UNLIMITED_LIST_PLACEHOLDER = 1_000_000


async def proc_frodo_response(resp) -> Any:
    data = await resp.json()
    if 400 <= resp.status <= 500:
        raise LiveAttrsException(data.get('error', 'unspecified error'))
    return data


class FrodoLiveAttributes(AbstractLiveAttributes):

    corparch: AbstractCorporaArchive

    def __init__(
            self,
            corparch: AbstractCorporaArchive,
            service_url: str,
            doclist_cache_dir: str,
            max_attr_list_size: int
    ):
        self.corparch = corparch
        self._service_url = service_url
        self._doclist_cache_dir = doclist_cache_dir
        self._session = None
        self._max_attr_list_size = max_attr_list_size

    async def is_enabled_for(self, plugin_ctx, corpora):
        if len(corpora) == 0:
            return False
        # TODO now enabled if database path is defined
        return bool((await self.corparch.get_corpus_info(plugin_ctx, corpora[0])).metadata.database)

    async def get_attr_values(
            self, plugin_ctx, corpus, attr_map, aligned_corpora=None, autocomplete_attr=None, apply_cutoff=False, limit_lists=True):
        json_body = {'attrs': attr_map, 'applyCutoff': apply_cutoff}
        if aligned_corpora:
            json_body['aligned'] = aligned_corpora
        if autocomplete_attr:
            json_body['autocompleteAttr'] = autocomplete_attr
        json_body['maxAttrListSize'] = self._max_attr_list_size if limit_lists else UNLIMITED_LIST_PLACEHOLDER
        async with plugin_ctx.request.ctx.http_client.post(urljoin(self._service_url, f'/liveAttributes/{corpus.corpname}/query'), json=json_body) as resp:
            data = await proc_frodo_response(resp)
        return AttrValuesResponse(**data)

    async def get_subc_size(self, plugin_ctx, corpora, attr_map):
        json_body = {'attrs': attr_map}
        if len(corpora) > 1:
            json_body['aligned'] = corpora[1:]
        async with plugin_ctx.request.ctx.http_client.post(urljoin(self._service_url,f'/liveAttributes/{corpora[0]}/selectionSubcSize'), json=json_body) as resp:
            data = await proc_frodo_response(resp)
            return data['total']

    async def get_supported_structures(self, plugin_ctx, corpname):
        corpus_info = await self.corparch.get_corpus_info(plugin_ctx, corpname)
        id_attr = corpus_info.metadata.id_attr
        return [id_attr.split('.')[0]] if id_attr else []

    async def get_bibliography(self, plugin_ctx, corpus, item_id):
        async with plugin_ctx.request.ctx.http_client.post(urljoin(self._service_url,f'/liveAttributes/{corpus.corpname}/getBibliography'), json={'itemId': item_id}) as resp:
            data = await proc_frodo_response(resp)
            return list(data.items())

    async def find_bib_titles(self, plugin_ctx, corpus_id, id_list) -> List[BibTitle]:
        async with plugin_ctx.request.ctx.http_client.post(urljoin(self._service_url,f'/liveAttributes/{corpus_id}/findBibTitles'), json={'itemIds': id_list}) as resp:
            data = await proc_frodo_response(resp)
            return [BibTitle(item_id, data[item_id]) for item_id in id_list]

    async def fill_attrs(self, plugin_ctx, corpus_id, search, values, fill):
        json_body = {'search': search, 'values': values, 'fill': fill}
        async with plugin_ctx.request.ctx.http_client.post(urljoin(self._service_url,f'/liveAttributes/{corpus_id}/fillAttrs'), json=json_body) as resp:
            return await proc_frodo_response(resp)

    def _mk_doclist_cache_file_path(self, attr_map, aligned_corpora, view_attrs, save_format: str) -> str:
        file_path = '{}.{}'.format(mk_cache_key(attr_map, aligned_corpora, view_attrs), save_format)
        return os.path.join(self._doclist_cache_dir, file_path)

    async def document_list(self, plugin_ctx, corpus_id, view_attrs, attr_map, aligned_corpora, save_format):
        args = dict(attrs=attr_map, aligned=aligned_corpora)
        attrs = urllib.parse.urlencode([('attr',  x) for x in view_attrs])
        async with plugin_ctx.request.ctx.http_client.post(urljoin(self._service_url,f'/liveAttributes/{corpus_id}/documentList?{attrs}'), json=args) as resp:
            data = await proc_frodo_response(resp)
            file = self._mk_doclist_cache_file_path(
                attr_map, aligned_corpora, view_attrs, save_format)
            if save_format == 'csv':
                for i, item in enumerate(data):
                    data[i] = DocListItem.from_dict(item)
                await export_csv(data, file)
                return file, 'text/csv'
            if save_format == 'jsonl':
                for i, item in enumerate(data):
                    data[i] = DocListItem.from_dict(item)
                await export_jsonl(data, file)
                return file, 'application/jsonl'
            if save_format == 'xml':
                await export_xml(data, file)
                return file, 'application/xml'
            if save_format == 'xlsx':
                for i, item in enumerate(data):
                    data[i] = DocListItem.from_dict(item)
                await export_xlsx(data, file)
                return file, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    async def num_matching_documents(self, plugin_ctx, corpus_id, attr_map, aligned_corpora):
        args = dict(attrs=attr_map, aligned=aligned_corpora)
        async with plugin_ctx.request.ctx.http_client.post(urljoin(self._service_url,f'/liveAttributes/{corpus_id}/numMatchingDocuments'), json=args) as resp:
            return await proc_frodo_response(resp)


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch: AbstractCorporaArchive) -> FrodoLiveAttributes:
    plg_conf = settings.get('plugins')['live_attributes']
    return FrodoLiveAttributes(
        corparch,
        plg_conf['service_url'],
        plg_conf['doclist_cache_dir'],
        max_attr_list_size=settings.get_int('global', 'max_attr_list_size')
    )
