# Copyright (c) 2013 Czech National Corpus
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
A plug-in providing user's favorite and global featured corpora lists. The data
are passed through via the 'export' method which is recognized by KonText and then
interpreted via a custom JavaScript (which is an integral part of the plug-in).


Required config.xml/plugins entries: please see config.rng


Corplist.xml entries:
--------------------

### Keywords

element keywords {
    element keyword {
        attribute ident {
            text  # an internal identifier of the keywords (referenced by corpus/keywords/item)
        }
        element label {
            attribute lang {
                text  # a 2-char identifier (cs, en, us, pl,...)
            }
            text  # a translated representation of the label
        }+
    }*
}?

### Corpus

element corpus {
    attribute web {
        text
    }
    attribute sentence_struct {
        text  # a structural attribute specifying a sentence (used to switch between kwic and sentence view mode)
    }
    attribute ident {
        text  # a corpus identifier (case insensitive)
    }
    attribute default_virt_keyboard {
        text  # default language for virtual keybord query input
    }?
    attribute tagset {
        text  #  an optional positional tagset identifier (used by tag-builder widget)
    }?
    attribute speaker_id_attr {
        text  # a structural attribute used to identify a speaker within a speech
    }?
    attribute speech_overlap_attr {
        text  # a structural attribute specifying whether there is an overlap between structures
    }?
    attribute speech_overlap_val {
        text  # a value denoting 'true' in case of speech_overlap_attr
    }?
    element metadata {
        element featured {
            empty  # if present then the corpus is added to the "Featured corpora list"
        }?
        element database {
            text  # path to a sqlite3 database file containing text types values (= values of structural attrs.)
        }?
        element id_attr {
            text  # an attribute used to identify a bibliography item (e.g.: doc.id, opus.id,...)
        }?
        element label_attr {
            text  # an attribute used to represent a bibliography item (e.g.: doc.title, opus.label,...)
        }?
        element sort_attrs {
            empty  # if present then the bibliography item attributes are sorted alphabetically (e.g.: doc.author,..., doc.translator)
        }?
    }?
    element keywords {
        element item {
            text  # an internal identifier of a keyword
        }*
    }?
    element reference {
        element default {
            text
        }
        element article {
            text  # a respective scientific paper representing the corpus
        }?
        element other_bibliography {
            text  # a web address leading to more information
        }?
    }?
}

"""

from collections import OrderedDict
import copy
import re
import logging
from dataclasses import dataclass, field
from dataclasses_json import dataclass_json
from typing import List, Optional

try:
    from markdown import markdown
except ImportError:
    def markdown(s): return s
from lxml import etree

import plugins
from plugins.abstract.corparch import AbstractSearchableCorporaArchive
from plugins.abstract.corparch.corpus import BrokenCorpusInfo, CorpusInfo
from plugins.abstract.corparch import CorplistProvider
from plugins import inject
import l10n
from controller import exposed
from controller.plg import PluginCtx
import actions.user
from translation import ugettext as _
from settings import import_bool

DEFAULT_LANG = 'en'
DEFAULT_PAGE_LIST_SIZE = 20


def translate_markup(s):
    """
    Transforms markdown markup into HTML
    """
    if not s:
        return None
    return markdown(s.strip())


@dataclass_json
@dataclass
class CorpusListItem:

    id: str
    corpus_id: str
    name: str
    description: str
    size: int
    size_info: str = field(init=False)
    path: str
    featured: bool = False
    found_in: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)

    def __post_init__(self):
        self.size_info = l10n.simplify_num(self.size)

    def __repr__(self):
        return 'CorpusListItem({0})'.format(self.__dict__)


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


class DefaultCorplistProvider(CorplistProvider):
    """
    Corpus listing and filtering service
    """

    def __init__(self, plugin_ctx, auth, corparch, tag_prefix, session_keywords_key, default_label):
        """
        arguments:
        plugin_ctx -- a controller.PluginCtx instance
        auth -- an auth plug-in instance
        corparch -- a plugins.abstract.corparch.AbstractSearchableCorporaArchive instance
        tag_prefix -- a string determining how a tag (= keyword or label) is recognized
        """
        self._plugin_ctx = plugin_ctx
        self._auth = auth
        self._corparch = corparch
        self._tag_prefix = tag_prefix
        self.SESSION_KEYWORDS_KEY = session_keywords_key
        self.default_label = default_label

    @staticmethod
    def cut_result(res, offset, limit):
        right_lim = offset + int(limit)
        new_res = res[offset:right_lim]
        if right_lim >= len(res):
            right_lim = None
        return new_res, right_lim

    @staticmethod
    def matches_size(d, min_size, max_size):
        item_size = d.get('size', None)
        return (item_size is not None and
                (not min_size or int(item_size) >= int(min_size)) and
                (not max_size or int(item_size) <= int(max_size)))

    def sort(self, plugin_ctx, data, field='name', *fields):
        if field == 'size':
            return sorted(data, key=lambda c: c.get(field, 0), reverse=True)
        else:
            def corp_cmp_key(c, field):
                return c.get(field) if c.get(field) is not None else ''
            return l10n.sort(data, loc=plugin_ctx.user_lang, key=lambda c: corp_cmp_key(c, field))

    def should_fetch_next(self, ans, offset, limit):
        """
        This quite artificial function can be used to optimize loading of a long list.
        It is expected to depend on how the sort() function is implemented.
        In case there is no sorting involved it is probably OK to skip loading
        whole list once all the 'to be displayed' data is ready.
        """
        return True

    def search(self, plugin_ctx, query, offset=0, limit=None, filter_dict=None):
        external_keywords = filter_dict.getlist('keyword')
        external_keywords = self._corparch.map_external_keywords(plugin_ctx, external_keywords)
        if len(external_keywords) != 0:
            query_substrs = []
            query_keywords = external_keywords + [self.default_label]
        else:

            if self.SESSION_KEYWORDS_KEY not in plugin_ctx.session:
                plugin_ctx.session[self.SESSION_KEYWORDS_KEY] = [self.default_label]
            initial_query = query
            if query is False:
                query = ''
            query_substrs, query_keywords = parse_query(self._tag_prefix, query)
            if len(query_keywords) == 0 and initial_query is False:
                query_keywords = plugin_ctx.session[self.SESSION_KEYWORDS_KEY]
            else:
                plugin_ctx.session[self.SESSION_KEYWORDS_KEY] = query_keywords
        query = ' '.join(query_substrs) \
                + ' ' + ' '.join('%s%s' % (self._tag_prefix, s) for s in query_keywords)

        ans = {'rows': []}
        permitted_corpora = self._auth.permitted_corpora(plugin_ctx.user_dict)

        if filter_dict.get('minSize'):
            min_size = l10n.desimplify_num(filter_dict.get('minSize'), strict=False)
        else:
            min_size = 0
        if filter_dict.get('maxSize'):
            max_size = l10n.desimplify_num(filter_dict.get('maxSize'), strict=False)
        else:
            max_size = None

        sorting_field = filter_dict.get('sortBySize', 'name')

        if offset is None:
            offset = 0
        else:
            offset = int(offset)

        if limit is None:
            limit = int(self._corparch.max_page_size)
        else:
            limit = int(limit)

        user_items = self._corparch.user_items.get_user_items(plugin_ctx)

        def fav_id(corpus_id):
            for item in user_items:
                if item.is_single_corpus and item.main_corpus_id == corpus_id:
                    return item.ident
            return None

        query_substrs, query_keywords = parse_query(self._tag_prefix, query)
        all_keywords_map = dict(self._corparch.all_keywords(plugin_ctx))
        normalized_query_substrs = [s.lower() for s in query_substrs]
        used_keywords = set()

        for corp in self._corparch.get_list(plugin_ctx):
            full_data = self._corparch.get_corpus_info(plugin_ctx, corp['id'])
            if not isinstance(full_data, BrokenCorpusInfo):
                keywords = [k for k, _ in full_data.metadata.keywords]
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
                        found_in.append('defaultCorparch__found_in_desc')
                    else:
                        tests.append(False)
                tests.append(self.matches_size(corp, min_size, max_size))
                tests.append(self._corparch.custom_filter(
                    self._plugin_ctx, full_data, permitted_corpora))

                if all(test for test in tests):
                    corp['size'] = corp['size']
                    corp['size_info'] = l10n.simplify_num(corp['size']) if corp['size'] else None
                    corp['keywords'] = []
                    for k in keywords:
                        if k not in all_keywords_map:
                            logging.getLogger(__name__).warning(
                                f'Undefined search keyword {k} (corpus {corp["id"]}')
                            continue
                        corp['keywords'].append((k, all_keywords_map[k]))
                    corp['found_in'] = found_in
                    corp['fav_id'] = fav_id(corp['id'])
                    # because of client-side fav/feat/search items compatibility
                    corp['corpus_id'] = corp['id']
                    corp['pmltq'] = full_data.pmltq
                    corp['repo'] = full_data.web
                    corp['access'] = full_data.access
                    corp['tokenConnect'] = full_data.token_connect.providers
                    ans['rows'].append(corp)
                    used_keywords.update(keywords)
                    if not self.should_fetch_next(ans, offset, limit):
                        break

        ans['rows'], ans['nextOffset'] = self.cut_result(
            self.sort(plugin_ctx, ans['rows'], field=sorting_field), offset, limit)
        ans['keywords'] = l10n.sort(used_keywords, loc=plugin_ctx.user_lang)
        ans['query'] = query
        ans['current_keywords'] = query_keywords
        ans['filters'] = dict(filter_dict)
        return ans


@exposed(return_type='json', access_level=1, skip_corpus_init=True)
def get_favorite_corpora(ctrl, request):
    with plugins.runtime.CORPARCH as ca, plugins.runtime.USER_ITEMS as ui:
        return ca.export_favorite(ctrl._plugin_ctx, ui.get_user_items(ctrl._plugin_ctx))


class CorpusArchive(AbstractSearchableCorporaArchive):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    SORT_ATTRS_KEY = 'sort_attrs'

    FEATURED_KEY = 'featured'

    GROUP_DUPLICATES_KEY = 'group_duplicates'

    LABEL_OVERLAY_TRANSPARENCY = 0.20

    SESSION_KEYWORDS_KEY = 'plugin_lindatcorparch_default_keywords'

    def __init__(
            self, auth, user_items, file_path, root_xpath, tag_prefix, max_num_hints,
            max_page_size, default_label, registry_lang):
        super(CorpusArchive, self).__init__()
        self._auth = auth
        self._user_items = user_items
        self._corplist: Optional[OrderedDict[str, CorpusInfo]] = None
        self.file_path = file_path
        self.root_xpath = root_xpath
        self._tag_prefix = tag_prefix
        self._max_num_hints = int(max_num_hints)
        self._max_page_size = max_page_size
        self._registry_lang = registry_lang
        self._messages = {}
        self._keywords = None  # keyword (aka tags) database for corpora; None = not loaded yet
        self._colors = {}
        self.default_label = default_label
        self._external_keyword_mapping = None

    @property
    def max_page_size(self):
        return self._max_page_size

    def external_keywords_mapping(self, plugin_ctx: PluginCtx):
        if self._external_keyword_mapping is None:
            mapping = {}
            if self._keywords is None:
                self._load(plugin_ctx)
            for label_key in self._keywords:
                for lang_key in self._keywords[label_key]:
                    new_key = self._keywords[label_key][lang_key]
                    mapping[new_key.lower()] = label_key
                mapping[label_key] = label_key
            self._external_keyword_mapping = mapping
        return copy.deepcopy(self._external_keyword_mapping)

    def map_external_keywords(self, plugin_ctx, external_keywords):
        mapping = self.external_keywords_mapping(plugin_ctx)
        mapped = []
        for external_keyword in external_keywords:
            external_keyword = external_keyword.lower()
            if external_keyword in mapping:
                mapped.append(mapping[external_keyword])
        return mapped

    def all_keywords(self, plugin_ctx: PluginCtx):
        ans = []
        if self._keywords is None:
            self._load(plugin_ctx)
        lang_key = self._get_iso639lang(plugin_ctx.user_lang)
        for label_key, item in list(self._keywords.items()):
            if lang_key in item:
                ans.append((label_key, item[lang_key]))
        return ans

    @property
    def user_items(self):
        return self._user_items

    @staticmethod
    def _decode_bool(v):
        ans = False
        if v is not None:
            if v.isdigit():
                ans = bool(int(v))
            elif v.lower() == 'true':
                ans = True
            elif v.lower() == 'false':
                ans = False
        return ans

    def customize_corpus_info(self, corpus_info, node):
        pass

    def get_list(self, plugin_ctx: PluginCtx, user_allowed_corpora=None):
        """
        arguments:
        user_allowed_corpora -- a dict (corpus_id, corpus_variant) containing corpora ids
                                accessible by the current user
        """
        cl = []
        for item in list(self._raw_list(plugin_ctx).values()):
            corp_id, path, web = item.id, item.path, item.sentence_struct
            if user_allowed_corpora is None or corp_id in user_allowed_corpora:
                corp_info = dict(name=corp_id)
                try:
                    corp_info = plugin_ctx.corpus_manager.get_info(corp_id)
                    cl.append({'id': corp_id,
                               'name': corp_info.name,
                               'desc': corp_info.description,
                               'size': corp_info.size,
                               'path': path
                               })
                except Exception as e:
                    logging.getLogger(__name__).warning(
                        f'Failed to fetch info about {corp_info.name} with error {type(e).__name__} ({e})')
                    cl.append({
                        'id': corp_id, 'name': corp_id,
                        'path': path, 'desc': '', 'size': None})
        return cl

    def create_corplist_provider(self, plugin_ctx):
        return DefaultCorplistProvider(plugin_ctx, self._auth, self, self._tag_prefix, self.SESSION_KEYWORDS_KEY,
                                       self.default_label)

    def _get_corplist_title(self, elm, user_lang):
        """
        Returns locale-correct title of a corpus group (= CORPLIST XML element)
        """
        ans = None
        lang = self._get_iso639lang(user_lang) if user_lang else DEFAULT_LANG
        if 'title' in elm.attrib:
            if elm.attrib['title']:
                ans = elm.attrib['title']
            else:
                ans = None
        else:
            titles = elm.findall('title')
            if len(titles) > 0:
                matching = [s.text for s in titles if 'lang' in s.attrib and s.attrib['lang'] == lang]
                if len(matching) > 0:
                    ans = matching[0]
        return ans

    def _parse_meta_desc(self, meta_elm):
        ans = {}

        for elm in meta_elm:
            if elm.tag == 'desc':
                if 'ref' in list(elm.keys()):
                    message_key = elm.attrib['ref']
                    if message_key in self._messages:
                        ans = self._messages[message_key]
                else:
                    lang_code = elm.attrib['lang']
                    ans[lang_code] = markdown(elm.text)
                    if 'ident' in list(elm.keys()):
                        message_key = elm.attrib['ident']
                        if message_key not in self._messages:
                            self._messages[message_key] = {}
                        self._messages[message_key][lang_code] = ans[lang_code]
        return ans

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

    def _parse_keywords(self, root):
        for k in root.findall('./keyword'):
            if k.attrib['ident'] not in self._keywords:
                self._keywords[k.attrib['ident']] = {}
                color_code = k.attrib.get('color')
                if color_code:
                    self._colors[k.attrib['ident']] = self._parse_color(color_code)
            for lab in k.findall('./label'):
                self._keywords[k.attrib['ident']][lab.attrib['lang']] = lab.text

    def _get_corpus_keywords(self, root):
        """
        Returns fixed labels (= keywords) for the corpus. Please
        note that the "favorite" flag is not included here.
        returns:
        OrderedDict(keyword_id => {...keyword labels...})
        """
        ans = OrderedDict()
        for k in root.findall('./keywords/item'):
            keyword = k.text.strip()
            if keyword in self._keywords:
                ans[keyword] = keyword
        return list(ans.items())

    def get_label_color(self, label_id):
        return self._colors.get(label_id, None)

    def _process_corpus_node(self, plugin_ctx: PluginCtx, node, path, data):
        corpus_id = node.attrib['ident'].lower()
        web_url = node.attrib['repo'] if 'repo' in node.attrib else None
        sentence_struct = node.attrib['sentence_struct'] if 'sentence_struct' in node.attrib else None
        parallel = node.attrib['parallel'] if 'parallel' in node.attrib else 'other'
        pmltq = node.attrib['pmltq'] if 'pmltq' in node.attrib else 'no'
        access = [group.strip()
                  for group in node.attrib.get('access', 'anonymous').split(',')]

        ans = self.create_corpus_info()
        ans.id = corpus_id
        ans.name = plugin_ctx.corpus_manager.get_info(ans.id).name
        ans.path = path
        ans.web = web_url
        ans.sentence_struct = sentence_struct
        ans.tagset = node.attrib.get('tagset', None)
        ans.tagset_type = node.attrib.get('tagset', None)
        ans.tagset_pos_attr = node.attrib.get('tagset_pos_attr', None)
        ans.tagset_feat_attr = node.attrib.get('tagset_feat_attr', None)
        ans.speech_segment = node.attrib.get('speech_segment', None)
        ans.speaker_id_attr = node.attrib.get('speaker_id_attr', None)
        ans.speech_overlap_attr = node.attrib.get('speech_overlap_attr', None)
        ans.speech_overlap_val = node.attrib.get('speech_overlap_val', None)
        ans.bib_struct = node.attrib.get('bib_struct', None)
        ans.collator_locale = node.attrib.get('collator_locale', 'en_US')
        ans.sample_size = node.attrib.get('sample_size', -1)
        ans.use_safe_font = self._decode_bool(node.attrib.get('use_safe_font', 'false'))
        ans.parallel = parallel
        ans.pmltq = pmltq
        ans.access = access

        #ref_elm = node.find('reference')
        # if ref_elm is not None:
        #    ans.citation_info.default_ref = translate_markup(getattr(ref_elm.find('default'),
        #                                                             'text', None))
        #    articles = [translate_markup(getattr(x, 'text', None))
        #                for x in ref_elm.findall('article')]
        #    ans.citation_info.article_ref = articles
        #    ans.citation_info.other_bibliography = translate_markup(
        #        getattr(ref_elm.find('other_bibliography'), 'text', None))

        ans.citation_info.default_ref = node.attrib['repo'] if 'repo' in node.attrib else None

        ans.metadata.default_virt_keyboard = node.attrib.get('default_virt_keyboard', None)
        meta_elm = node.find('metadata')
        if meta_elm is not None:
            ans.metadata.database = getattr(meta_elm.find('database'), 'text', None)
            ans.metadata.label_attr = getattr(meta_elm.find('label_attr'), 'text', None)
            ans.metadata.id_attr = getattr(meta_elm.find('id_attr'), 'text', None)
            ans.metadata.sort_attrs = True if meta_elm.find(
                self.SORT_ATTRS_KEY) is not None else False
            # ans.metadata.desc = self._parse_meta_desc(meta_elm)
            ans.metadata.desc = plugin_ctx.corpus_manager.get_info(ans.id).description
            ans.metadata.keywords = self._get_corpus_keywords(meta_elm)
            ans.metadata.featured = True if meta_elm.find(self.FEATURED_KEY) is not None else False
            ans.metadata.group_duplicates = True if meta_elm.find(
                self.GROUP_DUPLICATES_KEY) is not None else False
            ans.metadata.avg_label_attr_len = getattr(
                meta_elm.find('avg_label_attr_len'), 'text', None)
            if ans.metadata.avg_label_attr_len is not None:
                ans.metadata.avg_label_attr_len = int(ans.metadata.avg_label_attr_len)

        token_connect_elm = node.find('token_connect')
        if token_connect_elm is not None:
            ans.token_connect.providers = [(p.text, import_bool(p.attrib.get('is_kwic_view', '0')))
                                           for p in token_connect_elm.findall('provider')]

        kwic_connect_elm = node.find('kwic_connect')
        if kwic_connect_elm is not None:
            ans.kwic_connect.providers = [p.text for p in kwic_connect_elm.findall('provider')]

        query_suggest_elm = node.find('query_suggest')
        if query_suggest_elm is not None:
            ans.query_suggest.providers = [p.text for p in query_suggest_elm.findall('provider')]

        simple_query_default_attrs_elm = node.find('simple_query_default_attrs')
        if simple_query_default_attrs_elm is not None:
            ans.simple_query_default_attrs = [
                p.text for p in simple_query_default_attrs_elm.findall('attribute')]
        else:
            ans.simple_query_default_attrs = []

        self.customize_corpus_info(ans, node)
        data.append(ans)
        return ans

    def _parse_corplist_node(self, plugin_ctx: PluginCtx, root, path, data):
        """
        """
        if not hasattr(root, 'tag') or not root.tag == 'corplist':
            return data
        title = self._get_corplist_title(root, plugin_ctx.user_lang)
        if title:
            path = "%s%s/" % (path, title)
        for item in root:
            if not hasattr(item, 'tag'):  # getting rid of non-elements
                continue
            elif item.tag == 'keywords':
                self._parse_keywords(item)
            elif item.tag == 'corplist':
                self._parse_corplist_node(plugin_ctx, item, path, data)
            elif item.tag == 'corpus':
                self._process_corpus_node(plugin_ctx, item, path, data)

    def _localize_corpus_info(self, plugin_ctx, data, lang_code):
        """
        Updates localized values from data (please note that not all
        the data are localized - e.g. paths to files) by a single variant
        given passed lang_code.
        """
        ans = copy.deepcopy(data)
        lang_code = lang_code.split('_')[0]
        # desc = ans.metadata.desc
        # if lang_code in desc:
        #    ans.metadata.desc = desc[lang_code]
        # else:
        #    ans.metadata.desc = ''

        translated_k = []
        for keyword, label in ans.metadata.keywords:
            translations = self._keywords.get(keyword, {})
            translated_k.append((keyword, translations.get(lang_code, keyword)))
        ans.metadata.keywords = translated_k
        ans.description = plugin_ctx.corpus_manager.get_info(ans.id).description
        return ans

    def get_corpus_info(self, plugin_ctx, corp_name):
        if corp_name:
            # get rid of path-like corpus ID prefix
            corp_name = corp_name.split('/')[-1].lower()
            if corp_name in self._raw_list(plugin_ctx):
                if plugin_ctx.user_lang is not None:
                    ans = self._localize_corpus_info(plugin_ctx,
                                                     self._raw_list(plugin_ctx)[corp_name],
                                                     lang_code=plugin_ctx.user_lang)
                else:
                    ans = self._raw_list(plugin_ctx)[corp_name]
                ans.manatee = plugin_ctx.corpus_manager.get_info(corp_name)
                return ans
            return BrokenCorpusInfo(name=corp_name)
        else:
            return BrokenCorpusInfo()

    def _load(self, plugin_ctx: PluginCtx):
        """
        Loads data from a configuration file
        """
        data = []
        self._keywords = OrderedDict()
        with open(self.file_path) as f:
            xml = etree.parse(f)
            root = xml.find(self.root_xpath)
            if root is not None:
                self._parse_corplist_node(plugin_ctx, root, '/', data)
        self._corplist = OrderedDict([(item.id.lower(), item) for item in data])

    def _raw_list(self, plugin_ctx: PluginCtx):
        """
        Returns list of all defined corpora including all lang. variants of labels etc.
        """
        if self._corplist is None:
            self._load(plugin_ctx)
        return self._corplist

    def _get_iso639lang(self, lang):
        return lang.split('_')[0]

    def _export_untranslated_label(self, plugin_ctx, text):
        if self._registry_lang[:2] == plugin_ctx.user_lang[:2]:
            return text
        else:
            return '{0} [{1}]'.format(text, _('translation not available'))

    def _export_featured(self, plugin_ctx: PluginCtx):
        permitted_corpora = self._auth.permitted_corpora(plugin_ctx.user_dict)

        def is_featured(o: CorpusInfo):
            return o.metadata.featured

        cm = plugin_ctx.corpus_manager
        featured = []
        for x in list(self._raw_list(plugin_ctx).values()):
            if x.id in permitted_corpora and is_featured(x):
                featured.append({
                    # on client-side, this may contain also subc. id, aligned ids
                    'id': x.id,
                    'corpus_id': x.id,
                    'name': cm.get_info(x.id).name,
                    'size': cm.get_info(x.id).size,
                    'size_info': l10n.simplify_num(cm.get_info(x.id).size),
                    'description': self._export_untranslated_label(plugin_ctx, cm.get_info(x.id).description)})
        return featured

    def export_favorite(self, plugin_ctx: PluginCtx, favitems):
        ans = []
        for item in favitems:
            tmp = item.to_dict()
            tmp['description'] = self._export_untranslated_label(
                plugin_ctx, plugin_ctx.corpus_manager.get_info(item.main_corpus_id).description)
            ans.append(tmp)
        return ans

    def export(self, plugin_ctx):
        initial_keywords = plugin_ctx.session.get(self.SESSION_KEYWORDS_KEY, [self.default_label])
        external_keywords = plugin_ctx.request.args.getlist('keyword')
        mapped_external_keywords = self.map_external_keywords(plugin_ctx, external_keywords)
        if len(mapped_external_keywords) != 0:
            initial_keywords.extend(mapped_external_keywords)

        return dict(
            favorite=self.export_favorite(plugin_ctx, self._user_items.get_user_items(plugin_ctx)),
            featured=self._export_featured(plugin_ctx),
            corpora_labels=[(k, lab, self.get_label_color(k))
                            for k, lab in self.all_keywords(plugin_ctx)],
            initial_keywords=initial_keywords,
            tag_prefix=self._tag_prefix,
            max_num_hints=self._max_num_hints
        )

    def initial_search_params(self, plugin_ctx, query, filter_dict=None):
        query_substrs, query_keywords = parse_query(self._tag_prefix, query)
        all_keywords = self.all_keywords(plugin_ctx)
        exp_keywords = [(k, lab, k in query_keywords, self.get_label_color(k))
                        for k, lab in all_keywords]
        return {
            'keywords': exp_keywords,
            'filters': {
                'maxSize': filter_dict.getlist('maxSize'),
                'minSize': filter_dict.getlist('minSize'),
                'name': query_substrs,
                'sortBySize': 'name'
            }
        }

    def export_actions(self):
        return {actions.user.User: [get_favorite_corpora]}


@inject(plugins.runtime.AUTH, plugins.runtime.USER_ITEMS)
def create_instance(conf, auth, user_items):
    """
    Interface function called by KonText creates new plugin instance
    """
    return CorpusArchive(
        auth=auth,
        user_items=user_items,
        file_path=conf.get('plugins', 'corparch')['file'],
        root_xpath=conf.get('plugins', 'corparch')['root_elm_path'],
        tag_prefix=conf.get('plugins', 'corparch')['tag_prefix'],
        max_num_hints=conf.get('plugins', 'corparch')['max_num_hints'],
        max_page_size=conf.get('plugins', 'corparch').get('default_page_list_size', DEFAULT_PAGE_LIST_SIZE),
        default_label=conf.get('plugins', 'corparch')['default_label'],
        registry_lang=conf.get('corpora', 'manatee_registry_locale', 'en_US'))
