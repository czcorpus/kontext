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
Required config.xml/plugins entries:

<corptree>
    <module>corptree</module>
    <file>[a path to a configuration XML file]</file>
    <root_elm_path>[an XPath query leading to a root element where configuration can be found]</root_elm_path>
</corptree>
"""

from collections import OrderedDict
import copy

try:
    from markdown import markdown
except ImportError:
    markdown = lambda s: s
from lxml import etree

from plugins.abstract.corpora import AbstractCorporaArchive
from l10n import import_string
import manatee

DEFAULT_LANG = 'en'


def translate_markup(s):
    """
    Transforms markdown markup into HTML
    """
    if not s:
        return None
    return markdown(s.strip())


def call_controller(controller_obj, method, *args, **kwargs):
    return apply(getattr(controller_obj, method), args, kwargs)


class CorpTree(AbstractCorporaArchive):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    DEFAULT_FEATURED_KEY = 'featured'
    DEFAULT_FAVORITE_KEY = 'favorite'

    def __init__(self, file_path, root_xpath):
        super(CorpTree, self).__init__(('lang', 'featured_corpora'))  # <- thread local attributes
        self._corplist = None
        self.file_path = file_path
        self.root_xpath = root_xpath
        self._messages = {}
        self._keywords = OrderedDict()  # keyword (aka tags) database for corpora
        self._featured_keyword = None  # a keyword representing "featured" corpora
        self._favorite_keyword = None  # a keyword representing user's "favorite" corpora

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
        if self.DEFAULT_FEATURED_KEY in root.attrib:
            self._featured_keyword = root.attrib[self.DEFAULT_FEATURED_KEY]
        else:
            self._featured_keyword = self.DEFAULT_FEATURED_KEY

        if self.DEFAULT_FAVORITE_KEY in root.attrib:
            self._favorite_keyword = root.attrib[self.DEFAULT_FAVORITE_KEY]
        else:
            self._favorite_keyword = self.DEFAULT_FAVORITE_KEY

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

    def get_all_corpus_keywords(self):
        def encode_prop(l_key):
            if self._keyword_is_featured(l_key, localized=False):
                return 1
            elif self.keyword_is_favorite(l_key, localized=False):
                return 2
            else:
                return 0
        ans = []
        lang_key = self._get_iso639lang()
        for label_key, item in self._keywords.items():
            if lang_key in item:
                ans.append((item[lang_key], encode_prop(label_key)))
        return ans

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
                corpus_id = item.attrib['ident'].lower()
                web_url = item.attrib['web'] if 'web' in item.attrib else None
                sentence_struct = item.attrib['sentence_struct'] if 'sentence_struct' in item.attrib else None

                ans = {
                    'id': corpus_id,
                    'path': path,
                    'web': web_url,
                    'sentence_struct': sentence_struct,
                    'tagset': item.attrib.get('tagset', None),
                    'speech_segment': item.attrib.get('speech_segment', None),
                    'bib_struct': item.attrib.get('bib_struct', None),
                    'citation_info': {'default_ref': None, 'article_ref': None, 'other_bibliography': None},
                    'metadata': {'database': None, 'label_attr': None, 'id_attr': None, 'desc': {}, 'keywords': {}}
                }

                ref_elm = item.find('reference')
                if ref_elm is not None:
                    ans['citation_info']['default_ref'] = translate_markup(getattr(ref_elm.find('default'),
                                                                                   'text', None))
                    articles = [translate_markup(getattr(x, 'text', None)) for x in ref_elm.findall('article')]
                    ans['citation_info']['article_ref'] = articles
                    ans['citation_info']['other_bibliography'] = translate_markup(
                        getattr(ref_elm.find('other_bibliography'), 'text', None))

                meta_elm = item.find('metadata')
                if meta_elm is not None:
                    ans['metadata']['database'] = getattr(meta_elm.find('database'), 'text', None)
                    ans['metadata']['label_attr'] = getattr(meta_elm.find('label_attr'), 'text', None)
                    ans['metadata']['id_attr'] = getattr(meta_elm.find('id_attr'), 'text', None)
                    ans['metadata']['desc'] = self._parse_meta_desc(meta_elm)
                    ans['metadata']['keywords'] = self._get_corpus_keywords(meta_elm)
                data.append(ans)

    def _keyword_is_featured(self, keyword_ident, localized=False):
        if not localized:
            return keyword_ident == self._featured_keyword
        return self._keywords[self._featured_keyword][self._get_iso639lang()] == keyword_ident

    def keyword_is_favorite(self, keyword_ident, localized=False):
        if not localized:
            return keyword_ident == self._favorite_keyword
        return self._keywords[self._favorite_keyword][self._get_iso639lang()] == keyword_ident

    @staticmethod
    def _localize_corpus_info(data, lang_code):
        """
        Updates localized values from data (please note that not all
        the data are localized - e.g. paths to files) by a single variant
        given passed lang_code.
        """
        ans = copy.deepcopy(data)
        lang_code = lang_code.split('_')[0]
        desc = ans['metadata']['desc']
        if lang_code in desc:
            ans['metadata']['desc'] = desc[lang_code]
        else:
            ans['metadata']['desc'] = ''

        translated_k = OrderedDict()
        for keyword, label in ans['metadata']['keywords'].items():
            if type(label) is dict and lang_code in label:
                translated_k[keyword] = label[lang_code]
            elif type(label) is str:
                translated_k[keyword] = label
        ans['metadata']['keywords'] = translated_k
        return ans

    def get_corpus_info(self, corp_name, language=None):
        if corp_name != '':
            # get rid of path-like corpus ID prefix
            corp_name = corp_name.split('/')[-1].lower()
            if corp_name in self._raw_list():
                if language is not None:
                    return self._localize_corpus_info(self._raw_list()[corp_name], lang_code=language)
                else:
                    return self._raw_list()[corp_name]
            raise ValueError('Missing configuration data for %s' % corp_name)
        else:
            return {'metadata': {}}  # for 'empty' corpus to work properly

    def _load(self):
        """
        Loads data from a configuration file
        """
        data = []
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
                corp_name = None
                try:
                    corp_id = user_allowed_corpora[canonical_id]
                    corp = manatee.Corpus(corp_id)
                    corp_name = corp.get_conf('NAME') if corp.get_conf('NAME') else canonical_id
                    corp_info = corp.get_info()
                    corp_encoding = corp.get_conf('ENCODING')

                    cl.append({'id': corp_id,
                               'canonical_id': canonical_id,
                               'name': import_string(corp_name, from_encoding=corp_encoding),
                               'desc': import_string(corp_info, from_encoding=corp_encoding),
                               'size': corp.size(),
                               'path': path
                               })
                except Exception, e:
                    import logging
                    logging.getLogger(__name__).warn(
                        u'Failed to fetch info about %s with error %s (%r)' % (corp_name,
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

    def export(self, *args):
        is_featured = lambda o: CorpTree.DEFAULT_FEATURED_KEY in o['metadata'].get('keywords', {})
        return {'featured': [(x['id'], x.get('name', x['id']))
                             for x in self._raw_list().values() if is_featured(x)]}


def create_instance(conf):
    """
    Interface function called by KonText creates new plugin instance
    """
    return CorpTree(file_path=conf.get('plugins', 'corptree')['file'],
                    root_xpath=conf.get('plugins', 'corptree')['root_elm_path'])