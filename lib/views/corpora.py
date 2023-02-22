# Copyright (c) 2015 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
# Copyright (c) 2015 Tomas Machalek <tomas.machalek@gmail.com>
# Copyright(c) 2020 Martin Zimandl <martin.zimandl@gmail.com>
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

import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import List, Union

import plugins
from action.control import http_action
from action.errors import ForbiddenException
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.model.user import UserActionModel
from action.response import KResponse
from dataclasses_json import LetterCase, dataclass_json
from plugin_types.corparch import (
    AbstractSearchableCorporaArchive, SimpleCorporaArchive)
from plugin_types.corparch.corpus import CitationInfo, TagsetInfo
from plugin_types.subc_storage import SubcListFilterArgs
from sanic import Blueprint


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
    tagsets: List[TagsetInfo]


bp = Blueprint('corpora', url_prefix='corpora')


@bp.route('/corplist')
@http_action(action_model=UserActionModel, template='corpora/corplist.html')
async def corplist(amodel: UserActionModel, req: KRequest, resp: KResponse):
    amodel.disabled_menu_items = amodel.CONCORDANCE_ACTIONS
    with plugins.runtime.CORPARCH((AbstractSearchableCorporaArchive, SimpleCorporaArchive)) as cp:
        if isinstance(cp, AbstractSearchableCorporaArchive):
            params = await cp.initial_search_params(amodel.plugin_ctx)
            data = await cp.search(
                plugin_ctx=amodel.plugin_ctx,
                query=False,
                offset=0,
                limit=req.args.get('limit', None))
        elif isinstance(cp, SimpleCorporaArchive):
            params = {}
            data = await cp.get_all(amodel.plugin_ctx)
    data['search_params'] = params
    return dict(corplist_data=data)


@bp.route('/ajax_list_corpora')
@http_action(action_model=UserActionModel, return_type='json')
async def ajax_list_corpora(amodel: UserActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.CORPARCH(AbstractSearchableCorporaArchive) as cp:
        return await cp.search(
            plugin_ctx=amodel.plugin_ctx, query=req.args.get('query', None),
            offset=req.args.get('offset', None), limit=req.args.get('limit', None))


@bp.route('/ajax_get_corp_details')
@http_action(action_model=CorpusActionModel, return_type='json')
async def ajax_get_corp_details(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    corpname = req.args.get('corpname')
    with plugins.runtime.AUTH as auth, plugins.runtime.CORPARCH as ca:
        _, acc, _ = await auth.corpus_access(req.session_get('user'), corpname)
        if not acc:
            raise ForbiddenException('No access to corpus {0}'.format(corpname))
        corp_conf_info = await ca.get_corpus_info(amodel.plugin_ctx, corpname)
        corpus = await amodel.cf.get_corpus(req.args.get('corpname'))
        ans = CorpusDetail(
            corpname=corpus.get_conf('NAME') if corpus.get_conf('NAME') else corpus.corpname,
            description=corp_conf_info.description,
            size=corpus.size,
            attrlist=[],
            structlist=[],
            web_url=corp_conf_info.web if corp_conf_info is not None else '',
            citation_info=corp_conf_info.citation_info,
            keywords=[],
            tagsets=corp_conf_info.tagsets,
        )

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


@bp.route('/ajax_get_structattrs_details')
@http_action(action_model=CorpusActionModel, return_type='json')
async def ajax_get_structattrs_details(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
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


@bp.route('/bibliography')
@http_action(action_model=CorpusActionModel, return_type='json')
async def bibliography(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.LIVE_ATTRIBUTES as liveatt:
        return dict(bib_data=await liveatt.get_bibliography(amodel.plugin_ctx, amodel.corp, item_id=req.args.get('id')))


@bp.route('/ajax_get_corparch_item')
@http_action(action_model=CorpusActionModel, return_type='json')
async def ajax_get_corp_details(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    corpname = getattr(amodel.args, 'corpname')
    user_id = amodel.session_get('user', 'id')

    out = {}
    out['corpusIdent'] = dict(
        id=corpname,
        variant=amodel._corpus_variant,
        name=amodel.corp.human_readable_corpname,
        usesubcorp=amodel.corp.subcorpus_id,
        origSubcorpName=amodel.corp.subcorpus_name,
        foreignSubcorp=user_id != amodel.corp.author_id,
        size=amodel.corp.size,
        searchSize=amodel.corp.search_size,
    )
    out['availableSubcorpora'] = await amodel.get_subcorpora_list(amodel.corp)
    return out
