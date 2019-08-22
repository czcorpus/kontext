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
import os
import logging

from controller import exposed
import actions.user
import plugins
from plugins.abstract.corpora import (AbstractSearchableCorporaArchive, BrokenCorpusInfo, CorplistProvider,
                                      TokenConnect, KwicConnect, DictLike, TagsetInfo)
import l10n
from plugins.rdbms_corparch.backend import ManateeCorpora
from plugins.rdbms_corparch.backend.sqlite import Backend
from plugins.rdbms_corparch.registry import RegModelSerializer, RegistryConf

try:
    from markdown import markdown
except ImportError:
    def markdown(s): return s


def parse_query(tag_prefix, query):
    """
    Parses a search query:

    <query> ::= <label> | <desc_part>
    <label> ::= <tag_prefix> <desc_part>

    returns:
    2-tuple (list of description substrings, list of labels/keywords)
    """
    if query is not None:
        tokens = re.split(r'\s+', query.strip())
    else:
        tokens = []
    query_keywords = []
    substrs = []
    for t in tokens:
        if len(t) > 0:
            if t[0] == tag_prefix:
                query_keywords.append(t[1:])
            else:
                substrs.append(t)
    return substrs, query_keywords


class CorpusListItem(DictLike):

    def __init__(self, id=None, corpus_id=None, name=None, description=None, size=0, path=None,
                 featured=False, keywords=None):
        self.id = id
        self.corpus_id = corpus_id
        self.name = name
        self.description = description
        self.size = size
        self.size_info = l10n.simplify_num(size)
        self.path = path
        self.featured = featured
        self.found_in = []
        self.keywords = [] if keywords is None else keywords

    def __unicode__(self):
        return u'CorpusListItem({0})'.format(self.__dict__)

    def __repr__(self):
        return self.__unicode__()


class DeafultCorplistProvider(CorplistProvider):
    """
    Corpus listing and filtering service
    """

    def __init__(self, plugin_api, corparch, tag_prefix):
        """
        arguments:
        plugin_api -- a controller.PluginApi instance
        corparch -- a plugins.abstract.corpora.AbstractSearchableCorporaArchive instance
        tag_prefix -- a string determining how a tag (= keyword or label) is recognized
        """
        self._plugin_api = plugin_api
        self._corparch = corparch
        self._tag_prefix = tag_prefix

    def search(self, plugin_api, query, offset=0, limit=None, filter_dict=None):
        if query is False:  # False means 'use default values'
            query = ''
        if filter_dict.get('minSize'):
            min_size = l10n.desimplify_num(filter_dict.get('minSize'), strict=False)
        else:
            min_size = 0
        if filter_dict.get('maxSize'):
            max_size = l10n.desimplify_num(filter_dict.get('maxSize'), strict=False)
        else:
            max_size = None
        if filter_dict.get('requestable'):
            requestable = bool(int(filter_dict.get('requestable')))
        else:
            requestable = False

        if offset is None:
            offset = 0
        else:
            offset = int(offset)

        if limit is None:
            limit = int(self._corparch.max_page_size)
        else:
            limit = int(limit)

        user_items = self._corparch.user_items.get_user_items(plugin_api)

        def fav_id(corpus_id):
            for item in user_items:
                if item.is_single_corpus and item.main_corpus_id == corpus_id:
                    return item.ident
            return None

        def get_found_in(corp, phrases):
            ans = []
            for phrase in phrases:
                phrase = phrase.lower()
                if phrase not in corp.name.lower() and phrase in corp.description.lower():
                    ans.append('defaultCorparch__found_in_desc')
                    break
            return ans

        query_substrs, query_keywords = parse_query(self._tag_prefix, query)
        normalized_query_substrs = [s.lower() for s in query_substrs]
        used_keywords = set()
        rows = self._corparch.list_corpora(plugin_api, substrs=normalized_query_substrs,
                                           min_size=min_size, max_size=max_size, requestable=requestable,
                                           offset=offset, limit=limit + 1, keywords=query_keywords).values()
        ans = []
        for i, corp in enumerate(rows):
            used_keywords.update(corp.keywords)
            corp.keywords = self._corparch.get_l10n_keywords(corp.keywords, plugin_api.user_lang)
            corp.fav_id = fav_id(corp.id)
            corp.found_in = get_found_in(corp, normalized_query_substrs)
            ans.append(corp.to_dict())
            if i == limit - 1:
                break
        return dict(rows=ans,
                    nextOffset=offset + limit if len(rows) > limit else None,
                    keywords=l10n.sort(used_keywords, loc=plugin_api.user_lang),
                    query=query,
                    current_keywords=query_keywords,
                    filters=dict(filter_dict))


@exposed(return_type='json', access_level=1, skip_corpus_init=True)
def get_favorite_corpora(ctrl, request):
    with plugins.runtime.CORPARCH as ca:
        return ca.export_favorite(ctrl._plugin_api)


class RDBMSCorparch(AbstractSearchableCorporaArchive):
    """
    A corparch plug-in implementation based on a relational
    database (sqlite/mysql - depends on backend).

    The main advantages over default_corparch are:
    1) no redundancies (e.g. references, text type descriptions)
    2) referential integrity
    3) optimized data loading
    """

    LABEL_OVERLAY_TRANSPARENCY = 0.20

    def __init__(self, backend, user_items, tag_prefix, max_num_hints, max_page_size, registry_lang):
        """

        arguments:
            backend -- a database backend
            user_items -- user_items plug-in
            tag_prefix -- a string used to distinguish search labels (tags) from actual searched strings
            max_num_hints --
            max_page_size --
            registry_lang --
        """
        self._backend = backend
        self._user_items = user_items
        self._tag_prefix = tag_prefix
        self._max_num_hints = int(max_num_hints)
        self._max_page_size = int(max_page_size)
        self._registry_lang = registry_lang
        self._corpus_info_cache = {}
        self._keywords = None  # keyword (aka tags) database for corpora; None = not loaded yet
        self._colors = {}
        self._descriptions = defaultdict(lambda: {})
        self._tc_providers = {}
        self._kc_providers = {}
        self._mc = ManateeCorpora()

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

    def _corp_info_from_row(self, row):
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
            ans.metadata.id_attr = row['id_attr'].encode('utf-8') if row['id_attr'] else None
            ans.metadata.label_attr = row['label_attr'].encode(
                'utf-8') if row['label_attr'] else None
            ans.metadata.featured = bool(row['featured'])
            ans.metadata.database = row['database']
            ans.metadata.keywords = [x for x in (
                row['keywords'].split(',') if row['keywords'] else []) if x]
            ans.metadata.desc = row['ttdesc_id']
            ans.metadata.group_duplicates = bool(row['bib_group_duplicates'])
            ans.manatee.encoding = row['encoding']
            ans.manatee.description = row['info']
            ans.manatee.size = row['size']
            ans.manatee.lang = row['language']
            ans.manatee.name = row['name']
            return ans
        return None

    def _export_untranslated_label(self, plugin_api, text):
        """
        This plug-in is able to load multi-language descriptions
        so here we don't have to add any stuff here
        """
        return text

    def corpus_list_item_from_row(self, plugin_api, row):
        keywords = [x for x in (row['keywords'].split(',') if row['keywords'] else []) if x]
        return CorpusListItem(id=row['id'],
                              corpus_id=row['id'],
                              name=row['name'],
                              description=self._export_untranslated_label(plugin_api, row['info']),
                              size=row['size'],
                              featured=row['featured'],
                              path=None,
                              keywords=keywords)

    def list_corpora(self, plugin_api, substrs=None, keywords=None, min_size=0, max_size=None, requestable=False,
                     offset=0, limit=-1):
        user_id = plugin_api.user_dict['id']
        ans = OrderedDict()
        for row in self._backend.load_all_corpora(user_id, substrs=substrs, keywords=keywords, min_size=min_size,
                                                  max_size=max_size, requestable=requestable, offset=offset,
                                                  limit=limit):
            ans[row['id']] = self.corpus_list_item_from_row(plugin_api, row)
        return ans

    def get_l10n_keywords(self, id_list, lang_code):
        all_keywords = self.all_keywords(lang_code)
        ans = []
        for keyword_id in id_list:
            if keyword_id in all_keywords:
                ans.append((keyword_id, all_keywords[keyword_id]))
            else:
                ans.append((keyword_id, keyword_id))
        return ans

    def _localize_corpus_info(self, data, lang_code):
        """
        Updates localized values from data (please note that not all
        the data are localized - e.g. paths to files) by a single variant
        given passed lang_code.
        """
        ans = copy.deepcopy(data)
        lang_code = lang_code.split('_')[0]
        if ans.metadata.desc is not None and lang_code in self._descriptions:
            ans.metadata.desc = self._descriptions[lang_code][ans.metadata.desc]
        else:
            ans.metadata.desc = ''
        ans.metadata.keywords = self.get_l10n_keywords(ans.metadata.keywords, lang_code)
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

    def _get_tckc_providers(self, corpus_id):
        if corpus_id not in self._tc_providers and corpus_id not in self._kc_providers:
            self._tc_providers[corpus_id] = TokenConnect()
            self._kc_providers[corpus_id] = KwicConnect()
            data = self._backend.load_tckc_providers(corpus_id)
            for row in data:
                if row['type'] == 'tc':
                    self._tc_providers[corpus_id].providers.append(row['provider'])
                elif row['type'] == 'kc':
                    self._kc_providers[corpus_id].providers.append(row['provider'])
        return self._tc_providers[corpus_id], self._kc_providers[corpus_id]

    def _fetch_corpus_info(self, corpus_id):
        if corpus_id not in self._corpus_info_cache:
            row = self._backend.load_corpus(corpus_id)
            corp = self._corp_info_from_row(row)
            corp.tagsets = [TagsetInfo().from_dict(row2)
                            for row2 in self._backend.load_corpus_tagsets(corpus_id)]
            self._corpus_info_cache[corpus_id] = corp
            for art in self._backend.load_corpus_articles(corpus_id):
                if art['role'] == 'default':
                    corp.citation_info.default_ref = markdown(art['entry'])
                elif art['role'] == 'standard':
                    corp.citation_info.article_ref.append(markdown(art['entry']))
                elif art['role'] == 'other':
                    corp.citation_info.other_bibliography = markdown(art['entry'])
            if row['ttdesc_id'] not in self._descriptions:
                for drow in self._backend.load_ttdesc(row['ttdesc_id']):
                    self._descriptions['cs'][row['ttdesc_id']] = drow['text_cs']
                    self._descriptions['en'][row['ttdesc_id']] = drow['text_en']
        return self._corpus_info_cache.get(corpus_id, None)

    def get_corpus_info(self, user_lang, corp_name):
        """
        Obtain full corpus info
        """
        if corp_name:
            try:
                # get rid of path-like corpus ID prefix
                corp_name = corp_name.lower()
                corp_info = self._fetch_corpus_info(corp_name)
                if corp_info is not None:
                    if user_lang is not None:
                        ans = self._localize_corpus_info(corp_info, lang_code=user_lang)
                    else:
                        ans = corp_info
                    ans.manatee = self._mc.get_info(corp_name)
                    ans.token_connect, ans.kwic_connect = self._get_tckc_providers(corp_name)
                    ans.metadata.interval_attrs = self._backend.load_interval_attrs(corp_name)

                    return ans
                return BrokenCorpusInfo(name=corp_name)
            except TypeError as ex:
                logging.getLogger(__name__).warning(
                    'Failed to fetch corpus info for {0}: {1}'.format(corp_name, ex))
                return BrokenCorpusInfo(name=corp_name)
        else:
            return BrokenCorpusInfo()

    def mod_corplist_menu(self, plugin_api, menu_item):
        if not plugin_api.user_is_anonymous:
            menu_item.add_args(('requestable', '1'))

    def create_corplist_provider(self, plugin_api):
        return DeafultCorplistProvider(plugin_api, self, self._tag_prefix)

    def _export_favorite(self, plugin_api):
        ans = []
        for item in plugins.runtime.USER_ITEMS.instance.get_user_items(plugin_api):
            tmp = item.to_dict()
            tmp['description'] = self._export_untranslated_label(
                plugin_api, self._mc.get_info(item.main_corpus_id).description)
            ans.append(tmp)
        return ans

    def initial_search_params(self, plugin_api, query, filter_dict=None):
        query_substrs, query_keywords = parse_query(self._tag_prefix, query)
        all_keywords = self.all_keywords(plugin_api.user_lang)
        exp_keywords = [(k, lab, k in query_keywords, self.get_label_color(k))
                        for k, lab in all_keywords.items()]
        return {
            'keywords': exp_keywords,
            'filters': {
                'maxSize': filter_dict.getlist('maxSize'),
                'minSize': filter_dict.getlist('minSize'),
                'name': query_substrs
            }
        }

    def rebuild_registry(self, registry_path, variant, proc_aligned=False):
        logging.getLogger(__name__).info('Rebuilding registry {0}'.format(registry_path))
        rc = RegistryConf(corpus_id=os.path.basename(registry_path),
                          variant=variant,
                          backend=self._backend)
        rc.load()
        if not os.path.exists(os.path.dirname(registry_path)):
            os.makedirs(os.path.dirname(registry_path))
        s = RegModelSerializer(add_heading=True)
        with open(registry_path, 'w') as fw:
            fw.write(s.serialize(rc).encode(rc.encoding))
        if proc_aligned:
            for aligned in rc.aligned:
                self.rebuild_registry(os.path.join(
                    os.path.dirname(registry_path), aligned), variant)

    def export_actions(self):
        return {actions.user.User: [get_favorite_corpora]}

    def _export_featured(self, plugin_api):
        return [dict(r) for r in self.backend.load_featured_corpora(plugin_api.user_lang)]

    def export(self, plugin_api):
        return dict(
            favorite=self._export_favorite(plugin_api),
            featured=self._export_featured(plugin_api),
            corpora_labels=[(k, lab, self.get_label_color(k))
                            for k, lab in self.all_keywords(plugin_api.user_lang).items()],
            tag_prefix=self._tag_prefix,
            max_num_hints=self._max_num_hints,
            max_page_size=self.max_page_size
        )


@plugins.inject(plugins.runtime.USER_ITEMS)
def create_instance(conf, user_items):
    return RDBMSCorparch(backend=Backend(db_path=conf.get('plugins', 'corparch')['file']),
                         user_items=user_items,
                         tag_prefix=conf.get('plugins', 'corparch')['default:tag_prefix'],
                         max_num_hints=conf.get('plugins', 'corparch')['default:max_num_hints'],
                         max_page_size=conf.get('plugins', 'corparch').get('default:default_page_list_size',
                                                                           None),
                         registry_lang=conf.get('corpora', 'manatee_registry_locale', 'en_US'))
