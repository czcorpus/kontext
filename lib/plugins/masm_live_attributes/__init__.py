# Copyright (c) 2022 Charles University in Prague, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

import json
import urllib.request
import urllib.parse
from urllib.error import HTTPError

import plugins
from plugins.abstract.corparch import AbstractCorporaArchive
from plugins.abstract.live_attributes import (AbstractLiveAttributes, AttrValuesResponse, LiveAttrsException)
from controller import exposed
from actions import concordance


@exposed(return_type='json', http_method='POST')
def filter_attributes(self, request):
    attrs = json.loads(request.form.get('attrs', '{}'))
    aligned = json.loads(request.form.get('aligned', '[]'))
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return lattr.get_attr_values(self._plugin_ctx, corpus=self.corp, attr_map=attrs,
                                     aligned_corpora=aligned)


@exposed(return_type='json', http_method='POST')
def attr_val_autocomplete(self, request):
    attrs = json.loads(request.form.get('attrs', '{}'))
    attrs[request.form['patternAttr']] = '%{}%'.format(request.form['pattern'])
    aligned = json.loads(request.form.get('aligned', '[]'))
    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return lattr.get_attr_values(self._plugin_ctx, corpus=self.corp, attr_map=attrs,
                                     aligned_corpora=aligned,
                                     autocomplete_attr=request.form['patternAttr'])


@exposed(return_type='json', http_method='POST')
def fill_attrs(self, request):
    search = request.json['search']
    values = request.json['values']
    fill = request.json['fill']

    with plugins.runtime.LIVE_ATTRIBUTES as lattr:
        return lattr.fill_attrs(corpus_id=self.corp.corpname, search=search, values=values, fill=fill)


def handle_http_error(err: HTTPError):
    if 400 <= err.status <= 500:
        data = json.loads(err.read().decode())
        raise LiveAttrsException(data.get('error', 'unspecified error'))


class MasmLiveAttributes(AbstractLiveAttributes):

    corparch: AbstractCorporaArchive

    def export_actions(self):
        return {concordance.Actions: [filter_attributes, attr_val_autocomplete, fill_attrs]}

    def __init__(self, corparch: AbstractCorporaArchive, service_url: str, max_attr_list_size: int):
        self.corparch = corparch
        self._service_url = service_url
        self._max_attr_list_size = max_attr_list_size

    def _get_request(self, path: str, json_object) -> urllib.request.Request:
        return urllib.request.Request(urllib.parse.urljoin(self._service_url, path), data=json.dumps(json_object).encode(), method='POST')

    def is_enabled_for(self, plugin_ctx, corpora):
        if len(corpora) == 0:
            return False
        # TODO now enabled if database path is defined
        return bool((self.corparch.get_corpus_info(plugin_ctx, corpora[0])).metadata.database)

    def get_attr_values(
            self, plugin_ctx, corpus, attr_map, aligned_corpora=None, autocomplete_attr=None, limit_lists=True):

        json_body = {'attrs': attr_map}
        if aligned_corpora:
            json_body['aligned'] = aligned_corpora
        if autocomplete_attr:
            json_body['autocompleteAttr'] = autocomplete_attr
        json_body['maxAttrListSize'] = self._max_attr_list_size

        request = self._get_request(
            f'/liveAttributes/{corpus.corpname}/query', json_body)
        try:
            response = urllib.request.urlopen(request)
            data = json.loads(response.read().decode())
            return AttrValuesResponse(**data)
        except HTTPError as ex:
            handle_http_error(ex)

    def get_subc_size(self, plugin_ctx, corpora, attr_map):
        json_body = {'attrs': attr_map}
        if len(corpora) > 1:
            json_body['aligned'] = corpora[1:]

        request = self._get_request(
            f'/liveAttributes/{corpora[0]}/selectionSubcSize', json_body)
        try:
            response = urllib.request.urlopen(request)
            data = json.loads(response.read().decode())
            return data['total']
        except HTTPError as ex:
            handle_http_error(ex)


    def get_supported_structures(self, plugin_ctx, corpname):
        corpus_info = self.corparch.get_corpus_info(plugin_ctx, corpname)
        id_attr = corpus_info.metadata.id_attr
        return [id_attr.split('.')[0]] if id_attr else []

    def get_bibliography(self, plugin_ctx, corpus, item_id):
        request = self._get_request(
            f'/liveAttributes/{corpus.corpname}/getBibliography', {'itemId': item_id})
        try:
            response = urllib.request.urlopen(request)
            data = json.loads(response.read().decode())
            return list(data.items())
        except HTTPError as ex:
            handle_http_error(ex)


    def find_bib_titles(self, plugin_ctx, corpus_id, id_list):
        request = self._get_request(
            f'/liveAttributes/{corpus_id}/findBibTitles', {'itemIds': id_list})
        try:
            response = urllib.request.urlopen(request)
            data = json.loads(response.read().decode())
            return [data[item_id] for item_id in id_list]
        except HTTPError as ex:
            handle_http_error(ex)


    def fill_attrs(self, corpus_id, search, values, fill):
        json_body = {'search': search, 'values': values, 'fill': fill}
        request = self._get_request(f'/liveAttributes/{corpus_id}/fillAttrs', json_body)
        try:
            response = urllib.request.urlopen(request)
            return json.loads(response.read().decode())
        except HTTPError as ex:
            handle_http_error(ex)



@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(settings, corparch: AbstractCorporaArchive) -> MasmLiveAttributes:
    plg_conf = settings.get('plugins')['live_attributes']
    return MasmLiveAttributes(
        corparch,
        plg_conf['service_url'],
        max_attr_list_size=settings.get_int('global', 'max_attr_list_size')
    )
