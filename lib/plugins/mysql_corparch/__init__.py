# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Department of Linguistics
# Copyright (c) 2018 Tomas Machalek <tomas.machalek@gmail.com>
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

import copy
import logging
import re
from collections import OrderedDict, defaultdict
from typing import Any, Dict, Iterable, List, Optional, Tuple
from mysql.connector.aio.abstracts import MySQLCursorAbstract

import plugins
import ujson as json
from action.control import http_action
from action.krequest import KRequest
from action.model.user import UserActionModel
from action.plugin.ctx import AbstractCorpusPluginCtx, PluginCtx
from action.response import KResponse
from plugin_types.corparch import (
    AbstractSearchableCorporaArchive, CorpusListItem)
from plugin_types.corparch.backend import DatabaseBackend
from plugin_types.corparch.corpus import (
    BrokenCorpusInfo, CorpusInfo, KwicConnect, MLPositionFilter, QuerySuggest,
    StructAttrInfo, TokenConnect, TokensLinking)
from plugin_types.user_items import AbstractUserItems
from plugins import inject
from plugins.common.mysql import MySQLConf
from plugins.common.mysql.adhocdb import AdhocDB
from plugins.mysql_corparch.backend import Backend
from plugins.mysql_corparch.corplist import (
    DefaultCorplistProvider, parse_query)
from plugins.mysql_integration_db import MySqlIntegrationDb
from sanic.blueprints import Blueprint

try:
    from markdown import markdown
except ImportError:
    def markdown(s): return s


bp = Blueprint('mysql_corparch')


@bp.route('/user/get_favorite_corpora')
@http_action(return_type='json', access_level=2, action_model=UserActionModel)
async def get_favorite_corpora(amodel: UserActionModel, req: KRequest, resp: KResponse):
    with plugins.runtime.CORPARCH as ca, plugins.runtime.USER_ITEMS as ui:
        return await ca.export_favorite(amodel.plugin_ctx, await ui.get_user_items(amodel.plugin_ctx))


class MySQLCorparch(AbstractSearchableCorporaArchive):
    """
    A corparch plug-in implementation based on a relational
    database (sqlite/mysql - depends on backend).

    The main advantages over default_corparch are:
    1) no redundancies (e.g. references, text type descriptions)
    2) referential integrity
    3) optimized data loading
    """

    LABEL_OVERLAY_TRANSPARENCY = 0.20

    def __init__(
            self,
            db_backend: DatabaseBackend,
            user_items: AbstractUserItems,
            tag_prefix: str,
            max_num_hints,
            max_page_size,
            registry_lang: str,
            prefer_vlo_metadata: bool):
        """

        arguments:
            backend -- a database backend
            user_items -- user_items plug-in
            tag_prefix -- a string used to distinguish search labels (tags) from actual searched strings
            max_num_hints --
            max_page_size --
            registry_lang --
        """
        self._backend = db_backend
        self._user_items = user_items
        self._tag_prefix = tag_prefix
        self._max_num_hints = int(max_num_hints)
        self._max_page_size = int(max_page_size)
        self._registry_lang = registry_lang

        # caching localized corpora info as this is widely used throughout
        # the whole application
        self._corpus_info_cache: Dict[Tuple[str, str], CorpusInfo] = {}
        self._keywords = None  # keyword (aka tags) database for corpora; None = not loaded yet
        self._colors = {}
        self._tt_desc_i18n = defaultdict(lambda: {})
        self._tc_providers = {}
        self._kc_providers = {}
        self._tl_providers = {}
        self._qs_providers = {}
        self._prefer_vlo_metadata = prefer_vlo_metadata

    @property
    def max_page_size(self):
        return self._max_page_size

    @property
    def user_items(self):
        return self._user_items

    @property
    def backend(self):
        return self._backend

    def _parse_color(self, code: str) -> str:
        code = code.lower()
        transparency = self.LABEL_OVERLAY_TRANSPARENCY
        if code[0] == '#':
            code = code[1:]
            r, g, b = [int(f'0x{code[i:i + 2]}', 0) for i in range(0, len(code), 2)]
            return f'rgba({r}, {g}, {b}, {transparency:1.2f})'
        elif code.find('rgb') == 0:
            m = re.match(r'rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)', code, re.IGNORECASE)
            if m:
                return f'rgba({m.group(1)}, {m.group(2)}, {m.group(3)}, {transparency:1.2f})'
        raise ValueError(f'Invalid color code: {code}')

    def get_label_color(self, label_id):
        return self._colors.get(label_id, None)

    def _corp_info_from_row(self, row: Dict[str, Any], lang: str) -> Optional[CorpusInfo]:
        if row:
            ans = self.create_corpus_info()
            ans.id = row['id']
            ans.pid = row['id'] if row['pid'] is None else row['pid']
            ans.web = row['web']
            ans.sentence_struct = row['sentence_struct']
            ans.collator_locale = row['collator_locale'] if row['collator_locale'] else 'en_US'
            ans.speech_segment = row['speech_segment']
            ans.speaker_id_attr = row['speaker_id_attr']
            ans.speech_overlap_attr = row['speech_overlap_attr']
            ans.speech_overlap_val = row['speech_overlap_val']
            ans.use_safe_font = row['use_safe_font']
            ans.default_tagset = row['default_tagset']
            ans._description_cs = row['description_cs']
            ans._description_en = row['description_en']
            ans.default_view_opts = json.loads(
                row['default_view_opts']) if row['default_view_opts'] else {}
            ans.metadata.id_attr = row['id_attr']
            ans.metadata.label_attr = row['label_attr']
            ans.metadata.featured = bool(row['featured'])
            ans.metadata.database = row['database']
            ans.metadata.keywords = [x for x in (
                row['keywords'].split(',') if row['keywords'] else []) if x]
            ans.metadata.desc = row['ttdesc_id']
            ans.metadata.group_duplicates = bool(row['bib_group_duplicates'])
            ans.metadata.default_virt_keyboard = row['default_virt_keyboard']
            ans.manatee.encoding = row['encoding']
            ans.manatee.size = row['size']
            ans.manatee.lang = row['language']
            ans.manatee.name = row['name']
            ans.part_of_ml_corpus = row['part_of_ml_corpus']
            ans.ml_position_filter = MLPositionFilter(row['ml_position_filter'])
            return ans
        return None

    def _export_untranslated_label(self, plugin_ctx, text):
        """
        This plug-in is able to load multi-language descriptions
        so here we don't have to add any stuff here
        """
        return text

    async def export_favorite(self, plugin_ctx, favitems):
        ans = []
        favitems_corpids = [x.corpora[0]['id'] for x in favitems]
        async with self.backend.cursor() as cursor:
            descriptions = await self.backend.load_corpora_descriptions(
                cursor, favitems_corpids, plugin_ctx.user_lang)
            for item in favitems:
                tmp = item.to_dict()
                tmp['description'] = descriptions.get(item.corpora[0]['id'], None)
                ans.append(tmp)
        return ans

    def corpus_list_item_from_row(self, plugin_ctx, row: Dict[str, Any]) -> CorpusListItem:
        desc = row['description_cs'] if plugin_ctx.user_lang == 'cs_CZ' else row['description_en']
        keywords = [x for x in (row['keywords'].split(',') if row['keywords'] else []) if x]
        return CorpusListItem(id=row['id'],
                              corpus_id=row['id'],
                              name=row['name'],
                              description=self._export_untranslated_label(plugin_ctx, desc),
                              size=row['size'],
                              featured=row['featured'],
                              path=None,
                              keywords=keywords)

    async def list_corpora(self, plugin_ctx, substrs=None, keywords=None, min_size=0, max_size=None, requestable=False,
                           offset=0, limit=-1, favourites=()):
        user_id = plugin_ctx.user_dict['id']
        ans = OrderedDict()
        async with self._backend.cursor() as cursor:
            for row in await self._backend.list_corpora(
                    cursor=cursor, user_id=user_id, substrs=substrs, keywords=keywords, min_size=min_size,
                    max_size=max_size, requestable=requestable, offset=offset,
                    limit=limit, favourites=favourites):
                ans[row['id']] = self.corpus_list_item_from_row(plugin_ctx, row)
            return ans

    async def get_l10n_keywords(self, id_list, lang_code) -> List[Tuple[str, str]]:
        all_keywords = await self.all_keywords(lang_code)
        ans = []
        for keyword_id in id_list:
            if keyword_id in all_keywords:
                ans.append((keyword_id, all_keywords[keyword_id]))
            else:
                ans.append((keyword_id, keyword_id))
        return ans

    async def _localize_corpus_info(self, data: CorpusInfo, lang_code) -> CorpusInfo:
        """
        Updates localized values from data (please note that not all
        the data are localized - e.g. paths to files) by a single variant
        given passed lang_code.
        """
        ans = copy.deepcopy(data)
        lang_code = lang_code.split('_')[0]
        if ans.metadata.desc is not None and lang_code in self._tt_desc_i18n:
            ans.metadata.desc = self._tt_desc_i18n[lang_code][ans.metadata.desc]
        else:
            ans.metadata.desc = ''
        ans.metadata.keywords = await self.get_l10n_keywords(ans.metadata.keywords, lang_code)
        ans.description = ans.localized_desc(lang_code)
        return ans

    @staticmethod
    def _get_iso639lang(lang):
        """
        return 2-letter version of a lang-code
        """
        return lang.split('_')[0]

    async def all_keywords(self, lang):
        if self._keywords is None:
            async with self._backend.cursor() as cursor:
                self._keywords = defaultdict(lambda: OrderedDict())
                for row in await self._backend.load_all_keywords(cursor):
                    #  id, label_cs, label_en, color
                    self._keywords['cs'][row['id']] = row['label_cs']
                    self._keywords['en'][row['id']] = row['label_en']
                    self._colors[row['id']] = self._parse_color(
                        row['color']) if row['color'] else None
        lang_key = self._get_iso639lang(lang)
        return self._keywords[lang_key]

    async def _get_tckcqs_providers(self, cursor: MySQLCursorAbstract, corpus_id):
        if corpus_id not in self._tc_providers and corpus_id not in self._kc_providers:
            self._tc_providers[corpus_id] = TokenConnect()
            self._kc_providers[corpus_id] = KwicConnect()
            self._tl_providers[corpus_id] = TokensLinking()
            self._qs_providers[corpus_id] = QuerySuggest()
            data = await self._backend.load_tckc_providers(cursor, corpus_id)
            for row in data:
                if row['type'] == 'tc':
                    self._tc_providers[corpus_id].providers.append(
                        (row['provider'], row['is_kwic_view']))
                elif row['type'] == 'kc':
                    self._kc_providers[corpus_id].providers.append(row['provider'])
                elif row['type'] == 'tl':
                    self._tl_providers[corpus_id].providers.append(row['provider'])
                elif row['type'] == 'qs':
                    self._qs_providers[corpus_id].providers.append(row['provider'])
        return self._tc_providers[corpus_id], self._kc_providers[corpus_id], self._tl_providers[corpus_id], self._qs_providers[corpus_id]

    async def _fetch_corpus_info(self, plugin_ctx: AbstractCorpusPluginCtx, cursor: MySQLCursorAbstract, corpus_id: str) -> CorpusInfo:
        cache_key = (corpus_id, plugin_ctx.user_lang)
        if cache_key not in self._corpus_info_cache:
            row = await self._backend.load_corpus(cursor, corpus_id)
            corp = self._corp_info_from_row(row, plugin_ctx.user_lang)
            if corp is not None:
                corp.tagsets = await self._backend.load_corpus_tagsets(cursor, corpus_id)
                for art in await self._backend.load_corpus_articles(cursor, corpus_id):
                    if art['role'] == 'default':
                        corp.citation_info.default_ref = markdown(art['entry'])
                    elif art['role'] == 'standard':
                        corp.citation_info.article_ref.append(markdown(art['entry']))
                    elif art['role'] == 'other':
                        corp.citation_info.other_bibliography = markdown(art['entry'])
                if self._prefer_vlo_metadata:
                    default_ref = await self._backend.load_corpus_as_source_info(cursor, corpus_id, plugin_ctx.user_lang)
                    if default_ref is not None:
                        corp.citation_info.default_ref = default_ref
                if row['ttdesc_id'] not in self._tt_desc_i18n:
                    for drow in await self._backend.load_ttdesc(cursor, row['ttdesc_id']):
                        self._tt_desc_i18n['cs'][row['ttdesc_id']] = drow['text_cs']
                        self._tt_desc_i18n['en'][row['ttdesc_id']] = drow['text_en']
                corp.simple_query_default_attrs = await self._backend.load_simple_query_default_attrs(
                    cursor, corpus_id)

                if plugin_ctx.user_lang is not None:
                    full_corp_info = await self._localize_corpus_info(corp, lang_code=plugin_ctx.user_lang)
                else:
                    full_corp_info = corp
                full_corp_info.manatee = await plugin_ctx.corpus_factory.get_info(corpus_id)
                (
                    full_corp_info.token_connect, full_corp_info.kwic_connect,
                    full_corp_info.tokens_linking, full_corp_info.query_suggest
                ) = await self._get_tckcqs_providers(cursor, corpus_id)
                full_corp_info.metadata.interval_attrs = await self._backend.load_interval_attrs(cursor, corpus_id)
                self._corpus_info_cache[cache_key] = full_corp_info
            else:
                return BrokenCorpusInfo(name=corpus_id)
        return self._corpus_info_cache.get(cache_key, None)

    async def on_soft_reset(self):
        self._corpus_info_cache = {}
        logging.getLogger(__name__).warning('mysql_corparch flush corpus_info_cache (soft reset)')

    async def get_corpus_info(self, plugin_ctx: AbstractCorpusPluginCtx, corp_name: str) -> CorpusInfo:
        """
        Obtain full corpus info
        """
        if corp_name:
            try:
                # get rid of path-like corpus ID prefix
                corp_name = corp_name.lower()
                async with self._backend.cursor() as cursor:
                    return await self._fetch_corpus_info(plugin_ctx, cursor, corp_name)
            except TypeError as ex:
                logging.getLogger(__name__).warning(
                    'Failed to fetch corpus info for {0}: {1}'.format(corp_name, ex))
                return BrokenCorpusInfo(name=corp_name)
        else:
            return BrokenCorpusInfo()

    async def get_structattrs_info(
            self, plugin_ctx: 'PluginCtx', corp_name: str, full_names: Iterable[str]) -> List[StructAttrInfo]:
        items = await super().get_structattrs_info(plugin_ctx, corp_name, full_names)
        items_index = dict((f'{x.structure_name}{x.name}', x) for x in items)
        async with self.backend.cursor() as cursor:
            data = await self.backend.load_corpus_structattrs(cursor, corp_name)
        for row in data:
            item = items_index.get(f'{row["structure_name"]}{row["name"]}')
            if item is None:
                logging.getLogger(__name__).warning(
                    f'get_structattrs_info: structure {row["structure_name"]} '
                    f'appears to be missing in corpus configuration file of {corp_name}')
                continue
            item.dt_format = row['dt_format']
        return items

    def mod_corplist_menu(self, plugin_ctx, menu_item):
        if not plugin_ctx.user_is_anonymous:
            menu_item.add_args(('requestable', '1'))

    def create_corplist_provider(self, plugin_ctx):
        return DefaultCorplistProvider(plugin_ctx, self, self._tag_prefix)

    async def _export_favorite(self, cursor: MySQLCursorAbstract, plugin_ctx):
        ans = []
        for item in await plugins.runtime.USER_ITEMS.instance.get_user_items(plugin_ctx):
            tmp = item.to_dict()
            corp_info = await self._fetch_corpus_info(plugin_ctx, cursor, item.main_corpus_id)
            if corp_info:
                tmp['description'] = self._export_untranslated_label(
                    plugin_ctx, corp_info.description)
            else:
                tmp['description'] = ''
            ans.append(tmp)
        return ans

    async def initial_search_params(self, plugin_ctx: PluginCtx):
        query_substrs, query_keywords = parse_query(
            self._tag_prefix, plugin_ctx.request.args.get('query'))
        all_keywords = await self.all_keywords(plugin_ctx.user_lang)
        exp_keywords = [(k, lab, k in query_keywords, self.get_label_color(k))
                        for k, lab in list(all_keywords.items())]
        return {
            'keywords': exp_keywords,
            'filters': {
                'maxSize': plugin_ctx.request.args_getlist('maxSize'),
                'minSize': plugin_ctx.request.args_getlist('minSize'),
                'name': query_substrs
            }
        }

    @staticmethod
    def export_actions():
        return bp

    async def _export_featured(self, cursor: MySQLCursorAbstract, plugin_ctx: PluginCtx):
        return [
            dict(r)
            for r in await self.backend.load_featured_corpora(cursor, plugin_ctx.user_id, plugin_ctx.user_lang)]

    async def export(self, plugin_ctx):
        async with self._backend.cursor() as cursor:
            return dict(
                favorite=await self._export_favorite(cursor, plugin_ctx),
                featured=await self._export_featured(cursor, plugin_ctx),
                corpora_labels=[(k, lab, self.get_label_color(k))
                                for k, lab in list((await self.all_keywords(plugin_ctx.user_lang)).items())],
                tag_prefix=self._tag_prefix,
                max_num_hints=self._max_num_hints,
                max_page_size=self.max_page_size
            )

    async def on_response(self):
        await self.backend.close()


@inject(plugins.runtime.USER_ITEMS, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, user_items: AbstractUserItems, integ_db: MySqlIntegrationDb):
    plugin_conf = conf.get('plugins', 'corparch')
    if integ_db.is_active and 'mysql_host' not in plugin_conf:
        logging.getLogger(__name__).info(f'mysql_corparch uses integration_db[{integ_db.info}]')
        db_backend = Backend(integ_db, enable_parallel_acc=True)
    else:
        logging.getLogger(__name__).info(
            'mysql_user_items uses custom database configuration {}@{}'.format(
                plugin_conf['mysql_user'], plugin_conf['mysql_host']))
        db_backend = Backend(AdhocDB(MySQLConf.from_conf(plugin_conf)))

    return MySQLCorparch(
        db_backend=db_backend,
        user_items=user_items,
        tag_prefix=plugin_conf['tag_prefix'],
        max_num_hints=plugin_conf['max_num_hints'],
        max_page_size=plugin_conf.get('default_page_list_size', None),
        registry_lang=conf.get('corpora', 'manatee_registry_locale', 'en_US'),
        prefer_vlo_metadata=plugin_conf.get('prefer_vlo_metadata', False),
    )
