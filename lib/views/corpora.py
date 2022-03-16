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
from action.errors import ForbiddenException
from action.model.authorized import UserActionModel
from action.model.corpus import CorpusActionModel
from action.decorators import http_action
from sanic import Blueprint

import plugins
from plugin_types.corparch import AbstractSearchableCorporaArchive
from plugin_types.corparch.corpus import CitationInfo


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


bp = Blueprint('corpora')


@bp.route('/corpora/corplist')
@http_action(action_model=UserActionModel, template='corpora/corplist.html')
async def corplist(amodel, req, resp):
    amodel.disabled_menu_items = amodel.CONCORDANCE_ACTIONS
    with plugins.runtime.CORPARCH as cp:
        if isinstance(cp, AbstractSearchableCorporaArchive):
            params = await cp.initial_search_params(amodel.plugin_ctx, req.args.get('query'), req.args)
            data = await cp.search(
                plugin_ctx=amodel.plugin_ctx,
                query=False,
                offset=0,
                limit=req.args.get('limit', None),
                filter_dict=req.args)
        else:
            params = {}
            data = await cp.get_all(amodel.plugin_ctx)
        data['search_params'] = params
        return dict(corplist_data=data)


@bp.route('/corpora/ajax_list_corpora')
@http_action(action_model=UserActionModel, return_type='json')
async def ajax_list_corpora(amodel, req, resp):
    with plugins.runtime.CORPARCH as cp:
        return await cp.search(
            plugin_ctx=amodel.plugin_ctx, query=req.args.get('query', None),
            offset=req.args.get('offset', None), limit=req.args.get('limit', None),
            filter_dict=req.args)


@bp.route('/corpora/ajax_get_corp_details')
@http_action(action_model=CorpusActionModel, return_type='json')
async def ajax_get_corp_details(amodel, req, resp):
    corpname = req.args.get('corpname')
    with plugins.runtime.AUTH as auth, plugins.runtime.CORPARCH as ca:
        _, acc, _ = await auth.corpus_access(req.session_get('user'), corpname)
        if not acc:
            raise ForbiddenException('No access to corpus {0}'.format(corpname))
        corp_conf_info = await ca.get_corpus_info(amodel.plugin_ctx, corpname)
        corpus = amodel.cm.get_corpus(req.args.get('corpname'))
        ans = CorpusDetail(
            corpname=corpus.get_conf('NAME') if corpus.get_conf('NAME') else corpus.corpname,
            description=corp_conf_info.description,
            size=corpus.size,
            attrlist=[],
            structlist=[],
            web_url=corp_conf_info.web if corp_conf_info is not None else '',
            citation_info=corp_conf_info.citation_info,
            keywords=[])

        with plugins.runtime.CORPARCH as cp:
            ans.keywords = [
                KeyWord(name=name, color=cp.get_label_color(ident))
                for (ident, name) in corp_conf_info.metadata.keywords]

        try:
            ans.attrlist = [
                AttrStruct(name=item, size=int(corpus.get_attr(item).id_range()))
                for item in corpus.get_posattrs()]
        except RuntimeError as e:
            logging.getLogger(__name__).warning(f'{e}')
            ans.attrlist = ErrorInfo(error=req.translate('Failed to load'))

        ans.structlist = [
            AttrStruct(name=item, size=int(corpus.get_struct(item).size()))
            for item in corpus.get_structs()]

        return ans


@bp.route('/corpora/ajax_get_structattrs_details')
@http_action(action_model=UserActionModel, return_type='json')
async def ajax_get_structattrs_details(amodel, req, resp):
    """
    Provides a map (struct_name=>[list of attributes]). This is used
    by 'insert within' widget.
    """
    speech_segment = (await amodel.get_corpus_info(amodel.args.corpname)).speech_segment
    ans = defaultdict(lambda: [])
    for item in amodel.corp.get_structattrs():
        if item != speech_segment:
            k, v = item.split('.')
            ans[k].append(v)
    return dict(structattrs=dict((k, v) for k, v in list(ans.items()) if len(v) > 0))


@bp.route('/corpora/bibliography')
@http_action(action_model=UserActionModel, return_type='json')
def bibliography(amodel, req, resp):
    with plugins.runtime.LIVE_ATTRIBUTES as liveatt:
        return dict(bib_data=liveatt.get_bibliography(amodel.plugin_ctx, amodel.corp, item_id=req.args.get('id')))
