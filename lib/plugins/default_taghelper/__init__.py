# Copyright (c) 2012 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2012 Tomas Machalek <tomas.machalek@gmail.com>
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

"""
A 'taghelper' plug-in implementation. It provides a data-driven, interactive way
how to create a tag query. Please note that this works only with tag formats with
fixed positions for defined categories (e.g.: part of speech = character 0,
gender = character 1, case = character 2,...)

Please note that this module requires a proper Corptree plug-in configuration and data.

Required XML:

element taghelper {
  element module { "default_taghelper" }
  element clear_interval {
    text # TTL - number of seconds
  }
  element tags_cache_dir {
    text #  a path to a dir where files are cached
  }
}
"""
from typing import Any, Dict

import plugins
from action.control import http_action
from action.errors import UserReadableException
from action.krequest import KRequest
from action.model.corpus import CorpusActionModel
from action.response import KResponse
from plugin_types.corparch import AbstractCorporaArchive
from plugin_types.taghelper import (AbstractTaghelper,
                                    AbstractTagsetInfoLoader,
                                    AbstractValueSelectionFetcher)
from plugins.default_taghelper.fetchers import NullSelectionFetcher
from plugins.default_taghelper.fetchers.keyval import KeyvalSelectionFetcher
from plugins.default_taghelper.fetchers.positional import \
    PositionalSelectionFetcher
from plugins.default_taghelper.loaders import NullTagVariantLoader
from plugins.default_taghelper.loaders.keyval import KeyvalTagVariantLoader
from plugins.default_taghelper.loaders.positional import \
    PositionalTagVariantLoader
from sanic.blueprints import Blueprint

bp = Blueprint('default_taghelper', 'corpora')


@bp.route('/ajax_get_tag_variants')
@http_action(return_type='json', action_model=CorpusActionModel)
async def ajax_get_tag_variants(amodel: CorpusActionModel, req: KRequest, resp: KResponse):
    """
    """
    corpname = req.args.get('corpname')
    tagset_name = req.args.get('tagset')

    fetcher = await plugins.runtime.TAGHELPER.instance.fetcher(amodel.plugin_ctx, corpname, tagset_name)
    values_selection = await fetcher.fetch(req)
    try:
        tag_loader = await plugins.runtime.TAGHELPER.instance.loader(amodel.plugin_ctx, corpname, tagset_name)
    except IOError:
        raise UserReadableException(
            req.translate('Corpus {corpname} is not supported by this widget.'))

    if await fetcher.is_empty(values_selection):
        ans = await tag_loader.get_initial_values(req.ui_lang, req.translate)
    else:
        ans = await tag_loader.get_variant(values_selection, req.ui_lang, req.translate)
    return ans


class Taghelper(AbstractTaghelper):

    def __init__(self, conf: Dict[str, Any], corparch: AbstractCorporaArchive):
        self._conf = conf
        self._corparch = corparch
        self._loaders = {}
        self._fetchers = {}

    async def loader(self, plugin_ctx, corpus_name, tagset_name) -> AbstractTagsetInfoLoader:
        if (corpus_name, tagset_name) not in self._loaders:
            for tagset in (await self._corparch.get_corpus_info(plugin_ctx, corpus_name)).tagsets:
                if tagset.type == 'positional':
                    self._loaders[(corpus_name, tagset.ident)] = PositionalTagVariantLoader(
                        corpus_name=corpus_name, tagset_name=tagset.ident,
                        cache_dir=self._conf['tags_cache_dir'],
                        tags_src_dir=self._conf['tags_src_dir'],
                        cache_clear_interval=self._conf['clear_interval'],
                        taglist_path=self._conf['taglist_path'])
                    self._fetchers[(corpus_name, tagset.ident)] = PositionalSelectionFetcher()
                elif tagset.type == 'keyval':
                    self._loaders[(corpus_name, tagset.ident)] = KeyvalTagVariantLoader(
                        corpus_name=corpus_name, tagset_name=tagset.ident,
                        tags_src_dir=self._conf['tags_src_dir'],
                    )
                    self._fetchers[(corpus_name, tagset.ident)] = KeyvalSelectionFetcher()
                else:
                    self._loaders[(corpus_name, tagset.ident)] = NullTagVariantLoader()
                    self._fetchers[(corpus_name, tagset.ident)] = NullSelectionFetcher()
        return self._loaders[(corpus_name, tagset_name)]

    async def fetcher(self, plugin_ctx, corpus_name, tagset_name) -> AbstractValueSelectionFetcher:
        if (corpus_name, tagset_name) not in self._fetchers:
            for tagset in (await self._corparch.get_corpus_info(plugin_ctx, corpus_name)).tagsets:
                if tagset.type == 'positional':
                    self._fetchers[(corpus_name, tagset.ident)] = PositionalSelectionFetcher()
                elif tagset.type == 'keyval':
                    self._fetchers[(corpus_name, tagset.ident)] = KeyvalSelectionFetcher()
                else:
                    self._fetchers[(corpus_name, tagset.ident)] = NullSelectionFetcher()
        return self._fetchers[(corpus_name, tagset_name)]

    async def tags_available_for(self, plugin_ctx, corpus_name, tagset_id) -> bool:
        for tagset in (await self._corparch.get_corpus_info(plugin_ctx, corpus_name)).tagsets:
            if tagset.ident == tagset_id:
                loader = await self.loader(plugin_ctx, corpus_name, tagset.ident)
                return await loader.is_available(plugin_ctx.translate)
        return False

    @staticmethod
    def export_actions():
        return bp

    async def export(self, plugin_ctx):
        tagsets = {}
        try:
            for corp in ([plugin_ctx.current_corpus.corpname] + plugin_ctx.available_aligned_corpora):
                info = await self._corparch.get_corpus_info(plugin_ctx, corp)
                for tagset in info.tagsets:
                    tagsets[tagset.ident] = tagset
        except AttributeError:
            pass  # we ignore if plugin_ctx does not support 'current_corpus' - please see AbstractTaghelper
        return dict(corp_tagsets=[x.to_dict() for x in tagsets.values()])


@plugins.inject(plugins.runtime.CORPARCH)
def create_instance(conf, corparch: AbstractCorporaArchive):
    """
    arguments:
    conf -- KonText's settings module or a compatible object
    """
    return Taghelper(conf.get('plugins', 'taghelper'), corparch)
