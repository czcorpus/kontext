# Copyright (c) 2015 Institute of the Czech National Corpus
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

from collections import defaultdict
import logging
from typing import List, Union
from dataclasses import dataclass
from dataclasses_json import dataclass_json, LetterCase
from controller import exposed
from controller.kontext import Kontext
from action.errors import ForbiddenException
import plugins
from plugin_types.corparch import AbstractSearchableCorporaArchive
from plugin_types.corparch.corpus import CitationInfo
from translation import ugettext as translate


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class KeyWord:
    name: str
    color: str


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class AttrStruct:
    name: str
    size: int


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class ErrorInfo:
    error: str


@dataclass_json(letter_case=LetterCase.CAMEL)
@dataclass
class CorpusDetail:
    corpname: str
    description: str
    size: int
    attrlist: Union[List[AttrStruct], ErrorInfo]
    structlist: List[AttrStruct]
    web_url: str
    citation_info: CitationInfo
    keywords: List[KeyWord]


class Corpora(Kontext):

    def get_mapping_url_prefix(self):
        return '/corpora/'

    @exposed(skip_corpus_init=True)
    def corplist(self, request):
        self.disabled_menu_items = self.CONCORDANCE_ACTIONS
        with plugins.runtime.CORPARCH as cp:
            if isinstance(cp, AbstractSearchableCorporaArchive):
                params = cp.initial_search_params(self._plugin_ctx, request.args.get('query'),
                                                  request.args)
                data = cp.search(plugin_ctx=self._plugin_ctx,
                                 query=False,
                                 offset=0,
                                 limit=request.args.get('limit', None),
                                 filter_dict=request.args)
            else:
                params = {}
                data = cp.get_all(self._plugin_ctx)
            data['search_params'] = params
            return dict(corplist_data=data)

    @exposed(return_type='json', skip_corpus_init=True)
    def ajax_list_corpora(self, request):
        with plugins.runtime.CORPARCH as cp:
            return cp.search(plugin_ctx=self._plugin_ctx, query=request.args.get('query', None),
                             offset=request.args.get('offset', None), limit=request.args.get('limit', None),
                             filter_dict=request.args)

    @exposed(return_type='json')
    def ajax_get_structattrs_details(self, _):
        """
        Provides a map (struct_name=>[list of attributes]). This is used
        by 'insert within' widget.
        """
        speech_segment = self.get_corpus_info(self.args.corpname).speech_segment
        ans = defaultdict(lambda: [])
        for item in self.corp.get_structattrs():
            if item != speech_segment:
                k, v = item.split('.')
                ans[k].append(v)
        return dict(structattrs=dict((k, v) for k, v in list(ans.items()) if len(v) > 0))

    @exposed(return_type='json')
    def bibliography(self, request):
        with plugins.runtime.LIVE_ATTRIBUTES as liveatt:
            return dict(bib_data=liveatt.get_bibliography(self._plugin_ctx, self.corp, item_id=request.args.get('id')))
