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

import threading
from collections import OrderedDict

try:
    from markdown import markdown
except ImportError:
    markdown = lambda s: s
from lxml import etree


thread_local = threading.local()
thread_local.lang = 'en'  # default language must be set
thread_local.corplist = OrderedDict()


def translate_markup(s):
    """
    Transforms markdown markup into HTML
    """
    if not s:
        return None
    return markdown(s.strip())


class CorpTree(object):
    """
    Loads and provides access to a hierarchical list of corpora
    defined in XML format
    """

    def __init__(self, file_path, root_xpath):
        self.file_path = file_path
        self.root_xpath = root_xpath
        self._messages = {}
        self._keywords = {}  # keyword (aka tags) database for corpora
        self._featured_keywords = set()  # keywords with specific promotion (e.g. "featured corpora")
        self._favorite_keywords = set()  # keywords understood as user favorite access "labels/tags"

    def get_corplist_title(self, elm):
        """
        Returns locale-correct title of a corpus group (= CORPLIST XML element)
        """
        ans = None

        if self._lang():
            lang = self._lang().split('_')[0]
        else:
            lang = 'en'
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
            if 'type' in k.attrib:
                if k.attrib['type'] == 'featured':
                    self._featured_keywords.add(k.attrib['ident'])
                elif k.attrib['type'] == 'favorite':
                    self._favorite_keywords.add(k.attrib['ident'])
            for lab in k.findall('./label'):
                self._keywords[k.attrib['ident']][lab.attrib['lang']] = lab.text

    def _get_corpus_keywords(self, root):
        """
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

    def get_all_corpus_keywords(self, lang):
        """
        returns:
        list of 2-tuples (localized_label, spec_prop)
        where spec_prop is int such as that:
        0 - no special property
        1 - featured label
        2 - favorite label
        """
        def encode_prop(l_key):
            if self.keyword_is_featured(l_key):
                return 1
            elif self.keyword_is_favorite(l_key):
                return 2
            else:
                return 0
        ans = set()
        lang_key = lang.split('_')[0]
        for label_key, item in self._keywords.items():
            if lang_key in item:
                ans.add((item[lang_key], encode_prop(label_key)))
        return list(ans)

    def _parse_corplist_node(self, root, data, path='/'):
        """
        """
        if not hasattr(root, 'tag') or not root.tag == 'corplist':
            return data
        title = self.get_corplist_title(root)
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
                web_url = item.attrib['web'] if 'web' in item.attrib else None
                sentence_struct = item.attrib['sentence_struct'] if 'sentence_struct' in item.attrib else None

                ans = {
                    'id': item.attrib['ident'].lower(),
                    'path': path,
                    'web': web_url,
                    'sentence_struct': sentence_struct,
                    'tagset': item.attrib.get('tagset', None),
                    'speech_segment': item.attrib.get('speech_segment', None),
                    'bib_struct': item.attrib.get('bib_struct', None),
                    'citation_info': {'default_ref': None, 'article_ref': None, 'other_bibliography': None},
                    'metadata': {'database': None, 'label_attr': None, 'id_attr': None, 'desc': {}, 'keywords': {},
                                 'featured': False}
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

    def keyword_is_featured(self, keyword_ident):
        return keyword_ident in self._featured_keywords

    def keyword_is_favorite(self, keyword_ident):
        return keyword_ident in self._favorite_keywords

    def _localize_corpus_info(self, data, lang_code):
        """
        Updates localized values from data (please note that not all
        the data are localized - e.g. paths to files) by a single variant
        given passed lang_code.
        """
        ans = {}
        ans.update(data)

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
        """
        Returns an information related to provided corpus name and contained within
        the configuration XML file (i.e. not the data from the registry file). It is
        able to handle names containing the '/' character.

        arguments:
        corp_name -- name of the corpus
        language -- a language to export localized data to; both xx_YY and xx variants are
                    accepted (in case there is no match for xx_YY xx is used).
                    If None then all the variants are returned (=> slightly different structure
                    of returned dictionary; typically - instead of a str value there is a dict
                    where keys correspond to language codes).

        returns:
        a dictionary containing corpus information as defined in config.xml (i.e. <corpus> tag
        and its attributes and also its subtree (e.g. <metadata> tag).
        See self._parse_corplist_node method for the information how data is organized in the
        dictionary.
        """
        if corp_name != '':
            # get rid of path-like corpus ID prefix
            corp_name = corp_name.split('/')[-1].lower()
            if corp_name in self._list():
                if language is not None:
                    return self._localize_corpus_info(self._list()[corp_name], lang_code=language)
                else:
                    return self._list()[corp_name]
            raise ValueError('Missing configuration data for %s' % corp_name)
        else:
            return {'metadata': {}}  # for 'empty' corpus to work properly

    def _load(self, force_load=False):
        """
        Loads data from a configuration file
        """
        if len(self._list()) == 0 or force_load:
            data = []
            with open(self.file_path) as f:
                xml = etree.parse(f)
                root = xml.find(self.root_xpath)
                if root is not None:
                    self._parse_corplist_node(root, data, path='/')
            self._list([(item['id'].lower(), item) for item in data])

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
            return thread_local.lang
        else:
            thread_local.lang = v

    def _list(self, v=None):
        """
        Sets or gets parsed data list.

        arguments:
        v -- (optional) if not None then current corpus list is set to the passed value else current
        list is returned

        returns:
        current corpus list if called in 'get mode'
        """
        if not hasattr(thread_local, 'corplist'):
            thread_local.corplist = OrderedDict()
        if v is None:
            return thread_local.corplist
        else:
            thread_local.corplist = OrderedDict(v)

    def get(self):
        """
        Returns corpus tree data
        """
        return self._list().values()

    def setup(self, **kwargs):
        """
        Interface method expected by KonText if a module wants to be set-up by
        some "late" information (like locales).

        Please note that each request calls this method on the same instance
        which means that any client-specific data must be thread-local.
        """
        self._lang(kwargs.get('lang', None))
        self._load()


def create_instance(conf):
    """
    Interface function called by KonText creates new plugin instance
    """
    return CorpTree(file_path=conf.get('plugins', 'corptree')['file'],
                    root_xpath=conf.get('plugins', 'corptree')['root_elm_path'])