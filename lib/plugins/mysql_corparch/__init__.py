# Copyright (c) 2018 Charles University, Faculty of Arts,
#                    Institute of the Czech National Corpus
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

import re
import copy
from collections import OrderedDict, defaultdict
import logging
from typing import Dict, List, Tuple, Iterable
import json
from mysql.connector.connection import MySQLConnection
from mysql.connector.cursor import MySQLCursor
from sanic.blueprints import Blueprint

from action.decorators import http_action
import plugins
from plugins import inject
from plugin_types.corparch import AbstractSearchableCorporaArchive, CorpusListItem
from plugin_types.corparch.backend import DatabaseBackend
from plugin_types.integration_db import IntegrationDatabase
from plugin_types.corparch.corpus import (
    BrokenCorpusInfo, TokenConnect, KwicConnect, QuerySuggest, CorpusInfo, StructAttrInfo)
from plugins.mysql_corparch.backend import Backend
from plugins.mysql_corparch.corplist import DefaultCorplistProvider, parse_query

try:
    from markdown import markdown
except ImportError:
    def markdown(s): return s


bp = Blueprint('mysql_corparch')


@bp.route('/get_favorite_corpora')
@http_action(return_type='json', access_level=1, skip_corpus_init=True)
def get_favorite_corpora(ctrl, request):
    with plugins.runtime.CORPARCH as ca, plugins.runtime.USER_ITEMS as ui:
        return ca.export_favorite(ctrl._plugin_ctx, ui.get_user_items(ctrl._plugin_ctx))


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

    def __init__(self, db_backend: DatabaseBackend, user_items, tag_prefix, max_num_hints, max_page_size, registry_lang):
        """

        arguments:
            backend -- a database backend
            user_items -- user_items plug-in
            tag_prefix -- a string used to distinguish search labels (tags) from actual searched strings
            max_num_hints --
            max_page_size --
            registry_lang --
        """
        self._backend: DatabaseBackend = db_backend
        self._user_items = user_items
        self._tag_prefix = tag_prefix
        self._max_num_hints = int(max_num_hints)
        self._max_page_size = int(max_page_size)
        self._registry_lang = registry_lang
        self._corpus_info_cache: Dict[str, CorpusInfo] = {}
        self._keywords = None  # keyword (aka tags) database for corpora; None = not loaded yet
        self._colors = {}
        self._tt_desc_i18n = defaultdict(lambda: {})
        self._tc_providers = {}
        self._kc_providers = {}
        self._qs_providers = {}

    @property
    def max_page_size(self):
        return self._max_page_size

    @property
    def user_items(self):
        return self._user_items

    @property
    def backend(self):
        return self._backend

    def _parse_color(self, code):
        code = code.lower()
        transparency = self.LABEL_OVERLAY_TRANSPARENCY
        if code[0] == '#':
            code = code[1:]
            r, g, b = [int('0x%s' % code[i:i + 2], 0) for i in range(0, len(code), 2)]
            return 'rgba(%d, %s, %d, %01.2f)' % (r, g, b, transparency)
        elif code.find('rgb') == 0:
            m = re.match(r'rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)', code, re.IGNORECASE)
            if m:
                return 'rgba(%s, %s, %s, %01.2f)' % (m.group(1), m.group(2), m.group(3), transparency)
        raise ValueError('Invalid color code: %s' % code)

    def get_label_color(self, label_id):
        return self._colors.get(label_id, None)

    def _corp_info_from_row(self, row, lang):
        if row:
            ans = self.create_corpus_info()
            ans.id = row['id']
            ans.web = row['web']
            ans.sentence_struct = row['sentence_struct']
            ans.collator_locale = row['collator_locale']
            ans.speech_segment = row['speech_segment']
            ans.speaker_id_attr = row['speaker_id_attr']
            ans.speech_overlap_attr = row['speech_overlap_attr']
            ans.speech_overlap_val = row['speech_overlap_val']
            ans.use_safe_font = row['use_safe_font']
            ans.default_tagset = row['default_tagset']
            ans._description_cs = row['description_cs']
            ans._description_en = row['description_en']
            try:
                ans.default_view_opts = json.loads(
                    row['default_view_opts']) if row['default_view_opts'] else {}
            except Exception as ex:
                logging.getLogger(__name__).warning(
                    f'Failed to load default view opts for {ans.id}: {ex}')
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
            return ans
        return None

    def _export_untranslated_label(self, plugin_ctx, text):
        """
        This plug-in is able to load multi-language descriptions
        so here we don't have to add any stuff here
        """
        return text

    def export_favorite(self, plugin_ctx, favitems):
        ans = []
        favitems_corpids = [x.corpora[0]['id'] for x in favitems]
        descriptions = self.backend.load_corpora_descriptions(
            favitems_corpids, plugin_ctx.user_lang)
        for item in favitems:
            tmp = item.to_dict()
            tmp['description'] = descriptions.get(item.corpora[0]['id'], None)
            ans.append(tmp)
        return ans

    def corpus_list_item_from_row(self, plugin_ctx, row):
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

    def list_corpora(self, plugin_ctx, substrs=None, keywords=None, min_size=0, max_size=None, requestable=False,
                     offset=0, limit=-1, favourites=()):
        user_id = plugin_ctx.user_dict['id']
        ans = OrderedDict()
        for row in self._backend.list_corpora(user_id, substrs=substrs, keywords=keywords, min_size=min_size,
                                              max_size=max_size, requestable=requestable, offset=offset,
                                              limit=limit, favourites=favourites):
            ans[row['id']] = self.corpus_list_item_from_row(plugin_ctx, row)
        return ans

    def get_l10n_keywords(self, id_list, lang_code) -> List[Tuple[str, str]]:
        all_keywords = self.all_keywords(lang_code)
        ans = []
        for keyword_id in id_list:
            if keyword_id in all_keywords:
                ans.append((keyword_id, all_keywords[keyword_id]))
            else:
                ans.append((keyword_id, keyword_id))
        return ans

    def _localize_corpus_info(self, data: CorpusInfo, lang_code) -> CorpusInfo:
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
        ans.metadata.keywords = self.get_l10n_keywords(ans.metadata.keywords, lang_code)
        ans.description = ans.localized_desc(lang_code)
        return ans

    @staticmethod
    def _get_iso639lang(lang):
        """
        return 2-letter version of a lang-code
        """
        return lang.split('_')[0]

    def all_keywords(self, lang):
        if self._keywords is None:
            self._keywords = defaultdict(lambda: OrderedDict())
            for row in self._backend.load_all_keywords():
                #  id, label_cs, label_en, color
                self._keywords['cs'][row['id']] = row['label_cs']
                self._keywords['en'][row['id']] = row['label_en']
                self._colors[row['id']] = self._parse_color(row['color']) if row['color'] else None
        lang_key = self._get_iso639lang(lang)
        return self._keywords[lang_key]

    def _get_tckcqs_providers(self, corpus_id):
        if corpus_id not in self._tc_providers and corpus_id not in self._kc_providers:
            self._tc_providers[corpus_id] = TokenConnect()
            self._kc_providers[corpus_id] = KwicConnect()
            self._qs_providers[corpus_id] = QuerySuggest()
            data = self._backend.load_tckc_providers(corpus_id)
            for row in data:
                if row['type'] == 'tc':
                    self._tc_providers[corpus_id].providers.append(
                        (row['provider'], row['is_kwic_view']))
                elif row['type'] == 'kc':
                    self._kc_providers[corpus_id].providers.append(row['provider'])
                elif row['type'] == 'qs':
                    self._qs_providers[corpus_id].providers.append(row['provider'])
        return self._tc_providers[corpus_id], self._kc_providers[corpus_id], self._qs_providers[corpus_id]

    def _fetch_corpus_info(self, corpus_id: str, user_lang: str) -> CorpusInfo:
        if corpus_id not in self._corpus_info_cache:
            row = self._backend.load_corpus(corpus_id)
            corp = self._corp_info_from_row(row, user_lang)
            if corp:
                corp.tagsets = self._backend.load_corpus_tagsets(corpus_id)
                self._corpus_info_cache[corpus_id] = corp
                for art in self._backend.load_corpus_articles(corpus_id):
                    if art['role'] == 'default':
                        corp.citation_info.default_ref = markdown(art['entry'])
                    elif art['role'] == 'standard':
                        corp.citation_info.article_ref.append(markdown(art['entry']))
                    elif art['role'] == 'other':
                        corp.citation_info.other_bibliography = markdown(art['entry'])
                if row['ttdesc_id'] not in self._tt_desc_i18n:
                    for drow in self._backend.load_ttdesc(row['ttdesc_id']):
                        self._tt_desc_i18n['cs'][row['ttdesc_id']] = drow['text_cs']
                        self._tt_desc_i18n['en'][row['ttdesc_id']] = drow['text_en']
                corp.simple_query_default_attrs = self._backend.load_simple_query_default_attrs(
                    corpus_id)
        return self._corpus_info_cache.get(corpus_id, None)

    def get_corpus_info(self, plugin_ctx, corp_name):
        """
        Obtain full corpus info
        """
        if corp_name:
            try:
                # get rid of path-like corpus ID prefix
                corp_name = corp_name.lower()
                corp_info = self._fetch_corpus_info(corp_name, plugin_ctx.user_lang)
                if corp_info is not None:
                    if plugin_ctx.user_lang is not None:
                        ans = self._localize_corpus_info(corp_info, lang_code=plugin_ctx.user_lang)
                    else:
                        ans = corp_info
                    ans.manatee = plugin_ctx.corpus_manager.get_info(corp_name)
                    ans.token_connect, ans.kwic_connect, ans.query_suggest = self._get_tckcqs_providers(
                        corp_name)
                    ans.metadata.interval_attrs = self._backend.load_interval_attrs(corp_name)

                    return ans
                return BrokenCorpusInfo(name=corp_name)
            except TypeError as ex:
                logging.getLogger(__name__).warning(
                    'Failed to fetch corpus info for {0}: {1}'.format(corp_name, ex))
                return BrokenCorpusInfo(name=corp_name)
        else:
            return BrokenCorpusInfo()

    def get_structattrs_info(
            self, plugin_ctx: 'PluginCtx', corp_name: str, full_names: Iterable[str]) -> List[StructAttrInfo]:
        items = super().get_structattrs_info(plugin_ctx, corp_name, full_names)
        items_index = dict((f'{x.structure_name}{x.name}', x) for x in items)
        data = self.backend.load_corpus_structattrs(corp_name)
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

    def _export_favorite(self, plugin_ctx):
        ans = []
        for item in plugins.runtime.USER_ITEMS.instance.get_user_items(plugin_ctx):
            tmp = item.to_dict()
            corp_info = self._fetch_corpus_info(item.main_corpus_id, plugin_ctx.user_lang)
            if corp_info:
                tmp['description'] = self._export_untranslated_label(
                    plugin_ctx, corp_info.description)
            else:
                tmp['description'] = ''
            ans.append(tmp)
        return ans

    def initial_search_params(self, plugin_ctx, query, filter_dict=None):
        query_substrs, query_keywords = parse_query(self._tag_prefix, query)
        all_keywords = self.all_keywords(plugin_ctx.user_lang)
        exp_keywords = [(k, lab, k in query_keywords, self.get_label_color(k))
                        for k, lab in list(all_keywords.items())]
        return {
            'keywords': exp_keywords,
            'filters': {
                'maxSize': filter_dict.getlist('maxSize'),
                'minSize': filter_dict.getlist('minSize'),
                'name': query_substrs
            }
        }

    @staticmethod
    def export_actions():
        return bp

    def _export_featured(self, plugin_ctx):
        return [dict(r) for r in self.backend.load_featured_corpora(plugin_ctx.user_lang)]

    def export(self, plugin_ctx):
        return dict(
            favorite=self._export_favorite(plugin_ctx),
            featured=self._export_featured(plugin_ctx),
            corpora_labels=[(k, lab, self.get_label_color(k))
                            for k, lab in list(self.all_keywords(plugin_ctx.user_lang).items())],
            tag_prefix=self._tag_prefix,
            max_num_hints=self._max_num_hints,
            max_page_size=self.max_page_size
        )


@inject(plugins.runtime.USER_ITEMS, plugins.runtime.INTEGRATION_DB)
def create_instance(conf, user_items, integ_db: IntegrationDatabase[MySQLConnection, MySQLCursor]):
    plugin_conf = conf.get('plugins', 'corparch')
    if integ_db.is_active and 'mysql_host' not in plugin_conf:
        logging.getLogger(__name__).info(f'mysql_corparch uses integration_db[{integ_db.info}]')
        db_backend = Backend(integ_db)
    else:
        from plugins.common.mysql import MySQLOps, MySQLConf
        logging.getLogger(__name__).info(
            'mysql_user_items uses custom database configuration {}@{}'.format(
                plugin_conf['mysql_user'], plugin_conf['mysql_host']))
        db_backend = Backend(MySQLOps(MySQLConf(plugin_conf)))

    return MySQLCorparch(
        db_backend=db_backend,
        user_items=user_items,
        tag_prefix=plugin_conf['tag_prefix'],
        max_num_hints=plugin_conf['max_num_hints'],
        max_page_size=plugin_conf.get('default_page_list_size', None),
        registry_lang=conf.get('corpora', 'manatee_registry_locale', 'en_US'))
