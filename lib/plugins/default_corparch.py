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


Required config.xml/plugins entries:

<corparch>
    <module>corparch</module>
    <file>[a path to a configuration XML file]</file>
    <root_elm_path>
        [an XPath query leading to a root element where configuration can be found]
    </root_elm_path>
    <tag_prefix extension-by="default">
        [a spec. character specifying that the following string is a tag/label]
    </tag_prefix>
    <max_num_hints>
        [the maximum number of hints corpus selection widget shows (even if there are more results
         available]
    </max_num_hints>
</corparch>

How does the corpus list specification XML entry looks like:

<a_root_elm>
  <corpus sentence_struct="p" ident="SUSANNE" collator_locale="cs_CZ" tagset="pp_tagset"
      web="http://www.korpus.cz/syn2010.php">
    <metadata>
      <featured />
      <keywords>
        <item>foreign_language_corpora</item>
        <item>written_corpora</item>
      </keywords>
    </metadata>
  </corpus>
   ...
</a_root_elm>

"""

from collections import OrderedDict
import copy
import re
from functools import partial

try:
    from markdown import markdown
except ImportError:
    markdown = lambda s: s
from lxml import etree

from plugins.abstract.corpora import AbstractSearchableCorporaArchive
from plugins.abstract.corpora import CorpusInfo, BrokenCorpusInfo
from plugins.abstract.user_items import CorpusItem
from plugins import inject
import l10n
import manatee
from fallback_corpus import EmptyCorpus
from translation import ugettext as _

DEFAULT_LANG = 'en'


def translate_markup(s):
    """
    Transforms markdown markup into HTML
    """
    if not s:
        return None
    return markdown(s.strip())


class ManateeCorpusInfo(object):
    def __init__(self, corpus, canonical_id):
        self.encoding = corpus.get_conf('ENCODING')
        import_string = partial(l10n.import_string, from_encoding=self.encoding)
        self.name = import_string(corpus.get_conf('NAME') if corpus.get_conf('NAME')
                                  else canonical_id)
        self.description = import_string(corpus.get_info())
        self.size = corpus.size()


class ManateeCorpora(object):
    def __init__(self):
        self._cache = {}

    def get_info(self, canonical_corpus_id):
        try:
            if canonical_corpus_id not in self._cache:
                self._cache[canonical_corpus_id] = ManateeCorpusInfo(
                    manatee.Corpus(canonical_corpus_id), canonical_corpus_id)
            return self._cache[canonical_corpus_id]
        except:
            # probably a misconfigured/missing corpus
            return ManateeCorpusInfo(EmptyCorpus(corpname=canonical_corpus_id),
                                     canonical_corpus_id)


class CorpTree(AbstractSearchableCorporaArchive):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    FEATURED_KEY = 'featured'
    FAVORITE_KEY = 'favorite'

    def __init__(self, auth, user_items, file_path, root_xpath, tag_prefix, max_num_hints,
                 max_page_size):
        super(CorpTree, self).__init__(('lang', 'featured_corpora'))  # <- thread local attributes
        self._auth = auth
        self._user_items = user_items
        self._corplist = None
        self.file_path = file_path
        self.root_xpath = root_xpath
        self._tag_prefix = tag_prefix
        self._max_num_hints = int(max_num_hints)
        self._max_page_size = max_page_size
        self._messages = {}
        self._keywords = None  # keyword (aka tags) database for corpora; None = not loaded yet
        self._manatee_corpora = ManateeCorpora()

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

    def _get_corplist_title(self, elm):
        """
        Returns locale-correct title of a corpus group (= CORPLIST XML element)
        """
        ans = None

        if self._lang():
            lang = self._get_iso639lang()
        else:
            lang = DEFAULT_LANG
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
                if 'ref' in elm.keys():
                    message_key = elm.attrib['ref']
                    if message_key in self._messages:
                        ans = self._messages[message_key]
                else:
                    lang_code = elm.attrib['lang']
                    ans[lang_code] = markdown(elm.text)
                    if 'ident' in elm.keys():
                        message_key = elm.attrib['ident']
                        if message_key not in self._messages:
                            self._messages[message_key] = {}
                        self._messages[message_key][lang_code] = ans[lang_code]
        return ans

    def _parse_keywords(self, root):
        for k in root.findall('./keyword'):
            if k.attrib['ident'] not in self._keywords:
                self._keywords[k.attrib['ident']] = {}
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
                if self._keywords[keyword]:
                    ans[keyword] = self._keywords[keyword]
                else:
                    ans[keyword] = keyword
        return ans

    @property
    def all_keywords(self):
        ans = []
        if self._keywords is None:
            self._load()
        lang_key = self._get_iso639lang()
        for label_key, item in self._keywords.items():
            if lang_key in item:
                ans.append((label_key, item[lang_key]))
        return ans

    def _process_corpus_node(self, node, path, data):
        corpus_id = node.attrib['ident'].lower()
        web_url = node.attrib['web'] if 'web' in node.attrib else None
        sentence_struct = node.attrib['sentence_struct'] if 'sentence_struct' in node.attrib else None

        ans = self.create_corpus_info()
        ans.id = corpus_id
        ans.path = path
        ans.web = web_url
        ans.sentence_struct = sentence_struct
        ans.tagset = node.attrib.get('tagset', None)
        ans.speech_segment = node.attrib.get('speech_segment', None)
        ans.bib_struct = node.attrib.get('bib_struct', None)
        ans.collator_locale = node.attrib.get('collator_locale', 'en_US')
        ans.sample_size = node.attrib.get('sample_size', -1)
        self.customize_corpus_info(ans, node)

        ref_elm = node.find('reference')
        if ref_elm is not None:
            ans.citation_info.default_ref = translate_markup(getattr(ref_elm.find('default'),
                                                                     'text', None))
            articles = [translate_markup(getattr(x, 'text', None)) for x in ref_elm.findall('article')]
            ans.citation_info.article_ref = articles
            ans.citation_info.other_bibliography = translate_markup(
                getattr(ref_elm.find('other_bibliography'), 'text', None))

        meta_elm = node.find('metadata')
        if meta_elm is not None:
            ans.metadata.database = getattr(meta_elm.find('database'), 'text', None)
            ans.metadata.label_attr = getattr(meta_elm.find('label_attr'), 'text', None)
            ans.metadata.id_attr = getattr(meta_elm.find('id_attr'), 'text', None)
            ans.metadata.desc = self._parse_meta_desc(meta_elm)
            ans.metadata.keywords = self._get_corpus_keywords(meta_elm)
            ans.metadata.featured = True if meta_elm.find(self.FEATURED_KEY) is not None else False
        data.append(ans)

    def _parse_corplist_node(self, root, data, path='/'):
        """
        """
        if not hasattr(root, 'tag') or not root.tag == 'corplist':
            return data
        title = self._get_corplist_title(root)
        if title:
            path = "%s%s/" % (path, title)
        for item in root:
            if not hasattr(item, 'tag'):  # getting rid of non-elements
                continue
            elif item.tag == 'keywords':
                self._parse_keywords(item)
            elif item.tag == 'corplist':
                self._parse_corplist_node(item, data, path)
            elif item.tag == 'corpus':
                self._process_corpus_node(item, path, data)

    @staticmethod
    def _localize_corpus_info(data, lang_code):
        """
        Updates localized values from data (please note that not all
        the data are localized - e.g. paths to files) by a single variant
        given passed lang_code.
        """
        ans = copy.deepcopy(data)
        lang_code = lang_code.split('_')[0]
        desc = ans.metadata.desc
        if lang_code in desc:
            ans.metadata.desc = desc[lang_code]
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

    def get_corpus_info(self, corp_name, language=None):
        if corp_name:
            # get rid of path-like corpus ID prefix
            corp_name = corp_name.split('/')[-1].lower()
            if corp_name in self._raw_list():
                if language is not None:
                    return self._localize_corpus_info(self._raw_list()[corp_name],
                                                      lang_code=language)
                else:
                    return self._raw_list()[corp_name]
            raise ValueError('Missing configuration data for %s' % corp_name)
        else:
            return BrokenCorpusInfo()

    def _load(self):
        """
        Loads data from a configuration file
        """
        data = []
        self._keywords = OrderedDict()
        with open(self.file_path) as f:
            xml = etree.parse(f)
            root = xml.find(self.root_xpath)
            if root is not None:
                self._parse_corplist_node(root, data, path='/')
        self._corplist = OrderedDict([(item['id'].lower(), item) for item in data])

    def _raw_list(self):
        """
        Returns list of all defined corpora including all lang. variants of labels etc.
        """
        if self._corplist is None:
            self._load()
        return self._corplist

    def _lang(self, v=None):
        """
        Sets or gets UI language. Values are stored in a thread-local storage so
        its ok to serve many clients with different languages via a single plug-in
        instance.

        arguments:
        v -- (optional) if not None then current language is set to [v] else current
        language is returned

        returns:
        current language if called in 'get mode'
        """
        if v is None:
            if not self.haslocal('lang'):
                self.setlocal('lang', DEFAULT_LANG)
            return self.getlocal('lang')
        else:
            self.setlocal('lang', v)

    def _get_iso639lang(self):
        return self._lang().split('_')[0]

    def get_list(self, user_allowed_corpora):
        """
        arguments:
        user_allowed_corpora -- a dict (corpus_canonical_id, corpus_id) containing corpora ids
                                accessible by the current user
        """
        simple_names = set(user_allowed_corpora.keys())
        cl = []
        for item in self._raw_list().values():
            canonical_id, path, web = item['id'], item['path'], item['sentence_struct']
            if canonical_id in simple_names:
                try:
                    corp_id = user_allowed_corpora[canonical_id]
                    corp_info = self._manatee_corpora.get_info(corp_id)
                    cl.append({'id': corp_id,
                               'canonical_id': canonical_id,
                               'name': l10n.import_string(corp_info.name,
                                                          from_encoding=corp_info.encoding),
                               'desc': l10n.import_string(corp_info.description,
                                                          from_encoding=corp_info.encoding),
                               'size': corp_info.size,
                               'path': path
                               })
                except Exception, e:
                    import logging
                    logging.getLogger(__name__).warn(
                        u'Failed to fetch info about %s with error %s (%r)' % (corp_info.name,
                                                                               type(e).__name__, e))
                    cl.append({
                        'id': corp_id, 'canonical_id': canonical_id, 'name': corp_id,
                        'path': path, 'desc': '', 'size': None})
        return cl

    def setup(self, controller_obj):
        """
        Interface method expected by KonText if a module wants to be set-up by
        some "late" information (like locales).

        Please note that each request calls this method on the same instance
        which means that any client-specific data must be thread-local.
        """
        self._lang(getattr(controller_obj, 'ui_lang', None))

    def _export_featured(self, user_id):
        permitted_corpora = self._auth.permitted_corpora(user_id)
        is_featured = lambda o: o['metadata'].get('featured', False)
        featured = []
        for x in self._raw_list().values():
            if x['id'] in permitted_corpora and is_featured(x):
                featured.append({
                    'id': permitted_corpora[x['id']],
                    'name': self._manatee_corpora.get_info(x['id']).name,
                    'size': l10n.simplify_num(self._manatee_corpora.get_info(x['id']).size),
                    'description': self._manatee_corpora.get_info(x['id']).description
                })
        return featured

    def export(self, user_id, *args):
        return {
            'featured': self._export_featured(user_id),
            'corpora_labels': self.all_keywords,
            'tag_prefix': self._tag_prefix,
            'max_num_hints': self._max_num_hints
        }

    def _parse_query(self, query):
        if query is not None:
            tokens = re.split(r'\s+', query.strip())
        else:
            tokens = []
        query_keywords = []
        substrs = []
        for t in tokens:
            if len(t) > 0:
                if t[0] == self._tag_prefix:
                    query_keywords.append(t[1:])
                else:
                    substrs.append(t)
        return substrs, query_keywords

    def customize_search_result_item(self, item, full_data):
        pass

    def search(self, user_id, query, offset=0, limit=None, filter_dict=None):
        ans = {'rows': []}
        permitted_corpora = self._auth.permitted_corpora(user_id)
        user_items = self._user_items.get_user_items(user_id)
        used_keywords = set()
        all_keywords_map = dict(self.all_keywords)
        if filter_dict.get('minSize'):
            min_size = l10n.desimplify_num(filter_dict.get('minSize'), strict=False)
        else:
            min_size = 0
        if filter_dict.get('maxSize'):
            max_size = l10n.desimplify_num(filter_dict.get('maxSize'), strict=False)
        else:
            max_size = None
        corplist = self.get_list(permitted_corpora)

        if offset is None:
            offset = 0
        else:
            offset = int(offset)

        if limit is None:
            limit = self._max_page_size

        def cut_result(res):
            if limit is not None:
                right_lim = offset + int(limit)
                new_res = res[offset:right_lim]
                if right_lim >= len(res):
                    right_lim = None
            else:
                right_lim = None
                new_res = res
            return new_res, right_lim

        def is_fav(corpus_id):
            for item in user_items:
                if isinstance(item, CorpusItem) and item.corpus_id == corpus_id:
                    return True
            return False

        query_substrs, query_keywords = self._parse_query(query)
        matches_all = lambda d: reduce(lambda prev, curr: prev and curr, d, True)

        def matches_size(d):
            item_size = d.get('size', None)
            return (item_size is not None and
                    (not min_size or int(item_size) >= int(min_size)) and
                    (not max_size or int(item_size) <= int(max_size)))

        normalized_query_substrs = [s.lower() for s in query_substrs]

        for corp in corplist:
            full_data = self.get_corpus_info(corp['id'], self.getlocal('lang'))
            if not isinstance(full_data, BrokenCorpusInfo):
                keywords = [k for k in full_data['metadata']['keywords'].keys()]
                hits = []
                found_in = []

                hits.extend([k in keywords for k in query_keywords])
                for s in normalized_query_substrs:
                    # the name must be tested first to prevent the list 'found_in'
                    # to be filled in case item matches both name and description
                    if s in corp['name'].lower():
                        hits.append(True)
                    elif s in (corp['desc'].lower() if corp['desc'] else ''):
                        hits.append(True)
                        found_in.append(_('description'))
                    else:
                        hits.append(False)
                hits.append(matches_size(corp))
                hits.append(self.custom_filter(full_data, permitted_corpora))

                if matches_all(hits):
                    corp['raw_size'] = l10n.simplify_num(corp['size']) if corp['size'] else None
                    corp['keywords'] = [(k, all_keywords_map[k]) for k in keywords]
                    corp['found_in'] = found_in
                    corp['user_item'] = is_fav(corp['id'])
                    self.customize_search_result_item(corp, full_data)
                    ans['rows'].append(corp)
                    used_keywords.update(keywords)

        corp_cmp_key = lambda c: c.get('name') if c.get('name') is not None else ''
        ans['rows'], ans['nextOffset'] = cut_result(l10n.sort(ans['rows'], loc=self._lang(),
                                                              key=corp_cmp_key))
        ans['keywords'] = l10n.sort(used_keywords, loc=self._lang())
        ans['query'] = query
        ans['filters'] = dict(filter_dict)
        return ans

    def initial_search_params(self, query, filter_dict=None):
        query_substrs, query_keywords = self._parse_query(query)
        all_keywords = self.all_keywords
        exp_keywords = [(k, lab, k in query_keywords) for k, lab in all_keywords]
        return {
            'keywords': exp_keywords,
            'currKeywords': [],  # TODO
            'filters': {
                'maxSize': filter_dict.getlist('maxSize'),
                'minSize': filter_dict.getlist('minSize')
            }
        }


@inject('auth', 'user_items')
def create_instance(conf, auth, user_items):
    """
    Interface function called by KonText creates new plugin instance
    """
    return CorpTree(auth=auth,
                    user_items=user_items,
                    file_path=conf.get('plugins', 'corparch')['file'],
                    root_xpath=conf.get('plugins', 'corparch')['root_elm_path'],
                    tag_prefix=conf.get('plugins', 'corparch')['default:tag_prefix'],
                    max_num_hints=conf.get('plugins', 'corparch')['default:max_num_hints'],
                    max_page_size=conf.get('plugins', 'corparch').get(
                        'default:default_page_list_size', None))
