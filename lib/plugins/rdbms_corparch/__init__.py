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
from plugins.abstract.corpora import AbstractSearchableCorporaArchive, BrokenCorpusInfo, CorplistProvider
import l10n
from plugins.rdbms_corparch.backend import ManateeCorpora
from plugins.rdbms_corparch.backend.sqlite import Backend
from plugins.rdbms_corparch.registry import RegModelSerializer, RegistryConf
from translation import ugettext as _


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


class DeafultCorplistProvider(CorplistProvider):
    """
    Corpus listing and filtering service
    """

    def __init__(self, plugin_api, auth, corparch, tag_prefix):
        """
        arguments:
        plugin_api -- a controller.PluginApi instance
        auth -- an auth plug-in instance
        corparch -- a plugins.abstract.corpora.AbstractSearchableCorporaArchive instance
        tag_prefix -- a string determining how a tag (= keyword or label) is recognized
        """
        self._plugin_api = plugin_api
        self._auth = auth
        self._corparch = corparch
        self._tag_prefix = tag_prefix

    @staticmethod
    def cut_result(res, offset, limit):
        right_lim = offset + int(limit)
        new_res = res[offset:right_lim]
        if right_lim >= len(res):
            right_lim = None
        return new_res, right_lim

    @staticmethod
    def matches_all(d):
        return reduce(lambda prev, curr: prev and curr, d, True)

    @staticmethod
    def matches_size(d, min_size, max_size):
        item_size = d.get('size', None)
        return (item_size is not None and
                (not min_size or int(item_size) >= int(min_size)) and
                (not max_size or int(item_size) <= int(max_size)))

    def sort(self, plugin_api, data, *fields):
        def corp_cmp_key(c):
            return c.get('name') if c.get('name') is not None else ''
        return l10n.sort(data, loc=plugin_api.user_lang, key=corp_cmp_key)

    def should_fetch_next(self, ans, offset, limit):
        """
        This quite artificial function can be used to optimize loading of a long list.
        It is expected to depend on how the sort() function is implemented.
        In case there is no sorting involved it is probably OK to skip loading
        whole list once all the 'to be displayed' data is ready.
        """
        return True

    def search(self, plugin_api, query, offset=0, limit=None, filter_dict=None):
        if query is False:  # False means 'use default values'
            query = ''
        ans = {'rows': []}
        permitted_corpora = self._auth.permitted_corpora(plugin_api.user_dict)
        used_keywords = set()
        all_keywords_map = dict(self._corparch.all_keywords(plugin_api.user_lang))
        if filter_dict.get('minSize'):
            min_size = l10n.desimplify_num(filter_dict.get('minSize'), strict=False)
        else:
            min_size = 0
        if filter_dict.get('maxSize'):
            max_size = l10n.desimplify_num(filter_dict.get('maxSize'), strict=False)
        else:
            max_size = None

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

        query_substrs, query_keywords = parse_query(self._tag_prefix, query)

        normalized_query_substrs = [s.lower() for s in query_substrs]
        for corp in self._corparch.get_list(plugin_api, permitted_corpora):
            full_data = self._corparch.get_corpus_info(plugin_api.user_lang, corp['id'])
            if not isinstance(full_data, BrokenCorpusInfo):
                keywords = [k for k in full_data['metadata']['keywords'].keys()]
                tests = []
                found_in = []

                tests.extend([k in keywords for k in query_keywords])
                for s in normalized_query_substrs:
                    # the name must be tested first to prevent the list 'found_in'
                    # to be filled in case item matches both name and description
                    if s in corp['name'].lower():
                        tests.append(True)
                    elif s in (corp['desc'].lower() if corp['desc'] else ''):
                        tests.append(True)
                        found_in.append(_('description'))
                    else:
                        tests.append(False)
                tests.append(self.matches_size(corp, min_size, max_size))
                tests.append(self._corparch.custom_filter(
                    self._plugin_api, full_data, permitted_corpora))

                if self.matches_all(tests):
                    corp['size'] = corp['size']
                    corp['size_info'] = l10n.simplify_num(corp['size']) if corp['size'] else None
                    corp['keywords'] = [(k, all_keywords_map[k]) for k in keywords]
                    corp['found_in'] = found_in
                    corp['fav_id'] = fav_id(corp['id'])
                    # because of client-side fav/feat/search items compatibility
                    corp['corpus_id'] = corp['id']
                    self._corparch.customize_search_result_item(self._plugin_api, corp, permitted_corpora,
                                                                full_data)
                    ans['rows'].append(corp)
                    used_keywords.update(keywords)
                    if not self.should_fetch_next(ans, offset, limit):
                        break
        ans['rows'], ans['nextOffset'] = self.cut_result(
            self.sort(plugin_api, ans['rows']), offset, limit)
        ans['keywords'] = l10n.sort(used_keywords, loc=plugin_api.user_lang)
        ans['query'] = query
        ans['current_keywords'] = query_keywords
        ans['filters'] = dict(filter_dict)
        return ans


@exposed(return_type='json', access_level=1, skip_corpus_init=True)
def get_favorite_corpora(ctrl, request):
    with plugins.runtime.CORPARCH as ca:
        return ca.export_favorite(ctrl._plugin_api)


class RDBMSCorparch(AbstractSearchableCorporaArchive):

    LABEL_OVERLAY_TRANSPARENCY = 0.20

    def __init__(self, backend, auth, user_items, tag_prefix, max_num_hints, max_page_size, registry_lang):
        self._backend = backend
        self._mc = ManateeCorpora()
        self._auth = auth
        self._user_items = user_items
        self._tag_prefix = tag_prefix
        self._max_num_hints = int(max_num_hints)
        self._max_page_size = max_page_size
        self._registry_lang = registry_lang
        self._raw_list_data = None
        self._keywords = None  # keyword (aka tags) database for corpora; None = not loaded yet
        self._colors = {}
        self._descriptions = {}

    @property
    def max_page_size(self):
        return self._max_page_size

    @property
    def user_items(self):
        return self._user_items

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
            mci = self._mc.get_info(corpus_id=row['id'])
            ans = self.create_corpus_info()
            ans.id = row['id']
            ans.name = mci.name
            ans.web = row['web']
            ans.sentence_struct = row['sentence_struct']
            ans.tagset = row['tagset']
            ans.collator_locale = row['collator_locale']
            ans.speech_segment = row['speech_segment']
            ans.speaker_id_attr = row['speaker_id_attr']
            ans.speech_overlap_attr = row['speech_overlap_attr']
            ans.speech_overlap_val = row['speech_overlap_val']
            ans.use_safe_font = row['use_safe_font']
            ans.metadata.id_attr = row['id_attr']
            ans.metadata.label_attr = row['label_attr']
            ans.metadata.featured = bool(row['featured'])
            ans.metadata.database = row['database']
            ans.metadata.keywords = self._backend.get_corpus_keywords(row['id'])
            ans.metadata.desc = row['ttdesc_id']
            return ans
        return None

    def _raw_list(self):
        if self._raw_list_data is None:
            self._descriptions = defaultdict(lambda: {})
            for row in self._backend.load_descriptions():
                self._descriptions['cs'][row['id']] = row['text_cs']
                self._descriptions['en'][row['id']] = row['text_en']
            self._raw_list_data = OrderedDict([(row['id'], self._corp_info_from_row(row))
                                               for row in self._backend.load_all_corpora()])
        return self._raw_list_data

    def _export_untranslated_label(self, plugin_api, text):
        if self._registry_lang[:2] == plugin_api.user_lang[:2]:
            return text
        else:
            return u'{0} [{1}]'.format(text, _('translation not available'))

    def _export_featured(self, plugin_api):
        permitted_corpora = self._auth.permitted_corpora(plugin_api.user_dict)

        def is_featured(o):
            return o['metadata'].get('featured', False)

        featured = []
        for x in self._raw_list().values():
            if x['id'] in permitted_corpora and is_featured(x):
                featured.append({
                    # on client-side, this may contain also subc. id, aligned ids
                    'id': x['id'],
                    'corpus_id': x['id'],
                    'name': self._mc.get_info(x['id']).name,
                    'size': self._mc.get_info(x['id']).size,
                    'size_info': l10n.simplify_num(self._mc.get_info(x['id']).size),
                    'description': self._export_untranslated_label(
                        plugin_api, self._mc.get_info(x['id']).description)
                })
        return featured

    def _localize_corpus_info(self, data, lang_code):
        """
        Updates localized values from data (please note that not all
        the data are localized - e.g. paths to files) by a single variant
        given passed lang_code.
        """
        ans = copy.deepcopy(data)
        lang_code = lang_code.split('_')[0]
        desc = ans.metadata.desc
        if ans.metadata.desc is not None and lang_code in self._descriptions:
            ans.metadata.desc = self._descriptions[lang_code][ans.metadata.desc]
        else:
            ans.metadata.desc = ''

        translated_k = OrderedDict()
        for keyword, label in ans.metadata.keywords.items():
            if type(label) is dict and lang_code in label:
                translated_k[keyword] = label[lang_code]
            elif type(label) is str:
                translated_k[keyword] = label
        ans.metadata.keywords = translated_k
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
        return self._keywords[lang_key].items()

    def get_corpus_info(self, user_lang, corp_name):
        if corp_name:
            # get rid of path-like corpus ID prefix
            corp_name = corp_name.split('/')[-1].lower()
            if corp_name in self._raw_list():
                if user_lang is not None:
                    ans = self._localize_corpus_info(self._raw_list()[corp_name],
                                                     lang_code=user_lang)
                else:
                    ans = self._raw_list()[corp_name]
                ans.manatee = self._mc.get_info(corp_name)
                return ans
            return BrokenCorpusInfo(name=corp_name)
        else:
            return BrokenCorpusInfo()

    def get_list(self, plugin_api, user_allowed_corpora):
        """
        arguments:
        user_allowed_corpora -- a dict (corpus_id, corpus_variant) containing corpora ids
                                accessible by the current user
        """
        cl = []
        for item in self._raw_list().values():
            corp_id, path, web = item['id'], item['path'], item['sentence_struct']
            if corp_id in user_allowed_corpora:
                try:
                    corp_info = self._mc.get_info(corp_id)
                    cl.append({'id': corp_id,
                               'name': l10n.import_string(corp_info.name,
                                                          from_encoding=corp_info.encoding),
                               'desc': l10n.import_string(corp_info.description,
                                                          from_encoding=corp_info.encoding),
                               'size': corp_info.size,
                               'path': path
                               })
                except Exception as e:
                    import logging
                    logging.getLogger(__name__).warn(
                        u'Failed to fetch info about %s with error %s (%r)' % (corp_info.name,
                                                                               type(e).__name__, e))
                    cl.append({
                        'id': corp_id, 'name': corp_id,
                        'path': path, 'desc': '', 'size': None})
        return cl

    def create_corplist_provider(self, plugin_api):
        return DeafultCorplistProvider(plugin_api, self._auth, self, self._tag_prefix)

    def export_favorite(self, plugin_api):
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
                        for k, lab in all_keywords]
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

    def export(self, plugin_api):
        return dict(
            favorite=self.export_favorite(plugin_api),
            featured=self._export_featured(plugin_api),
            corpora_labels=[(k, lab, '')  # TODO self.get_label_color(k)
                            for k, lab in self.all_keywords(plugin_api.user_lang)],
            tag_prefix=self._tag_prefix,
            max_num_hints=self._max_num_hints
        )


@plugins.inject(plugins.runtime.AUTH, plugins.runtime.USER_ITEMS)
def create_instance(conf, auth, user_items):
    return RDBMSCorparch(backend=Backend(db_path=conf.get('plugins', 'corparch')['file']),
                         auth=auth,
                         user_items=user_items,
                         tag_prefix=conf.get('plugins', 'corparch')['default:tag_prefix'],
                         max_num_hints=conf.get('plugins', 'corparch')['default:max_num_hints'],
                         max_page_size=conf.get('plugins', 'corparch').get('default:default_page_list_size',
                                                                           None),
                         registry_lang=conf.get('corpora', 'manatee_registry_locale', 'en_US'))
